from django.conf import settings
from django.db import connection
from django.core.cache import cache
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckView(APIView):
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        health = {"status": "ok"}

        # DB check
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            db_ok = True
        except Exception as e:
            db_ok = False
            health["status"] = "degraded"

        # Redis check
        try:
            cache.set("health_check", "ok", 10)
            val = cache.get("health_check")
            redis_ok = val == "ok"
        except Exception as e:
            redis_ok = False
            health["status"] = "degraded"

        # Only expose internal details in DEBUG mode
        if settings.DEBUG:
            health["checks"] = {
                "database": "ok" if db_ok else "error",
                "redis": "ok" if redis_ok else "error",
            }

        status_code = 200 if health["status"] == "ok" else 503
        return Response(health, status=status_code)
