from decimal import Decimal

from django.db.models import Count, F, Sum
from django.utils import timezone
from rest_framework import generics, permissions, serializers as drf_serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import IsTrailAllowed
from apps.spots.serializers import SpotSerializer
from config.pagination import TrailPagination
from config.permissions import IsOwnerOrReadOnly
from config.throttles import TrailCreateThrottle
from config.validators import validate_image_file

from .models import (
    StampPoint,
    Tag,
    Trail,
    TrailBookmark,
    TrailCompletion,
    TrailCondition,
    TrailLike,
    TrailSeries,
    UserStamp,
)
from .serializers import (
    StampPointSerializer,
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
    UserStampSerializer,
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
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly, IsTrailAllowed]
    pagination_class = TrailPagination
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
        # `series` and `segments` are hit by the detail serializer on every
        # retrieve; prefetch them so the Trail detail page doesn't fan out
        # into separate queries per trail.
        qs = Trail.objects.select_related("author").prefetch_related(
            "tags", "series", "segments"
        )
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

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsTrailAllowed])
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
        permission_classes=[permissions.IsAuthenticated, IsTrailAllowed],
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
        permission_classes=[permissions.IsAuthenticated, IsTrailAllowed],
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

    @action(detail=True, methods=["get"])
    def stamps(self, request, pk=None):
        """List stamp points for a trail."""
        trail = self.get_object()
        qs = trail.stamp_points.all().order_by("order")
        serializer = StampPointSerializer(
            qs, many=True, context={"request": request},
        )
        return Response(serializer.data)

    @action(
        detail=True, methods=["post"],
        url_path=r"stamps/(?P<stamp_id>\d+)/collect",
        permission_classes=[permissions.IsAuthenticated, IsTrailAllowed],
    )
    def collect_stamp(self, request, pk=None, stamp_id=None):
        """Collect a stamp point if the user is within radius.

        Expects JSON body: {"lat": ..., "lng": ...}
        Optionally: {"lat": ..., "lng": ..., "activity_id": ...}
        """
        import math

        trail = self.get_object()
        try:
            stamp_point = trail.stamp_points.get(pk=stamp_id)
        except StampPoint.DoesNotExist:
            return Response(
                {"detail": "스탬프 포인트를 찾을 수 없습니다."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Parse user location
        user_lat = request.data.get("lat")
        user_lng = request.data.get("lng")
        if user_lat is None or user_lng is None:
            return Response(
                {"detail": "lat, lng 좌표가 필요합니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            user_lat = float(user_lat)
            user_lng = float(user_lng)
        except (TypeError, ValueError):
            return Response(
                {"detail": "lat, lng는 유효한 숫자여야 합니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Haversine distance check
        stamp_lat = float(stamp_point.lat)
        stamp_lng = float(stamp_point.lng)
        R = 6371000  # Earth radius in meters
        phi1 = math.radians(user_lat)
        phi2 = math.radians(stamp_lat)
        dphi = math.radians(stamp_lat - user_lat)
        dlambda = math.radians(stamp_lng - user_lng)
        a = (
            math.sin(dphi / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        )
        distance_m = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        if distance_m > stamp_point.radius_meters:
            return Response(
                {
                    "detail": f"스탬프 포인트에서 너무 멀어요. ({int(distance_m)}m / {stamp_point.radius_meters}m 이내 필요)",
                    "distance_m": round(distance_m, 1),
                    "radius_m": stamp_point.radius_meters,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Optional activity link
        activity = None
        activity_id = request.data.get("activity_id")
        if activity_id:
            from apps.activities.models import ActivityTrack
            activity = ActivityTrack.objects.filter(
                pk=activity_id, user=request.user,
            ).first()

        user_stamp, created = UserStamp.objects.get_or_create(
            user=request.user,
            stamp_point=stamp_point,
            defaults={"activity": activity},
        )

        return Response(
            {
                "collected": True,
                "created": created,
                "stamp": StampPointSerializer(
                    stamp_point, context={"request": request},
                ).data,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

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
        from decimal import InvalidOperation
        lat_raw = request.query_params.get("lat")
        lng_raw = request.query_params.get("lng")
        radius_raw = request.query_params.get("radius_km", "10")
        if not lat_raw or not lng_raw:
            return Response(
                {"error": "lat and lng are required"}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            lat = Decimal(lat_raw)
            lng = Decimal(lng_raw)
            radius = Decimal(radius_raw)
        except (InvalidOperation, TypeError, ValueError):
            return Response(
                {"error": "lat, lng, radius_km must be valid numbers"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Sanity-check ranges before issuing a potentially massive
        # bounding-box query. -90..90 / -180..180 for coords;
        # radius capped at 100 km to keep response size reasonable.
        if not (Decimal("-90") <= lat <= Decimal("90")):
            return Response({"error": "lat out of range"}, status=status.HTTP_400_BAD_REQUEST)
        if not (Decimal("-180") <= lng <= Decimal("180")):
            return Response({"error": "lng out of range"}, status=status.HTTP_400_BAD_REQUEST)
        if radius <= 0 or radius > Decimal("100"):
            radius = Decimal("10")
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
    """Personalized trail recommendations for authenticated users.

    Uses the scoring engine from recommendations.py.  Results are
    cached per user for 5 minutes inside the engine.
    """
    serializer_class = TrailListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from .recommendations import get_recommendations
        return get_recommendations(self.request.user)


class ForYouView(generics.GenericAPIView):
    """GET /api/v1/trails/for-you/

    Personalized 'For You' recommendations with reason strings.
    - Authenticated users: full scoring engine with preference/social/activity signals.
    - Anonymous users: popularity + seasonal + image scoring.

    Each trail in the response includes a ``recommendation_reason`` dict
    with localized strings (ko, en, ja, zh).
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = TrailListSerializer

    def get(self, request):
        from .recommendations import (
            get_anonymous_recommendations,
            get_personalized_recommendations,
        )

        try:
            limit = max(1, min(20, int(request.query_params.get("limit", "10"))))
        except (TypeError, ValueError):
            limit = 10

        if request.user.is_authenticated:
            results = get_personalized_recommendations(request.user, limit=limit)
        else:
            results = get_anonymous_recommendations(limit=limit)

        # Serialize trails using the standard TrailListSerializer
        trails = [r["trail"] for r in results]
        serializer = self.get_serializer(trails, many=True)

        # Attach recommendation metadata to each serialized trail
        data = serializer.data
        for i, item in enumerate(data):
            if i < len(results):
                item["recommendation_score"] = results[i]["score"]
                item["recommendation_reason"] = results[i]["reasons"]
                item["recommendation_reason_key"] = results[i]["reason_key"]

        return Response(data)


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
        # Annotate aggregate stats on the queryset so the serializer
        # methods don't have to issue per-series queries (was N+1).
        return TrailSeries.objects.prefetch_related("trails").annotate(
            _trail_count=Count("trails", distinct=True),
            _total_distance=Sum("trails__distance_km"),
            _total_minutes=Sum("trails__estimated_minutes"),
        ).all()

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


class MyStampsView(generics.ListAPIView):
    """List all stamps collected by the current user."""
    serializer_class = UserStampSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return (
            UserStamp.objects
            .filter(user=self.request.user)
            .select_related("stamp_point", "stamp_point__trail")
        )


class TagListView(generics.ListAPIView):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None


# ---------------------------------------------------------------------------
# AI Description Generation
# ---------------------------------------------------------------------------

class AIDescriptionThrottle(UserRateThrottle):
    scope = "ai_description"
    rate = "10/hour"


class AIDescriptionInputSerializer(drf_serializers.Serializer):
    title = drf_serializers.CharField(max_length=100)
    distance_km = drf_serializers.DecimalField(
        max_digits=6, decimal_places=2, required=False, default=0
    )
    difficulty = drf_serializers.ChoiceField(
        choices=["easy", "moderate", "hard"], required=False, default="moderate"
    )
    elevation_gain = drf_serializers.IntegerField(required=False, allow_null=True)
    trail_type = drf_serializers.ChoiceField(
        choices=["urban", "coastal", "village", "cultural", "nature", "mixed"],
        required=False,
        default="mixed",
    )
    region = drf_serializers.CharField(max_length=50, required=False, default="")
    country = drf_serializers.CharField(max_length=2, required=False, default="KR")
    path_data = drf_serializers.JSONField(required=False, default=dict)


class GenerateAIDescriptionView(APIView):
    """POST /api/v1/trails/ai/generate-description/

    Accepts trail metadata and returns AI-generated descriptions in
    Korean, English, and Japanese, plus suggested tags and best-season reasoning.

    Requires authentication. Rate-limited to 10 requests per hour per user.
    """

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [AIDescriptionThrottle]

    def post(self, request):
        serializer = AIDescriptionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from .ai_utils import generate_trail_description

        trail_data = serializer.validated_data
        # Convert Decimal to float for JSON serialization in the prompt
        if trail_data.get("distance_km") is not None:
            trail_data["distance_km"] = float(trail_data["distance_km"])

        result = generate_trail_description(trail_data)

        if not result:
            return Response(
                {"detail": "AI description generation failed. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(result, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# AI Natural Language Search
# ---------------------------------------------------------------------------

class AISearchThrottle(UserRateThrottle):
    scope = "ai_search"
    rate = "60/hour"


class AISearchInputSerializer(drf_serializers.Serializer):
    query = drf_serializers.CharField(max_length=300)
    language = drf_serializers.ChoiceField(
        choices=["ko", "en", "ja", "zh"], required=False, default="ko"
    )


class AISearchView(APIView):
    """POST /api/v1/trails/ai-search/

    Natural language trail search. Parses a conversational query
    using Claude and returns matching trails with a summary.

    No authentication required (public search).
    Rate-limited to 60 requests per hour.
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = [AISearchThrottle]

    def post(self, request):
        serializer = AISearchInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        query = serializer.validated_data["query"]
        language = serializer.validated_data["language"]

        from .ai_search import (
            build_search_queryset,
            generate_search_summary,
            parse_search_intent,
        )

        # Step 1: Parse natural language into structured filters
        intent = parse_search_intent(query, language)

        # Step 2: Build ORM query and get results
        trails_qs = build_search_queryset(intent)
        trails_list = list(trails_qs)

        # Step 3: Serialize results
        trail_serializer = TrailListSerializer(
            trails_list, many=True, context={"request": request}
        )

        # Step 4: Generate search summary
        search_summary = generate_search_summary(intent, len(trails_list), language)

        return Response(
            {
                "search_summary": search_summary,
                "intent": intent,
                "count": len(trails_list),
                "results": trail_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def get(self, request):
        """GET /api/v1/trails/ai-search/ — check if AI search is available."""
        from .ai_search import is_ai_search_available

        return Response(
            {"available": is_ai_search_available()},
            status=status.HTTP_200_OK,
        )
