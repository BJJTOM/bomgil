import logging
from decimal import Decimal

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from .models import add_xp

logger = logging.getLogger(__name__)


# ── Walk completed (ActivityTrack created): +10 per km + daily bonus ──
@receiver(post_save, sender="activities.ActivityTrack")
def xp_on_activity_created(sender, instance, created, **kwargs):
    if not created:
        return
    user = instance.user
    distance = instance.distance_km or Decimal("0")
    km = int(distance)
    if km > 0:
        add_xp(user, km * 10, "walk_completed")
        logger.debug("XP: +%d for walk (%s km) user=%s", km * 10, distance, user.pk)

    # Daily walk bonus: first activity of the day
    from apps.activities.models import ActivityTrack

    today = timezone.now().date()
    day_count = ActivityTrack.objects.filter(
        user=user,
        created_at__date=today,
    ).count()
    if day_count == 1:  # this is the first one today
        add_xp(user, 15, "daily_walk_bonus")
        logger.debug("XP: +15 daily walk bonus user=%s", user.pk)


# ── Trail created: +50 ──
@receiver(post_save, sender="trails.Trail")
def xp_on_trail_created(sender, instance, created, **kwargs):
    if not created:
        return
    add_xp(instance.author, 50, "trail_created")
    logger.debug("XP: +50 trail created user=%s", instance.author.pk)


# ── Community post created: +20 ──
@receiver(post_save, sender="community.Post")
def xp_on_post_created(sender, instance, created, **kwargs):
    if not created:
        return
    add_xp(instance.author, 20, "post_created")
    logger.debug("XP: +20 post created user=%s", instance.author.pk)


# ── Comment created: +5 ──
@receiver(post_save, sender="community.PostComment")
def xp_on_comment_created(sender, instance, created, **kwargs):
    if not created:
        return
    add_xp(instance.author, 5, "comment_created")
    logger.debug("XP: +5 comment created user=%s", instance.author.pk)


# ── Review created: +30 ──
@receiver(post_save, sender="reviews.Review")
def xp_on_review_created(sender, instance, created, **kwargs):
    if not created:
        return
    add_xp(instance.author, 30, "review_created")
    logger.debug("XP: +30 review created user=%s", instance.author.pk)


# ── Received a like (post like): +3 to post author ──
@receiver(post_save, sender="community.PostLike")
def xp_on_post_like(sender, instance, created, **kwargs):
    if not created:
        return
    post = instance.post
    # Don't give XP for liking your own post
    if instance.user_id == post.author_id:
        return
    add_xp(post.author, 3, "received_like")
    logger.debug("XP: +3 received like user=%s", post.author.pk)


# ── Received a like (trail like): +3 to trail author ──
@receiver(post_save, sender="trails.TrailLike")
def xp_on_trail_like(sender, instance, created, **kwargs):
    if not created:
        return
    trail = instance.trail
    if instance.user_id == trail.author_id:
        return
    add_xp(trail.author, 3, "received_like")
    logger.debug("XP: +3 received trail like user=%s", trail.author.pk)
