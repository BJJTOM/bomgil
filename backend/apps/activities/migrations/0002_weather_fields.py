from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('activities', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='activitytrack',
            name='weather_temp_c',
            field=models.DecimalField(blank=True, decimal_places=1, help_text='기온 (°C)', max_digits=4, null=True),
        ),
        migrations.AddField(
            model_name='activitytrack',
            name='weather_condition',
            field=models.CharField(blank=True, default='', help_text='날씨 상태 (Clear/Rain/Snow 등)', max_length=40),
        ),
        migrations.AddField(
            model_name='activitytrack',
            name='weather_icon',
            field=models.CharField(blank=True, default='', help_text='OpenWeatherMap 아이콘 코드', max_length=10),
        ),
    ]
