"""
Community admin — full moderation panel.

Every content model gets:
  - rich list_display (id, author, key fields, hidden state, created_at)
  - search across content + author
  - filter by category, status, hidden
  - date_hierarchy by created_at
  - "Hide selected" / "Unhide selected" bulk actions
  - clickable author links to the user admin
"""
from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html
from django.urls import reverse

from .models import (
    Post, PostImage, PostComment, PostLike, CommentLike, PostBookmark,
    Report, UserBlock,
    Group, GroupMember, GroupMessage,
    Challenge, ChallengeParticipant,
    Notice, SiteConfig,
)


# ── Reusable hide/unhide actions ────────────────────────────────────
@admin.action(description="🚫 선택한 항목 숨김 (소프트 삭제)")
def hide_selected(modeladmin, request, queryset):
    updated = queryset.filter(is_hidden=False).update(
        is_hidden=True,
        hidden_at=timezone.now(),
    )
    modeladmin.message_user(request, f"{updated}개 항목을 숨겼습니다.")


@admin.action(description="✅ 선택한 항목 다시 보이기")
def unhide_selected(modeladmin, request, queryset):
    updated = queryset.filter(is_hidden=True).update(
        is_hidden=False,
        hidden_at=None,
    )
    modeladmin.message_user(request, f"{updated}개 항목을 복원했습니다.")


def author_link(obj, attr="author"):
    user = getattr(obj, attr, None)
    if not user:
        return "-"
    url = reverse("admin:accounts_customuser_change", args=[user.pk])
    return format_html('<a href="{}">{}</a>', url, user.nickname or user.username)


def hidden_badge(obj):
    if getattr(obj, 'is_hidden', False):
        return format_html(
            '<span style="color:#fff;background:#EF4444;padding:2px 8px;'
            'border-radius:8px;font-size:11px;font-weight:600;">숨김</span>'
        )
    return format_html('<span style="color:#22C55E;font-size:11px;font-weight:600;">공개</span>')


# ── Post ────────────────────────────────────────────────────────────
class PostImageInline(admin.TabularInline):
    model = PostImage
    extra = 0


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'title', 'author_display', 'category', 'like_count',
        'comment_count', 'view_count', 'status_badge', 'created_at',
    ]
    list_filter = ['category', 'is_hidden', 'is_pinned', 'created_at']
    search_fields = ['title', 'content', 'author__nickname', 'author__username']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    readonly_fields = ['like_count', 'comment_count', 'view_count', 'bookmark_count', 'hidden_at']
    actions = [hide_selected, unhide_selected]
    inlines = [PostImageInline]
    list_per_page = 50

    @admin.display(description='작성자')
    def author_display(self, obj):
        return author_link(obj)

    @admin.display(description='상태', ordering='is_hidden')
    def status_badge(self, obj):
        return hidden_badge(obj)


@admin.register(PostComment)
class PostCommentAdmin(admin.ModelAdmin):
    list_display = ['id', 'short_content', 'author_display', 'post', 'parent', 'like_count', 'status_badge', 'created_at']
    list_filter = ['is_hidden', 'is_deleted', 'created_at']
    search_fields = ['content', 'author__nickname']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    readonly_fields = ['like_count', 'hidden_at']
    actions = [hide_selected, unhide_selected]
    list_per_page = 100

    @admin.display(description='댓글 내용')
    def short_content(self, obj):
        return obj.content[:60] + "..." if len(obj.content) > 60 else obj.content

    @admin.display(description='작성자')
    def author_display(self, obj):
        return author_link(obj)

    @admin.display(description='상태', ordering='is_hidden')
    def status_badge(self, obj):
        if obj.is_hidden:
            return format_html('<span style="color:#fff;background:#EF4444;padding:2px 8px;border-radius:8px;font-size:11px;">숨김</span>')
        if obj.is_deleted:
            return format_html('<span style="color:#fff;background:#9CA3AF;padding:2px 8px;border-radius:8px;font-size:11px;">유저삭제</span>')
        return format_html('<span style="color:#22C55E;font-size:11px;">공개</span>')


@admin.register(PostLike)
class PostLikeAdmin(admin.ModelAdmin):
    list_display = ['user', 'post', 'created_at']
    search_fields = ['user__nickname', 'post__title']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']


