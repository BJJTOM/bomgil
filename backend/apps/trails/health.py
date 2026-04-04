from django.db import connection
from django.core.cache import cache
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckView(APIView):
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        health = {"status": "ok", "checks": {}}

        # DB check
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            health["checks"]["database"] = "ok"
        except Exception as e:
            health["checks"]["database"] = f"error: {str(e)}"
            health["status"] = "degraded"

        # Redis check
        try:
            cache.set("health_check", "ok", 10)
            val = cache.get("health_check")
            health["checks"]["redis"] = "ok" if val == "ok" else "error"
        except Exception as e:
            health["checks"]["redis"] = f"error: {str(e)}"
            health["status"] = "degraded"

        status_code = 200 if health["status"] == "ok" else 503
        return Response(health, status=status_code)
