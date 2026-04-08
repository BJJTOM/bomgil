from decimal import Decimal

from django.db.models import F
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from apps.spots.serializers import SpotSerializer
from config.permissions import IsOwnerOrReadOnly
from config.throttles import TrailCreateThrottle
from config.validators import validate_image_file

from .models import Tag, Trail, TrailLike
from .serializers import (
    TagSerializer,
    TrailCreateSerializer,
    TrailDetailSerializer,
    TrailListSerializer,
)


class TrailLikeThrottle(UserRateThrottle):
    scope = "trail_like"
    rate = "200/hour"


class TrailUpdateThrottle(UserRateThrottle):
    scope = "trail_update"
    rate = "60/hour"


class TrailViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    filterset_fields = ["region", "country", "difficulty", "best_season", "status", "tags"]
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
        if self.action == "list":
            # 일반 유저는 approved만, 관리자는 status 필터 가능
            if not (self.request.user.is_authenticated and self.request.user.is_staff):
                qs = qs.filter(status="approved")
        elif self.action == "retrieve":
            # 상세 보기는 approved이거나 작성자 본인
            if self.request.user.is_authenticated:
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

    @action(detail=True, methods=["get"])
    def spots(self, request, pk=None):
        trail = self.get_object()
        spots = trail.spots.all().order_by("order")
        serializer = SpotSerializer(spots, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def popular(self, request):
        qs = Trail.objects.filter(status="approved").select_related("author").prefetch_related("tags")
        qs = qs.order_by("-like_count")[:20]
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


class TagListView(generics.ListAPIView):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
