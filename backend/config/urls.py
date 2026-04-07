from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.trails.health import HealthCheckView

from django.http import JsonResponse




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
    path("api/v1/community/", include("apps.community.urls")),
    path("api/v1/health/", HealthCheckView.as_view(), name="health-check"),
]

# Serve media files in both debug and production
# In production (Render free tier without S3), files are on local disk
# and will be lost on redeploy, but at least served while the instance is alive
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
