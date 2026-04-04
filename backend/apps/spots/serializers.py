from rest_framework import serializers

from .models import Spot, SpotImage


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
            "trail", "name", "name_en", "name_ja", "spot_type",
            "lat", "lng", "order", "distance_from_start_km",
            "description", "description_en", "description_ja",
            "menu_highlight", "price_range", "tip",
        ]
