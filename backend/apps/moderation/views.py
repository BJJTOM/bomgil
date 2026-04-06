from datetime import timedelta

from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.reviews.models import Review
from apps.reviews.serializers import ReviewSerializer
from apps.spots.models import Spot
from apps.spots.serializers import SpotSerializer
from apps.trails.models import Trail
from apps.trails.serializers import TrailDetailSerializer

from .models import ModerationLog
from .reports import Notification, Report
from .serializers import (
    ModerationActionSerializer,
    ModerationLogSerializer,
    NotificationSerializer,
    ReportCreateSerializer,
    ReportSerializer,
)

MODEL_MAP = {
    "trail": (Trail, TrailDetailSerializer),
    "spot": (Spot, SpotSerializer),
    "review": (Review, ReviewSerializer),
}

REPORT_THRESHOLD = 3  # Auto-flag after N reports


class PendingListView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        type_filter = request.query_params.get("type")
        results = []

        for key, (model, serializer_cls) in MODEL_MAP.items():
            if type_filter and type_filter != key:
                continue
            qs = model.objects.filter(status="pending")
            data = serializer_cls(qs, many=True, context={"request": request}).data
            for item in data:
                item["_type"] = key
            results.extend(data)

        results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return Response(results)


class ModerationApproveView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, type_name, pk):
        model, _ = MODEL_MAP.get(type_name, (None, None))
        if not model:
            return Response({"error": "Invalid type"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            obj = model.objects.get(pk=pk)
        except model.DoesNotExist:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        obj.status = "approved"
        obj.save(update_fields=["status"])

        ModerationLog.objects.create(
            moderator=request.user,
            content_type=ContentType.objects.get_for_model(model),
            object_id=pk,
            action="approve",
        )

        # Notify author
        author = getattr(obj, "author", None)
        if author:
            title = getattr(obj, "title", getattr(obj, "name", "콘텐츠"))
            Notification.objects.create(
                user=author,
                message=f'"{title}" 이(가) 승인되어 공개되었습니다.',
                link=f"/trails/{getattr(obj, 'trail_id', pk) if type_name != 'trail' else pk}",
            )

        return Response({"status": "approved"})


class ModerationRejectView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, type_name, pk):
        serializer = ModerationActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        model, _ = MODEL_MAP.get(type_name, (None, None))
        if not model:
            return Response({"error": "Invalid type"}, status=status.HTTP_400_BAD_REQUEST)

        reason = serializer.validated_data.get("reason", "")
        if not reason:
            return Response(
                {"error": "Reason is required for rejection"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            obj = model.objects.get(pk=pk)
        except model.DoesNotExist:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        obj.status = "rejected"
        if hasattr(obj, "rejection_reason"):
            obj.rejection_reason = reason
        obj.save()

        ModerationLog.objects.create(
            moderator=request.user,
            content_type=ContentType.objects.get_for_model(model),
            object_id=pk,
            action="reject",
            reason=reason,
        )

        # Notify author
        author = getattr(obj, "author", None)
        if author:
            title = getattr(obj, "title", getattr(obj, "name", "콘텐츠"))
            Notification.objects.create(
                user=author,
                message=f'"{title}" 이(가) 반려되었습니다. 사유: {reason[:100]}',
                link=f"/trails/{getattr(obj, 'trail_id', pk) if type_name != 'trail' else pk}",
            )

        return Response({"status": "rejected"})


class ModerationLogListView(generics.ListAPIView):
    queryset = ModerationLog.objects.select_related("moderator", "content_type")
    serializer_class = ModerationLogSerializer
    permission_classes = [permissions.IsAdminUser]


class ModerationStatsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        now = timezone.now()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)

        today_logs = ModerationLog.objects.filter(created_at__gte=today)
        week_logs = ModerationLog.objects.filter(created_at__gte=week_ago)
        month_logs = ModerationLog.objects.filter(created_at__gte=month_ago)

        total_pending = (
            Trail.objects.filter(status="pending").count()
            + Spot.objects.filter(status="pending").count()
            + Review.objects.filter(status="pending").count()
        )

        month_rejected = month_logs.filter(action="reject").count()
        month_total = month_logs.count()
        rejection_rate = (month_rejected / month_total * 100) if month_total > 0 else 0

        stats = {
            "pending": {
                "trails": Trail.objects.filter(status="pending").count(),
                "spots": Spot.objects.filter(status="pending").count(),
                "reviews": Review.objects.filter(status="pending").count(),
                "total": total_pending,
            },
            "today": {
                "processed": today_logs.count(),
                "approved": today_logs.filter(action="approve").count(),
                "rejected": today_logs.filter(action="reject").count(),
            },
            "week": {
                "processed": week_logs.count(),
                "approved": week_logs.filter(action="approve").count(),
                "rejected": week_logs.filter(action="reject").count(),
            },
            "month": {
                "processed": month_logs.count(),
                "approved": month_logs.filter(action="approve").count(),
                "rejected": month_logs.filter(action="reject").count(),
                "rejection_rate": round(rejection_rate, 1),
            },
            "reports_pending": Report.objects.filter(is_resolved=False).count(),
            "total_logs": ModerationLog.objects.count(),
        }
        return Response(stats)


# ─── Report Views ───

class ReportCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        type_name = serializer.validated_data["content_type"]
        model, _ = MODEL_MAP.get(type_name, (None, None))
        if not model:
            return Response({"error": "Invalid type"}, status=status.HTTP_400_BAD_REQUEST)

        ct = ContentType.objects.get_for_model(model)
        object_id = serializer.validated_data["object_id"]

        report, created = Report.objects.get_or_create(
            reporter=request.user,
            content_type=ct,
            object_id=object_id,
            defaults={
                "reason": serializer.validated_data["reason"],
                "detail": serializer.validated_data.get("detail", ""),
            },
        )

        if not created:
            return Response(
                {"error": "이미 신고한 콘텐츠입니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Auto-flag if reports from distinct reporters >= threshold
        report_count = Report.objects.filter(
            content_type=ct, object_id=object_id
        ).values("reporter").distinct().count()

        if report_count >= REPORT_THRESHOLD:
            try:
                obj = model.objects.get(pk=object_id)
                if hasattr(obj, "status") and obj.status == "approved":
                    obj.status = "pending"  # Re-flag for review
                    obj.save(update_fields=["status"])
                    ModerationLog.objects.create(
                        moderator=request.user,
                        content_type=ct,
                        object_id=object_id,
                        action="flag",
                        reason=f"신고 {report_count}건 누적으로 자동 플래그",
                    )
            except model.DoesNotExist:
                pass

        return Response({"reported": True}, status=status.HTTP_201_CREATED)


class ReportListView(generics.ListAPIView):
    serializer_class = ReportSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        qs = Report.objects.select_related("reporter", "content_type")
        if self.request.query_params.get("resolved") == "false":
            qs = qs.filter(is_resolved=False)
        return qs


# ─── Notification Views ───

class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class NotificationReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, user=request.user)
        except Notification.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return Response({"is_read": True})


class NotificationReadAllView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(
            is_read=True
        )
        return Response({"status": "ok"})
