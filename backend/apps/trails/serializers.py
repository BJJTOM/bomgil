from rest_framework import serializers

from apps.accounts.serializers import UserPublicSerializer

from .models import Tag, Trail, TrailLike


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "name_en", "name_ja"]


class TrailListSerializer(serializers.ModelSerializer):
    author = UserPublicSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Trail
        fields = [
            "id", "author", "title", "region", "country",
            "distance_km", "estimated_minutes", "difficulty",
            "cover_image", "thumbnail_url", "tags", "best_season", "status",
            "view_count", "like_count", "is_liked", "created_at",
        ]

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return TrailLike.objects.filter(user=request.user, trail=obj).exists()
        return False


class TrailDetailSerializer(serializers.ModelSerializer):
    author = UserPublicSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Trail
        fields = "__all__"
        read_only_fields = ["author", "view_count", "like_count", "status", "rejection_reason"]

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return TrailLike.objects.filter(user=request.user, trail=obj).exists()
        return False


class TrailCreateSerializer(serializers.ModelSerializer):
    tag_ids = serializers.PrimaryKeyRelatedField(
        queryset=Tag.objects.all(), many=True, required=False, write_only=True
    )

    class Meta:
        model = Trail
        fields = [
            "title", "title_en", "title_ja",
            "description", "description_en", "description_ja",
            "region", "country", "distance_km", "estimated_minutes",
            "difficulty", "elevation_gain",
            "start_lat", "start_lng", "end_lat", "end_lng",
            "path_data", "cover_image", "tag_ids", "best_season", "status",
        ]

    def create(self, validated_data):
        tags = validated_data.pop("tag_ids", [])
        trail = Trail.objects.create(**validated_data)
        if tags:
            trail.tags.set(tags)
        return trail
