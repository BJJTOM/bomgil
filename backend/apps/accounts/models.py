from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


# ── Level / XP System ──────────────────────────────
LEVEL_THRESHOLDS = [
    (1, 0),
    (2, 100),
    (3, 300),
    (4, 700),
    (5, 1500),
    (6, 3000),
    (7, 5000),
    (8, 8000),
    (9, 12000),
    (10, 20000),
]

LEVEL_NAMES = {
    1: "\uc0c8\uc2f9",       # 새싹
    2: "\uc0b0\ucc45\ub7ec",  # 산책러
    3: "\ud0d0\ud5d8\uac00",  # 탐험가
    4: "\ud2b8\ub808\uc77c\ub7ec",  # 트레일러
    5: "\ub9c8\uc2a4\ud130",  # 마스터
    6: "\ucc4c\ub9b0\uc800",  # 챌린저
    7: "\ub808\uc778\uc800",  # 레인저
    8: "\uac00\uc774\ub4dc",  # 가이드
    9: "\uc804\ubb38\uac00",  # 전문가
    10: "\ub808\uc804\ub4dc", # 레전드
}


def level_for_xp(xp: int) -> int:
    """Return the level corresponding to the given XP total."""
    current_level = 1
    for lvl, threshold in LEVEL_THRESHOLDS:
        if xp >= threshold:
            current_level = lvl
    return current_level


def xp_for_next_level(current_level: int) -> int:
    """Return the XP required to reach the next level (0 if max)."""
    for lvl, threshold in LEVEL_THRESHOLDS:
        if lvl == current_level + 1:
            return threshold
    return 0  # already max level


def add_xp(user, amount: int, reason: str):
    """Add XP to a user, update their level, and create an XPLog entry."""
    user.xp += amount
    user.level = level_for_xp(user.xp)
    user.save(update_fields=["xp", "level"])
    XPLog.objects.create(user=user, amount=amount, reason=reason)


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
    following = models.ManyToManyField('self', symmetrical=False, related_name='followers', blank=True)
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

    # Push notifications
    fcm_token = models.CharField(max_length=500, blank=True, default='')

    # XP / Level
    xp = models.PositiveIntegerField(default=0)
    level = models.PositiveIntegerField(default=1)

    # Phase 11: 인증
    is_verified = models.BooleanField(default=False)
    verification_level = models.IntegerField(choices=VERIFICATION_LEVEL_CHOICES, default=0)
    phone_number = models.CharField(max_length=20, blank=True, db_index=True)
    phone_verified = models.BooleanField(default=False)
    firebase_uid = models.CharField(max_length=128, blank=True, default='', db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta(AbstractUser.Meta):
        verbose_name = "회원"
        verbose_name_plural = "회원"

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
        ("walker_10km", "10km 워커 🚶"),
        ("walker_50km", "50km 워커 🏃"),
        ("walker_100km", "100km 워커 🏅"),
        ("global_walker", "글로벌 워커 🌍"),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="badges")
    badge_type = models.CharField(max_length=20, choices=BADGE_CHOICES)
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["user", "badge_type"]
        verbose_name = "배지"
        verbose_name_plural = "배지"

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
        verbose_name = "휴대폰 인증"
        verbose_name_plural = "휴대폰 인증"


class Notification(models.Model):
    NOTIFICATION_TYPE_CHOICES = [
        ('like', '좋아요'),
        ('comment', '댓글'),
        ('reply', '답글'),
        ('follow', '팔로우'),
        ('system', '시스템'),
    ]
    TARGET_TYPE_CHOICES = [
        ('post', '게시글'),
        ('trail', '코스'),
        ('activity', '활동'),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='account_notifications')
    actor = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications_sent'
    )
    title = models.CharField(max_length=100)
    body = models.CharField(max_length=300)
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPE_CHOICES, default='system')
    target_type = models.CharField(max_length=20, choices=TARGET_TYPE_CHOICES, null=True, blank=True)
    target_id = models.PositiveIntegerField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "알림"
        verbose_name_plural = "알림"

    def __str__(self):
        return f"[{self.notification_type}] {self.user.nickname}: {self.title}"


class XPLog(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="xp_logs")
    amount = models.IntegerField()
    reason = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "XP \ub85c\uadf8"       # XP 로그
        verbose_name_plural = "XP \ub85c\uadf8"

    def __str__(self):
        return f"{self.user.nickname} +{self.amount} ({self.reason})"
