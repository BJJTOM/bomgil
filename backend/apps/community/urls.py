from django.urls import path
from . import views

urlpatterns = [
    # 게시판
    path('posts/', views.PostListView.as_view(), name='post-list'),
    path('posts/popular/', views.PopularPostListView.as_view(), name='post-popular'),
    path('posts/bookmarks/', views.MyBookmarkedPostsView.as_view(), name='post-bookmarks'),
    path('posts/create/', views.PostCreateView.as_view(), name='post-create'),
    path('posts/<int:pk>/', views.PostDetailView.as_view(), name='post-detail'),
    path('posts/<int:pk>/update/', views.PostUpdateView.as_view(), name='post-update'),
    path('posts/<int:pk>/like/', views.PostLikeView.as_view(), name='post-like'),
    path('posts/<int:pk>/bookmark/', views.PostBookmarkView.as_view(), name='post-bookmark'),
    path('posts/<int:pk>/delete/', views.PostDeleteView.as_view(), name='post-delete'),
    path('posts/<int:pk>/images/', views.PostImageUploadView.as_view(), name='post-images'),
    path('posts/<int:pk>/images/<int:image_id>/', views.PostImageDeleteView.as_view(), name='post-image-delete'),
    path('posts/<int:pk>/comments/', views.PostCommentListView.as_view(), name='post-comments'),
    path('posts/<int:pk>/comments/create/', views.PostCommentCreateView.as_view(), name='post-comment-create'),
    path('posts/comments/<int:comment_id>/like/', views.CommentLikeView.as_view(), name='comment-like'),
    path('posts/comments/<int:comment_id>/reply/', views.CommentReplyView.as_view(), name='comment-reply'),
    path('posts/comments/<int:comment_id>/update/', views.PostCommentUpdateView.as_view(), name='comment-update'),
    path('posts/comments/<int:comment_id>/delete/', views.PostCommentDeleteView.as_view(), name='comment-delete'),

    # 신고 / 차단
    path('report/', views.ReportCreateView.as_view(), name='report-create'),
    path('block/', views.UserBlockView.as_view(), name='user-block'),
    path('unblock/', views.UserUnblockView.as_view(), name='user-unblock'),
    path('blocked-users/', views.BlockedUsersView.as_view(), name='blocked-users'),

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
    path('challenges/<int:pk>/leave/', views.ChallengeLeaveView.as_view(), name='challenge-leave'),
    path('challenges/<int:pk>/progress/', views.ChallengeProgressUpdateView.as_view(), name='challenge-progress'),
    path('challenges/<int:pk>/leaderboard/', views.ChallengeLeaderboardView.as_view(), name='challenge-leaderboard'),

    # 공지사항
    path('notices/', views.NoticeListView.as_view(), name='notice-list'),

    # 사이트 설정
    path('site-config/', views.SiteConfigView.as_view(), name='site-config'),

    # 약관·방침 (공개 + 어드민)
    path('legal/<slug:slug>/', views.LegalDocumentPublicView.as_view(), name='legal-public'),
    path('admin/legal/', views.LegalDocumentListAdminView.as_view(), name='legal-admin-list'),
    path('admin/legal/<int:pk>/', views.LegalDocumentAdminDetailView.as_view(), name='legal-admin-detail'),

    # 사용자 피드백 (베타)
    path('feedback/', views.FeedbackCreateView.as_view(), name='feedback-create'),
]
