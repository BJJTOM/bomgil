from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ChatMessageCreateView,
    ChatMessageListView,
    ChatRoomListView,
    CompanionRequestAcceptView,
    CompanionRequestRejectView,
    MyCompanionRequestsView,
    MyWalkPlansView,
    SafetyReportCreateView,
    UserCompanionReviewsView,
    WalkPlanViewSet,
)

router = DefaultRouter()
router.register("walk-plans", WalkPlanViewSet, basename="walk-plan")

urlpatterns = [
    # Walk plans (router)
    path("", include(router.urls)),
    # Companion requests
    path(
        "companion-requests/<int:pk>/accept/",
        CompanionRequestAcceptView.as_view(),
        name="companion-request-accept",
    ),
    path(
        "companion-requests/<int:pk>/reject/",
        CompanionRequestRejectView.as_view(),
        name="companion-request-reject",
    ),
    # My activity
    path("me/walk-plans/", MyWalkPlansView.as_view(), name="my-walk-plans"),
    path("me/companion-requests/", MyCompanionRequestsView.as_view(), name="my-companion-requests"),
    # User companion reviews
    path(
        "users/<str:nickname>/companion-reviews/",
        UserCompanionReviewsView.as_view(),
        name="user-companion-reviews",
    ),
    # Safety
    path("safety-reports/", SafetyReportCreateView.as_view(), name="safety-report-create"),
    # Chat
    path("chat-rooms/", ChatRoomListView.as_view(), name="chat-room-list"),
    path("chat-rooms/<int:room_id>/messages/", ChatMessageListView.as_view(), name="chat-messages"),
    path("chat-rooms/<int:room_id>/messages/send/", ChatMessageCreateView.as_view(), name="chat-send"),
]
