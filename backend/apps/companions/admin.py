from django.contrib import admin

from .models import (
    ChatMessage,
    ChatRoom,
    CompanionRequest,
    CompanionReview,
    SafetyReport,
    WalkPlan,
)


@admin.register(WalkPlan)
class WalkPlanAdmin(admin.ModelAdmin):
    list_display = ["user", "trail", "planned_date", "pace", "companion_status"]
    list_filter = ["companion_status", "pace", "planned_date"]


@admin.register(CompanionRequest)
class CompanionRequestAdmin(admin.ModelAdmin):
    list_display = ["requester", "walk_plan", "status", "created_at"]
    list_filter = ["status"]


@admin.register(CompanionReview)
class CompanionReviewAdmin(admin.ModelAdmin):
    list_display = ["reviewer", "reviewed_user", "rating", "created_at"]


@admin.register(SafetyReport)
class SafetyReportAdmin(admin.ModelAdmin):
    list_display = ["reporter", "reported_user", "reason", "is_resolved", "created_at"]
    list_filter = ["reason", "is_resolved"]


@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ["walk_plan", "created_at"]


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ["room", "sender", "content", "created_at"]
