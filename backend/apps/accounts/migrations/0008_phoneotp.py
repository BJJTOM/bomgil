from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_phoneauthlog'),
    ]

    operations = [
        migrations.CreateModel(
            name='PhoneOTP',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('phone_number', models.CharField(db_index=True, max_length=20)),
                ('code', models.CharField(max_length=6)),
                ('expires_at', models.DateTimeField(db_index=True)),
                ('verified', models.BooleanField(default=False)),
                ('attempts', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': '전화번호 OTP',
                'verbose_name_plural': '전화번호 OTP',
                'ordering': ['-created_at'],
            },
        ),
    ]
