from django.contrib.auth import authenticate
from dj_rest_auth.registration.serializers import RegisterSerializer
from rest_framework import serializers

from .models import CustomUser, UserBadge


class EmailLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data.get('email')
        password = data.get('password')
        if not email or not password:
            raise serializers.ValidationError("이메일과 비밀번호를 입력해주세요.")
        try:
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError("이메일 또는 비밀번호가 올바르지 않습니다.")
        user = authenticate(username=user.username, password=password)
        if user is None:
            raise serializers.ValidationError("이메일 또는 비밀번호가 올바르지 않습니다.")
        data['user'] = user
        return data


class CustomRegisterSerializer(RegisterSerializer):
    nickname = serializers.CharField(max_length=50, required=True)

    def get_cleaned_data(self):
        data = super().get_cleaned_data()
        data["nickname"] = self.validated_data.get("nickname", "")
        return data

    def custom_signup(self, request, user):
        user.nickname = self.validated_data.get("nickname", "")
        user.save(update_fields=["nickname"])


class UserBadgeSerializer(serializers.ModelSerializer):
    label = serializers.CharField(source="get_badge_type_display", read_only=True)

    class Meta:
        model = UserBadge
        fields = ["badge_type", "label", "earned_at"]


class UserSerializer(serializers.ModelSerializer):
    badges = UserBadgeSerializer(many=True, read_only=True)

    class Meta:
        model = CustomUser
        fields = [
            "id", "username", "email", "nickname", "profile_image", "bio",
            "preferred_language", "is_guide",
            # Phase 8 companion fields
            "age_range", "walking_style", "companion_rating",
            "total_walks", "companion_count", "one_liner",
            # Phase 11
            "is_verified", "verification_level", "badges",
            "created_at",
        ]
        read_only_fields = [
            "id", "username", "email", "is_guide",
            "companion_rating", "total_walks", "companion_count",
            "is_verified", "verification_level", "created_at",
        ]


class UserPublicSerializer(serializers.ModelSerializer):
    badges = UserBadgeSerializer(many=True, read_only=True)
    trail_count = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            "id", "nickname", "profile_image", "bio", "is_guide",
            "age_range", "walking_style", "companion_rating",
            "total_walks", "companion_count", "one_liner",
            "is_verified", "verification_level", "badges",
            "trail_count", "review_count",
        ]

    def get_trail_count(self, obj):
        return obj.trails.filter(status="approved").count()

    def get_review_count(self, obj):
        return obj.reviews.count()
