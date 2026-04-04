from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class WalkPlan(models.Model):
    PACE_CHOICES = [
        ("slow", "느긋하게"),
        ("moderate", "보통"),
        ("fast", "빠르게"),
    ]
    STATUS_CHOICES = [
        ("open", "동행 구하는 중"),
        ("matched", "동행 확정"),
        ("closed", "모집 마감"),
        ("completed", "완료"),
    ]
    GENDER_CHOICES = [
        ("any", "상관없음"),
        ("male", "남성"),
        ("female", "여성"),
    ]
    AGE_RANGE_CHOICES = [
        ("any", "상관없음"),
        ("20s", "20대"),
        ("30s", "30대"),
        ("40s", "40대"),
        ("50s_plus", "50대 이상"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="walk_plans"
    )
    trail = models.ForeignKey(
        "trails.Trail", on_delete=models.CASCADE, related_name="walk_plans"
    )
    planned_date = models.DateField()
    planned_time = models.TimeField(null=True, blank=True)
    message = models.TextField(max_length=200, blank=True)
    pace = models.CharField(max_length=10, choices=PACE_CHOICES, default="moderate")
    companion_status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="open")
    max_companions = models.PositiveSmallIntegerField(default=3)
    preferred_gender = models.CharField(max_length=10, choices=GENDER_CHOICES, default="any")
    preferred_age_range = models.CharField(max_length=10, choices=AGE_RANGE_CHOICES, default="any")
    is_visible = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["planned_date", "planned_time"]
        indexes = [
            models.Index(fields=["planned_date"]),
            models.Index(fields=["companion_status"]),
        ]

    def __str__(self):
        return f"{self.user.nickname} - {self.trail.title} ({self.planned_date})"

    @property
    def accepted_count(self):
        return self.requests.filter(status="accepted").count()

    @property
    def is_full(self):
        return self.accepted_count >= self.max_companions


class CompanionRequest(models.Model):
    STATUS_CHOICES = [
        ("pending", "대기 중"),
        ("accepted", "수락"),
        ("rejected", "거절"),
        ("cancelled", "취소"),
    ]

    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="companion_requests"
    )
    walk_plan = models.ForeignKey(
        WalkPlan, on_delete=models.CASCADE, related_name="requests"
    )
    message = models.TextField(max_length=200)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["requester", "walk_plan"]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.requester.nickname} → {self.walk_plan}"


class CompanionReview(models.Model):
    REVIEW_TAGS = [
        "편안한 대화", "적절한 페이스", "시간 약속 준수",
        "재미있는 사람", "좋은 코스 추천", "다시 걷고 싶어요",
        "안전한 동행", "추천",
    ]

    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="given_companion_reviews"
    )
    reviewed_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_companion_reviews"
    )
    walk_plan = models.ForeignKey(
        WalkPlan, on_delete=models.CASCADE, related_name="companion_reviews"
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    tags = models.JSONField(default=list, blank=True)
    content = models.TextField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["reviewer", "walk_plan"]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.reviewer.nickname} → {self.reviewed_user.nickname} ({self.rating}★)"


class SafetyReport(models.Model):
    REASON_CHOICES = [
        ("no_show", "노쇼"),
        ("inappropriate", "부적절한 행동"),
        ("harassment", "괴롭힘"),
        ("scam", "사기"),
        ("safety_concern", "안전 우려"),
        ("other", "기타"),
    ]

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="safety_reports_filed"
    )
    reported_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="safety_reports_received"
    )
    walk_plan = models.ForeignKey(
        WalkPlan, on_delete=models.CASCADE, related_name="safety_reports"
    )
    reason = models.CharField(max_length=20, choices=REASON_CHOICES)
    detail = models.TextField(max_length=500)
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Safety: {self.reporter.nickname} → {self.reported_user.nickname}"


class ChatRoom(models.Model):
    walk_plan = models.OneToOneField(
        WalkPlan, on_delete=models.CASCADE, related_name="chat_room",
        null=True, blank=True,
    )
    name = models.CharField(max_length=100, blank=True)
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name="chat_rooms"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name or f"Chat: {self.walk_plan}"


class ChatMessage(models.Model):
    room = models.ForeignKey(
        ChatRoom, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_messages"
    )
    content = models.TextField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.sender.nickname}: {self.content[:30]}"
