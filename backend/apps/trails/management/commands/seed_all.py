"""One-shot: run every slow data-seed command the service uses.

Useful when you want to refresh public trails, series, and legal docs
in a single local or Render Shell invocation without editing env vars
and waiting for a full build.
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Run every seed command in sequence (trails, cleanup, series, legal)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--skip-trails",
            action="store_true",
            help="Skip the public-trail import/cleanup step.",
        )

    def handle(self, *args, **options):
        import os
        os.environ.setdefault("MORU_DISABLE_REVALIDATE", "1")

        self.stdout.write(self.style.NOTICE("▶ seed_legal_documents"))
        call_command("seed_legal_documents")

        if not options["skip_trails"]:
            self.stdout.write(self.style.NOTICE("▶ import_public_trails"))
            try:
                call_command("import_public_trails")
            except Exception as exc:
                self.stderr.write(self.style.WARNING(f"  skipped: {exc}"))

            self.stdout.write(self.style.NOTICE("▶ cleanup_public_trails"))
            try:
                call_command("cleanup_public_trails")
            except Exception as exc:
                self.stderr.write(self.style.WARNING(f"  skipped: {exc}"))

        self.stdout.write(self.style.NOTICE("▶ seed_trail_series"))
        try:
            call_command("seed_trail_series")
        except Exception as exc:
            self.stderr.write(self.style.WARNING(f"  skipped: {exc}"))

        self.stdout.write(self.style.SUCCESS("\n✓ seed_all complete"))
