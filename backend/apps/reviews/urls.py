from django.urls import path

from .views import ReviewDetailView, ReviewHelpfulView, TrailReviewListCreateView

urlpatterns = [
    path(
        "trails/<int:trail_id>/",
        TrailReviewListCreateView.as_view(),
        name="trail-reviews",
    ),
    path("<int:pk>/", ReviewDetailView.as_view(), name="review-detail"),
    path("<int:pk>/helpful/", ReviewHelpfulView.as_view(), name="review-helpful"),
]
