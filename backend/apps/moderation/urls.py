from django.urls import path

from .views import (
    ModerationApproveView,
    ModerationLogListView,
    ModerationRejectView,
    ModerationStatsView,
    NotificationListView,
    NotificationReadAllView,
    NotificationReadView,
    PendingListView,
    ReportCreateView,
    ReportListView,
)

urlpatterns = [
    # Moderation (admin)
    path("pending/", PendingListView.as_view(), name="moderation-pending"),
    path(
        "<str:type_name>/<int:pk>/approve/",
        ModerationApproveView.as_view(),
        name="moderation-approve",
    ),
    path(
        "<str:type_name>/<int:pk>/reject/",
        ModerationRejectView.as_view(),
        name="moderation-reject",
    ),
    path("logs/", ModerationLogListView.as_view(), name="moderation-logs"),
    path("stats/", ModerationStatsView.as_view(), name="moderation-stats"),
    # Reports
    path("reports/", ReportListView.as_view(), name="report-list"),
    path("reports/create/", ReportCreateView.as_view(), name="report-create"),
    # Notifications
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path(
        "notifications/<int:pk>/read/",
        NotificationReadView.as_view(),
        name="notification-read",
    ),
    path(
        "notifications/read-all/",
        NotificationReadAllView.as_view(),
        name="notification-read-all",
    ),
]
