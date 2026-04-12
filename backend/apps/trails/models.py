from django.conf import settings
from django.db import models


class Tag(models.Model):
    name = models.CharField(max_length=30, unique=True)
    name_en = models.CharField(max_length=30, blank=True)
    name_ja = models.CharField(max_length=30, blank=True)

    class Meta:
        verbose_name = "태그"
        verbose_name_plural = "태그"

    def __str__(self):
        return self.name


class Trail(models.Model):
    DIFFICULTY_CHOICES = [
        ("easy", "여유롭게"),
        ("moderate", "보통"),
        ("hard", "도전적"),
    ]
    SEASON_CHOICES = [
        ("spring", "봄"),
        ("summer", "여름"),
        ("fall", "가을"),
        ("winter", "겨울"),
        ("all", "사계절"),
        ("rainy_ok", "우천 가능"),
    ]
    STATUS_CHOICES = [
        ("draft", "임시저장"),
        ("pending", "승인대기"),
        ("approved", "승인됨"),
        ("rejected", "반려됨"),
    ]
    TRAIL_TYPE_CHOICES = [
        ("urban", "도심산책"),
        ("coastal", "해안길"),
        ("village", "마을길"),
        ("cultural", "문화탐방"),
        ("nature", "자연길"),
        ("mixed", "복합"),
    ]
    SURFACE_CHOICES = [
        ("paved", "포장도로"),
        ("mixed", "포장+비포장"),
        ("unpaved", "비포장"),
    ]

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="trails"
    )
    title = models.CharField(max_length=100)
    title_en = models.CharField(max_length=100, blank=True)
    title_ja = models.CharField(max_length=100, blank=True)
    description = models.TextField(max_length=1000)
    description_en = models.TextField(max_length=1000, blank=True)
    description_ja = models.TextField(max_length=1000, blank=True)
    region = models.CharField(max_length=50, blank=True, default='')
    country = models.CharField(max_length=2, default="KR")
    distance_km = models.DecimalField(max_digits=6, decimal_places=2)
    estimated_minutes = models.PositiveIntegerField()
    difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES)
    elevation_gain = models.PositiveIntegerField(null=True, blank=True)
    start_lat = models.DecimalField(max_digits=9, decimal_places=6)
    start_lng = models.DecimalField(max_digits=9, decimal_places=6)
    end_lat = models.DecimalField(max_digits=9, decimal_places=6)
    end_lng = models.DecimalField(max_digits=9, decimal_places=6)
    path_data = models.JSONField(default=dict, blank=True)
    cover_image = models.ImageField(upload_to="trails/covers/", blank=True)
    thumbnail_url = models.URLField(max_length=500, blank=True, help_text="External thumbnail image URL")
    tags = models.ManyToManyField(Tag, blank=True, related_name="trails")
    best_season = models.CharField(max_length=10, choices=SEASON_CHOICES, default="all")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="draft")
    rejection_reason = models.TextField(blank=True)
    view_count = models.PositiveIntegerField(default=0)
    like_count = models.PositiveIntegerField(default=0)

    # Phase 7: 도보여행 전용 필드
    trail_type = models.CharField(max_length=10, choices=TRAIL_TYPE_CHOICES, default="mixed")
    is_multi_day = models.BooleanField(default=False)
    total_days = models.PositiveIntegerField(null=True, blank=True)
    transport_access = models.TextField(max_length=200, blank=True)
    walking_surface = models.CharField(max_length=10, choices=SURFACE_CHOICES, default="paved")

    # Phase 12: admin moderation — separate from user-owned `status`.
    # Hidden trails disappear from public feeds immediately regardless
    # of their approval status. Admins can restore by unchecking.
    is_hidden = models.BooleanField(default=False, db_index=True)
    hidden_at = models.DateTimeField(null=True, blank=True)
    hidden_reason = models.CharField(max_length=200, blank=True, default='')

    # Phase 13: official/curated trails vs user-generated.
    # Official trails come from government/tourism sources (Durunubi,
    # 길따라, local municipalities) and get a verified badge in the UI.
    # `source` identifies the origin; `source_url` is the canonical page.
    is_official = models.BooleanField(default=False, db_index=True, help_text="공식 큐레이션 코스")
    source = models.CharField(
        max_length=40, blank=True, default='',
        help_text="출처 식별자 (durunubi, gilttara, user 등)",
    )
    source_url = models.URLField(max_length=500, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "코스"
        verbose_name_plural = "코스"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["region"]),
            models.Index(fields=["country"]),
            models.Index(fields=["difficulty"]),
            models.Index(fields=["status"]),
            models.Index(fields=["trail_type"]),
            models.Index(fields=["start_lat", "start_lng"]),
            models.Index(fields=["is_official", "region"]),
        ]

    def __str__(self):
        return self.title


