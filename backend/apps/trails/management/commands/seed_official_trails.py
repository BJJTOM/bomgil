"""Seed curated "official" trails (DEPRECATED).

This command previously contained hand-curated fake trail data to
bootstrap the catalog.  That data has been replaced by the
``import_public_trails`` management command which pulls real walking
course data from the Korea Tourism Organization public API.

The command is kept functional (no-op) so that existing deployment
scripts that call it do not break.

Usage:
    python manage.py seed_official_trails          # no-op, prints message
    python manage.py seed_official_trails --update  # no-op, prints message

To import real trail data instead, run:
    python manage.py import_public_trails
    python manage.py import_public_trails --limit 10   # test with 10 courses
"""

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "DEPRECATED — use import_public_trails instead"

    def add_arguments(self, parser):
        parser.add_argument(
            "--update", action="store_true",
            help="(deprecated, no-op)",
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.WARNING(
                "seed_official_trails is deprecated. "
                "Run 'python manage.py import_public_trails' to import real "
                "walking course data from the Korea Tourism Organization API."
            )
        )
