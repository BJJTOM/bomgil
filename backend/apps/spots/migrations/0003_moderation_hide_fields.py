from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('spots', '0002_alter_spot_options_spot_closed_days_spot_day_number_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='spot',
            name='is_hidden',
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.AddField(
            model_name='spot',
            name='hidden_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='spot',
            name='hidden_reason',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
    ]
