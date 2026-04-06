from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.accounts.models import CustomUser


class Command(BaseCommand):
    help = 'Delete guest accounts older than 24 hours'

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(hours=24)
        deleted = CustomUser.objects.filter(
            email__endswith='@roami.guest',
            date_joined__lt=cutoff,
        ).delete()
        self.stdout.write(f'Deleted {deleted[0]} guest accounts')
