"""One-off: clear broken Unsplash thumbnails on the moru_curated
showcase trails so the frontend gradient+emoji fallback renders.

The initial seed committed invented Unsplash photo IDs that all 404.
This command nulls `thumbnail_url` on every `source='moru_curated'` row
whose current URL points to `images.unsplash.com`.

Usage:
    python manage.py fix_showcase_thumbnails
"""
from django.core.management.base import BaseCommand

from apps.trails.models import Trail


class Command(BaseCommand):
    help = "Clear broken Unsplash thumbnails on moru_curated trails."

    def handle(self, *args, **options):
        qs = Trail.objects.filter(
            source="moru_curated",
            thumbnail_url__startswith="https://images.unsplash.com/",
        )
        count = qs.count()
        qs.update(thumbnail_url="")
        self.stdout.write(self.style.SUCCESS(
            f"✓ cleared thumbnail_url on {count} showcase trail(s)"
        ))
