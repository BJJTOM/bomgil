import re

from django.contrib.auth import authenticate
from dj_rest_auth.registration.serializers import RegisterSerializer
from rest_framework import serializers

from .models import CustomUser, LEVEL_NAMES, Notification, UserBadge, XPLog, xp_for_next_level


def strip_html(value):
    """Remove HTML tags from string."""
    return re.sub(r'<[^>]+>', '', value).strip()


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

    def validate_nickname(self, value):
        cleaned = strip_html(value)
        if cleaned != value:
            raise serializers.ValidationError("HTML 태그는 사용할 수 없습니다.")
        if len(cleaned) < 1 or len(cleaned) > 50:
            raise serializers.ValidationError("닉네임은 1~50자여야 합니다.")
        return cleaned

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
    level_name = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            "id", "username", "email", "nickname", "profile_image", "bio",
            "preferred_language", "is_guide",
            # Phase 8 companion fields
            "age_range", "walking_style", "companion_rating",
            "total_walks", "companion_count", "one_liner",
            # XP / Level
            "xp", "level", "level_name",
            # Phase 11
            "is_verified", "verification_level", "badges",
            "created_at",
        ]
        read_only_fields = [
            "id", "username", "email", "is_guide",
            "companion_rating", "total_walks", "companion_count",
            "xp", "level",
            "is_verified", "verification_level", "created_at",
        ]

    def get_level_name(self, obj):
        return LEVEL_NAMES.get(obj.level, LEVEL_NAMES[1])

    def validate_nickname(self, value):
        cleaned = strip_html(value)
        if cleaned != value:
            raise serializers.ValidationError("HTML 태그는 사용할 수 없습니다.")
        if len(cleaned) < 1 or len(cleaned) > 50:
            raise serializers.ValidationError("닉네임은 1~50자여야 합니다.")
        return cleaned

    def validate_bio(self, value):
        if value and strip_html(value) != value:
            raise serializers.ValidationError("HTML 태그는 사용할 수 없습니다.")
        return strip_html(value) if value else value

    def validate_one_liner(self, value):
        if value and strip_html(value) != value:
            raise serializers.ValidationError("HTML 태그는 사용할 수 없습니다.")
        return strip_html(value) if value else value

    def validate_profile_image(self, value):
        from config.validators import validate_image_file
        if value is None:
            return value
        validate_image_file(value)
        return value


class UserPublicSerializer(serializers.ModelSerializer):
    badges = UserBadgeSerializer(many=True, read_only=True)
    level_name = serializers.SerializerMethodField()
    trail_count = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    follower_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            "id", "nickname", "profile_image", "bio", "is_guide",
            "age_range", "walking_style", "companion_rating",
            "total_walks", "companion_count", "one_liner",
            "xp", "level", "level_name",
            "is_verified", "verification_level", "badges",
            "trail_count", "review_count",
            "follower_count", "following_count", "is_following",
        ]

    def get_level_name(self, obj):
        return LEVEL_NAMES.get(obj.level, LEVEL_NAMES[1])

    def get_trail_count(self, obj):
        return obj.trails.filter(status="approved").count()

    def get_review_count(self, obj):
        return obj.reviews.count()

    def get_follower_count(self, obj):
        return obj.followers.count()

    def get_following_count(self, obj):
        return obj.following.count()

    def get_is_following(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return request.user.following.filter(pk=obj.pk).exists()
        return False


class XPLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = XPLog
        fields = ["id", "amount", "reason", "created_at"]
        read_only_fields = fields


class UserXPDetailSerializer(serializers.ModelSerializer):
    level_name = serializers.SerializerMethodField()
    next_level_xp = serializers.SerializerMethodField()
    xp_logs = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ["xp", "level", "level_name", "next_level_xp", "xp_logs"]

    def get_level_name(self, obj):
        return LEVEL_NAMES.get(obj.level, LEVEL_NAMES[1])

    def get_next_level_xp(self, obj):
        return xp_for_next_level(obj.level)

    def get_xp_logs(self, obj):
        logs = obj.xp_logs.all()[:20]
        return XPLogSerializer(logs, many=True).data


class NotificationSerializer(serializers.ModelSerializer):
    actor_nickname = serializers.CharField(source='actor.nickname', read_only=True, default=None)
    actor_profile_image = serializers.ImageField(source='actor.profile_image', read_only=True, default=None)

    class Meta:
        model = Notification
        fields = [
            'id', 'title', 'body', 'notification_type',
            'target_type', 'target_id', 'is_read',
            'actor_nickname', 'actor_profile_image',
            'created_at',
        ]
        read_only_fields = fields
