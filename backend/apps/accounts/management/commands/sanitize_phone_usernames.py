"""Rotate phone-encoded usernames/emails to random hex tokens.

Older signups created users with usernames like ``phone_77773333`` and
emails like ``phone_77773333@phone.moruwalk.com`` — both encode the last
8 digits of the phone number. Even though no public serializer exposes
these fields today, they are a latent leak surface (admin exports, third
party analytics, future endpoints, etc.). This command rotates each such
user to a random hex username/email so the digits are no longer recoverable.

Idempotent: a user that already has a non-phone-encoded username is
skipped on subsequent runs.

Usage:
    python manage.py sanitize_phone_usernames           # apply
    python manage.py sanitize_phone_usernames --dry-run # report only
"""
import re
import secrets

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import CustomUser

# Matches the legacy pattern phone_<8 digits>[<int>]
LEGACY_USERNAME = re.compile(r"^phone_\d{7,8}\d*$")
SAFE_DOMAIN = "@phone.moruwalk.com"


def _new_username() -> str:
    for _ in range(5):
        candidate = f"phone_{secrets.token_hex(8)}"
        if not CustomUser.objects.filter(username=candidate).exists():
            return candidate
    return f"phone_{secrets.token_hex(12)}"


class Command(BaseCommand):
    help = "Rotate phone-encoded usernames/emails to random hex tokens"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Report only, do not write")

    def handle(self, *args, **options):
        dry = options["dry_run"]

        # Only consider users that actually have a phone number AND match the
        # legacy pattern. We do NOT touch users created with random hex names.
        candidates = CustomUser.objects.exclude(phone_number="").exclude(phone_number__isnull=True)

        rotated = 0
        skipped = 0
        for user in candidates.iterator():
            if not LEGACY_USERNAME.match(user.username or ""):
                skipped += 1
                continue
            new_user = _new_username()
            new_email = f"{new_user}{SAFE_DOMAIN}"
            self.stdout.write(
                f"  {user.username:30s} -> {new_user}    "
                f"(id={user.id}, nick={user.nickname})"
            )
            if not dry:
                with transaction.atomic():
                    user.username = new_user
                    user.email = new_email
                    user.save(update_fields=["username", "email"])
            rotated += 1

        if dry:
            self.stdout.write(self.style.WARNING(
                f"DRY RUN — would rotate {rotated} users, skipped {skipped}"
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"Rotated {rotated} users, skipped {skipped}"
            ))
