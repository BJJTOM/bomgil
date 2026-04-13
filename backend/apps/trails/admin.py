"""Trails admin — full moderation panel with hide/unhide actions."""
from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html
from django.urls import reverse

from .collections import Collection
from .models import (
    Tag,
    Trail,
    TrailBookmark,
    TrailCompletion,
    TrailCondition,
    TrailLike,
    TrailSeries,
    TrailSeriesTrail,
)


@admin.action(description="🚫 선택한 코스 숨김")
def hide_selected_trails(modeladmin, request, queryset):
    updated = queryset.filter(is_hidden=False).update(
        is_hidden=True, hidden_at=timezone.now()
    )
    modeladmin.message_user(request, f"{updated}개 코스를 숨겼습니다.")


@admin.action(description="✅ 선택한 코스 다시 보이기")
def unhide_selected_trails(modeladmin, request, queryset):
    updated = queryset.filter(is_hidden=True).update(
        is_hidden=False, hidden_at=None
    )
    modeladmin.message_user(request, f"{updated}개 코스를 복원했습니다.")


@admin.action(description="✓ 선택한 코스 승인")
def approve_selected(modeladmin, request, queryset):
    updated = queryset.update(status="approved")
    modeladmin.message_user(request, f"{updated}개 코스를 승인했습니다.")


@admin.action(description="✗ 선택한 코스 반려")
def reject_selected(modeladmin, request, queryset):
    updated = queryset.update(status="rejected")
    modeladmin.message_user(request, f"{updated}개 코스를 반려했습니다.")


def author_link(obj):
    user = obj.author
    if not user:
        return "-"
    url = reverse("admin:accounts_customuser_change", args=[user.pk])
    return format_html('<a href="{}">{}</a>', url, user.nickname or user.username)


@admin.register(Trail)
class TrailAdmin(admin.ModelAdmin):
    list_display = [
        "id", "title", "author_display", "region", "country",
        "difficulty", "distance_km", "official_badge", "status_badge", "hidden_badge",
        "like_count", "view_count", "created_at",
    ]
    list_filter = ["status", "is_hidden", "is_official", "source", "difficulty", "country", "best_season", "trail_type", "created_at"]
    search_fields = ["title", "description", "region", "author__nickname"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]
    readonly_fields = ["view_count", "like_count", "hidden_at", "created_at", "updated_at"]
    actions = [hide_selected_trails, unhide_selected_trails, approve_selected, reject_selected]
    list_per_page = 50
    fieldsets = (
        ("기본 정보", {
            "fields": ("title", "title_en", "title_ja", "description", "description_en", "description_ja",
                       "author", "region", "country", "difficulty", "best_season"),
        }),
        ("거리 / 시간 / 고도", {
            "fields": ("distance_km", "estimated_minutes", "elevation_gain"),
        }),
        ("좌표 / 경로", {
            "fields": ("start_lat", "start_lng", "end_lat", "end_lng", "path_data"),
        }),
        ("타입 / 표면 / 다일정", {
            "fields": ("trail_type", "walking_surface", "is_multi_day", "total_days", "transport_access"),
        }),
        ("이미지 / 태그", {
            "fields": ("cover_image", "thumbnail_url", "tags"),
        }),
        ("승인 / 모더레이션", {
            "fields": ("status", "rejection_reason", "is_hidden", "hidden_reason", "hidden_at"),
        }),
        ("출처 / 공식", {
            "fields": ("is_official", "source", "source_url"),
        }),
        ("통계 (read-only)", {
            "fields": ("view_count", "like_count", "created_at", "updated_at"),
        }),
    )

    @admin.display(description="작성자")
    def author_display(self, obj):
        return author_link(obj)

    @admin.display(description="승인", ordering="status")
    def status_badge(self, obj):
        colors = {
            "approved": ("#22C55E", "승인"),
            "pending": ("#F59E0B", "대기"),
            "rejected": ("#EF4444", "반려"),
            "draft": ("#9CA3AF", "임시"),
        }
        color, label = colors.get(obj.status, ("#9CA3AF", obj.status))
        return format_html(
            '<span style="color:#fff;background:{};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;">{}</span>',
            color, label,
        )

    @admin.display(description="공개", ordering="is_hidden")
    def hidden_badge(self, obj):
        if obj.is_hidden:
            return format_html('<span style="color:#fff;background:#1F2937;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;">숨김</span>')
        return format_html('<span style="color:#22C55E;font-size:11px;font-weight:600;">공개</span>')

    @admin.display(description="공식", ordering="is_official")
    def official_badge(self, obj):
        if obj.is_official:
            return format_html(
                '<span style="color:#fff;background:#2D4A2E;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;">공식</span>'
            )
        return format_html('<span style="color:#9CA3AF;font-size:11px;">유저</span>')


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ["name", "name_en", "name_ja"]
    search_fields = ["name", "name_en", "name_ja"]


@admin.register(TrailLike)
class TrailLikeAdmin(admin.ModelAdmin):
    list_display = ["user", "trail", "created_at"]
    search_fields = ["user__nickname", "trail__title"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]


@admin.register(TrailBookmark)
class TrailBookmarkAdmin(admin.ModelAdmin):
    list_display = ["user", "trail", "note", "created_at"]
    search_fields = ["user__nickname", "trail__title"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]


@admin.register(TrailCompletion)
class TrailCompletionAdmin(admin.ModelAdmin):
    list_display = ["user", "trail", "source", "coverage", "completed_at"]
    list_filter = ["source", "completed_at"]
    search_fields = ["user__nickname", "trail__title"]
    date_hierarchy = "completed_at"
    ordering = ["-completed_at"]
    autocomplete_fields = ["user", "trail"]


@admin.register(TrailCondition)
class TrailConditionAdmin(admin.ModelAdmin):
    list_display = ["trail", "tag", "user", "helpful_count", "is_hidden", "created_at"]
    list_filter = ["tag", "is_hidden", "created_at"]
    search_fields = ["trail__title", "user__nickname", "note"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]
    autocomplete_fields = ["user", "trail"]


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ["title", "is_featured", "created_at"]
    list_filter = ["is_featured"]
    search_fields = ["title", "description"]
    filter_horizontal = ["trails"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]


class TrailSeriesTrailInline(admin.TabularInline):
    model = TrailSeriesTrail
    extra = 1
    fields = ["order", "segment_label", "trail"]
    autocomplete_fields = ["trail"]
    ordering = ["order"]


@admin.register(TrailSeries)
class TrailSeriesAdmin(admin.ModelAdmin):
    list_display = [
        "title", "slug", "region", "is_featured", "sort_order", "trail_count",
    ]
    list_filter = ["is_featured", "region"]
    search_fields = ["title", "title_en", "slug", "subtitle", "description"]
    prepopulated_fields = {"slug": ("title_en",)}
    ordering = ["sort_order", "title"]
    inlines = [TrailSeriesTrailInline]

    @admin.display(description="구간 수")
    def trail_count(self, obj):
        return obj.trails.count()
