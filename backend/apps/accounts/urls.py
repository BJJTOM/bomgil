from django.urls import include, path

from .views import (
    EmailLoginView,
    FollowersView,
    FollowingView,
    FollowView,
    GuestLoginView,
    MeView,
    PhoneSendView,
    PhoneVerifyView,
    UserBadgesView,
    UserLikedTrailsView,
    UserProfileView,
    UserReviewsView,
    UserTrailsView,
)

urlpatterns = [
    path("", include("dj_rest_auth.urls")),
    path("register/", include("dj_rest_auth.registration.urls")),
    path("social/google/", include("allauth.socialaccount.providers.google.urls")),
    path("social/kakao/", include("allauth.socialaccount.providers.kakao.urls")),
    path("me/", MeView.as_view(), name="user-me"),
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
    # Phone verification
    path("phone/send/", PhoneSendView.as_view(), name="phone-send"),
    path("phone/verify/", PhoneVerifyView.as_view(), name="phone-verify"),
]
