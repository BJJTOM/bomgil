from decimal import Decimal

from django.db.models import F
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from apps.spots.serializers import SpotSerializer
from config.permissions import IsOwnerOrReadOnly
from config.throttles import TrailCreateThrottle
from config.validators import validate_image_file

from .models import (
    Tag,
    Trail,
    TrailBookmark,
    TrailCompletion,
    TrailCondition,
    TrailLike,
    TrailSeries,
)
from .serializers import (
    TagSerializer,
    TrailBookmarkSerializer,
    TrailCompletionSerializer,
    TrailConditionCreateSerializer,
    TrailConditionSerializer,
    TrailCreateSerializer,
    TrailDetailSerializer,
    TrailListSerializer,
    TrailSeriesDetailSerializer,
    TrailSeriesListSerializer,
)


class TrailLikeThrottle(UserRateThrottle):
    scope = "trail_like"
    rate = "200/hour"


class TrailBookmarkThrottle(UserRateThrottle):
    scope = "trail_bookmark"
    rate = "200/hour"


class TrailUpdateThrottle(UserRateThrottle):
    scope = "trail_update"
    rate = "60/hour"


class TrailViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    filterset_fields = [
        "region", "country", "difficulty", "best_season", "status", "tags",
        "is_official", "trail_type",
    ]
    search_fields = ["title", "description", "region", "tags__name", "tags__name_en"]
    ordering_fields = ["created_at", "like_count", "distance_km"]
    ordering = ["-created_at"]

    def get_throttles(self):
        if self.action == "create":
            return [TrailCreateThrottle()]
        if self.action in ("update", "partial_update", "destroy"):
            return [TrailUpdateThrottle()]
        if self.action == "like":
            return [TrailLikeThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        qs = Trail.objects.select_related("author").prefetch_related("tags")
        is_staff = self.request.user.is_authenticated and self.request.user.is_staff

        # Admin moderation: hidden trails are invisible to everyone except staff.
        if not is_staff:
            qs = qs.filter(is_hidden=False)

        if self.action == "list":
            # 일반 유저는 approved만, 관리자는 status 필터 가능
            if not is_staff:
                qs = qs.filter(status="approved")
            # Category filters (time / distance) via query params
            # These map user-facing buckets to ranges on estimated_minutes
            # and distance_km. Kept here instead of filterset so the bucket
            # labels ("short", "half", "full") can stay stable in the UI
            # even if the underlying thresholds change.
            time_bucket = self.request.query_params.get("time_bucket")
            if time_bucket == "short":  # up to 1 hour
                qs = qs.filter(estimated_minutes__lte=60)
            elif time_bucket == "half":  # 1–4 hours
                qs = qs.filter(estimated_minutes__gt=60, estimated_minutes__lte=240)
            elif time_bucket == "full":  # 4+ hours
                qs = qs.filter(estimated_minutes__gt=240)
        elif self.action == "retrieve":
            # 상세 보기는 approved이거나 작성자 본인 (또는 staff)
            if is_staff:
                pass
            elif self.request.user.is_authenticated:
                from django.db.models import Q
                qs = qs.filter(
                    Q(status="approved") | Q(author=self.request.user)
                )
            else:
                qs = qs.filter(status="approved")
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return TrailListSerializer
        if self.action in ("create", "update", "partial_update"):
            return TrailCreateSerializer
        return TrailDetailSerializer

    def perform_create(self, serializer):
        cover = self.request.FILES.get("cover_image")
        if cover is not None:
            validate_image_file(cover)
        serializer.save(author=self.request.user)

    def perform_update(self, serializer):
        cover = self.request.FILES.get("cover_image")
        if cover is not None:
            validate_image_file(cover)
        serializer.save()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        Trail.objects.filter(pk=instance.pk).update(view_count=F("view_count") + 1)
        instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def like(self, request, pk=None):
        trail = self.get_object()
        like, created = TrailLike.objects.get_or_create(user=request.user, trail=trail)
        if not created:
            like.delete()
            Trail.objects.filter(pk=trail.pk).update(like_count=F("like_count") - 1)
            return Response({"liked": False}, status=status.HTTP_200_OK)
        Trail.objects.filter(pk=trail.pk).update(like_count=F("like_count") + 1)
        return Response({"liked": True}, status=status.HTTP_201_CREATED)

    @action(
        detail=True, methods=["post"],
        permission_classes=[permissions.IsAuthenticated],
        throttle_classes=[TrailBookmarkThrottle],
    )
    def bookmark(self, request, pk=None):
        """Toggle a bookmark. Body optional: {"note": "..."}"""
        trail = self.get_object()
        note = (request.data.get("note") or "")[:200] if isinstance(request.data, dict) else ""
        bm, created = TrailBookmark.objects.get_or_create(
            user=request.user, trail=trail, defaults={"note": note},
        )
        if not created:
            bm.delete()
            return Response({"bookmarked": False}, status=status.HTTP_200_OK)
        return Response({"bookmarked": True}, status=status.HTTP_201_CREATED)

    @action(
        detail=True, methods=["post"],
        permission_classes=[permissions.IsAuthenticated],
    )
    def complete(self, request, pk=None):
        """Manually mark this trail as completed by the user.

        Does not require an activity — lets users who walked the trail
        with another app or before installing Moru check it off.
        """
        trail = self.get_object()
        tc, created = TrailCompletion.objects.get_or_create(
            user=request.user, trail=trail,
            defaults={"source": "manual", "coverage": 1.0},
        )
        return Response(
            {"completed": True, "id": tc.id, "created": created},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(
        detail=True, methods=["get", "post"],
        permission_classes=[permissions.IsAuthenticatedOrReadOnly],
    )
    def conditions(self, request, pk=None):
        """List condition reports for a trail or submit a new one.

        GET returns up to 20 most-recent reports, newest first.
        POST expects {tag, note?, image?} and returns the created row.
        """
        trail = self.get_object()

        if request.method == "GET":
            qs = (
                TrailCondition.objects
                .filter(trail=trail, is_hidden=False)
                .select_related("user")
                .order_by("-created_at")[:20]
            )
            serializer = TrailConditionSerializer(
                qs, many=True, context={"request": request},
            )
            return Response(serializer.data)

        # POST — authenticated users only
        if not request.user.is_authenticated:
            return Response({"detail": "authentication required"}, status=401)

        # Rate-limit: one report per user per trail per hour. Prevents
        # spamming the same trail with stale tags.
        recent_cutoff = timezone.now() - timezone.timedelta(hours=1)
        recent_exists = TrailCondition.objects.filter(
            user=request.user, trail=trail, created_at__gte=recent_cutoff,
        ).exists()
        if recent_exists:
            return Response(
                {"detail": "이미 최근에 이 코스에 제보했어요. 1시간 후 다시 시도해주세요."},
                status=429,
            )

        serializer = TrailConditionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        img = request.FILES.get("image")
        if img is not None:
            try:
                validate_image_file(img)
            except Exception as e:
                return Response({"image": str(e)}, status=400)
        instance = serializer.save(user=request.user, trail=trail)
        return Response(
            TrailConditionSerializer(instance, context={"request": request}).data,
            status=201,
        )

    @action(detail=True, methods=["get"])
    def spots(self, request, pk=None):
        trail = self.get_object()
        spots = trail.spots.all().order_by("order")
        serializer = SpotSerializer(spots, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def popular(self, request):
        qs = Trail.objects.filter(status="approved", is_hidden=False).select_related("author").prefetch_related("tags")
        qs = qs.order_by("-like_count")[:20]
        serializer = TrailListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
    def today(self, request):
        """Today's recommended courses for the home screen.

        Prioritizes official/curated trails near the user. If no location
        is provided, falls back to the most-liked official trails.
        """
        from decimal import InvalidOperation
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")
        try:
            limit = max(1, min(20, int(request.query_params.get("limit", "3"))))
        except (TypeError, ValueError):
            limit = 3
        base = Trail.objects.filter(
            status="approved", is_hidden=False, is_official=True,
        ).select_related("author").prefetch_related("tags")
        if lat and lng:
            try:
                latd = Decimal(lat)
                lngd = Decimal(lng)
                degree = Decimal("0.5")  # ~55 km bounding box
                base = base.filter(
                    start_lat__range=(latd - degree, latd + degree),
                    start_lng__range=(lngd - degree, lngd + degree),
                )
            except (InvalidOperation, TypeError, ValueError):
                # Malformed coordinates → fall through to global list
                # rather than throw 500. Better UX: user sees *some*
                # curated content even with a bad lat/lng query param.
                pass
        qs = base.order_by("-like_count", "-view_count")[:limit]
        serializer = TrailListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def nearby(self, request):
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")
        radius_km = request.query_params.get("radius_km", "10")
        if not lat or not lng:
            return Response(
                {"error": "lat and lng are required"}, status=status.HTTP_400_BAD_REQUEST
            )
        lat, lng = Decimal(lat), Decimal(lng)
        radius = Decimal(radius_km)
        degree_approx = radius / Decimal("111")
        qs = Trail.objects.filter(
            status="approved",
            is_hidden=False,
            start_lat__range=(lat - degree_approx, lat + degree_approx),
            start_lng__range=(lng - degree_approx, lng + degree_approx),
        ).select_related("author").prefetch_related("tags")
        serializer = TrailListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)


class RecommendedTrailsView(generics.ListAPIView):
    serializer_class = TrailListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from .recommendations import get_recommendations
        qs = get_recommendations(self.request.user)
        return qs.select_related("author").prefetch_related("tags")


class MyBookmarksView(generics.ListAPIView):
    serializer_class = TrailBookmarkSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # bookmarks list is small; one request is fine

    def get_queryset(self):
        return (
            TrailBookmark.objects
            .filter(user=self.request.user, trail__is_hidden=False)
            .select_related("trail", "trail__author")
            .prefetch_related("trail__tags")
        )


class MyCompletionsView(generics.ListAPIView):
    serializer_class = TrailCompletionSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return (
            TrailCompletion.objects
            .filter(user=self.request.user, trail__is_hidden=False)
            .select_related("trail", "trail__author")
            .prefetch_related("trail__tags")
        )


class TrailSeriesViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only series catalog.

    Series are fully curated by admins; users never create them, so
    we inherit from ReadOnlyModelViewSet (list + retrieve only).
    Retrieval is by slug (e.g. /trail-series/jeju-olle/) for stable
    URLs that survive reseeds.
    """
    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return TrailSeries.objects.prefetch_related("trails").all()

    def get_serializer_class(self):
        if self.action == "retrieve":
            return TrailSeriesDetailSerializer
        return TrailSeriesListSerializer

    @action(detail=False, methods=["get"])
    def featured(self, request):
        qs = self.get_queryset().filter(is_featured=True)
        serializer = TrailSeriesListSerializer(
            qs, many=True, context={"request": request},
        )
        return Response(serializer.data)


class TagListView(generics.ListAPIView):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
