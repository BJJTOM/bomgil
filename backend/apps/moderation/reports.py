from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class Report(models.Model):
    REASON_CHOICES = [
        ("spam", "스팸/광고"),
        ("inappropriate", "��적절한 콘텐츠"),
        ("false_info", "허위 정보"),
        ("copyright", "저작권 침해"),
        ("harassment", "괴롭힘/혐오"),
        ("other", "기타"),
    ]

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reports"
    )
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")
    reason = models.CharField(max_length=20, choices=REASON_CHOICES)
    detail = models.TextField(max_length=500, blank=True)
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ["reporter", "content_type", "object_id"]
        verbose_name = "신고"
        verbose_name_plural = "신고"

    def __str__(self):
        return f"Report by {self.reporter} - {self.reason}"


class Notification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    message = models.CharField(max_length=300)
    link = models.CharField(max_length=200, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "알림"
        verbose_name_plural = "알림"

    def __str__(self):
        return f"{self.user.nickname}: {self.message[:50]}"
