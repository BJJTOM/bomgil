from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    LANGUAGE_CHOICES = [
        ("ko", "한국어"),
        ("en", "English"),
        ("ja", "日本語"),
        ("zh", "中文"),
    ]
    WALKING_STYLE_CHOICES = [
        ("explorer", "탐험가"),
        ("foodie", "맛집러"),
        ("photographer", "사진러"),
        ("talker", "수다쟁이"),
        ("silent", "조용한 산책"),
    ]
    AGE_RANGE_CHOICES = [
        ("20s", "20대"),
        ("30s", "30대"),
        ("40s", "40대"),
        ("50s_plus", "50대 이상"),
    ]
    VERIFICATION_LEVEL_CHOICES = [
        (0, "미인증"),
        (1, "이메일 인증"),
        (2, "본인 인증"),
        (3, "신뢰 동행자"),
    ]

    nickname = models.CharField(max_length=50, unique=True)
    profile_image = models.ImageField(upload_to="profiles/", null=True, blank=True)
    bio = models.TextField(max_length=300, blank=True)
    preferred_language = models.CharField(
        max_length=10, choices=LANGUAGE_CHOICES, default="ko"
    )
    is_guide = models.BooleanField(default=False)

    # Phase 8: 동행 프로필
    age_range = models.CharField(max_length=10, choices=AGE_RANGE_CHOICES, null=True, blank=True)
    walking_style = models.CharField(max_length=15, choices=WALKING_STYLE_CHOICES, null=True, blank=True)
    companion_rating = models.DecimalField(max_digits=2, decimal_places=1, null=True, blank=True)
    total_walks = models.PositiveIntegerField(default=0)
    companion_count = models.PositiveIntegerField(default=0)
    one_liner = models.CharField(max_length=100, blank=True)

    # Phase 11: 인증
    is_verified = models.BooleanField(default=False)
    verification_level = models.IntegerField(choices=VERIFICATION_LEVEL_CHOICES, default=0)
    phone_number = models.CharField(max_length=20, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.nickname or self.username


class UserBadge(models.Model):
    BADGE_CHOICES = [
        ("verified", "본인 인증 ✓"),
        ("trusted", "신뢰 동행자 🛡️"),
        ("first_walk", "첫 동행 🌱"),
        ("companion_10", "길벗 🤝"),
        ("popular", "인기 동행자 🌟"),
        ("trail_creator", "코스 개척자 🗺️"),
        ("storyteller", "스토리텔러 📝"),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="badges")
    badge_type = models.CharField(max_length=20, choices=BADGE_CHOICES)
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["user", "badge_type"]

    def __str__(self):
        return f"{self.user.nickname} - {self.get_badge_type_display()}"


class PhoneVerification(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    phone_number = models.CharField(max_length=20)
    code = models.CharField(max_length=6)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
