from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_phone_firebase_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='PhoneAuthLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('phone_number', models.CharField(db_index=True, max_length=20)),
                ('event_type', models.CharField(choices=[
                    ('sms_sent', 'SMS 발송'),
                    ('verified', '인증 성공'),
                    ('login', '로그인'),
                    ('signup', '신규 가입'),
                    ('failed', '인증 실패'),
                ], db_index=True, max_length=20)),
                ('firebase_uid', models.CharField(blank=True, default='', max_length=128)),
                ('nickname', models.CharField(blank=True, default='', max_length=50)),
                ('email', models.EmailField(blank=True, default='', max_length=254)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.CharField(blank=True, default='', max_length=300)),
                ('error_message', models.CharField(blank=True, default='', max_length=300)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='phone_auth_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': '전화번호 인증 기록',
                'verbose_name_plural': '전화번호 인증 기록',
                'ordering': ['-created_at'],
            },
        ),
    ]
