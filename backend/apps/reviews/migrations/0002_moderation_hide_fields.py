from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reviews', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='review',
            name='is_hidden',
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.AddField(
            model_name='review',
            name='hidden_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='review',
            name='hidden_reason',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
    ]
