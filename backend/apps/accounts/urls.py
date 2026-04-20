from django.urls import include, path

from .views import (
    AccountDeleteView,
    EmailLoginView,
    FCMTokenView,
    SendOtpView,
    VerifyOtpView,
    CompletePhoneAuthView,
    FollowersView,
    PasswordChangeView,
    FollowingView,
    FollowView,
    GuestLoginView,
    MeView,
    MeXPView,
    NotificationListView,
    NotificationReadAllView,
    NotificationUnreadCountView,
    ThrottledRegisterView,
    UserBadgesView,
    UserLikedTrailsView,
    UserProfileView,
    UserReviewsView,
    UserTrailsView,
)

urlpatterns = [
    path("", include("dj_rest_auth.urls")),
    path("register/", ThrottledRegisterView.as_view(), name="throttled-register"),
    path("register/", include("dj_rest_auth.registration.urls")),
    path("me/", MeView.as_view(), name="user-me"),
    path("me/delete/", AccountDeleteView.as_view(), name="account-delete"),
    path("me/xp/", MeXPView.as_view(), name="user-me-xp"),
    path("me/likes/", UserLikedTrailsView.as_view(), name="user-liked-trails"),
    path("users/<str:nickname>/", UserProfileView.as_view(), name="user-profile"),
    path("users/<str:nickname>/trails/", UserTrailsView.as_view(), name="user-trails"),
    path("users/<str:nickname>/reviews/", UserReviewsView.as_view(), name="user-reviews"),
    path("users/<str:nickname>/badges/", UserBadgesView.as_view(), name="user-badges"),
    path("users/<str:nickname>/follow/", FollowView.as_view(), name="user-follow"),
    path("users/<str:nickname>/followers/", FollowersView.as_view(), name="user-followers"),
    path("users/<str:nickname>/following/", FollowingView.as_view(), name="user-following"),
    # Email login
    path("email-login/", EmailLoginView.as_view(), name="email-login"),
    # Guest login
    path("guest-login/", GuestLoginView.as_view(), name="guest-login"),
    # Password change
    path("password-change/", PasswordChangeView.as_view(), name="password-change"),
    # Phone OTP
    path("phone/otp/send/", SendOtpView.as_view(), name="otp-send"),
    path("phone/otp/verify/", VerifyOtpView.as_view(), name="otp-verify"),
    path("phone/otp/complete/", CompletePhoneAuthView.as_view(), name="otp-complete"),
    # FCM token
    path("fcm-token/", FCMTokenView.as_view(), name="fcm-token"),
    # Notifications
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("notifications/unread-count/", NotificationUnreadCountView.as_view(), name="notification-unread-count"),
    path("notifications/read-all/", NotificationReadAllView.as_view(), name="notification-read-all"),
]
