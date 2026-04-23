from datetime import timedelta

from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import generics, permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import CustomUser
from apps.accounts.serializers import UserPublicSerializer

from .collections import Collection
from .models import Trail, TrailLike
from .serializers import TrailListSerializer


class WeeklyPopularView(APIView):
    """주간 인기 코스 TOP 20"""

    def get(self, request):
        week_ago = timezone.now() - timedelta(days=7)
        trail_ids = (
            TrailLike.objects.filter(created_at__gte=week_ago)
            .values("trail")
            .annotate(count=Count("id"))
            .order_by("-count")[:20]
            .values_list("trail", flat=True)
        )
        trails = Trail.objects.filter(id__in=trail_ids, status="approved").select_related("author")
        serializer = TrailListSerializer(trails, many=True, context={"request": request})
        return Response(serializer.data)


class MonthlyPopularView(APIView):
    """월간 인기 코스 TOP 20"""

    def get(self, request):
        month_ago = timezone.now() - timedelta(days=30)
        trail_ids = (
            TrailLike.objects.filter(created_at__gte=month_ago)
            .values("trail")
            .annotate(count=Count("id"))
            .order_by("-count")[:20]
            .values_list("trail", flat=True)
        )
        trails = Trail.objects.filter(id__in=trail_ids, status="approved").select_related("author")
        serializer = TrailListSerializer(trails, many=True, context={"request": request})
        return Response(serializer.data)


class RegionPopularView(APIView):
    """지역별 인기 코스"""

    def get(self, request):
        region = request.query_params.get("region", "")
        qs = Trail.objects.filter(status="approved")
        if region:
            qs = qs.filter(region=region)
        qs = qs.order_by("-like_count")[:20]
        serializer = TrailListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)


class PopularGuidesView(APIView):
    """인기 가이드 (코스 등록수 + 좋아요 합산)"""

    def get(self, request):
        guides = list(
            CustomUser.objects.filter(trails__status="approved")
            .annotate(
                annotated_trail_count=Count("trails"),
                total_likes=Sum("trails__like_count"),
            )
            .order_by("-total_likes")[:20]
        )
        serializer = UserPublicSerializer(guides, many=True)
        data = list(serializer.data)
        # UserPublicSerializer의 Meta.fields 엔 total_likes 가 없으므로 수동 주입.
        for row, user in zip(data, guides):
            row["total_likes"] = getattr(user, "total_likes", 0) or 0
        return Response(data)


class CollectionSerializer(serializers.ModelSerializer):
    trail_count = serializers.SerializerMethodField()

    class Meta:
        model = Collection
        fields = [
            "id", "title", "title_en", "title_ja",
            "description", "cover_image", "is_featured",
            "trail_count", "created_at",
        ]

    def get_trail_count(self, obj):
        return obj.trails.count()


class CollectionDetailSerializer(serializers.ModelSerializer):
    trails = TrailListSerializer(many=True, read_only=True)

    class Meta:
        model = Collection
        fields = "__all__"


class CollectionListView(generics.ListAPIView):
    queryset = Collection.objects.all()
    serializer_class = CollectionSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None


class CollectionDetailView(generics.RetrieveAPIView):
    queryset = Collection.objects.prefetch_related("trails__author", "trails__tags")
    serializer_class = CollectionDetailSerializer
    permission_classes = [permissions.AllowAny]


class FeaturedCollectionsView(APIView):
    def get(self, request):
        collections = Collection.objects.filter(is_featured=True)[:5]
        serializer = CollectionSerializer(collections, many=True)
        return Response(serializer.data)
