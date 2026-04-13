from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trails', '0010_trailseries'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TrailCondition',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tag', models.CharField(choices=[
                    ('muddy', '진흙/미끄러움'),
                    ('icy', '빙판/결빙'),
                    ('overgrown', '수풀 무성'),
                    ('flooded', '침수/물빠짐'),
                    ('closed', '구간 통제'),
                    ('construction', '공사중'),
                    ('fallen_trees', '쓰러진 나무'),
                    ('bugs', '벌레 많음'),
                    ('crowded', '사람 많음'),
                    ('clear', '상태 양호'),
                    ('other', '기타'),
                ], db_index=True, max_length=20)),
                ('note', models.CharField(blank=True, default='', max_length=300)),
                ('image', models.ImageField(blank=True, null=True, upload_to='trails/conditions/')),
                ('helpful_count', models.PositiveIntegerField(default=0)),
                ('is_hidden', models.BooleanField(db_index=True, default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('trail', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='conditions', to='trails.trail')),
                ('user', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='trail_conditions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': '코스 상태 제보',
                'verbose_name_plural': '코스 상태 제보',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['trail', '-created_at'], name='trails_trai_trail_i_e0b7bc_idx'),
                    models.Index(fields=['tag', '-created_at'], name='trails_trai_tag_5c9e88_idx'),
                ],
            },
        ),
    ]
