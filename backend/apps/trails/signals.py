"""Signals for on-demand ISR revalidation of the public web pages.

Whenever an admin updates a Trail or TrailSeries, we want the
Next.js pages that show that data to refresh immediately — not
wait for the time-based ISR revalidate window. This is done by
calling a secured Next.js API route that invokes `revalidateTag()`
with the tags the page templates already declared.

Contract with the web frontend:
  - /trails/[id]           → tag `trail-{id}`
  - /series                → tag `trail-series`
  - /series/[slug]         → tag `trail-series-{slug}`
  - /explore/region/[slug] → tag `trails-region` (broad — region
                             pages fetch by keyword so one trail
                             edit potentially affects several)

The webhook call is fire-and-forget with a short timeout. Signal
handlers MUST NOT crash the save — if revalidation fails, the DB
write still goes through and the next visitor after the
revalidate window will see the fresh data.
"""

import logging
import os
import threading

import requests
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Trail, TrailSeries, TrailSeriesTrail

logger = logging.getLogger(__name__)

WEB_URL = os.environ.get("WEB_BASE_URL", "https://moruwalk.com")
REVALIDATE_SECRET = os.environ.get("REVALIDATE_SECRET", "")
REVALIDATE_TIMEOUT_S = 3.0


def _fire_revalidate(tags: list[str]) -> None:
    """Fire the webhook in a background thread so the save returns fast."""
    if not tags or not REVALIDATE_SECRET:
        return
    # Bulk operations like seed commands set MORU_DISABLE_REVALIDATE=1
    # to avoid firing 30+ webhooks in a tight loop during deploy.
    if os.environ.get("MORU_DISABLE_REVALIDATE"):
        return

    def _run():
        try:
            requests.post(
                f"{WEB_URL}/api/revalidate",
                headers={"x-revalidate-secret": REVALIDATE_SECRET},
                json={"tags": tags},
                timeout=REVALIDATE_TIMEOUT_S,
            )
        except Exception as exc:  # network failures shouldn't break anything
            logger.warning("ISR revalidate webhook failed for %s: %s", tags, exc)

    threading.Thread(target=_run, daemon=True).start()


@receiver([post_save, post_delete], sender=Trail)
def trail_changed(sender, instance: Trail, **kwargs):
    tags = [f"trail-{instance.pk}", "trails-region"]
    # Series pages that embed this trail also need refresh
    try:
        for slug in instance.series.values_list("slug", flat=True):
            tags.append(f"trail-series-{slug}")
        if instance.series.exists():
            tags.append("trail-series")
    except Exception:
        # M2M may not be ready on post_delete; don't crash
        pass
    _fire_revalidate(tags)


@receiver([post_save, post_delete], sender=TrailSeries)
def series_changed(sender, instance: TrailSeries, **kwargs):
    _fire_revalidate([
        "trail-series",
        f"trail-series-{instance.slug}",
    ])


@receiver([post_save, post_delete], sender=TrailSeriesTrail)
def series_member_changed(sender, instance: TrailSeriesTrail, **kwargs):
    try:
        slug = instance.series.slug
    except Exception:
        return
    _fire_revalidate([
        "trail-series",
        f"trail-series-{slug}",
    ])
