from django.contrib.auth.models import AbstractUser
from django.contrib.postgres.fields import ArrayField
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

    nickname = models.CharField("닉네임", max_length=50, unique=True)
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

    # Phase 12: physical profile (used by walk engine for calorie/stride accuracy)
    GENDER_CHOICES = [
        ("male", "남성"),
        ("female", "여성"),
        ("other", "기타"),
    ]
    weight_kg = models.PositiveSmallIntegerField(null=True, blank=True, help_text="체중 (kg)")
    height_cm = models.PositiveSmallIntegerField(null=True, blank=True, help_text="키 (cm)")
    birth_year = models.PositiveSmallIntegerField(null=True, blank=True, help_text="태어난 해 (예: 1990)")
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, default="")
    weekly_goal_km = models.DecimalField(max_digits=5, decimal_places=1, default=20, help_text="주간 목표 거리 (km)")

    # Push notifications
    fcm_token = models.CharField(max_length=500, blank=True, default='')

    # Marketing consent (optional — separate from core service terms,
    # which are required and recorded at signup via AgreementAcceptance).
    # Governs sending promotional pushes/emails/SMS.
    marketing_consent = models.BooleanField(default=False)
    marketing_consent_at = models.DateTimeField(null=True, blank=True)

    # XP / Level
    xp = models.PositiveIntegerField(default=0)
    level = models.PositiveIntegerField(default=1)

    # Phase 11: 인증
    is_verified = models.BooleanField(default=False)
    verification_level = models.IntegerField(choices=VERIFICATION_LEVEL_CHOICES, default=0)
    phone_number = models.CharField("전화번호", max_length=20, blank=True, db_index=True)
    phone_verified = models.BooleanField("전화번호 인증", default=False)
    phone_verified_at = models.DateTimeField("전화번호 인증 일시", null=True, blank=True)
    firebase_uid = models.CharField(max_length=128, blank=True, default='', db_index=True)

    # 최근 로그인 정보
    last_login_ip = models.GenericIPAddressField("마지막 로그인 IP", null=True, blank=True)
    last_login_user_agent = models.CharField("마지막 로그인 디바이스", max_length=300, blank=True, default="")

    # 탈퇴(소프트 딜리트)
    is_deleted = models.BooleanField("탈퇴 여부", default=False)
    deleted_at = models.DateTimeField("탈퇴 일시", null=True, blank=True)
    deletion_reason = models.TextField("탈퇴 사유", blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_suspended(self) -> bool:
        """활성 정지 기록이 하나라도 있으면 True."""
        return self._active_suspensions_qs().exists()

    def _active_suspensions_qs(self):
        from django.utils import timezone
        now = timezone.now()
        return self.suspensions.filter(
            lifted_at__isnull=True,
        ).filter(
            models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=now),
        )

    def is_suspended_for(self, scope: str) -> bool:
        """특정 scope 또는 account 스코프 정지가 유효한지."""
        qs = self._active_suspensions_qs()
        return qs.filter(
            models.Q(scopes__contains=[scope]) | models.Q(scopes__contains=["account"])
        ).exists()

    def active_suspension_scopes(self) -> set:
        """현재 유효한 정지의 scope 집합."""
        scopes = set()
        for row in self._active_suspensions_qs().values_list("scopes", flat=True):
            scopes.update(row or [])
        return scopes

    class Meta(AbstractUser.Meta):
        verbose_name = "유저"
        verbose_name_plural = "유저"

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


