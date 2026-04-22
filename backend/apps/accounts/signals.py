import logging
from decimal import Decimal

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from .models import add_xp
from .notifications import create_notification

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


# ═══════════════════════════════════════════════════════════════════════
# Push notification triggers
# ═══════════════════════════════════════════════════════════════════════

# ── #3  팔로우한 유저가 새 코스 등록 ──
# Fires when a Trail's status changes to 'approved'.  We check both
# created=False (status update) and created=True (direct creation with
# status='approved', e.g. by admin).
@receiver(post_save, sender="trails.Trail")
def push_on_trail_approved(sender, instance, created, **kwargs):
    trail = instance
    if trail.status != "approved":
        return
    author = trail.author
    if author is None:
        return

    # On update, only fire when status actually changed to approved.
    # Django signals don't give us the old value, so we use a simple
    # heuristic: if created, always fire. If updated, check update_fields
    # or just fire (dedup is handled by Notification unique-ish rows).
    # To prevent duplicate pushes on repeated saves of an already-approved
    # trail, we check whether we already sent this exact notification.
    from .models import Notification
    already_sent = Notification.objects.filter(
        notification_type="new_trail",
        target_type="trail",
        target_id=trail.pk,
        actor=author,
    ).exists()
    if already_sent:
        return

    followers = author.followers.all()
    for follower in followers:
        create_notification(
            user=follower,
            actor=author,
            title="새 코스 등록",
            body=f"{author.nickname}님이 새 코스를 등록했어요: {trail.title}",
            notification_type="new_trail",
            target_type="trail",
            target_id=trail.pk,
        )
    logger.info(
        "Push: new_trail trail=%s author=%s followers=%d",
        trail.pk, author.pk, followers.count(),
    )


# ── #4  새 리뷰가 달렸어요 ──
@receiver(post_save, sender="reviews.Review")
def push_on_review_created(sender, instance, created, **kwargs):
    if not created:
        return
    review = instance
    trail = review.trail
    author = trail.author
    if author is None:
        return

    create_notification(
        user=author,
        actor=review.author,
        title="새 리뷰",
        body=f"{review.author.nickname}님이 '{trail.title}'에 리뷰를 남겼어요",
        notification_type="review",
        target_type="trail",
        target_id=trail.pk,
    )
    logger.info(
        "Push: review trail=%s reviewer=%s owner=%s",
        trail.pk, review.author.pk, author.pk,
    )


# ── #5  동행 요청이 왔어요 ──
@receiver(post_save, sender="companions.CompanionRequest")
def push_on_companion_request(sender, instance, created, **kwargs):
    if not created:
        return
    request = instance
    walk_plan = request.walk_plan
    plan_owner = walk_plan.user

    create_notification(
        user=plan_owner,
        actor=request.requester,
        title="동행 요청",
        body=f"{request.requester.nickname}님이 동행을 요청했어요",
        notification_type="companion",
        target_type="walk_plan",
        target_id=walk_plan.pk,
    )
    logger.info(
        "Push: companion_request plan=%s requester=%s owner=%s",
        walk_plan.pk, request.requester.pk, plan_owner.pk,
    )
