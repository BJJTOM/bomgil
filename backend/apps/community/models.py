from django.db import models
from django.conf import settings


# ──────────────────────────────────────
# 게시판 (Board / Forum)
# ──────────────────────────────────────

class Post(models.Model):
    CATEGORY_CHOICES = [
        ('free', '자유'),
        ('qna', '질문답변'),
        ('recommend', '코스추천'),
        ('review', '후기'),
        ('meetup', '번개'),
        ('tip', '꿀팁'),
    ]

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='community_posts'
    )
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='free')
    title = models.CharField(max_length=100)
    content = models.TextField()
    images = models.JSONField(default=list, blank=True)
    trail = models.ForeignKey(
        'trails.Trail', on_delete=models.SET_NULL, null=True, blank=True, related_name='community_posts'
    )

    like_count = models.PositiveIntegerField(default=0)
    comment_count = models.PositiveIntegerField(default=0)
    view_count = models.PositiveIntegerField(default=0)
    bookmark_count = models.PositiveIntegerField(default=0)
    is_pinned = models.BooleanField(default=False)

    # Moderation — hidden posts disappear from public feeds but remain in DB
    # for audit/restoration. Separate from is_pinned; admins toggle this.
    is_hidden = models.BooleanField(default=False, db_index=True)
    hidden_at = models.DateTimeField(null=True, blank=True)
    hidden_reason = models.CharField(max_length=200, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_pinned', '-created_at']

    def __str__(self):
        return f'[{self.category}] {self.title}'


class PostImage(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='post_images')
    image = models.ImageField(upload_to='community/posts/')
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order']


class PostComment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='community_comments'
    )
    parent = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies'
    )
    content = models.TextField(max_length=1000)
    like_count = models.PositiveIntegerField(default=0)
    is_deleted = models.BooleanField(default=False)
    # Admin-side moderation flag (separate from user-triggered is_deleted).
    is_hidden = models.BooleanField(default=False, db_index=True)
    hidden_at = models.DateTimeField(null=True, blank=True)
    hidden_reason = models.CharField(max_length=200, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.author} on {self.post}'


class PostLike(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='likes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'post')


class CommentLike(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    comment = models.ForeignKey(PostComment, on_delete=models.CASCADE, related_name='likes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'comment')


class PostBookmark(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='post_bookmarks')
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='bookmarks')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'post')


# ──────────────────────────────────────
# 신고 / 차단
# ──────────────────────────────────────

class Report(models.Model):
    REASON_CHOICES = [
        ('spam', '스팸/광고'),
        ('abuse', '욕설/비하'),
        ('sexual', '성적 콘텐츠'),
        ('harassment', '괴롭힘'),
        ('misinformation', '허위정보'),
        ('other', '기타'),
    ]
    TARGET_CHOICES = [
        ('post', '게시글'),
        ('comment', '댓글'),
        ('user', '사용자'),
        ('group', '모임'),
    ]

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reports_made'
    )
    target_type = models.CharField(max_length=10, choices=TARGET_CHOICES)
    target_id = models.PositiveIntegerField()
    reason = models.CharField(max_length=20, choices=REASON_CHOICES)
    detail = models.TextField(max_length=500, blank=True, default='')
    status = models.CharField(max_length=10, default='pending', choices=[
        ('pending', '대기'),
        ('reviewed', '검토완료'),
        ('resolved', '처리완료'),
    ])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class UserBlock(models.Model):
    blocker = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocking'
    )
    blocked = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocked_by'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('blocker', 'blocked')


# ──────────────────────────────────────
# 모임 (Groups)
# ──────────────────────────────────────

class Group(models.Model):
    CATEGORY_CHOICES = [
        ('hiking', '등산'),
        ('walking', '산책'),
        ('running', '러닝'),
        ('trail', '트레일'),
        ('photo', '사진'),
        ('social', '친목'),
    ]

    name = models.CharField(max_length=50)
    description = models.TextField(max_length=500)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='walking')
    cover_image = models.ImageField(upload_to='community/groups/', null=True, blank=True)
    emoji = models.CharField(max_length=10, default='🥾')

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='owned_groups'
    )
    region = models.CharField(max_length=50, blank=True, default='')
    max_members = models.PositiveIntegerField(default=50)
    member_count = models.PositiveIntegerField(default=1)
    is_public = models.BooleanField(default=True)
    # Admin-only moderation
    is_hidden = models.BooleanField(default=False, db_index=True)
    hidden_at = models.DateTimeField(null=True, blank=True)
    hidden_reason = models.CharField(max_length=200, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-member_count', '-created_at']

    def __str__(self):
        return self.name


class GroupMember(models.Model):
    ROLE_CHOICES = [
        ('owner', '방장'),
        ('admin', '관리자'),
        ('member', '멤버'),
    ]

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='group_memberships'
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='member')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('group', 'user')
        ordering = ['joined_at']


