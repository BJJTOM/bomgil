"""
Production settings for Render deployment.
"""
import os

import dj_database_url

from .settings import *  # noqa: F401,F403

# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
DEBUG = False
SECRET_KEY = os.environ["SECRET_KEY"]  # No fallback — fail fast
ALLOWED_HOSTS = [
    h.strip() for h in
    os.environ.get("ALLOWED_HOSTS", "moruwalk.com,www.moruwalk.com").split(",")
    if h.strip()
]

# ---------------------------------------------------------------------------
# Database — Render PostgreSQL
# ---------------------------------------------------------------------------
DATABASE_URL = os.environ.get("DATABASE_URL", "")
DATABASES = {
    "default": dj_database_url.parse(DATABASE_URL, conn_max_age=600) if DATABASE_URL else {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# ---------------------------------------------------------------------------
# Cache — use local memory (free tier, no Redis)
# ---------------------------------------------------------------------------
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# ---------------------------------------------------------------------------
# Static files — Whitenoise
# ---------------------------------------------------------------------------
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# ---------------------------------------------------------------------------
# Media files — Cloudflare R2 (S3-compatible)
# ---------------------------------------------------------------------------
STORAGES["default"] = {
    "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
}
# Cloudflare R2 credentials — fallback for Render deploy until env vars are set
AWS_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID", "78673a73bb9b436de9003572ad5a0382")
AWS_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "adfad506e5b56b62b147cdd8140e1cccc5f39423d30b3c28957411c27f66bca7")
AWS_STORAGE_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME", "moru-media")
AWS_S3_ENDPOINT_URL = os.environ.get("R2_ENDPOINT_URL", "https://028d8e2de23582d1fc6235c2dd8fa760.r2.cloudflarestorage.com")
AWS_S3_REGION_NAME = "auto"
AWS_DEFAULT_ACL = None
AWS_S3_SIGNATURE_VERSION = "s3v4"
AWS_QUERYSTRING_AUTH = True
AWS_QUERYSTRING_EXPIRE = 3600  # signed URLs valid for 1 hour
MEDIA_URL = f"{AWS_S3_ENDPOINT_URL}/{AWS_STORAGE_BUCKET_NAME}/"

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = [
    x.strip() for x in
    os.environ.get("CORS_ALLOWED_ORIGINS", "https://moruwalk.com,https://www.moruwalk.com").split(",")
    if x.strip()
]
CORS_ALLOW_CREDENTIALS = True

# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = False  # Render handles SSL

# ---------------------------------------------------------------------------
# Throttling — relax base anon/user limits but preserve per-action scopes
# ---------------------------------------------------------------------------
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {
    **REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {}),
    "anon": "500/hour",
    "user": "5000/hour",
    "trail_create": "100/day",
    "login": "5/minute",
    "register": "3/minute",
}

# ---------------------------------------------------------------------------
# Security headers
# ---------------------------------------------------------------------------
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
