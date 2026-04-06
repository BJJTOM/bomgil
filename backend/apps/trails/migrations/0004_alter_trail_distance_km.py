from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trails', '0003_trail_thumbnail_url'),
    ]

    operations = [
        migrations.AlterField(
            model_name='trail',
            name='distance_km',
            field=models.DecimalField(decimal_places=2, max_digits=6),
        ),
    ]
