"""Reviews admin."""
from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html
from django.urls import reverse

from .models import Review, ReviewImage, ReviewHelpful


@admin.action(description="🚫 선택한 리뷰 숨김")
def hide_selected(modeladmin, request, queryset):
    updated = queryset.filter(is_hidden=False).update(
        is_hidden=True, hidden_at=timezone.now()
    )
    modeladmin.message_user(request, f"{updated}개 리뷰를 숨겼습니다.")


@admin.action(description="✅ 선택한 리뷰 다시 보이기")
def unhide_selected(modeladmin, request, queryset):
    updated = queryset.filter(is_hidden=True).update(
        is_hidden=False, hidden_at=None
    )
    modeladmin.message_user(request, f"{updated}개 리뷰를 복원했습니다.")


def author_link(obj):
    user = obj.author
    if not user:
        return "-"
    url = reverse("admin:accounts_customuser_change", args=[user.pk])
    return format_html('<a href="{}">{}</a>', url, user.nickname or user.username)


class ReviewImageInline(admin.TabularInline):
    model = ReviewImage
    extra = 0


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ["id", "trail", "author_display", "rating", "short_content", "status", "status_badge", "created_at"]
    list_filter = ["status", "is_hidden", "rating", "created_at"]
    search_fields = ["content", "author__nickname", "trail__title"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]
    readonly_fields = ["helpful_count", "hidden_at"]
    actions = [hide_selected, unhide_selected]
    inlines = [ReviewImageInline]

    @admin.display(description="작성자")
    def author_display(self, obj):
        return author_link(obj)

    @admin.display(description="내용")
    def short_content(self, obj):
        return obj.content[:50] + "..." if len(obj.content) > 50 else obj.content

    @admin.display(description="공개", ordering="is_hidden")
    def status_badge(self, obj):
        if obj.is_hidden:
            return format_html('<span style="color:#fff;background:#EF4444;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;">숨김</span>')
        return format_html('<span style="color:#22C55E;font-size:11px;font-weight:600;">공개</span>')


@admin.register(ReviewHelpful)
class ReviewHelpfulAdmin(admin.ModelAdmin):
    list_display = ["user", "review", "created_at"]
    search_fields = ["user__nickname"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]
