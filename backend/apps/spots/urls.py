from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import SpotImageUploadView, SpotViewSet

router = DefaultRouter()
router.register("", SpotViewSet, basename="spot")

urlpatterns = [
    path("images/", SpotImageUploadView.as_view({"post": "create"}), name="spot-image-upload"),
    path("", include(router.urls)),
]
