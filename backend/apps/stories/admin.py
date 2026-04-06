from django.contrib import admin

from .models import StoryComment, StoryPhoto, WalkStory


class StoryPhotoInline(admin.TabularInline):
    model = StoryPhoto
    extra = 1


@admin.register(WalkStory)
class WalkStoryAdmin(admin.ModelAdmin):
    list_display = ["title", "author", "mood", "like_count", "comment_count", "is_public", "created_at"]
    list_filter = ["mood", "is_public", "created_at"]
    search_fields = ["title", "content", "author__nickname"]
    readonly_fields = ["like_count", "comment_count"]
    inlines = [StoryPhotoInline]


@admin.register(StoryComment)
class StoryCommentAdmin(admin.ModelAdmin):
    list_display = ["short_content", "author", "story", "parent", "like_count", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["content", "author__nickname"]
    readonly_fields = ["like_count"]

    @admin.display(description="댓글 내용")
    def short_content(self, obj):
        return obj.content[:50] + "..." if len(obj.content) > 50 else obj.content
