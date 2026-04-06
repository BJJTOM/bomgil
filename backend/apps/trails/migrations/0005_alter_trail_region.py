from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trails', '0004_alter_trail_distance_km'),
    ]

    operations = [
        migrations.AlterField(
            model_name='trail',
            name='region',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
    ]
