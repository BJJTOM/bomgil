from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trails', '0008_trail_official_source'),
        ('activities', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TrailBookmark',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('note', models.CharField(blank=True, default='', max_length=200)),
                ('trail', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='bookmarks', to='trails.trail')),
                ('user', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='trail_bookmarks', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': '코스 북마크',
                'verbose_name_plural': '코스 북마크',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['user', '-created_at'], name='trails_trai_user_id_2dd04c_idx'),
                ],
                'unique_together': {('user', 'trail')},
            },
        ),
        migrations.CreateModel(
            name='TrailCompletion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source', models.CharField(choices=[('auto', '자동 감지'), ('manual', '수동 인증')], default='manual', max_length=10)),
                ('coverage', models.DecimalField(decimal_places=3, default=1.0, max_digits=4)),
                ('completed_at', models.DateTimeField(auto_now_add=True)),
                ('activity', models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, related_name='trail_completions', to='activities.activitytrack')),
                ('trail', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='completions', to='trails.trail')),
                ('user', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='trail_completions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': '코스 완주',
                'verbose_name_plural': '코스 완주',
                'ordering': ['-completed_at'],
                'indexes': [
                    models.Index(fields=['user', '-completed_at'], name='trails_trai_user_id_a9edc6_idx'),
                    models.Index(fields=['trail', '-completed_at'], name='trails_trai_trail_i_dc9f3b_idx'),
                ],
            },
        ),
    ]
