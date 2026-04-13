from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trails', '0011_trailcondition'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Trail.author CASCADE → SET_NULL. Deleting a user no longer
        # nukes every trail they ever uploaded — a hosted catalog
        # should outlive its individual contributors.
        migrations.AlterField(
            model_name='trail',
            name='author',
            field=models.ForeignKey(
                blank=True,
                help_text='작성자가 탈퇴해도 코스는 보존됨 (SET_NULL)',
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name='trails',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        # Composite index for the list-page hot path:
        #   status='approved' AND is_hidden=False ORDER BY created_at DESC
        migrations.AddIndex(
            model_name='trail',
            index=models.Index(
                fields=['status', 'is_hidden', '-created_at'],
                name='trails_trai_status_b8f3c1_idx',
            ),
        ),
    ]
