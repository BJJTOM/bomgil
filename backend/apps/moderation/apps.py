from django.apps import AppConfig


class ModerationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.moderation"
    verbose_name = "운영/신고"

    def ready(self):
        import apps.moderation.signals  # noqa: F401
