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

        # Defensive: this command runs from build.sh, so it must NEVER crash
        # the deploy. Any unexpected error is logged and swallowed.
        try:
            self._run(dry)
        except Exception as exc:  # noqa: BLE001
            self.stdout.write(self.style.ERROR(
                f"sanitize_phone_usernames failed: {exc!r} — continuing"
            ))

    def _run(self, dry: bool) -> None:
        # Only consider users that match the legacy pattern. We do NOT touch
        # users created with random hex names. Filtering by username at the DB
        # level avoids loading the entire user table.
        candidates = CustomUser.objects.filter(
            username__regex=r"^phone_\d{7,9}$"
        ).exclude(phone_number="").exclude(phone_number__isnull=True)

        total = candidates.count()
        self.stdout.write(f"Found {total} candidate user(s) to rotate")

        rotated = 0
        errors = 0
        for user in candidates.iterator(chunk_size=200):
            # Re-check with full regex (DB regex flavor varies across backends)
            if not LEGACY_USERNAME.match(user.username or ""):
                continue
            new_user = _new_username()
            new_email = f"{new_user}{SAFE_DOMAIN}"
            self.stdout.write(
                f"  {user.username:30s} -> {new_user}  (id={user.id})"
            )
            if not dry:
                try:
                    with transaction.atomic():
                        user.username = new_user
                        user.email = new_email
                        user.save(update_fields=["username", "email"])
                except Exception as exc:  # noqa: BLE001
                    errors += 1
                    self.stdout.write(self.style.WARNING(
                        f"    skipped (id={user.id}): {exc!r}"
                    ))
                    continue
            rotated += 1

        msg = f"Rotated {rotated} users, errors {errors}"
        if dry:
            self.stdout.write(self.style.WARNING(f"DRY RUN — {msg}"))
        else:
            self.stdout.write(self.style.SUCCESS(msg))
