from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.trails.health import HealthCheckView

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def _tmp_wipe(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    from apps.trails.models import Trail
    from apps.activities.models import Activity
    from apps.stories.models import WalkStory
    from apps.spots.models import Spot
    from apps.reviews.models import Review
    tc = Trail.objects.all().delete()
    ac = Activity.objects.all().delete()
    sc = WalkStory.objects.all().delete()
    spc = Spot.objects.all().delete()
    rc = Review.objects.all().delete()
    return JsonResponse({"trails": tc[0], "activities": ac[0], "stories": sc[0], "spots": spc[0], "reviews": rc[0]})

urlpatterns = [
    path("_wipe-data-tmp/", _tmp_wipe),
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
