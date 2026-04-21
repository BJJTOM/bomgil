"""
Content moderation signals.

Runs both rule-based (auto_moderate_text) and AI-powered moderation on
newly created content. AI moderation is non-blocking — on failure, content
publishes normally and a warning is logged.
"""

import logging
import threading

from django.contrib.contenttypes.models import ContentType
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from apps.community.models import GroupMessage, Post, PostComment
from apps.reviews.models import Review
from apps.spots.models import Spot
from apps.stories.models import WalkStory
from apps.trails.models import Trail

from .filters import auto_moderate_text
from .models import AIModerationLog, ModerationLog
from .reports import Notification

logger = logging.getLogger(__name__)


# ── Rule-based auto-moderation (existing) ──────────────────────────


def _auto_moderate(instance, text_fields, model_label):
    """Run auto-moderation on text fields of a newly created object."""
    if instance.status != "pending":
        return

    for field in text_fields:
        text = getattr(instance, field, "")
        if not text:
            continue
        should_flag, reason = auto_moderate_text(text)
        if should_flag:
            ct = ContentType.objects.get_for_model(instance)
            ModerationLog.objects.create(
                moderator_id=instance.author_id,
                content_type=ct,
                object_id=instance.pk,
                action="flag",
                reason=f"자동 감지 ({field}): {reason}",
            )
            # Notify admins would go here (email/websocket)
            break


@receiver(post_save, sender=Trail)
def auto_moderate_trail(sender, instance, created, **kwargs):
    if created:
        _auto_moderate(instance, ["title", "description"], "코스")


@receiver(post_save, sender=Spot)
def auto_moderate_spot(sender, instance, created, **kwargs):
    if created:
        _auto_moderate(instance, ["name", "description", "tip"], "경유지")


@receiver(post_save, sender=Review)
def auto_moderate_review(sender, instance, created, **kwargs):
    if created:
        _auto_moderate(instance, ["content"], "리뷰")


# ── AI-powered moderation ──────────────────────────────────────────


def _run_ai_moderation(model_class, instance_pk, text, content_type_label, author_field="author"):
    """
    Run AI moderation in a background thread.

    This is called from post_save signals so the user response is never
    blocked. On any failure the content stays published and a warning
    is logged.
    """
    from .ai_moderator import moderate_content

    try:
        result = moderate_content(text, content_type=content_type_label)

        # Re-fetch the instance to avoid stale state
        try:
            instance = model_class.objects.get(pk=instance_pk)
        except model_class.DoesNotExist:
            logger.info("AI moderation: %s #%s no longer exists, skipping", content_type_label, instance_pk)
            return

        ct = ContentType.objects.get_for_model(instance)

        # Store the truncated input text for audit (first 500 chars)
        input_preview = text[:500] if text else ""

        # Create audit log
        AIModerationLog.objects.create(
            content_type=ct,
            object_id=instance.pk,
            action=result["action"],
            is_safe=result["is_safe"],
            confidence=result["confidence"],
            flags=result["flags"],
            reason=result["reason"],
            input_text=input_preview,
            content_type_label=content_type_label,
        )

        # Apply action
        if result["action"] == "reject":
            _apply_reject(instance, result)
        elif result["action"] == "review":
            _apply_review(instance, ct, result, author_field)

    except Exception as e:
        logger.exception(
            "AI moderation failed for %s #%s: %s — content remains published",
            content_type_label, instance_pk, e,
        )


def _apply_reject(instance, result):
    """Auto-hide content that was rejected by AI."""
    if hasattr(instance, "is_hidden"):
        model_class = type(instance)
        model_class.objects.filter(pk=instance.pk).update(
            is_hidden=True,
            hidden_at=timezone.now(),
            hidden_reason=f"AI 자동 차단: {result['reason'][:150]}",
        )
        logger.info(
            "AI moderation REJECTED %s #%s (confidence=%.2f, flags=%s)",
            type(instance).__name__, instance.pk, result["confidence"], result["flags"],
        )


def _apply_review(instance, ct, result, author_field):
    """Queue content for admin review via ModerationLog."""
    author_id = getattr(instance, f"{author_field}_id", None)
    if author_id:
        ModerationLog.objects.create(
            moderator_id=author_id,
            content_type=ct,
            object_id=instance.pk,
            action="flag",
            reason=f"AI 검토 필요 ({result['confidence']:.0%}): {result['reason'][:300]}",
        )
    logger.info(
        "AI moderation flagged for REVIEW %s #%s (confidence=%.2f, flags=%s)",
        type(instance).__name__, instance.pk, result["confidence"], result["flags"],
    )


def _dispatch_ai_moderation(model_class, instance_pk, text, content_type_label, author_field="author"):
    """Dispatch AI moderation in a daemon thread so the response is not blocked."""
    thread = threading.Thread(
        target=_run_ai_moderation,
        args=(model_class, instance_pk, text, content_type_label, author_field),
        daemon=True,
    )
    thread.start()


# ── Signal receivers for AI moderation ─────────────────────────────


@receiver(post_save, sender=Post)
def ai_moderate_post(sender, instance, created, **kwargs):
    if not created:
        return
    text = f"{instance.title}\n{instance.content}"
    _dispatch_ai_moderation(Post, instance.pk, text, "post", author_field="author")


@receiver(post_save, sender=PostComment)
def ai_moderate_post_comment(sender, instance, created, **kwargs):
    if not created:
        return
    _dispatch_ai_moderation(PostComment, instance.pk, instance.content, "comment", author_field="author")


@receiver(post_save, sender=GroupMessage)
def ai_moderate_group_message(sender, instance, created, **kwargs):
    if not created:
        return
    _dispatch_ai_moderation(GroupMessage, instance.pk, instance.content, "message", author_field="sender")


@receiver(post_save, sender=WalkStory)
def ai_moderate_walk_story(sender, instance, created, **kwargs):
    if not created:
        return
    text = f"{instance.title}\n{instance.content}" if instance.title else instance.content
    _dispatch_ai_moderation(WalkStory, instance.pk, text, "story", author_field="author")


@receiver(post_save, sender=Review)
def ai_moderate_review(sender, instance, created, **kwargs):
    if not created:
        return
    _dispatch_ai_moderation(Review, instance.pk, instance.content, "review", author_field="author")
