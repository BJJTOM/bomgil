from django.contrib import admin
from .models import (
    Post, PostImage, PostComment, PostLike, PostBookmark,
    Report, UserBlock,
    Group, GroupMember, GroupMessage,
    Challenge, ChallengeParticipant,
    Notice,
)


class PostImageInline(admin.TabularInline):
    model = PostImage
    extra = 0


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['title', 'author', 'category', 'like_count', 'comment_count', 'view_count', 'bookmark_count', 'created_at']
    list_filter = ['category', 'is_pinned']
    search_fields = ['title', 'content']
    inlines = [PostImageInline]


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ['reporter', 'target_type', 'target_id', 'reason', 'status', 'created_at']
    list_filter = ['target_type', 'reason', 'status']


@admin.register(UserBlock)
class UserBlockAdmin(admin.ModelAdmin):
    list_display = ['blocker', 'blocked', 'created_at']


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'owner', 'category', 'member_count', 'is_public', 'created_at']
    list_filter = ['category', 'is_public']
    search_fields = ['name']


@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
    list_display = ['title', 'challenge_type', 'status', 'goal_value', 'participant_count', 'start_date', 'end_date']
    list_filter = ['status', 'challenge_type']


@admin.register(Notice)
class NoticeAdmin(admin.ModelAdmin):
    list_display = ['title', 'is_pinned', 'is_published', 'created_at', 'updated_at']
    list_filter = ['is_pinned', 'is_published']
    search_fields = ['title', 'content']
    list_editable = ['is_pinned', 'is_published']
