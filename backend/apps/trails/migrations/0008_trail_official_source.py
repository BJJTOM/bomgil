from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trails', '0007_moderation_hide_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='trail',
            name='is_official',
            field=models.BooleanField(default=False, db_index=True, help_text='공식 큐레이션 코스'),
        ),
        migrations.AddField(
            model_name='trail',
            name='source',
            field=models.CharField(blank=True, default='', help_text='출처 식별자 (durunubi, gilttara, user 등)', max_length=40),
        ),
        migrations.AddField(
            model_name='trail',
            name='source_url',
            field=models.URLField(blank=True, default='', max_length=500),
        ),
        migrations.AddIndex(
            model_name='trail',
            index=models.Index(fields=['is_official', 'region'], name='trails_trai_is_offi_b75abe_idx'),
        ),
    ]
