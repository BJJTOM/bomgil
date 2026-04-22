"""Clean up previously imported public trails.

Removes visitkorea-sourced trails that are not truly walking-scale
(distance > 15km covers drive/overnight tour packages that the public
API mixes into contentTypeId=25), and normalizes http thumbnails to
https so the browser doesn't block them as mixed content.

Idempotent. Safe to run on every deploy.
"""

from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.trails.models import Trail


class Command(BaseCommand):
    help = "Remove non-walking visitkorea trails and normalize http thumbnails to https."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only report what would change; do not modify the DB.",
        )
        parser.add_argument(
            "--max-distance-km",
            type=float,
            default=15.0,
            help="Trails beyond this distance are treated as non-walking (default 15 km).",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        max_km = options["max_distance_km"]

        # Use a single Q-combined filter so the resulting QuerySet stays
        # deletable. Two mutually-exclusive conditions (distance > 15
        # and distance ≤ 0) don't actually produce duplicates, so we
        # never needed .distinct() — calling it was what poisoned the
        # delete() in earlier deploys.
        qs = Trail.objects.filter(source="visitkorea")
        bad_distance = Q(distance_km__gt=max_km) | Q(distance_km__lte=0)
        to_delete = qs.filter(bad_distance)

        delete_count = to_delete.count()
        http_qs = qs.filter(thumbnail_url__startswith="http://")
        http_count = http_qs.count()

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no changes"))
            self.stdout.write(f"  would delete: {delete_count}")
            self.stdout.write(f"  would normalize to https: {http_count}")
            return

        if delete_count:
            to_delete.delete()
        if http_count:
            # Re-query after the delete above since some rows may overlap
            # and have just been removed.
            http_remaining = Trail.objects.filter(
                source="visitkorea", thumbnail_url__startswith="http://"
            )
            normalized = 0
            for trail in http_remaining.iterator():
                trail.thumbnail_url = "https://" + trail.thumbnail_url[len("http://"):]
                trail.save(update_fields=["thumbnail_url"])
                normalized += 1
            http_count = normalized

        self.stdout.write(
            self.style.SUCCESS(
                f"Cleanup complete: deleted={delete_count}, "
                f"normalized_thumbnails={http_count}"
            )
        )
