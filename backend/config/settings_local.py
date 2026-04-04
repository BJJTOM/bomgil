"""
Local development settings — SQLite, no Redis dependency.
Usage: DJANGO_SETTINGS_MODULE=config.settings_local python manage.py runserver 8001
"""
from .settings import *  # noqa

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# Disable throttling for local dev
REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = []
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {}

CORS_ALLOW_ALL_ORIGINS = True
DEBUG = True
