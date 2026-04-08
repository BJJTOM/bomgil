import re

from rest_framework import serializers

from .models import Spot, SpotImage


def _strip_tags(value):
    if not value:
        return value
    return re.sub(r'<[^>]+>', '', value).strip()


class SpotImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpotImage
        fields = ["id", "spot", "image", "order"]
        extra_kwargs = {"spot": {"required": False}}


class SpotSerializer(serializers.ModelSerializer):
    images = SpotImageSerializer(many=True, read_only=True)
    author_nickname = serializers.CharField(source="author.nickname", read_only=True)

    class Meta:
        model = Spot
        fields = [
            "id", "trail", "author", "author_nickname", "name", "name_en", "name_ja",
            "spot_type", "lat", "lng", "order", "distance_from_start_km",
            "description", "description_en", "description_ja",
            "menu_highlight", "price_range", "rating", "tip",
            "images", "status", "created_at", "updated_at",
        ]
        read_only_fields = ["author", "status"]


class SpotCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Spot
        fields = [
            "id", "trail", "name", "name_en", "name_ja", "spot_type",
            "lat", "lng", "order", "distance_from_start_km",
            "description", "description_en", "description_ja",
            "menu_highlight", "price_range", "tip",
        ]
        read_only_fields = ["id"]

    def validate_name(self, value):
        return _strip_tags(value)

    def validate_description(self, value):
        return _strip_tags(value)

    def validate_tip(self, value):
        return _strip_tags(value)

    def validate_menu_highlight(self, value):
        return _strip_tags(value)
