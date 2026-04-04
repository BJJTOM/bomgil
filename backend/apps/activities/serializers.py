from rest_framework import serializers
from apps.accounts.serializers import UserPublicSerializer
from .models import ActivityTrack, DailyActivitySummary


class ActivityTrackListSerializer(serializers.ModelSerializer):
    user = UserPublicSerializer(read_only=True)

    class Meta:
        model = ActivityTrack
        fields = [
            "id", "user", "trail", "story", "source", "title",
            "started_at", "finished_at", "total_steps",
            "distance_km", "duration_minutes", "calories_burned",
            "elevation_gain_m", "avg_speed_kmh", "avg_pace_min_km",
            "is_public", "created_at",
        ]


class ActivityTrackDetailSerializer(serializers.ModelSerializer):
    user = UserPublicSerializer(read_only=True)

    class Meta:
        model = ActivityTrack
        fields = [
            "id", "user", "trail", "story", "source", "title",
            "track_points", "started_at", "finished_at",
            "total_steps", "distance_km", "duration_minutes",
            "calories_burned", "elevation_gain_m", "elevation_loss_m",
            "max_elevation_m", "min_elevation_m",
            "avg_speed_kmh", "max_speed_kmh", "avg_pace_min_km",
            "min_lat", "max_lat", "min_lng", "max_lng",
            "is_public", "created_at", "updated_at",
        ]


class ActivityTrackCreateSerializer(serializers.ModelSerializer):
    gpx_file = serializers.FileField(required=False)

    class Meta:
        model = ActivityTrack
        fields = [
            "trail", "story", "source", "gpx_file", "track_points",
            "title", "total_steps", "calories_burned", "is_public",
        ]
        extra_kwargs = {
            "trail": {"required": False},
            "story": {"required": False},
            "track_points": {"required": False},
        }

    def validate_gpx_file(self, value):
        if value:
            if not value.name.lower().endswith('.gpx'):
                raise serializers.ValidationError("GPX 파일만 업로드할 수 있습니다.")
            if value.size > 10 * 1024 * 1024:  # 10MB
                raise serializers.ValidationError("파일 크기는 10MB를 초과할 수 없습니다.")
        return value


class DailyActivitySummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyActivitySummary
        fields = ["date", "total_steps", "total_distance_km", "total_duration_minutes", "total_calories", "track_count"]
