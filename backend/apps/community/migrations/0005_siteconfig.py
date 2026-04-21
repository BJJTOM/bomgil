from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('community', '0004_moderation_hide_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='SiteConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('instagram_url', models.URLField(blank=True, default='')),
                ('threads_url', models.URLField(blank=True, default='')),
                ('youtube_url', models.URLField(blank=True, default='')),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': '사이트 설정',
                'verbose_name_plural': '사이트 설정',
            },
        ),
    ]
