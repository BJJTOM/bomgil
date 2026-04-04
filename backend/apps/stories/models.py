from django.conf import settings
from django.db import models


class WalkStory(models.Model):
    MOOD_CHOICES = [
        ("happy", "즐거웠어요"),
        ("peaceful", "평화로웠어요"),
        ("exciting", "신났어요"),
        ("touching", "감동이었어요"),
        ("funny", "웃겼어요"),
    ]

    walk_plan = models.ForeignKey(
        "companions.WalkPlan", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="stories"
    )
    trail = models.ForeignKey(
        "trails.Trail", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="stories"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="stories"
    )
    title = models.CharField(max_length=100, blank=True)
    content = models.TextField(max_length=2000)
    mood = models.CharField(max_length=10, choices=MOOD_CHOICES, default="happy")
    companions_tagged = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="tagged_stories"
    )
    like_count = models.PositiveIntegerField(default=0)
    comment_count = models.PositiveIntegerField(default=0)
    is_public = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title or f"{self.author.nickname}의 이야기"


class StoryPhoto(models.Model):
    story = models.ForeignKey(WalkStory, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="stories/")
    caption = models.CharField(max_length=100, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]


class StoryLike(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="story_likes"
    )
    story = models.ForeignKey(WalkStory, on_delete=models.CASCADE, related_name="likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["user", "story"]


class StoryComment(models.Model):
    story = models.ForeignKey(WalkStory, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="story_comments"
    )
    content = models.TextField(max_length=500)
    like_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.author.nickname}: {self.content[:30]}"