class AgreementAcceptance(models.Model):
    """Audit trail for legal agreements accepted by the user at signup
    (or later). Creates one row per slug the user accepts — we keep the
    version string so that, if terms change later, we can prove which
    exact version the user was shown."""

    SLUG_CHOICES = [
        ("terms", "이용약관"),
        ("privacy", "개인정보처리방침"),
        ("location-terms", "위치기반서비스 이용약관"),
        ("location-privacy", "위치정보 처리방침"),
        ("marketing-consent", "마케팅 수신 동의"),
        ("age-14", "만 14세 이상 확인"),
    ]

    user = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name="agreements",
    )
    slug = models.CharField(max_length=40, choices=SLUG_CHOICES, db_index=True)
    version = models.CharField(max_length=20, blank=True, default="")
    accepted_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        unique_together = ("user", "slug")
        ordering = ["-accepted_at"]
        verbose_name = "약관 동의 기록"
        verbose_name_plural = "약관 동의 기록"

    def __str__(self):
        return f"{self.user.nickname or self.user.username} · {self.get_slug_display()} v{self.version}"


class PhoneOTP(models.Model):
    """6-digit OTP for phone verification (custom, no Firebase)."""
    phone_number = models.CharField(max_length=20, db_index=True)
    code = models.CharField(max_length=6)
    expires_at = models.DateTimeField(db_index=True)
    verified = models.BooleanField(default=False)
    attempts = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = '전화번호 OTP'
        verbose_name_plural = '전화번호 OTP'

    def is_valid(self):
        from django.utils import timezone
        return not self.verified and self.expires_at > timezone.now() and self.attempts < 5


class PhoneAuthLog(models.Model):
    """SMS authentication log via Firebase Phone Auth.

    Tracks all SMS authentication attempts and signups for admin review.
    """
    EVENT_CHOICES = [
        ('sms_sent', 'SMS 발송'),
        ('verified', '인증 성공'),
        ('login', '로그인'),
        ('signup', '신규 가입'),
        ('failed', '인증 실패'),
    ]
    phone_number = models.CharField(max_length=20, db_index=True)
    event_type = models.CharField(max_length=20, choices=EVENT_CHOICES, db_index=True)
    user = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='phone_auth_logs',
    )
    firebase_uid = models.CharField(max_length=128, blank=True, default='')
    nickname = models.CharField(max_length=50, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True, default='')
    error_message = models.CharField(max_length=300, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = '전화번호 인증 기록'
        verbose_name_plural = '전화번호 인증 기록'

    def __str__(self):
        return f"[{self.get_event_type_display()}] {self.phone_number} @ {self.created_at:%Y-%m-%d %H:%M}"


class Notification(models.Model):
    NOTIFICATION_TYPE_CHOICES = [
        ('like', '좋아요'),
        ('comment', '댓글'),
        ('reply', '답글'),
        ('follow', '팔로우'),
        ('system', '시스템'),
        ('new_trail', '새 코스'),
        ('review', '리뷰'),
        ('companion', '동행 요청'),
        ('weekly_goal', '주간 목표'),
    ]
    TARGET_TYPE_CHOICES = [
        ('post', '게시글'),
        ('trail', '코스'),
        ('activity', '활동'),
        ('walk_plan', '걷기 일정'),
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


class UserSuspension(models.Model):
    """운영자가 유저의 서비스 이용을 정지시킨 기록 (해제 포함)."""

    DURATION_CHOICES = [
        ("1d", "1일"),
        ("3d", "3일"),
        ("5d", "5일"),
        ("7d", "7일"),
        ("permanent", "영구정지"),
    ]
    _DURATION_DAYS = {"1d": 1, "3d": 3, "5d": 5, "7d": 7}

    SCOPE_CHOICES = [
        ("account", "계정 이용"),
        ("community", "커뮤니티"),
        ("trail", "코스 등록"),
        ("companion", "동행"),
        ("review", "리뷰/평점"),
    ]

    user = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name="suspensions",
        verbose_name="대상 유저",
    )
    reason = models.CharField("사유", max_length=100)
    duration = models.CharField(
        "정지 기간", max_length=10, choices=DURATION_CHOICES, default="7d",
    )
    scopes = ArrayField(
        base_field=models.CharField(max_length=20, choices=SCOPE_CHOICES),
        default=list, blank=True, size=10,
        verbose_name="정지 범위",
    )
    suspended_by = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+", verbose_name="정지 처리자",
    )
    suspended_at = models.DateTimeField("정지 시작", auto_now_add=True)
    expires_at = models.DateTimeField("자동 해제 예정", null=True, blank=True)
    lifted_at = models.DateTimeField("해제 일시", null=True, blank=True)
    lifted_by = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+", verbose_name="해제 처리자",
    )
    lifted_reason = models.TextField("해제 사유", blank=True, default="")

    class Meta:
        ordering = ["-suspended_at"]
        verbose_name = "정지 기록"
        verbose_name_plural = "정지 기록"

    def __str__(self):
        return f"[{self.status_label}] {self.user} — {self.reason[:30]}"

    @property
    def is_currently_active(self) -> bool:
        from django.utils import timezone
        if self.lifted_at:
            return False
        if self.expires_at and self.expires_at <= timezone.now():
            return False
        return True

    @property
    def status_label(self) -> str:
        if self.lifted_at:
            return "해제됨"
        from django.utils import timezone
        if self.expires_at and self.expires_at <= timezone.now():
            return "만료됨"
        return "정지중"

    def compute_expires_at(self):
        """duration 값 기준으로 expires_at 자동 계산. 영구정지면 None."""
        from django.utils import timezone
        from datetime import timedelta
        if self.duration == "permanent":
            return None
        days = self._DURATION_DAYS.get(self.duration)
        if not days:
            return None
        base = self.suspended_at or timezone.now()
        return base + timedelta(days=days)


