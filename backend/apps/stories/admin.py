"""Stories admin — moderation panel for WalkStory + comments."""
from django.contrib import admin
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from django.utils.html import format_html
from django.urls import reverse

from apps.moderation.models import AIModerationLog

from .models import StoryComment, StoryPhoto, WalkStory, StoryLike, CommentLike, Notification


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


@admin.action(description="🚫 선택한 항목 숨김")
def hide_selected(modeladmin, request, queryset):
    updated = queryset.filter(is_hidden=False).update(
        is_hidden=True, hidden_at=timezone.now()
    )
    modeladmin.message_user(request, f"{updated}개 항목을 숨겼습니다.")


@admin.action(description="✅ 선택한 항목 다시 보이기")
def unhide_selected(modeladmin, request, queryset):
    updated = queryset.filter(is_hidden=True).update(
        is_hidden=False, hidden_at=None
    )
    modeladmin.message_user(request, f"{updated}개 항목을 복원했습니다.")


def author_link(obj, attr="author"):
    user = getattr(obj, attr, None)
    if not user:
        return "-"
    url = reverse("admin:accounts_customuser_change", args=[user.pk])
    return format_html('<a href="{}">{}</a>', url, user.nickname or user.username)


def hidden_badge(obj):
    if getattr(obj, "is_hidden", False):
        return format_html('<span style="color:#fff;background:#EF4444;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;">숨김</span>')
    return format_html('<span style="color:#22C55E;font-size:11px;font-weight:600;">공개</span>')


class StoryPhotoInline(admin.TabularInline):
    model = StoryPhoto
    extra = 0


@admin.register(WalkStory)
class WalkStoryAdmin(admin.ModelAdmin):
    list_display = ["id", "title_or_default", "author_display", "mood", "like_count", "comment_count", "is_public", "status_badge", "ai_status", "created_at"]
    list_filter = ["mood", "is_public", "is_hidden", AIFlaggedFilter, "created_at"]
    search_fields = ["title", "content", "author__nickname"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]
    readonly_fields = ["like_count", "comment_count", "hidden_at"]
    actions = [hide_selected, unhide_selected]
    inlines = [StoryPhotoInline]
    list_per_page = 50

    @admin.display(description="제목")
    def title_or_default(self, obj):
        return obj.title or f"{obj.author.nickname}의 이야기"

    @admin.display(description="작성자")
    def author_display(self, obj):
        return author_link(obj)

    @admin.display(description="상태", ordering="is_hidden")
    def status_badge(self, obj):
        return hidden_badge(obj)

    @admin.display(description="AI")
    def ai_status(self, obj):
        return _ai_badge(obj)


@admin.register(StoryComment)
class StoryCommentAdmin(admin.ModelAdmin):
    list_display = ["id", "short_content", "author_display", "story", "parent", "like_count", "status_badge", "ai_status", "created_at"]
    list_filter = ["is_hidden", AIFlaggedFilter, "created_at"]
    search_fields = ["content", "author__nickname"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]
    readonly_fields = ["like_count", "hidden_at"]
    actions = [hide_selected, unhide_selected]
    list_per_page = 100

    @admin.display(description="댓글 내용")
    def short_content(self, obj):
        return obj.content[:50] + "..." if len(obj.content) > 50 else obj.content

    @admin.display(description="작성자")
    def author_display(self, obj):
        return author_link(obj)

    @admin.display(description="상태", ordering="is_hidden")
    def status_badge(self, obj):
        return hidden_badge(obj)

    @admin.display(description="AI")
    def ai_status(self, obj):
        return _ai_badge(obj)


@admin.register(StoryLike)
class StoryLikeAdmin(admin.ModelAdmin):
    list_display = ["user", "story", "created_at"]
    search_fields = ["user__nickname", "story__title"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]


@admin.register(CommentLike)
class StoryCommentLikeAdmin(admin.ModelAdmin):
    list_display = ["user", "comment", "created_at"]
    search_fields = ["user__nickname"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]


@admin.register(Notification)
class StoryNotificationAdmin(admin.ModelAdmin):
    list_display = ["recipient", "notification_type", "sender", "is_read", "created_at"]
    list_filter = ["notification_type", "is_read", "created_at"]
    search_fields = ["recipient__nickname", "sender__nickname"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]
