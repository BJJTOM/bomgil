from django.contrib import admin

from .models import ModerationLog
from .reports import Notification, Report


@admin.register(ModerationLog)
class ModerationLogAdmin(admin.ModelAdmin):
    list_display = ["moderator", "content_type", "object_id", "action", "created_at"]
    list_filter = ["action", "content_type"]


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ["reporter", "content_type", "object_id", "reason", "is_resolved", "created_at"]
    list_filter = ["reason", "is_resolved", "content_type"]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["user", "message", "is_read", "created_at"]
    list_filter = ["is_read"]