class LoginHistory(models.Model):
    """유저 로그인 이벤트 기록 — IP, 디바이스(UA)."""
    user = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name="login_history",
        verbose_name="유저",
    )
    ip_address = models.GenericIPAddressField("IP 주소", null=True, blank=True)
    user_agent = models.CharField("디바이스 (User-Agent)", max_length=300, blank=True, default="")
    login_method = models.CharField(
        "로그인 방식", max_length=20, blank=True, default="",
        help_text="예: password, phone, social_google 등",
    )
    created_at = models.DateTimeField("로그인 일시", auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "로그인 기록"
        verbose_name_plural = "로그인 기록"

    def __str__(self):
        return f"{self.user} @ {self.ip_address} · {self.created_at:%Y-%m-%d %H:%M}"

    @classmethod
    def record(cls, user, request=None, method: str = ""):
        """로그인 뷰에서 호출. request로부터 IP/UA 추출해 저장."""
        ip = None
        ua = ""
        if request is not None:
            xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
            ip = xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR")
            ua = request.META.get("HTTP_USER_AGENT", "")[:300]
        cls.objects.create(user=user, ip_address=ip, user_agent=ua, login_method=method)
        update_fields = []
        if ip:
            user.last_login_ip = ip
            update_fields.append("last_login_ip")
        if ua:
            user.last_login_user_agent = ua
            update_fields.append("last_login_user_agent")
        if update_fields:
            user.save(update_fields=update_fields)


class AdminMemo(models.Model):
    """운영자가 특정 유저에 대해 기록하는 메모 (이미지 첨부 가능)."""
    user = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name="admin_memos",
        verbose_name="대상 유저",
    )
    author = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+", verbose_name="작성자",
    )
    content = models.TextField("내용")
    created_at = models.DateTimeField("작성 일시", auto_now_add=True)
    updated_at = models.DateTimeField("수정 일시", auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "유저 메모"
        verbose_name_plural = "유저 메모"

    def __str__(self):
        return f"{self.user} — {self.content[:30]}"


class AdminMemoImage(models.Model):
    memo = models.ForeignKey(
        AdminMemo, on_delete=models.CASCADE, related_name="images",
        verbose_name="메모",
    )
    image = models.ImageField("이미지", upload_to="admin_memos/")
    uploaded_at = models.DateTimeField("업로드 일시", auto_now_add=True)

    class Meta:
        ordering = ["uploaded_at"]
        verbose_name = "유저 메모 첨부"
        verbose_name_plural = "유저 메모 첨부"

    def __str__(self):
        return f"{self.memo_id} — {self.image.name}"
