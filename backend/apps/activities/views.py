from django.db.models import Sum, Count
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .gpx_parser import compute_summary, parse_gpx, simplify_track
from .models import ActivityTrack, DailyActivitySummary
from .serializers import (
    ActivityTrackCreateSerializer,
    ActivityTrackDetailSerializer,
    ActivityTrackListSerializer,
    DailyActivitySummarySerializer,
)


class ActivityTrackViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "create":
            return ActivityTrackCreateSerializer
        if self.action in ("retrieve",):
            return ActivityTrackDetailSerializer
        return ActivityTrackListSerializer

    def get_queryset(self):
        qs = ActivityTrack.objects.filter(user=self.request.user).select_related("user", "trail", "story")
        source = self.request.query_params.get("source")
        if source:
            qs = qs.filter(source=source)
        return qs

    def perform_create(self, serializer):
        instance = serializer.save(user=self.request.user)
        if instance.gpx_file:
            points, summary = parse_gpx(instance.gpx_file)
            instance.track_points = simplify_track(points, tolerance=0.00005)
            for key, value in summary.items():
                if value is not None:
                    setattr(instance, key, value)
            instance.save()
        elif instance.track_points:
            summary = compute_summary(instance.track_points)
            for key, value in summary.items():
                if value is not None:
                    setattr(instance, key, value)
            instance.track_points = simplify_track(instance.track_points, tolerance=0.00005)
            instance.save()
        self._update_daily_summary(instance)

    def _update_daily_summary(self, activity):
        if not activity.started_at:
            return
        date = activity.started_at.date()
        summary, _ = DailyActivitySummary.objects.get_or_create(
            user=activity.user, date=date
        )
        agg = ActivityTrack.objects.filter(
            user=activity.user, started_at__date=date
        ).aggregate(
            steps=Sum("total_steps"),
            distance=Sum("distance_km"),
            duration=Sum("duration_minutes"),
            calories=Sum("calories_burned"),
            count=Count("id"),
        )
        summary.total_steps = agg["steps"] or 0
        summary.total_distance_km = agg["distance"] or 0
        summary.total_duration_minutes = agg["duration"] or 0
        summary.total_calories = agg["calories"] or 0
        summary.track_count = agg["count"] or 0
        summary.save()

    @action(detail=False, methods=["get"])
    def my_stats(self, request):
        tracks = ActivityTrack.objects.filter(user=request.user)
        agg = tracks.aggregate(
            total_distance=Sum("distance_km"),
            total_steps=Sum("total_steps"),
            total_duration=Sum("duration_minutes"),
            total_calories=Sum("calories_burned"),
            total_tracks=Count("id"),
        )
        today = timezone.now().date()
        week_ago = today - timezone.timedelta(days=7)
        daily = DailyActivitySummary.objects.filter(
            user=request.user, date__gte=week_ago
        ).order_by("date")
        return Response({
            "total_distance_km": float(agg["total_distance"] or 0),
            "total_steps": agg["total_steps"] or 0,
            "total_duration_minutes": agg["total_duration"] or 0,
            "total_calories": agg["total_calories"] or 0,
            "track_count": agg["total_tracks"] or 0,
            "weekly": DailyActivitySummarySerializer(daily, many=True).data,
        })


class TrailActivitiesView(generics.ListAPIView):
    serializer_class = ActivityTrackListSerializer

    def get_queryset(self):
        return ActivityTrack.objects.filter(
            trail_id=self.kwargs["trail_id"], is_public=True
        ).select_related("user")


class UserActivitiesView(generics.ListAPIView):
    serializer_class = ActivityTrackListSerializer

    def get_queryset(self):
        from apps.accounts.models import CustomUser
        user = CustomUser.objects.get(nickname=self.kwargs["nickname"])
        return ActivityTrack.objects.filter(
            user=user, is_public=True
        ).select_related("user")
