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
    try:
        from apps.spots.models import Spot
        from apps.reviews.models import Review
        from apps.stories.models import WalkStory
        from apps.activities.models import ActivityTrack
        from apps.trails.models import Trail, TrailLike
        from apps.accounts.models import CustomUser
        results = {}
        results['reviews'] = Review.objects.all().delete()[0]
        results['spots'] = Spot.objects.all().delete()[0]
        results['likes'] = TrailLike.objects.all().delete()[0]
        results['stories'] = WalkStory.objects.all().delete()[0]
        results['activities'] = ActivityTrack.objects.all().delete()[0]
        results['trails'] = Trail.objects.all().delete()[0]
        results['users'] = CustomUser.objects.filter(is_superuser=False).delete()[0]
        return JsonResponse({"status": "ok", **results})
    except Exception as e:
        import traceback
        return JsonResponse({"error": str(e), "trace": traceback.format_exc()}, status=500)

def _platform_stats(request):
    from apps.trails.models import Trail
    from apps.stories.models import WalkStory
    from apps.accounts.models import CustomUser
    countries = Trail.objects.filter(status="approved").values_list("country", flat=True).distinct().count()
    trails = Trail.objects.filter(status="approved").count()
    stories = WalkStory.objects.filter(is_public=True).count()
    users = CustomUser.objects.filter(is_active=True).count()
    return JsonResponse({"countries": countries, "trails": trails, "stories": stories, "users": users})

urlpatterns = [
    path("_wipe-data-tmp/", _tmp_wipe),
    path("api/v1/stats/", _platform_stats),
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
