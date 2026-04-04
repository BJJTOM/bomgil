from django.contrib import admin

from .models import StoryPhoto, WalkStory


class StoryPhotoInline(admin.TabularInline):
    model = StoryPhoto
    extra = 1


@admin.register(WalkStory)
class WalkStoryAdmin(admin.ModelAdmin):
    list_display = ["title", "author", "mood", "like_count", "created_at"]
    list_filter = ["mood"]
    inlines = [StoryPhotoInline]
