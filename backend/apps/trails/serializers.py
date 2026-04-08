import hashlib
import re

from django.core.cache import cache
from rest_framework import serializers

from apps.accounts.serializers import UserPublicSerializer

from .models import Tag, Trail, TrailLike


def _strip_tags(value):
    if not value:
        return value
    return re.sub(r'<[^>]+>', '', value).strip()


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "name_en", "name_ja"]


def _get_cached_cover_image_url(trail):
    """Return a cached signed URL for the trail's cover_image (1-hour TTL).

    Avoids calling R2/S3 to generate a new signed URL on every request.
    """
    if not trail.cover_image:
        return None
    # Build a stable cache key from the image name
    image_name = trail.cover_image.name
    key = f"trail_cover_url:{hashlib.md5(image_name.encode()).hexdigest()}"
    url = cache.get(key)
    if url is None:
        url = trail.cover_image.url  # generates a signed R2 URL
        cache.set(key, url, timeout=3600)  # cache for 1 hour
    return url


def _bulk_liked_set(context):
    """Return a set of trail IDs liked by the current user (cached on context)."""
    if "_liked_ids" not in context:
        request = context.get("request")
        if request and request.user.is_authenticated:
            context["_liked_ids"] = set(
                TrailLike.objects.filter(user=request.user).values_list("trail_id", flat=True)
            )
        else:
            context["_liked_ids"] = set()
    return context["_liked_ids"]


class TrailListSerializer(serializers.ModelSerializer):
    author = UserPublicSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    is_liked = serializers.SerializerMethodField()
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = Trail
        fields = [
            "id", "author", "title", "region", "country",
            "distance_km", "estimated_minutes", "difficulty",
            "cover_image", "thumbnail_url", "tags", "best_season", "status",
            "view_count", "like_count", "is_liked", "created_at",
        ]

    def get_cover_image(self, obj):
        return _get_cached_cover_image_url(obj)

    def get_is_liked(self, obj):
        return obj.pk in _bulk_liked_set(self.context)


class TrailDetailSerializer(serializers.ModelSerializer):
    author = UserPublicSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    is_liked = serializers.SerializerMethodField()
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = Trail
        fields = "__all__"
        read_only_fields = ["author", "view_count", "like_count", "status", "rejection_reason"]

    def get_cover_image(self, obj):
        return _get_cached_cover_image_url(obj)

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return TrailLike.objects.filter(user=request.user, trail=obj).exists()
        return False


class TrailCreateSerializer(serializers.ModelSerializer):
    tag_ids = serializers.PrimaryKeyRelatedField(
        queryset=Tag.objects.all(), many=True, required=False, write_only=True
    )
    tags = serializers.ListField(
        child=serializers.CharField(), required=False, write_only=True
    )

    class Meta:
        model = Trail
        fields = [
            "id", "title", "title_en", "title_ja",
            "description", "description_en", "description_ja",
            "region", "country", "distance_km", "estimated_minutes",
            "difficulty", "elevation_gain",
            "start_lat", "start_lng", "end_lat", "end_lng",
            "path_data", "cover_image", "tag_ids", "tags", "best_season", "status",
        ]
        read_only_fields = ["id"]

    def validate_title(self, value):
        return _strip_tags(value)

    def validate_description(self, value):
        return _strip_tags(value)

    def validate_title_en(self, value):
        return _strip_tags(value)

    def validate_title_ja(self, value):
        return _strip_tags(value)

    def validate_description_en(self, value):
        return _strip_tags(value)

    def validate_description_ja(self, value):
        return _strip_tags(value)

    def create(self, validated_data):
        tag_ids = validated_data.pop("tag_ids", [])
        tag_names = validated_data.pop("tags", [])
        trail = Trail.objects.create(**validated_data)
        # Resolve tags: accept both IDs and names
        all_tags = list(tag_ids)
        for name in tag_names:
            tag, _ = Tag.objects.get_or_create(name=name)
            all_tags.append(tag)
        if all_tags:
            trail.tags.set(all_tags)
        return trail