@admin.register(PostBookmark)
class PostBookmarkAdmin(admin.ModelAdmin):
    list_display = ['user', 'post', 'created_at']
    search_fields = ['user__nickname', 'post__title']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']


@admin.register(CommentLike)
class CommentLikeAdmin(admin.ModelAdmin):
    list_display = ['user', 'comment', 'created_at']
    search_fields = ['user__nickname']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']


# ── Reports & Blocks ────────────────────────────────────────────────
@admin.register(Report)
class CommunityReportAdmin(admin.ModelAdmin):
    list_display = ['id', 'reporter', 'target_type', 'target_id', 'reason', 'status', 'created_at']
    list_filter = ['target_type', 'reason', 'status', 'created_at']
    search_fields = ['reporter__nickname', 'detail']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    list_editable = ['status']


@admin.register(UserBlock)
class UserBlockAdmin(admin.ModelAdmin):
    list_display = ['blocker', 'blocked', 'created_at']
    search_fields = ['blocker__nickname', 'blocked__nickname']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']


# ── Groups & messages ───────────────────────────────────────────────
@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'owner_display', 'category', 'member_count', 'is_public', 'status_badge', 'created_at']
    list_filter = ['category', 'is_public', 'is_hidden', 'created_at']
    search_fields = ['name', 'description', 'owner__nickname']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    readonly_fields = ['member_count', 'hidden_at']
    actions = [hide_selected, unhide_selected]

    @admin.display(description='소유자')
    def owner_display(self, obj):
        return author_link(obj, 'owner')

    @admin.display(description='상태', ordering='is_hidden')
    def status_badge(self, obj):
        return hidden_badge(obj)


@admin.register(GroupMember)
class GroupMemberAdmin(admin.ModelAdmin):
    list_display = ['group', 'user', 'role', 'joined_at']
    list_filter = ['role']
    search_fields = ['group__name', 'user__nickname']
    date_hierarchy = 'joined_at'
    ordering = ['-joined_at']


@admin.register(GroupMessage)
class GroupMessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'short_content', 'sender_display', 'group', 'status_badge', 'created_at']
    list_filter = ['is_hidden', 'created_at']
    search_fields = ['content', 'sender__nickname', 'group__name']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    readonly_fields = ['hidden_at']
    actions = [hide_selected, unhide_selected]
    list_per_page = 100

    @admin.display(description='내용')
    def short_content(self, obj):
        return obj.content[:50] + '…' if len(obj.content) > 50 else obj.content

    @admin.display(description='보낸 사람')
    def sender_display(self, obj):
        return author_link(obj, 'sender')

    @admin.display(description='상태', ordering='is_hidden')
    def status_badge(self, obj):
        return hidden_badge(obj)


# ── Challenge ───────────────────────────────────────────────────────
@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
    list_display = ['title', 'challenge_type', 'status', 'goal_value', 'participant_count', 'start_date', 'end_date']
    list_filter = ['status', 'challenge_type']
    search_fields = ['title', 'description']
    date_hierarchy = 'start_date'
    ordering = ['-start_date']


@admin.register(ChallengeParticipant)
class ChallengeParticipantAdmin(admin.ModelAdmin):
    list_display = ['challenge', 'user', 'current_value', 'completed', 'joined_at']
    list_filter = ['completed']
    search_fields = ['user__nickname', 'challenge__title']
    date_hierarchy = 'joined_at'
    ordering = ['-joined_at']


# ── Site Config ─────────────────────────────────────────────────────
@admin.register(SiteConfig)
class SiteConfigAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'instagram_url', 'threads_url', 'youtube_url', 'updated_at']
    readonly_fields = ['updated_at']

    def has_add_permission(self, request):
        return not SiteConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


# ── Notice ──────────────────────────────────────────────────────────
@admin.register(Notice)
class NoticeAdmin(admin.ModelAdmin):
    list_display = ['title', 'is_pinned', 'is_published', 'created_at', 'updated_at']
    list_filter = ['is_pinned', 'is_published']
    search_fields = ['title', 'content']
    list_editable = ['is_pinned', 'is_published']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
