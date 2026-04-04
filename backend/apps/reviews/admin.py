from django.contrib import admin

from .models import Review, ReviewImage


class ReviewImageInline(admin.TabularInline):
    model = ReviewImage
    extra = 1


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ["trail", "author", "rating", "status", "created_at"]
    list_filter = ["status", "rating"]
    inlines = [ReviewImageInline]
