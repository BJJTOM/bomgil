"""Activities admin — moderation panel for ActivityTrack + DailyActivitySummary."""
from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html
from django.urls import reverse

from .models import ActivityTrack, DailyActivitySummary


@admin.action(description="🚫 선택한 활동 숨김")
def hide_selected(modeladmin, request, queryset):
    updated = queryset.filter(is_hidden=False).update(
        is_hidden=True, hidden_at=timezone.now()
    )
    modeladmin.message_user(request, f"{updated}개 활동을 숨겼습니다.")


@admin.action(description="✅ 선택한 활동 다시 보이기")
def unhide_selected(modeladmin, request, queryset):
    updated = queryset.filter(is_hidden=True).update(
        is_hidden=False, hidden_at=None
    )
    modeladmin.message_user(request, f"{updated}개 활동을 복원했습니다.")


def user_link(obj):
    user = obj.user
    if not user:
        return "-"
    url = reverse("admin:accounts_customuser_change", args=[user.pk])
    return format_html('<a href="{}">{}</a>', url, user.nickname or user.username)


@admin.register(ActivityTrack)
class ActivityTrackAdmin(admin.ModelAdmin):
    list_display = [
        "id", "user_display", "title", "source", "distance_km",
        "duration_minutes", "total_steps", "calories_burned",
        "is_public", "status_badge", "started_at",
    ]
    list_filter = ["source", "is_public", "is_hidden", "started_at"]
    search_fields = ["title", "user__nickname"]
    date_hierarchy = "started_at"
    ordering = ["-started_at"]
    readonly_fields = [
        "track_points", "min_lat", "max_lat", "min_lng", "max_lng",
        "weather_temp_c", "weather_condition", "weather_icon",
        "hidden_at", "created_at", "updated_at",
    ]
    actions = [hide_selected, unhide_selected]
    list_per_page = 50

    @admin.display(description="사용자")
    def user_display(self, obj):
        return user_link(obj)

    @admin.display(description="공개", ordering="is_hidden")
    def status_badge(self, obj):
        if obj.is_hidden:
            return format_html('<span style="color:#fff;background:#EF4444;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;">숨김</span>')
        if not obj.is_public:
            return format_html('<span style="color:#fff;background:#9CA3AF;padding:2px 8px;border-radius:8px;font-size:11px;">비공개</span>')
        return format_html('<span style="color:#22C55E;font-size:11px;font-weight:600;">공개</span>')


@admin.register(DailyActivitySummary)
class DailyActivitySummaryAdmin(admin.ModelAdmin):
    list_display = ["user_display", "date", "total_steps", "total_distance_km", "total_calories", "track_count"]
    list_filter = ["date"]
    search_fields = ["user__nickname"]
    date_hierarchy = "date"
    ordering = ["-date"]
    list_per_page = 100

    @admin.display(description="사용자")
    def user_display(self, obj):
        return user_link(obj)
