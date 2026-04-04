import re

from django.utils.html import strip_tags
from rest_framework import serializers

from apps.accounts.serializers import UserPublicSerializer

from .models import CommentLike, StoryComment, StoryLike, StoryPhoto, WalkStory


def sanitize_text(value):
    """Strip HTML tags and script content from user input."""
    if not value:
        return value
    # Remove script tags and content
    value = re.sub(r'<script[^>]*>.*?</script>', '', value, flags=re.DOTALL | re.IGNORECASE)
    # Strip all remaining HTML tags
    value = strip_tags(value)
    return value.strip()


class StoryPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoryPhoto
        fields = ["id", "image", "caption", "order"]


class StoryCommentSerializer(serializers.ModelSerializer):
    author = UserPublicSerializer(read_only=True)
    replies = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = StoryComment
        fields = ["id", "author", "content", "like_count", "parent", "replies", "is_liked", "created_at"]
        read_only_fields = ["author", "like_count"]

    def get_replies(self, obj):
        if obj.parent is None:
            replies = obj.replies.select_related("author").all()
            return StoryCommentSerializer(replies, many=True, context=self.context).data
        return []

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return CommentLike.objects.filter(user=request.user, comment=obj).exists()
        return False


class WalkStorySerializer(serializers.ModelSerializer):
    author = UserPublicSerializer(read_only=True)
    photos = StoryPhotoSerializer(many=True, read_only=True)
    companions_tagged = UserPublicSerializer(many=True, read_only=True)
    comments = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    trail_title = serializers.SerializerMethodField()
    trail_region = serializers.SerializerMethodField()
    trail_id = serializers.SerializerMethodField()

    class Meta:
        model = WalkStory
        fields = [
            "id", "walk_plan", "trail", "author", "title", "content", "mood",
            "photos", "companions_tagged", "like_count", "comment_count",
            "comments", "is_liked", "is_public",
            "trail_title", "trail_region", "trail_id",
            "created_at",
        ]
        read_only_fields = ["author", "like_count", "comment_count"]

    def get_comments(self, obj):
        # Only top-level comments (no parent) — replies are nested inside
        top_comments = obj.comments.filter(parent__isnull=True).select_related("author")
        return StoryCommentSerializer(top_comments, many=True, context=self.context).data

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return StoryLike.objects.filter(user=request.user, story=obj).exists()
        return False

    def get_trail_title(self, obj):
        if obj.trail:
            return obj.trail.title
        if obj.walk_plan and obj.walk_plan.trail:
            return obj.walk_plan.trail.title
        return None

    def get_trail_region(self, obj):
        if obj.trail:
            return obj.trail.region
        if obj.walk_plan and obj.walk_plan.trail:
            return obj.walk_plan.trail.region
        return None

    def get_trail_id(self, obj):
        if obj.trail_id:
            return obj.trail_id
        if obj.walk_plan and obj.walk_plan.trail_id:
            return obj.walk_plan.trail_id
        return None


class WalkStoryCreateSerializer(serializers.ModelSerializer):
    companion_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )

    class Meta:
        model = WalkStory
        fields = ["trail", "walk_plan", "title", "content", "mood", "is_public", "companion_ids"]
        extra_kwargs = {"walk_plan": {"required": False}, "trail": {"required": False}}

    def validate_title(self, value):
        return sanitize_text(value)

    def validate_content(self, value):
        return sanitize_text(value)

    def create(self, validated_data):
        companion_ids = validated_data.pop("companion_ids", [])
        story = WalkStory.objects.create(**validated_data)
        if companion_ids:
            story.companions_tagged.set(companion_ids)
        return story
