from rest_framework import serializers

from apps.accounts.serializers import UserPublicSerializer

from .models import Review, ReviewImage


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
