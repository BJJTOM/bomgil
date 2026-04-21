from rest_framework import serializers

from apps.accounts.serializers import UserPublicSerializer
from apps.trails.serializers import TrailListSerializer

from .models import (
    ChatMessage,
    ChatRoom,
    CompanionRequest,
    CompanionReview,
    SafetyReport,
    WalkPlan,
)


class WalkPlanListSerializer(serializers.ModelSerializer):
    user = UserPublicSerializer(read_only=True)
    trail_title = serializers.CharField(source="trail.title", read_only=True)
    trail_region = serializers.CharField(source="trail.region", read_only=True)
    trail_cover = serializers.ImageField(source="trail.cover_image", read_only=True)
    trail_distance_km = serializers.DecimalField(
        source="trail.distance_km", max_digits=5, decimal_places=1, read_only=True
    )
    trail_estimated_minutes = serializers.IntegerField(
        source="trail.estimated_minutes", read_only=True
    )
    trail_type = serializers.CharField(source="trail.trail_type", read_only=True)
    accepted_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = WalkPlan
        fields = [
            "id", "user", "trail", "trail_title", "trail_region", "trail_cover",
            "trail_distance_km", "trail_estimated_minutes", "trail_type",
            "planned_date", "planned_time", "message", "pace",
            "companion_status", "max_companions", "accepted_count",
            "preferred_gender", "preferred_age_range",
            "created_at",
        ]


class WalkPlanDetailSerializer(serializers.ModelSerializer):
    user = UserPublicSerializer(read_only=True)
    trail = TrailListSerializer(read_only=True)
    accepted_count = serializers.IntegerField(read_only=True)
    requests = serializers.SerializerMethodField()

    class Meta:
        model = WalkPlan
        fields = "__all__"
        read_only_fields = ["user", "companion_status"]

    def get_requests(self, obj):
        # Only show requests to the plan owner
        request = self.context.get("request")
        if request and request.user == obj.user:
            qs = obj.requests.filter(status="pending")
            return CompanionRequestSerializer(qs, many=True).data
        return []


class WalkPlanCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalkPlan
        fields = [
            "trail", "planned_date", "planned_time", "message",
            "pace", "max_companions", "preferred_gender", "preferred_age_range",
        ]


class CompanionRequestSerializer(serializers.ModelSerializer):
    requester = UserPublicSerializer(read_only=True)

    class Meta:
        model = CompanionRequest
        fields = ["id", "requester", "walk_plan", "message", "status", "created_at"]
        read_only_fields = ["requester", "status"]


class CompanionRequestCreateSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=200)


class CompanionReviewSerializer(serializers.ModelSerializer):
    reviewer = UserPublicSerializer(read_only=True)
    reviewed_user = UserPublicSerializer(read_only=True)

    class Meta:
        model = CompanionReview
        fields = [
            "id", "reviewer", "reviewed_user", "walk_plan",
            "rating", "tags", "content", "created_at",
        ]
        read_only_fields = ["reviewer"]


class CompanionReviewCreateSerializer(serializers.ModelSerializer):
    reviewed_user_id = serializers.IntegerField()

    class Meta:
        model = CompanionReview
        fields = ["reviewed_user_id", "rating", "tags", "content"]


class SafetyReportSerializer(serializers.ModelSerializer):
    reporter = UserPublicSerializer(read_only=True)

    class Meta:
        model = SafetyReport
        fields = [
            "id", "reporter", "reported_user", "walk_plan",
            "reason", "detail", "is_resolved", "created_at",
        ]
        read_only_fields = ["reporter", "is_resolved"]


class ChatRoomSerializer(serializers.ModelSerializer):
    participants = UserPublicSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    walk_plan_title = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = [
            "id", "walk_plan", "name", "walk_plan_title",
            "participants", "last_message", "unread_count", "created_at",
        ]

    def get_walk_plan_title(self, obj):
        if obj.name:
            return obj.name
        if obj.walk_plan and obj.walk_plan.trail:
            return obj.walk_plan.trail.title
        return f"Chat #{obj.id}"

    def get_last_message(self, obj):
        msg = obj.messages.order_by("-created_at").first()
        if msg:
            return ChatMessageSerializer(msg).data
        return None

    def get_unread_count(self, obj):
        return 0  # Simplified; real impl would track read timestamps


class ChatMessageSerializer(serializers.ModelSerializer):
    sender = UserPublicSerializer(read_only=True)

    class Meta:
        model = ChatMessage
        fields = ["id", "room", "sender", "content", "created_at"]
        read_only_fields = ["sender"]


class ChatMessageCreateSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=500)


# ── Companion matching serializers ──────────────────────────────


class CompatibilityBreakdownSerializer(serializers.Serializer):
    walking_style = serializers.FloatField()
    pace_match = serializers.FloatField()
    social_signals = serializers.FloatField()
    reputation = serializers.FloatField()
    availability = serializers.FloatField()


class CompatibilitySerializer(serializers.Serializer):
    score = serializers.FloatField()
    reasons = serializers.ListField(child=serializers.CharField())
    breakdown = CompatibilityBreakdownSerializer()


class SuggestedCompanionSerializer(serializers.Serializer):
    user = UserPublicSerializer()
    compatibility = CompatibilitySerializer()


class CompanionRequestWithScoreSerializer(serializers.Serializer):
    """CompanionRequest with compatibility score attached.

    Accepts a dict with model instance fields plus computed score data.
    """

    id = serializers.IntegerField(read_only=True)
    requester = UserPublicSerializer(read_only=True)
    walk_plan = serializers.IntegerField(read_only=True)
    message = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    compatibility_score = serializers.FloatField(read_only=True)
    compatibility_reasons = serializers.ListField(
        child=serializers.CharField(), read_only=True,
    )
