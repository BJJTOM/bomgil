from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_customuser_xp_customuser_level_xplog'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='phone_verified',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='customuser',
            name='firebase_uid',
            field=models.CharField(blank=True, default='', max_length=128, db_index=True),
        ),
        migrations.AlterField(
            model_name='customuser',
            name='phone_number',
            field=models.CharField(blank=True, max_length=20, db_index=True),
        ),
    ]
