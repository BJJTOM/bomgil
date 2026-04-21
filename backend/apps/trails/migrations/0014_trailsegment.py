# Generated manually

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('trails', '0013_rename_trails_trai_is_offi_b75abe_idx_trails_trai_is_offi_c95cd5_idx_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='TrailSegment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order', models.PositiveIntegerField()),
                ('start_name', models.CharField(max_length=100)),
                ('end_name', models.CharField(max_length=100)),
                ('distance_km', models.DecimalField(decimal_places=2, max_digits=5)),
                ('duration_minutes', models.PositiveIntegerField()),
                ('description', models.TextField(blank=True)),
                ('trail', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='segments', to='trails.trail')),
            ],
            options={
                'verbose_name': '구간',
                'verbose_name_plural': '구간',
                'ordering': ['order'],
                'unique_together': {('trail', 'order')},
            },
        ),
    ]
