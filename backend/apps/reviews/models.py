from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Review(models.Model):
    STATUS_CHOICES = [
        ("pending", "승인대기"),
        ("approved", "승인됨"),
        ("rejected", "반려됨"),
    ]

    trail = models.ForeignKey(
        "trails.Trail", on_delete=models.CASCADE, related_name="reviews"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews"
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    content = models.TextField(max_length=1000)
    visited_date = models.DateField()
    helpful_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "리뷰"
        verbose_name_plural = "리뷰"

    def __str__(self):
        return f"{self.trail.title} - {self.author.nickname} ({self.rating})"


class ReviewImage(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="reviews/")
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]
        verbose_name = "리뷰 이미지"
        verbose_name_plural = "리뷰 이미지"


class ReviewHelpful(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="helpful_reviews"
    )
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="helpfuls")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["user", "review"]
        verbose_name = "리뷰 도움됨"
        verbose_name_plural = "리뷰 도움됨"
