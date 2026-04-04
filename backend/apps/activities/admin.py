from django.contrib import admin
from .models import ActivityTrack, DailyActivitySummary


@admin.register(ActivityTrack)
class ActivityTrackAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "source", "distance_km", "duration_minutes", "created_at"]
    list_filter = ["source", "created_at"]


@admin.register(DailyActivitySummary)
class DailyActivitySummaryAdmin(admin.ModelAdmin):
    list_display = ["user", "date", "total_steps", "total_distance_km"]
