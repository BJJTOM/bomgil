from django.urls import path

from .translation_api import TranslateView
from .views import (
    CommentLikeView,
    CommentReplyView,
    NotificationListView,
    NotificationReadAllView,
    StoryCommentCreateView,
    StoryCommentListView,
    StoryCreateView,
    StoryDetailView,
    StoryFeedView,
    StoryLikeView,
    StoryShareCardView,
    TrailStoriesView,
    UserStoriesView,
)

urlpatterns = [
    path("", StoryFeedView.as_view(), name="story-feed"),
    path("create/", StoryCreateView.as_view(), name="story-create"),
    path("<int:pk>/", StoryDetailView.as_view(), name="story-detail"),
    path("<int:pk>/like/", StoryLikeView.as_view(), name="story-like"),
    path("<int:pk>/comments/", StoryCommentListView.as_view(), name="story-comments"),
    path("<int:pk>/comments/create/", StoryCommentCreateView.as_view(), name="story-comment-create"),
    path("<int:pk>/share-card/", StoryShareCardView.as_view(), name="story-share-card"),
    path("comments/<int:comment_id>/like/", CommentLikeView.as_view(), name="comment-like"),
    path("comments/<int:comment_id>/reply/", CommentReplyView.as_view(), name="comment-reply"),
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("notifications/read-all/", NotificationReadAllView.as_view(), name="notification-read-all"),
    path("trails/<int:trail_id>/", TrailStoriesView.as_view(), name="trail-stories"),
    path("users/<str:nickname>/", UserStoriesView.as_view(), name="user-stories"),
    path("translate/", TranslateView.as_view(), name="translate"),
]
