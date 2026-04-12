from django.db.models import Sum, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from .gpx_parser import compute_summary, parse_gpx, simplify_track
from .models import ActivityTrack, DailyActivitySummary
from .serializers import (
    ActivityTrackCreateSerializer,
    ActivityTrackDetailSerializer,
    ActivityTrackListSerializer,
    ActivityTrackUpdateSerializer,
    DailyActivitySummarySerializer,
)


class ActivityCreateThrottle(UserRateThrottle):
    scope = "activity_create"
    rate = "50/hour"


class ActivityUpdateThrottle(UserRateThrottle):
    scope = "activity_update"
    rate = "100/hour"


class ActivityMergeThrottle(UserRateThrottle):
    scope = "activity_merge"
    rate = "20/hour"


class ActivityTrackViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_throttles(self):
        if self.action == "create":
            return [ActivityCreateThrottle()]
        if self.action in ("update", "partial_update", "destroy"):
            return [ActivityUpdateThrottle()]
        return super().get_throttles()

    def get_serializer_class(self):
        if self.action == "create":
            return ActivityTrackCreateSerializer
        if self.action in ("update", "partial_update"):
            return ActivityTrackUpdateSerializer
        if self.action in ("retrieve",):
            return ActivityTrackDetailSerializer
        return ActivityTrackListSerializer

    def get_queryset(self):
        # Hide admin-moderated activities from the user's own list as well —
        # if an admin hid a record, the user shouldn't see it either.
        qs = ActivityTrack.objects.filter(
            user=self.request.user, is_hidden=False,
        ).select_related("user", "trail", "story")
        source = self.request.query_params.get("source")
        if source:
            qs = qs.filter(source=source)
        return qs

    def perform_create(self, serializer):
        started_at = serializer.validated_data.get("started_at")
        # Only check duplicates if started_at is explicitly provided (not
        # inferred from track_points later). IMPORTANT: only consider VISIBLE
        # activities — a hidden record (moderated or admin-hidden) should not
        # block a re-import, because the user can't see or delete it from
        # their own UI, resulting in a "ghost" duplicate error.
        if started_at:
            window_start = started_at - timezone.timedelta(seconds=30)
            window_end = started_at + timezone.timedelta(seconds=30)
            duplicate = ActivityTrack.objects.filter(
                user=self.request.user,
                is_hidden=False,
                started_at__gte=window_start,
                started_at__lte=window_end,
            ).exists()
            if duplicate:
                from rest_framework.exceptions import ValidationError
                raise ValidationError(
                    {"detail": "A similar activity was already recorded within 30 seconds."}
                )
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
        from apps.accounts.badges import check_and_award_badges
        check_and_award_badges(self.request.user)

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

    @action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
    def leaderboard(self, request):
        """Top walkers this week (sum of distance over the last 7 days).

        Returns up to 30 entries — the friends UI shows the top 10 by
        default and the rest can be expanded. No auth required so the
        community tab can show it to logged-out visitors too.
        """
        from datetime import timedelta
        from django.contrib.auth import get_user_model
        from django.db.models import Sum

        User = get_user_model()
        week_ago = timezone.now().date() - timedelta(days=7)

        rows = (
            DailyActivitySummary.objects.filter(date__gte=week_ago)
            .values("user_id")
            .annotate(week_km=Sum("total_distance_km"), week_steps=Sum("total_steps"))
            .order_by("-week_km")[:30]
        )
        user_ids = [r["user_id"] for r in rows]
        users = {u.id: u for u in User.objects.filter(id__in=user_ids)}

        out = []
        for rank, r in enumerate(rows, start=1):
            u = users.get(r["user_id"])
            if not u:
                continue
            out.append({
                "rank": rank,
                "user_id": u.id,
                "nickname": u.nickname,
                "profile_image": u.profile_image.url if u.profile_image else None,
                "level": getattr(u, "level", 1),
                "week_distance_km": float(r["week_km"] or 0),
                "week_steps": int(r["week_steps"] or 0),
                "is_me": request.user.is_authenticated and request.user.id == u.id,
            })
        return Response({"leaderboard": out, "period": "week"})

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

        # Streak calculation: walk through DailyActivitySummary records
        # backwards from today and count consecutive days with at least
        # one track. This is what Nike Run Club / Apple Activity show.
        from datetime import timedelta
        all_summaries = (
            DailyActivitySummary.objects.filter(user=request.user, track_count__gt=0)
            .order_by("-date")
            .values_list("date", flat=True)
        )
        summary_set = set(all_summaries)
        current_streak = 0
        cursor = today
        while cursor in summary_set:
            current_streak += 1
            cursor = cursor - timedelta(days=1)
        # Longest streak — single pass through sorted dates
        longest_streak = 0
        run = 0
        prev = None
        for d in sorted(summary_set):
            if prev is not None and (d - prev).days == 1:
                run += 1
            else:
                run = 1
            longest_streak = max(longest_streak, run)
            prev = d

        # Weekly progress towards user's weekly goal
        weekly_goal_km = float(getattr(request.user, "weekly_goal_km", 20) or 20)
        week_distance = sum(float(d.total_distance_km or 0) for d in daily)

        # Earned badges based on cumulative distance milestones.
        # Idempotent — using get_or_create.
        from apps.accounts.models import UserBadge
        total_km = float(agg["total_distance"] or 0)
        earned_badges = []
        for threshold, code in [
            (1, "first_walk"),
            (10, "walker_10km"),
            (50, "walker_50km"),
            (100, "walker_100km"),
        ]:
            if total_km >= threshold:
                badge, created = UserBadge.objects.get_or_create(
                    user=request.user, badge_type=code,
                )
                earned_badges.append({
                    "code": code,
                    "earned_at": badge.earned_at.isoformat(),
                    "newly_earned": created,
                })

        return Response({
            "total_distance_km": total_km,
            "total_steps": agg["total_steps"] or 0,
            "total_duration_minutes": agg["total_duration"] or 0,
            "total_calories": agg["total_calories"] or 0,
            "track_count": agg["total_tracks"] or 0,
            "weekly": DailyActivitySummarySerializer(daily, many=True).data,
            # Phase 12 additions
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "weekly_goal_km": weekly_goal_km,
            "weekly_distance_km": week_distance,
            "weekly_progress_pct": min(100, round((week_distance / weekly_goal_km) * 100)) if weekly_goal_km > 0 else 0,
            "earned_badges": earned_badges,
        })


