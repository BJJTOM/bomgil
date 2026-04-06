from django.conf import settings
from django.db import models


class Spot(models.Model):
    SPOT_TYPE_CHOICES = [
        ("start", "출발"),
        ("restaurant", "맛집"),
        ("cafe", "카페"),
        ("photo", "포토스팟"),
        ("rest", "휴식"),
        ("view", "전망"),
        ("danger", "주의구간"),
        ("market", "시장/마켓"),
        ("gallery", "갤러리/문화공간"),
        ("temple", "절/사찰"),
        ("accommodation", "숙소"),
        ("transport", "교통편"),
        ("tip", "꿀팁 포인트"),
        ("end", "도착"),
    ]
    STATUS_CHOICES = [
        ("pending", "승인대기"),
        ("approved", "승인됨"),
        ("rejected", "반려됨"),
    ]

    trail = models.ForeignKey(
        "trails.Trail", on_delete=models.CASCADE, related_name="spots"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="spots"
    )
    name = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100, blank=True)
    name_ja = models.CharField(max_length=100, blank=True)
    spot_type = models.CharField(max_length=20, choices=SPOT_TYPE_CHOICES)
    lat = models.DecimalField(max_digits=9, decimal_places=6)
    lng = models.DecimalField(max_digits=9, decimal_places=6)
    order = models.PositiveIntegerField()
    distance_from_start_km = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    description = models.TextField(max_length=500, blank=True)
    description_en = models.TextField(max_length=500, blank=True)
    description_ja = models.TextField(max_length=500, blank=True)
    menu_highlight = models.CharField(max_length=100, blank=True)
    price_range = models.CharField(max_length=50, blank=True)
    rating = models.DecimalField(max_digits=2, decimal_places=1, null=True, blank=True)
    tip = models.TextField(max_length=200, blank=True)
    # Phase 7: 새 필드
    opening_hours = models.CharField(max_length=100, blank=True)
    closed_days = models.CharField(max_length=50, blank=True)
    is_must_visit = models.BooleanField(default=False)
    # Day number for multi-day trails
    day_number = models.PositiveIntegerField(default=1)

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["day_number", "order"]
        verbose_name = "스팟"
        verbose_name_plural = "스팟"

    def __str__(self):
        return f"{self.trail.title} - {self.name}"


class SpotImage(models.Model):
    spot = models.ForeignKey(Spot, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="spots/")
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]
        verbose_name = "스팟 이미지"
        verbose_name_plural = "스팟 이미지"
