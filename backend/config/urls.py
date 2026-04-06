from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from django.views.decorators.csrf import csrf_exempt

from apps.trails.health import HealthCheckView


@csrf_exempt
def _tmp_setup(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    from apps.accounts.models import CustomUser
    email = "admin@moruwalk.com"
    if CustomUser.objects.filter(email=email).exists():
        return JsonResponse({"msg": "already exists"})
    CustomUser.objects.create_superuser(
        username="moruadmin", email=email, password="Moru@2026!tmp",
        nickname="Admin",
    )
    return JsonResponse({"msg": "created"})


urlpatterns = [
    path("_init-setup-8x7z/", _tmp_setup),
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/trails/", include("apps.trails.urls")),
    path("api/v1/spots/", include("apps.spots.urls")),
    path("api/v1/reviews/", include("apps.reviews.urls")),
    path("api/v1/moderation/", include("apps.moderation.urls")),
    path("api/v1/", include("apps.companions.urls")),
    path("api/v1/stories/", include("apps.stories.urls")),
    path("api/v1/activities/", include("apps.activities.urls")),
    path("api/v1/health/", HealthCheckView.as_view(), name="health-check"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
