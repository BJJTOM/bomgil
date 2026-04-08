from django.urls import path

from .views import ReviewDetailView, ReviewHelpfulView, ReviewImageUploadView, TrailReviewListCreateView

urlpatterns = [
    path(
        "trails/<int:trail_id>/",
        TrailReviewListCreateView.as_view(),
        name="trail-reviews",
    ),
    path("<int:pk>/", ReviewDetailView.as_view(), name="review-detail"),
    path("<int:pk>/helpful/", ReviewHelpfulView.as_view(), name="review-helpful"),
    path("<int:pk>/images/", ReviewImageUploadView.as_view(), name="review-images"),
]
