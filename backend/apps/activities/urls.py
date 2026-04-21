from django.urls import include, path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("", views.ActivityTrackViewSet, basename="activity")

urlpatterns = [
    path("weekly-insights/", views.WeeklyInsightsView.as_view(), name="weekly-insights"),
    path("merge/", views.ActivityMergeView.as_view(), name="activity-merge"),
    path("trail/<int:trail_id>/", views.TrailActivitiesView.as_view()),
    path("users/<str:nickname>/", views.UserActivitiesView.as_view()),
] + router.urls