class GroupMessage(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='group_messages'
    )
    content = models.TextField(max_length=2000)
    image = models.ImageField(upload_to='community/chat/', null=True, blank=True)
    is_hidden = models.BooleanField(default=False, db_index=True)
    hidden_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']


# ──────────────────────────────────────
# 챌린지 (Challenges)
# ──────────────────────────────────────

class Challenge(models.Model):
    TYPE_CHOICES = [
        ('distance', '거리'),
        ('steps', '걸음수'),
        ('streak', '연속일수'),
        ('trails', '코스완주'),
        ('elevation', '고도'),
    ]
    STATUS_CHOICES = [
        ('upcoming', '예정'),
        ('active', '진행중'),
        ('ended', '종료'),
    ]

    title = models.CharField(max_length=100)
    description = models.TextField(max_length=500)
    emoji = models.CharField(max_length=10, default='🏆')
    cover_image = models.ImageField(upload_to='community/challenges/', null=True, blank=True)

    challenge_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='distance')
    goal_value = models.FloatField(help_text='목표 수치 (km, 걸음, 일수 등)')
    goal_unit = models.CharField(max_length=10, default='km')

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='upcoming')
    start_date = models.DateField()
    end_date = models.DateField()

    participant_count = models.PositiveIntegerField(default=0)
    max_participants = models.PositiveIntegerField(default=0, help_text='0=무제한')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return self.title

    @property
    def is_full(self):
        return self.max_participants > 0 and self.participant_count >= self.max_participants


class ChallengeParticipant(models.Model):
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='challenge_participations'
    )
    current_value = models.FloatField(default=0)
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('challenge', 'user')
        ordering = ['-current_value']


# ──────────────────────────────────────
# 사이트 설정 (Site Config) — 싱글톤
# ──────────────────────────────────────
class SiteConfig(models.Model):
    instagram_url = models.URLField(blank=True, default='')
    threads_url = models.URLField(blank=True, default='')
    youtube_url = models.URLField(blank=True, default='')

    # Business info (Korean law disclosures)
    business_name = models.CharField(max_length=100, default='모루', verbose_name='상호')
    representative = models.CharField(max_length=50, blank=True, default='', verbose_name='대표')
    business_number = models.CharField(max_length=50, blank=True, default='', verbose_name='사업자등록번호')
    location_service_number = models.CharField(max_length=50, blank=True, default='', verbose_name='위치기반서비스 신고번호')
    telecom_number = models.CharField(max_length=50, blank=True, default='', verbose_name='통신판매업 신고번호')
    contact_email = models.CharField(max_length=100, default='contact@moruwalk.com', verbose_name='이메일')

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "사이트 설정"
        verbose_name_plural = "사이트 설정"

    def __str__(self):
        return "사이트 설정"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


# ──────────────────────────────────────
# Notice (공지사항)
# ──────────────────────────────────────
class Notice(models.Model):
    title = models.CharField(max_length=200)
    content = models.TextField()
    is_pinned = models.BooleanField(default=False)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_pinned', '-created_at']

    def __str__(self):
        return f"{'[중요] ' if self.is_pinned else ''}{self.title}"


# ──────────────────────────────────────
# LegalDocument (약관·방침: 어드민에서 편집)
# ──────────────────────────────────────
class LegalDocument(models.Model):
    """Admin-editable legal documents (terms, privacy, etc.).

    Every save creates a new row (version). The "published" flag flips
    only the latest revision per slug; older versions stay as historical
    record so we can always show the text that was effective at signup.
    """

    SLUG_CHOICES = [
        ("terms", "이용약관"),
        ("privacy", "개인정보처리방침"),
        ("location-terms", "위치기반서비스 이용약관"),
        ("location-privacy", "위치정보 처리방침"),
        ("marketing-consent", "마케팅 수신 동의"),
    ]

    slug = models.CharField(max_length=40, choices=SLUG_CHOICES, db_index=True)
    title = models.CharField(max_length=100)
    body_markdown = models.TextField(help_text="Markdown (GFM) 지원 — 표, 목록, 굵기 등")
    version = models.CharField(max_length=20, default="1.0", help_text='예: "1.0", "1.1"')
    effective_from = models.DateField(help_text="이 버전이 효력을 발생하는 시작일")
    is_published = models.BooleanField(
        default=False,
        help_text="체크 시 공개 API에서 이 슬러그의 최신 노출본이 됩니다",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["slug", "-effective_from", "-created_at"]
        indexes = [models.Index(fields=["slug", "-effective_from"])]
        verbose_name = "약관·방침 문서"
        verbose_name_plural = "약관·방침 문서"

    def __str__(self):
        status = "✓ 공개" if self.is_published else "초안"
        return f"[{self.get_slug_display()}] v{self.version} ({status})"

    @classmethod
    def latest_published(cls, slug: str):
        """Return the newest published document for the slug, or None."""
        return (
            cls.objects.filter(slug=slug, is_published=True)
            .order_by("-effective_from", "-created_at")
            .first()
        )
