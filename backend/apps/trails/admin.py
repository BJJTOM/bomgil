from django.contrib import admin

from .collections import Collection
from .models import Tag, Trail, TrailLike


@admin.register(Trail)
class TrailAdmin(admin.ModelAdmin):
    list_display = ["title", "author", "region", "country", "difficulty", "status", "like_count"]
    list_filter = ["status", "difficulty", "country", "best_season"]
    search_fields = ["title", "description", "region"]


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ["name", "name_en", "name_ja"]


@admin.register(TrailLike)
class TrailLikeAdmin(admin.ModelAdmin):
    list_display = ["user", "trail", "created_at"]


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ["title", "is_featured", "created_at"]
    filter_horizontal = ["trails"]
