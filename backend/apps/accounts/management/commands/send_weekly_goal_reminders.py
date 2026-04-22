"""Send push notifications to users who haven't met their weekly walking goal.

Usage:
    python manage.py send_weekly_goal_reminders

Schedule with cron (e.g. every Wednesday at 10:00 KST):
    0 10 * * 3  cd /path/to/project && python manage.py send_weekly_goal_reminders

Logic:
  - Finds all active users with weekly_goal_km > 0 and a valid fcm_token.
  - Calculates distance walked this week (Mon-Sun) from DailyActivitySummary.
  - If progress < 100%, sends a push reminder with the remaining distance.
"""

import logging
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Sum
from django.utils import timezone

from apps.accounts.models import CustomUser
from apps.accounts.notifications import create_notification
from apps.activities.models import DailyActivitySummary

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "주간 목표 미달성 유저에게 푸시 알림 발송"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="실제 발송하지 않고 대상자만 출력",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        today = timezone.now().date()

        # ISO weekday: Monday=1 ... Sunday=7
        # Calculate the Monday of the current week
        monday = today - timedelta(days=today.weekday())

        # Users with a weekly goal and a push token
        users = CustomUser.objects.filter(
            weekly_goal_km__gt=0,
            is_active=True,
        ).exclude(fcm_token="")

        sent_count = 0
        skipped_count = 0

        for user in users.iterator():
            # Sum distance walked Monday..today
            walked = (
                DailyActivitySummary.objects.filter(
                    user=user,
                    date__gte=monday,
                    date__lte=today,
                )
                .aggregate(total=Sum("total_distance_km"))
                ["total"]
            ) or Decimal("0")

            goal = user.weekly_goal_km or Decimal("0")
            if goal <= 0:
                skipped_count += 1
                continue

            remaining = goal - walked
            if remaining <= 0:
                # Already met the goal
                skipped_count += 1
                continue

            remaining_display = f"{remaining:.1f}"
            body = f"이번 주 목표까지 {remaining_display}km 남았어요! 오늘 한 걸음 더?"

            if dry_run:
                self.stdout.write(
                    f"  [DRY-RUN] user={user.pk} ({user.nickname}) "
                    f"goal={goal}km walked={walked:.1f}km remaining={remaining_display}km"
                )
            else:
                create_notification(
                    user=user,
                    actor=None,
                    title="주간 목표 알림",
                    body=body,
                    notification_type="weekly_goal",
                )
                sent_count += 1
                logger.info(
                    "Weekly goal reminder: user=%s goal=%skm walked=%skm remaining=%skm",
                    user.pk, goal, walked, remaining_display,
                )

        if dry_run:
            self.stdout.write(self.style.WARNING(
                f"Dry run complete. {users.count()} users checked, "
                f"{skipped_count} skipped (goal met or 0)."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"Sent {sent_count} weekly goal reminders, "
                f"skipped {skipped_count}."
            ))
