"""Companions admin — full management for walk plans, requests, chat."""
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse

from .models import (
    ChatMessage,
    ChatRoom,
    CompanionRequest,
    CompanionReview,
    SafetyReport,
    WalkPlan,
)


def user_link(obj, attr):
    user = getattr(obj, attr, None)
    if not user:
        return "-"
    url = reverse("admin:accounts_customuser_change", args=[user.pk])
    return format_html('<a href="{}">{}</a>', url, user.nickname or user.username)


@admin.register(WalkPlan)
class WalkPlanAdmin(admin.ModelAdmin):
    list_display = ["id", "user_display", "trail", "planned_date", "pace", "companion_status", "created_at"]
    list_filter = ["companion_status", "pace", "planned_date"]
    search_fields = ["user__nickname", "trail__title"]
    date_hierarchy = "planned_date"
    ordering = ["-planned_date"]
    list_per_page = 50

    @admin.display(description="사용자")
    def user_display(self, obj):
        return user_link(obj, "user")


@admin.register(CompanionRequest)
class CompanionRequestAdmin(admin.ModelAdmin):
    list_display = ["id", "requester_display", "walk_plan", "status", "created_at"]
    list_filter = ["status", "created_at"]
    search_fields = ["requester__nickname", "walk_plan__user__nickname"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]

    @admin.display(description="요청자")
    def requester_display(self, obj):
        return user_link(obj, "requester")


@admin.register(CompanionReview)
class CompanionReviewAdmin(admin.ModelAdmin):
    list_display = ["id", "reviewer_display", "reviewed_user_display", "rating", "created_at"]
    list_filter = ["rating", "created_at"]
    search_fields = ["reviewer__nickname", "reviewed_user__nickname", "content"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]

    @admin.display(description="리뷰어")
    def reviewer_display(self, obj):
        return user_link(obj, "reviewer")

    @admin.display(description="대상")
    def reviewed_user_display(self, obj):
        return user_link(obj, "reviewed_user")


@admin.register(SafetyReport)
class SafetyReportAdmin(admin.ModelAdmin):
    list_display = ["id", "reporter_display", "reported_user_display", "reason", "is_resolved", "created_at"]
    list_filter = ["reason", "is_resolved", "created_at"]
    search_fields = ["reporter__nickname", "reported_user__nickname", "detail"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]
    list_editable = ["is_resolved"]

    @admin.display(description="신고자")
    def reporter_display(self, obj):
        return user_link(obj, "reporter")

    @admin.display(description="피신고자")
    def reported_user_display(self, obj):
        return user_link(obj, "reported_user")


@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ["id", "walk_plan", "created_at"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ["id", "room", "sender_display", "short_content", "created_at"]
    search_fields = ["sender__nickname", "content"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]
    list_per_page = 100

    @admin.display(description="보낸 사람")
    def sender_display(self, obj):
        return user_link(obj, "sender")

    @admin.display(description="내용")
    def short_content(self, obj):
        return obj.content[:50] + "..." if len(obj.content) > 50 else obj.content
