from django.urls import path
from . import views

urlpatterns = [
    # 게시판
    path('posts/', views.PostListView.as_view(), name='post-list'),
    path('posts/create/', views.PostCreateView.as_view(), name='post-create'),
    path('posts/<int:pk>/', views.PostDetailView.as_view(), name='post-detail'),
    path('posts/<int:pk>/like/', views.PostLikeView.as_view(), name='post-like'),
    path('posts/<int:pk>/delete/', views.PostDeleteView.as_view(), name='post-delete'),
    path('posts/<int:pk>/images/', views.PostImageUploadView.as_view(), name='post-images'),
    path('posts/<int:pk>/comments/', views.PostCommentListView.as_view(), name='post-comments'),
    path('posts/<int:pk>/comments/create/', views.PostCommentCreateView.as_view(), name='post-comment-create'),
    path('posts/comments/<int:comment_id>/like/', views.CommentLikeView.as_view(), name='comment-like'),
    path('posts/comments/<int:comment_id>/reply/', views.CommentReplyView.as_view(), name='comment-reply'),

    # 모임
    path('groups/', views.GroupListView.as_view(), name='group-list'),
    path('groups/create/', views.GroupCreateView.as_view(), name='group-create'),
    path('groups/<int:pk>/', views.GroupDetailView.as_view(), name='group-detail'),
    path('groups/<int:pk>/join/', views.GroupJoinView.as_view(), name='group-join'),
    path('groups/<int:pk>/leave/', views.GroupLeaveView.as_view(), name='group-leave'),
    path('groups/<int:pk>/members/', views.GroupMemberListView.as_view(), name='group-members'),
    path('groups/<int:pk>/messages/', views.GroupMessageListView.as_view(), name='group-messages'),
    path('groups/<int:pk>/messages/create/', views.GroupMessageCreateView.as_view(), name='group-message-create'),

    # 챌린지
    path('challenges/', views.ChallengeListView.as_view(), name='challenge-list'),
    path('challenges/<int:pk>/', views.ChallengeDetailView.as_view(), name='challenge-detail'),
    path('challenges/<int:pk>/join/', views.ChallengeJoinView.as_view(), name='challenge-join'),
    path('challenges/<int:pk>/leaderboard/', views.ChallengeLeaderboardView.as_view(), name='challenge-leaderboard'),
]
