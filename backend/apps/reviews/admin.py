"""Reviews admin."""
from django.contrib import admin
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from django.utils.html import format_html
from django.urls import reverse

from apps.moderation.models import AIModerationLog

from .models import Review, ReviewImage, ReviewHelpful


class AIFlaggedFilter(admin.SimpleListFilter):
    """Filter content by AI moderation result."""
    title = "AI 모더레이션"
    parameter_name = "ai_flag"

    def lookups(self, request, model_admin):
        return [
            ("flagged", "AI 차단/검토"),
            ("rejected", "AI 차단"),
            ("review", "AI 검토 필요"),
            ("approved", "AI 승인"),
        ]

    def queryset(self, request, queryset):
        if not self.value():
            return queryset
        ct = ContentType.objects.get_for_model(queryset.model)
        logs = AIModerationLog.objects.filter(content_type=ct)
        if self.value() == "flagged":
            ids = logs.filter(action__in=["reject", "review"]).values_list("object_id", flat=True)
        elif self.value() == "rejected":
            ids = logs.filter(action="reject").values_list("object_id", flat=True)
        elif self.value() == "review":
            ids = logs.filter(action="review").values_list("object_id", flat=True)
        elif self.value() == "approved":
            ids = logs.filter(action="approve").values_list("object_id", flat=True)
        else:
            return queryset
        return queryset.filter(pk__in=ids)


def _ai_badge(obj):
    """Show the latest AI moderation result as a colored badge."""
    ct = ContentType.objects.get_for_model(obj)
    log = AIModerationLog.objects.filter(content_type=ct, object_id=obj.pk).order_by("-created_at").first()
    if not log:
        return format_html('<span style="color:#9CA3AF;font-size:11px;">-</span>')
    colors = {"approve": "#22C55E", "review": "#F59E0B", "reject": "#EF4444", "error": "#9CA3AF"}
    labels = {"approve": "OK", "review": "검토", "reject": "차단", "error": "오류"}
    bg = colors.get(log.action, "#9CA3AF")
    label = labels.get(log.action, log.action)
    return format_html(
        '<span style="color:#fff;background:{};padding:2px 6px;'
        'border-radius:8px;font-size:10px;font-weight:600;">{}</span>',
        bg, label,
    )


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
    list_display = ["id", "trail", "author_display", "rating", "short_content", "status", "status_badge", "ai_status", "created_at"]
    list_filter = ["status", "is_hidden", "rating", AIFlaggedFilter, "created_at"]
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

    @admin.display(description="AI")
    def ai_status(self, obj):
        return _ai_badge(obj)


@admin.register(ReviewHelpful)
class ReviewHelpfulAdmin(admin.ModelAdmin):
    list_display = ["user", "review", "created_at"]
    search_fields = ["user__nickname"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]
