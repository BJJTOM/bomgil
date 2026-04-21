from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .certificate import generate_certificate
from .gpx_export import GpxExportView
from .gpx_import import GpxImportView
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
from .views import (
    AISearchView,
    ForYouView,
    GenerateAIDescriptionView,
    MyBookmarksView,
    MyCompletionsView,
    MyStampsView,
    RecommendedTrailsView,
    TagListView,
    TrailSeriesViewSet,
    TrailViewSet,
)

router = DefaultRouter()
router.register("series", TrailSeriesViewSet, basename="trail-series")
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
    path("for-you/", ForYouView.as_view(), name="trail-for-you"),
    # Me: bookmarks, completions, stamps
    path("me/bookmarks/", MyBookmarksView.as_view(), name="trail-my-bookmarks"),
    path("me/completions/", MyCompletionsView.as_view(), name="trail-my-completions"),
    path("me/stamps/", MyStampsView.as_view(), name="trail-my-stamps"),
    # AI description generation
    path("ai/generate-description/", GenerateAIDescriptionView.as_view(), name="trail-ai-description"),
    # AI natural language search
    path("ai-search/", AISearchView.as_view(), name="trail-ai-search"),
    # GPX import / export
    path("import-gpx/", GpxImportView.as_view(), name="trail-import-gpx"),
    path("<int:pk>/gpx/", GpxExportView.as_view(), name="trail-gpx-export"),
    # OG Image
    path("<int:pk>/og-image/", generate_og_image, name="trail-og-image"),
    # Completion certificate
    path("<int:pk>/certificate/", generate_certificate, name="trail-certificate"),
    # Router
    path("", include(router.urls)),
]
