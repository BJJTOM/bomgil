from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import CustomUser


class Command(BaseCommand):
    help = "Delete guest accounts (email ending with @roami.guest) older than 7 days."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=7,
            help="Delete guest accounts older than this many days (default: 7)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show how many accounts would be deleted without actually deleting them",
        )

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(days=options["days"])
        guests = CustomUser.objects.filter(
            email__endswith="@roami.guest",
            created_at__lt=cutoff,
        )
        count = guests.count()

        if options["dry_run"]:
            self.stdout.write(
                self.style.WARNING(f"[Dry run] Would delete {count} guest account(s).")
            )
            return

        deleted, _ = guests.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {deleted} guest account(s) older than {options['days']} days."
            )
        )
