"""
Moru JWT authentication — rejects deleted or account-suspended users at the
authentication layer so any endpoint using these auth classes will 401 the
user without per-view changes.
"""
from dj_rest_auth.jwt_auth import JWTCookieAuthentication as _BaseJWTCookieAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication as _BaseJWTAuthentication


def _gate(user):
    if user is None:
        return user
    if getattr(user, "is_deleted", False):
        raise AuthenticationFailed(
            {"detail": "탈퇴한 계정입니다.", "code": "account_deleted"},
            code="account_deleted",
        )
    if user.is_suspended_for("account"):
        raise AuthenticationFailed(
            {"detail": "계정이 정지되어 있습니다.", "code": "account_suspended"},
            code="account_suspended",
        )
    return user


class MoruJWTAuthentication(_BaseJWTAuthentication):
    def get_user(self, validated_token):
        return _gate(super().get_user(validated_token))


class MoruJWTCookieAuthentication(_BaseJWTCookieAuthentication):
    def get_user(self, validated_token):
        return _gate(super().get_user(validated_token))


def assert_account_accessible(user):
    """Call from login/register views before issuing a new JWT."""
    _gate(user)
