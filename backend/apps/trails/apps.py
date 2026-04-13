from django.apps import AppConfig


class TrailsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.trails"
    verbose_name = "코스 관리"

    def ready(self):
        # Register post_save/post_delete signal handlers so Trail and
        # TrailSeries edits trigger an on-demand Next.js ISR revalidate.
        from . import signals  # noqa: F401
