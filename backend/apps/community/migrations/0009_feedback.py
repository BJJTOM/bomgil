# Generated for Feedback model (beta feedback inbox)

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('community', '0008_alter_challenge_options_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Feedback',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('category', models.CharField(choices=[('bug', '버그'), ('feature', '기능제안'), ('ux', '사용성'), ('content', '코스/정보 오류'), ('other', '기타')], max_length=16)),
                ('message', models.TextField(max_length=2000)),
                ('email', models.EmailField(blank=True, default='', max_length=254)),
                ('url', models.CharField(blank=True, default='', max_length=500)),
                ('user_agent', models.CharField(blank=True, default='', max_length=300)),
                ('status', models.CharField(choices=[('open', '열림'), ('reviewed', '확인'), ('resolved', '해결'), ('wontfix', '보류')], default='open', max_length=16)),
                ('admin_note', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='feedbacks', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': '피드백',
                'verbose_name_plural': '피드백',
                'ordering': ['-created_at'],
            },
        ),
    ]
