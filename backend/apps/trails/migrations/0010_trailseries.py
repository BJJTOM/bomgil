from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trails', '0009_bookmark_completion'),
    ]

    operations = [
        migrations.CreateModel(
            name='TrailSeries',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField(db_index=True, max_length=60, unique=True)),
                ('title', models.CharField(max_length=100)),
                ('title_en', models.CharField(blank=True, default='', max_length=100)),
                ('subtitle', models.CharField(blank=True, default='', max_length=200)),
                ('description', models.TextField(blank=True, default='', max_length=1500)),
                ('region', models.CharField(blank=True, default='', max_length=40)),
                ('cover_image', models.URLField(blank=True, default='', max_length=500)),
                ('accent_emoji', models.CharField(blank=True, default='', max_length=4)),
                ('sort_order', models.PositiveIntegerField(db_index=True, default=100)),
                ('is_featured', models.BooleanField(db_index=True, default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': '트레일 시리즈',
                'verbose_name_plural': '트레일 시리즈',
                'ordering': ['sort_order', '-created_at'],
            },
        ),
        migrations.CreateModel(
            name='TrailSeriesTrail',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order', models.PositiveIntegerField()),
                ('segment_label', models.CharField(blank=True, default='', help_text="e.g. '1코스' or 'Day 2'", max_length=60)),
                ('series', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='memberships', to='trails.trailseries')),
                ('trail', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='series_memberships', to='trails.trail')),
            ],
            options={
                'verbose_name': '시리즈 구간',
                'verbose_name_plural': '시리즈 구간',
                'ordering': ['series', 'order'],
                'indexes': [
                    models.Index(fields=['series', 'order'], name='trails_trai_series__d1aff0_idx'),
                ],
                'unique_together': {('series', 'trail')},
            },
        ),
        migrations.AddField(
            model_name='trailseries',
            name='trails',
            field=models.ManyToManyField(related_name='series', through='trails.TrailSeriesTrail', to='trails.trail'),
        ),
    ]
