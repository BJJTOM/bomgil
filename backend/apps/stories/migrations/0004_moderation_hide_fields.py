from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('stories', '0003_storycomment_parent_notification_commentlike'),
    ]

    operations = [
        migrations.AddField(
            model_name='walkstory',
            name='is_hidden',
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.AddField(
            model_name='walkstory',
            name='hidden_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='walkstory',
            name='hidden_reason',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
        migrations.AddField(
            model_name='storycomment',
            name='is_hidden',
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.AddField(
            model_name='storycomment',
            name='hidden_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storycomment',
            name='hidden_reason',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
    ]
