from rest_framework import serializers

from .models import ModerationLog
from .reports import Notification, Report


class ModerationLogSerializer(serializers.ModelSerializer):
    moderator_name = serializers.CharField(source="moderator.nickname", read_only=True)
    content_type_name = serializers.CharField(source="content_type.model", read_only=True)

    class Meta:
        model = ModerationLog
        fields = [
            "id", "moderator", "moderator_name", "content_type",
            "content_type_name", "object_id", "action", "reason", "created_at",
        ]
        read_only_fields = ["moderator"]


class ModerationActionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)


class ReportSerializer(serializers.ModelSerializer):
    reporter_name = serializers.CharField(source="reporter.nickname", read_only=True)
    content_type_name = serializers.CharField(source="content_type.model", read_only=True)

    class Meta:
        model = Report
        fields = [
            "id", "reporter", "reporter_name", "content_type",
            "content_type_name", "object_id", "reason", "detail",
            "is_resolved", "created_at",
        ]
        read_only_fields = ["reporter"]


class ReportCreateSerializer(serializers.Serializer):
    content_type = serializers.CharField()  # "trail", "spot", "review"
    object_id = serializers.IntegerField()
    reason = serializers.ChoiceField(choices=Report.REASON_CHOICES)
    detail = serializers.CharField(required=False, allow_blank=True, max_length=500)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "message", "link", "is_read", "created_at"]
        read_only_fields = ["message", "link", "created_at"]