class ActivityMergeView(APIView):
    """POST /activities/merge/ — merge multiple activities into one."""
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ActivityMergeThrottle]

    def post(self, request):
        activity_ids = request.data.get('activity_ids', [])
        delete_originals = request.data.get('delete_originals', False)

        if not activity_ids or len(activity_ids) < 2:
            return Response(
                {'error': '최소 2개의 활동을 선택해주세요.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        activities = list(
            ActivityTrack.objects.filter(
                id__in=activity_ids, user=request.user
            ).order_by('started_at', 'created_at')
        )

        if len(activities) != len(activity_ids):
            return Response(
                {'error': '일부 활동을 찾을 수 없거나 권한이 없습니다.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Merge stats
        total_distance = sum(float(a.distance_km or 0) for a in activities)
        total_steps = sum(a.total_steps or 0 for a in activities)
        total_calories = sum(a.calories_burned or 0 for a in activities)
        total_duration = sum(a.duration_minutes or 0 for a in activities)
        total_elevation = sum(a.elevation_gain_m or 0 for a in activities)

        # Concatenate track points
        merged_points = []
        for a in activities:
            if a.track_points:
                merged_points.extend(a.track_points)

        # Use earliest started_at and latest finished_at
        started_at = None
        finished_at = None
        for a in activities:
            if a.started_at:
                if started_at is None or a.started_at < started_at:
                    started_at = a.started_at
            if a.finished_at:
                if finished_at is None or a.finished_at > finished_at:
                    finished_at = a.finished_at

        first = activities[0]
        merged = ActivityTrack.objects.create(
            user=request.user,
            trail=first.trail,
            source=first.source,
            title=first.title or '합친 기록',
            started_at=started_at,
            finished_at=finished_at,
            total_steps=total_steps if total_steps > 0 else None,
            distance_km=round(total_distance, 2) if total_distance > 0 else None,
            duration_minutes=total_duration if total_duration > 0 else None,
            calories_burned=total_calories if total_calories > 0 else None,
            elevation_gain_m=total_elevation if total_elevation > 0 else None,
            track_points=merged_points,
            is_public=first.is_public,
        )

        if delete_originals:
            ActivityTrack.objects.filter(id__in=activity_ids, user=request.user).delete()

        return Response(
            ActivityTrackDetailSerializer(merged).data,
            status=status.HTTP_201_CREATED,
        )


class TrailActivitiesView(generics.ListAPIView):
    serializer_class = ActivityTrackListSerializer

    def get_queryset(self):
        return ActivityTrack.objects.filter(
            trail_id=self.kwargs["trail_id"], is_public=True, is_hidden=False,
        ).select_related("user")


class UserActivitiesView(generics.ListAPIView):
    serializer_class = ActivityTrackListSerializer

    def get_queryset(self):
        from apps.accounts.models import CustomUser
        user = get_object_or_404(CustomUser, nickname=self.kwargs["nickname"])
        return ActivityTrack.objects.filter(
            user=user, is_public=True, is_hidden=False,
        ).select_related("user")
