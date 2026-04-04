from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .og_image import generate_og_image
from .rankings import (
    CollectionDetailView,
    CollectionListView,
    FeaturedCollectionsView,
    MonthlyPopularView,
    PopularGuidesView,
    RegionPopularView,
    WeeklyPopularView,
)
from .views import RecommendedTrailsView, TagListView, TrailViewSet

router = DefaultRouter()
router.register("", TrailViewSet, basename="trail")

urlpatterns = [
    path("tags/", TagListView.as_view(), name="tag-list"),
    # Rankings
    path("rankings/weekly/", WeeklyPopularView.as_view(), name="ranking-weekly"),
    path("rankings/monthly/", MonthlyPopularView.as_view(), name="ranking-monthly"),
    path("rankings/region/", RegionPopularView.as_view(), name="ranking-region"),
    path("rankings/guides/", PopularGuidesView.as_view(), name="ranking-guides"),
    # Collections
    path("collections/", CollectionListView.as_view(), name="collection-list"),
    path("collections/featured/", FeaturedCollectionsView.as_view(), name="collection-featured"),
    path("collections/<int:pk>/", CollectionDetailView.as_view(), name="collection-detail"),
    # Recommendations
    path("recommended/", RecommendedTrailsView.as_view(), name="trail-recommended"),
    # OG Image
    path("<int:pk>/og-image/", generate_og_image, name="trail-og-image"),
    # Router
    path("", include(router.urls)),
]
