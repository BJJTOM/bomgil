# Generated manually for AI moderation feature

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("moderation", "0003_alter_moderationlog_options_and_more"),
        ("contenttypes", "0002_remove_content_type_name"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AIModerationLog",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "object_id",
                    models.PositiveIntegerField(),
                ),
                (
                    "action",
                    models.CharField(
                        choices=[
                            ("approve", "승인"),
                            ("review", "검토 필요"),
                            ("reject", "자동 차단"),
                            ("error", "AI 오류"),
                        ],
                        max_length=10,
                    ),
                ),
                (
                    "is_safe",
                    models.BooleanField(default=True),
                ),
                (
                    "confidence",
                    models.FloatField(default=0.0, help_text="AI 확신도 (0.0~1.0)"),
                ),
                (
                    "flags",
                    models.JSONField(blank=True, default=list, help_text="감지된 위반 유형"),
                ),
                (
                    "reason",
                    models.TextField(blank=True, help_text="AI 판단 사유", max_length=1000),
                ),
                (
                    "input_text",
                    models.TextField(
                        blank=True,
                        help_text="검사 대상 텍스트 (앞부분)",
                        max_length=5000,
                    ),
                ),
                (
                    "content_type_label",
                    models.CharField(
                        blank=True,
                        help_text="post, comment, etc.",
                        max_length=30,
                    ),
                ),
                (
                    "is_overridden",
                    models.BooleanField(default=False),
                ),
                (
                    "overridden_at",
                    models.DateTimeField(blank=True, null=True),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "content_type",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to="contenttypes.contenttype",
                    ),
                ),
                (
                    "overridden_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="ai_moderation_overrides",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "AI 모더레이션 로그",
                "verbose_name_plural": "AI 모더레이션 로그",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="aimoderationlog",
            index=models.Index(
                fields=["content_type", "object_id"],
                name="moderation_a_content_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="aimoderationlog",
            index=models.Index(
                fields=["action"],
                name="moderation_a_action_idx",
            ),
        ),
    ]
