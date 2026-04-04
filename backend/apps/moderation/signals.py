from django.contrib.contenttypes.models import ContentType
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.reviews.models import Review
from apps.spots.models import Spot
from apps.trails.models import Trail

from .filters import auto_moderate_text
from .models import ModerationLog
from .reports import Notification


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
