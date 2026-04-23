import logging
from decimal import Decimal

from django.contrib.auth.signals import user_logged_in
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

logger = logging.getLogger(__name__)


# ── 로그인 이벤트 자동 수집 (이메일/Django auth 기반) ──
@receiver(user_logged_in)
def record_login_history(sender, request, user, **kwargs):
    """
    Django 기본 `user_logged_in` 시그널을 수집.
    dj-rest-auth 회원가입/allauth 계정 인증에서 발생.
    phone/email/guest 로그인은 각 뷰에서 명시적으로 record() 호출하므로
    여기선 중복을 피하려 최근 3초 내 로그인 기록이 있으면 스킵.
    """
    try:
        from .models import LoginHistory
        from datetime import timedelta
        recent = LoginHistory.objects.filter(
            user=user, created_at__gt=timezone.now() - timedelta(seconds=3),
        ).exists()
        if recent:
            return
        LoginHistory.record(user, request, method="signal")
    except Exception:
        logger.exception("record_login_history failed for user=%s", getattr(user, "pk", None))


# ── Walk completed (ActivityTrack created): +10 per km + daily bonus ──
@receiver(post_save, sender="activities.ActivityTrack")
def xp_on_activity_created(sender, instance, created, **kwargs):
    try:
        if not created:
            return
        from .models import add_xp

        user = instance.user
        distance = instance.distance_km or Decimal("0")
        km = int(distance)
        if km > 0:
            add_xp(user, km * 10, "walk_completed")
            logger.debug("XP: +%d for walk (%s km) user=%s", km * 10, distance, user.pk)

        # Daily walk bonus: first activity of the day
        from apps.activities.models import ActivityTrack

        today = timezone.now().date()
        has_earlier_today = ActivityTrack.objects.filter(
            user=user,
            created_at__date=today,
        ).exclude(pk=instance.pk).exists()
        if not has_earlier_today:  # this is the first one today
            add_xp(user, 15, "daily_walk_bonus")
            logger.debug("XP: +15 daily walk bonus user=%s", user.pk)
    except Exception:
        logger.exception("Signal xp_on_activity_created failed for instance=%s", instance.pk)


# ── Trail created: +50 ──
@receiver(post_save, sender="trails.Trail")
def xp_on_trail_created(sender, instance, created, **kwargs):
    try:
        if not created:
            return
        from .models import add_xp

        add_xp(instance.author, 50, "trail_created")
        logger.debug("XP: +50 trail created user=%s", instance.author.pk)
    except Exception:
        logger.exception("Signal xp_on_trail_created failed for instance=%s", instance.pk)


# ── Community post created: +20 ──
@receiver(post_save, sender="community.Post")
def xp_on_post_created(sender, instance, created, **kwargs):
    try:
        if not created:
            return
        from .models import add_xp

        add_xp(instance.author, 20, "post_created")
        logger.debug("XP: +20 post created user=%s", instance.author.pk)
    except Exception:
        logger.exception("Signal xp_on_post_created failed for instance=%s", instance.pk)


# ── Comment created: +5 ──
@receiver(post_save, sender="community.PostComment")
def xp_on_comment_created(sender, instance, created, **kwargs):
    try:
        if not created:
            return
        from .models import add_xp

        add_xp(instance.author, 5, "comment_created")
        logger.debug("XP: +5 comment created user=%s", instance.author.pk)
    except Exception:
        logger.exception("Signal xp_on_comment_created failed for instance=%s", instance.pk)


# ── Review created: +30 ──
@receiver(post_save, sender="reviews.Review")
def xp_on_review_created(sender, instance, created, **kwargs):
    try:
        if not created:
            return
        from .models import add_xp

        add_xp(instance.author, 30, "review_created")
        logger.debug("XP: +30 review created user=%s", instance.author.pk)
    except Exception:
        logger.exception("Signal xp_on_review_created failed for instance=%s", instance.pk)


# ── Received a like (post like): +3 to post author ──
@receiver(post_save, sender="community.PostLike")
def xp_on_post_like(sender, instance, created, **kwargs):
    try:
        if not created:
            return
        from .models import add_xp

        post = instance.post
        # Don't give XP for liking your own post
        if instance.user_id == post.author_id:
            return
        add_xp(post.author, 3, "received_like")
        logger.debug("XP: +3 received like user=%s", post.author.pk)
    except Exception:
        logger.exception("Signal xp_on_post_like failed for instance=%s", instance.pk)


# ── Received a like (trail like): +3 to trail author ──
@receiver(post_save, sender="trails.TrailLike")
def xp_on_trail_like(sender, instance, created, **kwargs):
    try:
        if not created:
            return
        from .models import add_xp

        trail = instance.trail
        if instance.user_id == trail.author_id:
            return
        add_xp(trail.author, 3, "received_like")
        logger.debug("XP: +3 received trail like user=%s", trail.author.pk)
    except Exception:
        logger.exception("Signal xp_on_trail_like failed for instance=%s", instance.pk)


# ═══════════════════════════════════════════════════════════════════════
# Push notification triggers
# ═══════════════════════════════════════════════════════════════════════

# ── #3  팔로우한 유저가 새 코스 등록 ──
# Fires when a Trail's status changes to 'approved'.  We check both
# created=False (status update) and created=True (direct creation with
# status='approved', e.g. by admin).
@receiver(post_save, sender="trails.Trail")
def push_on_trail_approved(sender, instance, created, **kwargs):
    try:
        trail = instance
        if trail.status != "approved":
            return
        author = trail.author
        if author is None:
            return

        # On update, only fire when status actually changed to approved.
        # Django signals don't give us the old value, so we use a simple
        # heuristic: if created, always fire. If updated, check update_fields
        # or just fire (dedup is handled below).
        # To prevent duplicate pushes on repeated/concurrent saves of an
        # already-approved trail, we atomically create a sentinel notification
        # row (user=author) via get_or_create. Only the winner proceeds.
        from .models import Notification
        from .notifications import create_notification

        _sentinel, was_created = Notification.objects.get_or_create(
            notification_type="new_trail",
            target_type="trail",
            target_id=trail.pk,
            actor=author,
            user=author,
            defaults={
                "title": "새 코스 등록",
                "body": f"코스 알림 발송됨: {trail.title}",
            },
        )
        if not was_created:
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
    except Exception:
        logger.exception("Signal push_on_trail_approved failed for instance=%s", instance.pk)


# ── #4  새 리뷰가 달렸어요 ──
@receiver(post_save, sender="reviews.Review")
def push_on_review_created(sender, instance, created, **kwargs):
    try:
        if not created:
            return
        from .notifications import create_notification

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
    except Exception:
        logger.exception("Signal push_on_review_created failed for instance=%s", instance.pk)


# ── #5  동행 요청이 왔어요 ──
@receiver(post_save, sender="companions.CompanionRequest")
def push_on_companion_request(sender, instance, created, **kwargs):
    try:
        if not created:
            return
        from .notifications import create_notification

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
    except Exception:
        logger.exception("Signal push_on_companion_request failed for instance=%s", instance.pk)
