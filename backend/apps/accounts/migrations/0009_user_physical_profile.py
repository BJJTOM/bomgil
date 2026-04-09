from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_phoneotp'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='weight_kg',
            field=models.PositiveSmallIntegerField(blank=True, help_text='체중 (kg)', null=True),
        ),
        migrations.AddField(
            model_name='customuser',
            name='height_cm',
            field=models.PositiveSmallIntegerField(blank=True, help_text='키 (cm)', null=True),
        ),
        migrations.AddField(
            model_name='customuser',
            name='birth_year',
            field=models.PositiveSmallIntegerField(blank=True, help_text='태어난 해 (예: 1990)', null=True),
        ),
        migrations.AddField(
            model_name='customuser',
            name='gender',
            field=models.CharField(
                blank=True,
                choices=[('male', '남성'), ('female', '여성'), ('other', '기타')],
                default='',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='customuser',
            name='weekly_goal_km',
            field=models.DecimalField(
                decimal_places=1,
                default=20,
                help_text='주간 목표 거리 (km)',
                max_digits=5,
            ),
        ),
    ]