class TrailLike(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="trail_likes"
    )
    trail = models.ForeignKey(Trail, on_delete=models.CASCADE, related_name="likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["user", "trail"]
        verbose_name = "코스 좋아요"
        verbose_name_plural = "코스 좋아요"


class TrailBookmark(models.Model):
    """A user's 'walk later' bookmark for a trail.

    Distinct from TrailLike — a like is a social signal ("I liked this"),
    a bookmark is an intent signal ("I plan to walk this"). The two are
    tracked separately so we can push bookmarked trails when weather is
    good without spamming users about every trail they liked.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="trail_bookmarks"
    )
    trail = models.ForeignKey(Trail, on_delete=models.CASCADE, related_name="bookmarks")
    created_at = models.DateTimeField(auto_now_add=True)
    note = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        unique_together = ["user", "trail"]
        ordering = ["-created_at"]
        verbose_name = "코스 북마크"
        verbose_name_plural = "코스 북마크"
        indexes = [
            models.Index(fields=["user", "-created_at"]),
        ]


class TrailSeries(models.Model):
    """A curated multi-segment trail (e.g. 제주올레, 코리아둘레길).

    Unlike a single Trail, a series groups several trails into an
    ordered sequence with its own identity — a long-distance
    "completion challenge" that users can chip away at over weeks or
    months. Progress is computed per user from TrailCompletion rows
    against the member trails.

    Slug is a stable URL identifier used on the web landing pages
    (/series/jeju-olle, /series/seoul-city). Region is the primary
    geographic bucket; can be empty for cross-region series.
    """

    slug = models.SlugField(max_length=60, unique=True, db_index=True)
    title = models.CharField(max_length=100)
    title_en = models.CharField(max_length=100, blank=True, default="")
    subtitle = models.CharField(max_length=200, blank=True, default="")
    description = models.TextField(max_length=1500, blank=True, default="")
    region = models.CharField(max_length=40, blank=True, default="")
    cover_image = models.URLField(max_length=500, blank=True, default="")
    accent_emoji = models.CharField(max_length=4, blank=True, default="")
    # Display order on lists; lower = earlier
    sort_order = models.PositiveIntegerField(default=100, db_index=True)
    is_featured = models.BooleanField(default=False, db_index=True)
    trails = models.ManyToManyField(
        "Trail",
        through="TrailSeriesTrail",
        related_name="series",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "-created_at"]
        verbose_name = "트레일 시리즈"
        verbose_name_plural = "트레일 시리즈"

    def __str__(self):
        return self.title


class TrailSeriesTrail(models.Model):
    """Through model: one trail's position within a series."""

    series = models.ForeignKey(
        TrailSeries, on_delete=models.CASCADE, related_name="memberships",
    )
    trail = models.ForeignKey(
        "Trail", on_delete=models.CASCADE, related_name="series_memberships",
    )
    order = models.PositiveIntegerField()
    segment_label = models.CharField(
        max_length=60, blank=True, default="",
        help_text="e.g. '1코스' or 'Day 2'",
    )

    class Meta:
        ordering = ["series", "order"]
        unique_together = ["series", "trail"]
        verbose_name = "시리즈 구간"
        verbose_name_plural = "시리즈 구간"
        indexes = [
            models.Index(fields=["series", "order"]),
        ]

    def __str__(self):
        return f"{self.series.title} · {self.segment_label or self.trail.title}"


class TrailCompletion(models.Model):
    """A record that a user completed a specific trail.

    Created either manually (user taps "완주 인증") or automatically when
    their walk GPS track sufficiently overlaps the trail path. We keep
    the source so admin/analytics can tell them apart, and link back to
    the ActivityTrack that triggered the completion so completions can
    be undone if the underlying walk is deleted.
    """

    SOURCE_CHOICES = [
        ("auto", "자동 감지"),
        ("manual", "수동 인증"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="trail_completions"
    )
    trail = models.ForeignKey(Trail, on_delete=models.CASCADE, related_name="completions")
    activity = models.ForeignKey(
        "activities.ActivityTrack",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="trail_completions",
    )
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES, default="manual")
    # Fraction of the trail path that was actually walked (0..1).
    # Useful for display ("이 코스의 87% 완주") and for filtering out
    # false positives down the road.
    coverage = models.DecimalField(max_digits=4, decimal_places=3, default=1.000)
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-completed_at"]
        verbose_name = "코스 완주"
        verbose_name_plural = "코스 완주"
        indexes = [
            models.Index(fields=["user", "-completed_at"]),
            models.Index(fields=["trail", "-completed_at"]),
        ]

    def __str__(self):
        return f"{self.user_id} completed trail {self.trail_id}"
