from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('activities', '0001_initial'),
        ('trails', '0014_trailsegment'),
    ]

    operations = [
        migrations.CreateModel(
            name='StampPoint',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('lat', models.DecimalField(decimal_places=6, max_digits=9)),
                ('lng', models.DecimalField(decimal_places=6, max_digits=9)),
                ('radius_meters', models.PositiveIntegerField(default=50, help_text='수집 가능 반경 (미터)')),
                ('description', models.TextField(blank=True, default='', max_length=300)),
                ('emoji', models.CharField(default='📍', max_length=4)),
                ('order', models.PositiveIntegerField(default=0)),
                ('trail', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stamp_points', to='trails.trail')),
            ],
            options={
                'verbose_name': '스탬프 포인트',
                'verbose_name_plural': '스탬프 포인트',
                'ordering': ['trail', 'order'],
            },
        ),
        migrations.CreateModel(
            name='UserStamp',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('collected_at', models.DateTimeField(auto_now_add=True)),
                ('activity', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='stamps', to='activities.activitytrack')),
                ('stamp_point', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='collections', to='trails.stamppoint')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stamps', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': '수집한 스탬프',
                'verbose_name_plural': '수집한 스탬프',
                'ordering': ['-collected_at'],
            },
        ),
        migrations.AddIndex(
            model_name='stamppoint',
            index=models.Index(fields=['trail', 'order'], name='trails_stam_trail_i_8d2f3a_idx'),
        ),
        migrations.AddIndex(
            model_name='userstamp',
            index=models.Index(fields=['user', '-collected_at'], name='trails_user_user_id_4b7c1e_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='userstamp',
            unique_together={('user', 'stamp_point')},
        ),
    ]
