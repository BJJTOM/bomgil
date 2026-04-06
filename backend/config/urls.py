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
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM reviews_review")
            cursor.execute("DELETE FROM spots_spot")
            cursor.execute("DELETE FROM stories_walkstory")
            cursor.execute("DELETE FROM activities_activitytrack")
            cursor.execute("DELETE FROM trails_trail_tags")
            cursor.execute("DELETE FROM trails_traillike")
            cursor.execute("DELETE FROM trails_trail")
            cursor.execute("DELETE FROM accounts_customuser WHERE is_superuser = false")
        return JsonResponse({"status": "ok", "msg": "all data wiped"})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

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
