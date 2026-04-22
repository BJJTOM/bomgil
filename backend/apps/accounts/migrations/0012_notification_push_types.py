# Generated manually for push notification types

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_delete_phoneverification'),
    ]

    operations = [
        migrations.AlterField(
            model_name='notification',
            name='notification_type',
            field=models.CharField(
                choices=[
                    ('like', '좋아요'),
                    ('comment', '댓글'),
                    ('reply', '답글'),
                    ('follow', '팔로우'),
                    ('system', '시스템'),
                    ('new_trail', '새 코스'),
                    ('review', '리뷰'),
                    ('companion', '동행 요청'),
                    ('weekly_goal', '주간 목표'),
                ],
                default='system',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='notification',
            name='target_type',
            field=models.CharField(
                blank=True,
                choices=[
                    ('post', '게시글'),
                    ('trail', '코스'),
                    ('activity', '활동'),
                    ('walk_plan', '걷기 일정'),
                ],
                max_length=20,
                null=True,
            ),
        ),
    ]
