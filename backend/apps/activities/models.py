from django.conf import settings
from django.db import models


class ActivityTrack(models.Model):
    SOURCE_CHOICES = [
        ("manual_gpx", "GPX 파일 업로드"),
        ("apple_watch", "Apple Watch"),
        ("garmin", "Garmin"),
        ("samsung_health", "Samsung Health"),
        ("google_fit", "Google Fit"),
        ("cashwalk", "캐시워크"),
        ("phone_gps", "스마트폰 GPS"),
        ("strava", "Strava"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="activity_tracks")
    trail = models.ForeignKey("trails.Trail", on_delete=models.SET_NULL, null=True, blank=True, related_name="activity_tracks")
    story = models.ForeignKey("stories.WalkStory", on_delete=models.SET_NULL, null=True, blank=True, related_name="activity_tracks")

    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default="phone_gps")
    gpx_file = models.FileField(upload_to="activities/gpx/", null=True, blank=True)
    track_points = models.JSONField(default=list, help_text="Array of {lat, lng, ele, time}")

    title = models.CharField(max_length=100, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    total_steps = models.PositiveIntegerField(null=True, blank=True)
    distance_km = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    calories_burned = models.PositiveIntegerField(null=True, blank=True)
    elevation_gain_m = models.PositiveIntegerField(null=True, blank=True)
    elevation_loss_m = models.PositiveIntegerField(null=True, blank=True)
    max_elevation_m = models.DecimalField(max_digits=7, decimal_places=1, null=True, blank=True)
    min_elevation_m = models.DecimalField(max_digits=7, decimal_places=1, null=True, blank=True)
    avg_speed_kmh = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    max_speed_kmh = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    avg_pace_min_km = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)

    min_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    max_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    min_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    max_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    # Phase 12 — weather captured at walk start (via OpenWeatherMap)
    weather_temp_c = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True, help_text="기온 (°C)")
    weather_condition = models.CharField(max_length=40, blank=True, default="", help_text="날씨 상태 (Clear/Rain/Snow 등)")
    weather_icon = models.CharField(max_length=10, blank=True, default="", help_text="OpenWeatherMap 아이콘 코드")

    is_public = models.BooleanField(default=True)
    # Admin moderation — hide without deleting
    is_hidden = models.BooleanField(default=False, db_index=True)
    hidden_at = models.DateTimeField(null=True, blank=True)
    hidden_reason = models.CharField(max_length=200, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "활동 기록"
        verbose_name_plural = "활동 기록"

    def __str__(self):
        return self.title or f"{self.user.nickname}의 활동 기록"


class DailyActivitySummary(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="daily_summaries")
    date = models.DateField()
    total_steps = models.PositiveIntegerField(default=0)
    total_distance_km = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    total_duration_minutes = models.PositiveIntegerField(default=0)
    total_calories = models.PositiveIntegerField(default=0)
    track_count = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ["user", "date"]
        ordering = ["-date"]
        verbose_name = "일별 활동 요약"
        verbose_name_plural = "일별 활동 요약"

    def __str__(self):
        return f"{self.user.nickname} - {self.date}"
