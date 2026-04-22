import re

from django.contrib.auth import authenticate
from dj_rest_auth.registration.serializers import RegisterSerializer
from rest_framework import serializers

from .models import (
    AgreementAcceptance,
    CustomUser,
    LEVEL_NAMES,
    Notification,
    UserBadge,
    XPLog,
    xp_for_next_level,
)


REQUIRED_AGREEMENTS = ("terms", "privacy", "location-terms", "location-privacy", "age-14")


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

    # Consent booleans — all required ones must be true before a user can
    # register. Marketing is stored but optional.
    agree_terms = serializers.BooleanField(write_only=True)
    agree_privacy = serializers.BooleanField(write_only=True)
    agree_location_terms = serializers.BooleanField(write_only=True)
    agree_location_privacy = serializers.BooleanField(write_only=True)
    agree_age_14 = serializers.BooleanField(write_only=True)
    agree_marketing = serializers.BooleanField(write_only=True, required=False, default=False)

    def validate_nickname(self, value):
        cleaned = strip_html(value)
        if cleaned != value:
            raise serializers.ValidationError("HTML 태그는 사용할 수 없습니다.")
        if len(cleaned) < 1 or len(cleaned) > 50:
            raise serializers.ValidationError("닉네임은 1~50자여야 합니다.")
        return cleaned

    def validate(self, data):
        data = super().validate(data)
        missing = []
        if not data.get("agree_terms"):
            missing.append("이용약관")
        if not data.get("agree_privacy"):
            missing.append("개인정보처리방침")
        if not data.get("agree_location_terms"):
            missing.append("위치기반서비스 이용약관")
        if not data.get("agree_location_privacy"):
            missing.append("개인위치정보 처리방침")
        if not data.get("agree_age_14"):
            missing.append("만 14세 이상 확인")
        if missing:
            raise serializers.ValidationError(
                {"non_field_errors": [f"필수 약관에 동의해야 합니다: {', '.join(missing)}"]}
            )
        return data

    def get_cleaned_data(self):
        data = super().get_cleaned_data()
        data["nickname"] = self.validated_data.get("nickname", "")
        return data

    def custom_signup(self, request, user):
        from django.utils import timezone
        from apps.community.models import LegalDocument

        user.nickname = self.validated_data.get("nickname", "")
        marketing = bool(self.validated_data.get("agree_marketing", False))
        update_fields = ["nickname"]
        if marketing:
            user.marketing_consent = True
            user.marketing_consent_at = timezone.now()
            update_fields += ["marketing_consent", "marketing_consent_at"]
        user.save(update_fields=update_fields)

        # Record each accepted agreement with the live version the user
        # was shown, so we can later prove which wording they agreed to.
        ip = _client_ip(request)
        ua = (request.META.get("HTTP_USER_AGENT", "") if request else "")[:300]
        to_log = list(REQUIRED_AGREEMENTS) + (["marketing-consent"] if marketing else [])
        for slug in to_log:
            doc = LegalDocument.latest_published(slug) if slug != "age-14" else None
            version = doc.version if doc else ""
            AgreementAcceptance.objects.get_or_create(
                user=user,
                slug=slug,
                defaults={"version": version, "ip_address": ip, "user_agent": ua},
            )


def _client_ip(request):
    if not request:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


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
            "phone_number", "phone_verified",
            # Phase 12 — physical profile (drives walk engine accuracy)
            "weight_kg", "height_cm", "birth_year", "gender", "weekly_goal_km",
            "created_at",
        ]
        read_only_fields = [
            "id", "username", "email", "is_guide",
            "companion_rating", "total_walks", "companion_count",
            "xp", "level",
            "is_verified", "verification_level", "phone_verified", "created_at",
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
