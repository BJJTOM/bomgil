import hashlib
import re

from django.core.cache import cache
from rest_framework import serializers

from apps.accounts.serializers import UserPublicSerializer

from .models import (
    Tag,
    Trail,
    TrailBookmark,
    TrailCompletion,
    TrailCondition,
    TrailLike,
    TrailSeries,
    TrailSeriesTrail,
)


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


def _bulk_bookmarked_set(context):
    if "_bookmarked_ids" not in context:
        request = context.get("request")
        if request and request.user.is_authenticated:
            context["_bookmarked_ids"] = set(
                TrailBookmark.objects.filter(user=request.user).values_list("trail_id", flat=True)
            )
        else:
            context["_bookmarked_ids"] = set()
    return context["_bookmarked_ids"]


def _bulk_completed_set(context):
    if "_completed_ids" not in context:
        request = context.get("request")
        if request and request.user.is_authenticated:
            context["_completed_ids"] = set(
                TrailCompletion.objects.filter(user=request.user).values_list("trail_id", flat=True)
            )
        else:
            context["_completed_ids"] = set()
    return context["_completed_ids"]


class TrailListSerializer(serializers.ModelSerializer):
    author = UserPublicSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = Trail
        fields = [
            "id", "author", "title", "region", "country",
            "distance_km", "estimated_minutes", "difficulty",
            "cover_image", "thumbnail_url", "tags", "best_season", "status",
            "view_count", "like_count", "is_liked", "is_bookmarked", "is_completed",
            "created_at", "is_official", "source", "trail_type",
        ]

    def get_cover_image(self, obj):
        return _get_cached_cover_image_url(obj)

    def get_is_liked(self, obj):
        return obj.pk in _bulk_liked_set(self.context)

    def get_is_bookmarked(self, obj):
        return obj.pk in _bulk_bookmarked_set(self.context)

    def get_is_completed(self, obj):
        return obj.pk in _bulk_completed_set(self.context)


class TrailDetailSerializer(serializers.ModelSerializer):
    author = UserPublicSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()
    completion_count = serializers.SerializerMethodField()
    cover_image = serializers.SerializerMethodField()
    # Freshest condition report (≤7 days old) surfaced as a banner
    # on the mobile trail detail. None if nothing recent.
    latest_condition = serializers.SerializerMethodField()
    condition_count = serializers.SerializerMethodField()

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

    def get_is_bookmarked(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return TrailBookmark.objects.filter(user=request.user, trail=obj).exists()
        return False

    def get_is_completed(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return TrailCompletion.objects.filter(user=request.user, trail=obj).exists()
        return False

    def get_completion_count(self, obj):
        return TrailCompletion.objects.filter(trail=obj).count()

    def get_latest_condition(self, obj):
        from datetime import timedelta
        from django.utils import timezone
        cutoff = timezone.now() - timedelta(days=7)
        latest = (
            TrailCondition.objects
            .filter(trail=obj, is_hidden=False, created_at__gte=cutoff)
            .select_related("user")
            .order_by("-created_at")
            .first()
        )
        if not latest:
            return None
        return TrailConditionSerializer(latest, context=self.context).data

    def get_condition_count(self, obj):
        return TrailCondition.objects.filter(trail=obj, is_hidden=False).count()


class TrailBookmarkSerializer(serializers.ModelSerializer):
    trail = TrailListSerializer(read_only=True)

    class Meta:
        model = TrailBookmark
        fields = ["id", "trail", "note", "created_at"]


class TrailCompletionSerializer(serializers.ModelSerializer):
    trail = TrailListSerializer(read_only=True)

    class Meta:
        model = TrailCompletion
        fields = ["id", "trail", "source", "coverage", "completed_at"]


# --- Trail Conditions -----------------------------------------------------

class TrailConditionSerializer(serializers.ModelSerializer):
    user = UserPublicSerializer(read_only=True)
    tag_display = serializers.CharField(source="get_tag_display", read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = TrailCondition
        fields = [
            "id", "user", "tag", "tag_display", "note", "image",
            "helpful_count", "created_at",
        ]
        read_only_fields = ["id", "user", "helpful_count", "created_at"]

    def get_image(self, obj):
        if not obj.image:
            return None
        try:
            return obj.image.url
        except Exception:
            return None


class TrailConditionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrailCondition
        fields = ["tag", "note", "image"]


# --- Trail Series ---------------------------------------------------------

class TrailSeriesListSerializer(serializers.ModelSerializer):
    """Compact series representation for lists.

    Embeds progress so the client doesn't have to make N+1 calls.
    progress_completed / progress_total / progress_pct are 0 for anon
    users.
    """

    progress_completed = serializers.SerializerMethodField()
    progress_total = serializers.SerializerMethodField()
    progress_pct = serializers.SerializerMethodField()

    class Meta:
        model = TrailSeries
        fields = [
            "id", "slug", "title", "title_en", "subtitle", "region",
            "cover_image", "accent_emoji", "is_featured",
            "progress_completed", "progress_total", "progress_pct",
        ]

    def get_progress_total(self, obj):
        # Prefer a prefetched annotation if the viewset set one
        if hasattr(obj, "_trail_count"):
            return obj._trail_count
        return obj.trails.count()

    def get_progress_completed(self, obj):
        request = self.context.get("request")
        if not (request and request.user.is_authenticated):
            return 0
        trail_ids = list(obj.trails.values_list("id", flat=True))
        if not trail_ids:
            return 0
        return TrailCompletion.objects.filter(
            user=request.user, trail_id__in=trail_ids,
        ).values("trail_id").distinct().count()

    def get_progress_pct(self, obj):
        total = self.get_progress_total(obj)
        if total == 0:
            return 0
        done = self.get_progress_completed(obj)
        return round((done / total) * 100)


class TrailSeriesSegmentSerializer(serializers.ModelSerializer):
    """One segment row in the series detail view.

    Inlines the trail payload (so the client can render a card) plus
    the segment's order and label within the series, plus a per-user
    is_completed flag.
    """

    trail = TrailListSerializer(read_only=True)
    is_completed = serializers.SerializerMethodField()

    class Meta:
        model = TrailSeriesTrail
        fields = ["id", "order", "segment_label", "trail", "is_completed"]

    def get_is_completed(self, obj):
        request = self.context.get("request")
        if not (request and request.user.is_authenticated):
            return False
        # Bulk set cached on context to avoid N queries when rendering
        # a long series detail
        key = "_series_completed_trail_ids"
        if key not in self.context:
            series = self.context.get("_series_instance")
            if series is not None:
                trail_ids = list(series.trails.values_list("id", flat=True))
                self.context[key] = set(
                    TrailCompletion.objects
                    .filter(user=request.user, trail_id__in=trail_ids)
                    .values_list("trail_id", flat=True)
                )
            else:
                self.context[key] = set()
        return obj.trail_id in self.context[key]


class TrailSeriesDetailSerializer(TrailSeriesListSerializer):
    description = serializers.CharField(read_only=True)
    segments = serializers.SerializerMethodField()

    class Meta(TrailSeriesListSerializer.Meta):
        fields = TrailSeriesListSerializer.Meta.fields + ["description", "segments"]

    def get_segments(self, obj):
        ctx = dict(self.context)
        ctx["_series_instance"] = obj
        qs = (
            obj.memberships
            .select_related("trail", "trail__author")
            .prefetch_related("trail__tags")
            .order_by("order")
        )
        return TrailSeriesSegmentSerializer(qs, many=True, context=ctx).data


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
