from django.contrib import admin
from .models import (
    Post, PostImage, PostComment, PostLike,
    Group, GroupMember, GroupMessage,
    Challenge, ChallengeParticipant,
)


class PostImageInline(admin.TabularInline):
    model = PostImage
    extra = 0


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['title', 'author', 'category', 'like_count', 'comment_count', 'view_count', 'created_at']
    list_filter = ['category', 'is_pinned']
    search_fields = ['title', 'content']
    inlines = [PostImageInline]


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'owner', 'category', 'member_count', 'is_public', 'created_at']
    list_filter = ['category', 'is_public']
    search_fields = ['name']


@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
    list_display = ['title', 'challenge_type', 'status', 'goal_value', 'participant_count', 'start_date', 'end_date']
    list_filter = ['status', 'challenge_type']
