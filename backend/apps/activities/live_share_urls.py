from django.urls import path
from .live_share import LiveStartView, LiveDetailView

urlpatterns = [
    path("", LiveStartView.as_view(), name="live-walk-start"),
    path("<str:token>/", LiveDetailView.as_view(), name="live-walk-detail"),
]
