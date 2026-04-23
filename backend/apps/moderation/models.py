from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class ModerationLog(models.Model):
    ACTION_CHOICES = [
        ("approve", "승인"),
        ("reject", "반려"),
        ("delete", "삭제"),
        ("flag", "플래그"),
        ("suspend", "유저 정지"),
        ("lift", "정지 해제"),
        ("user_delete", "유저 탈퇴 처리"),
        ("memo", "유저 메모"),
    ]

    moderator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="moderation_logs"
    )
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    reason = models.TextField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "운영 로그"
        verbose_name_plural = "운영 로그"

    def __str__(self):
        return f"{self.moderator} - {self.action} - {self.content_type} #{self.object_id}"


class AIModerationLog(models.Model):
    """Audit log for AI-powered content moderation decisions."""

    ACTION_CHOICES = [
        ("approve", "승인"),
        ("review", "검토 필요"),
        ("reject", "자동 차단"),
        ("error", "AI 오류"),
    ]

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")

    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    is_safe = models.BooleanField(default=True)
    confidence = models.FloatField(default=0.0, help_text="AI 확신도 (0.0~1.0)")
    flags = models.JSONField(default=list, blank=True, help_text="감지된 위반 유형")
    reason = models.TextField(max_length=1000, blank=True, help_text="AI 판단 사유")
    input_text = models.TextField(max_length=5000, blank=True, help_text="검사 대상 텍스트 (앞부분)")
    content_type_label = models.CharField(max_length=30, blank=True, help_text="post, comment, etc.")

    # Whether the AI decision was overridden by a human moderator
    is_overridden = models.BooleanField(default=False)
    overridden_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="ai_moderation_overrides",
    )
    overridden_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "AI 모더레이션 로그"
        verbose_name_plural = "AI 모더레이션 로그"
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["action"]),
        ]

    def __str__(self):
        return f"[AI {self.action}] {self.content_type} #{self.object_id} ({self.confidence:.0%})"
