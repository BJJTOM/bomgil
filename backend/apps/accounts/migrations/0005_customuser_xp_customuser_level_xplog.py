from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_customuser_fcm_token_notification'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='xp',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='customuser',
            name='level',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.CreateModel(
            name='XPLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.IntegerField()),
                ('reason', models.CharField(max_length=50)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='xp_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'XP \ub85c\uadf8',
                'verbose_name_plural': 'XP \ub85c\uadf8',
                'ordering': ['-created_at'],
            },
        ),
    ]
