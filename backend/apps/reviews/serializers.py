import re

from django.utils.html import strip_tags
from rest_framework import serializers

from apps.accounts.serializers import UserPublicSerializer

from .models import Review, ReviewImage


def sanitize_text(value):
    """Strip HTML tags and script content from user input."""
    if not value:
        return value
    value = re.sub(r'<script[^>]*>.*?</script>', '', value, flags=re.DOTALL | re.IGNORECASE)
    value = strip_tags(value)
    return value.strip()


class ReviewImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewImage
        fields = ["id", "image", "order"]


class ReviewSerializer(serializers.ModelSerializer):
    author = UserPublicSerializer(read_only=True)
    images = ReviewImageSerializer(many=True, read_only=True)

    class Meta:
        model = Review
        fields = "__all__"
        read_only_fields = ["author", "helpful_count", "status"]


class ReviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ["rating", "content", "visited_date"]

    def validate_content(self, value):
        return sanitize_text(value)
