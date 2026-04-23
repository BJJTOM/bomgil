"""
Scope-based suspension/deletion gating.

- Read requests (SAFE_METHODS) are always allowed (lets suspended users still browse).
- Unauthenticated requests pass through to IsAuthenticated / IsAuthenticatedOrReadOnly.
- Deleted users are blocked on write (JWT authentication also blocks at the auth
  layer, so this is a safety net).
- `account` scope suspensions block every write; per-scope suspensions
  (community/trail/companion/review) block only the matching area.
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsNotSuspended(BasePermission):
    """Base — subclass and set `scope`."""

    scope: str | None = None
    message = "현재 이 기능은 이용이 정지되어 있습니다."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return True  # delegate to IsAuthenticated*
        if getattr(user, "is_deleted", False):
            self.message = "탈퇴한 계정입니다."
            return False
        if not self.scope:
            return True
        if user.is_suspended_for(self.scope):
            return False
        return True


class IsCommunityAllowed(IsNotSuspended):
    scope = "community"
    message = "커뮤니티 이용이 정지되어 있습니다."


class IsTrailAllowed(IsNotSuspended):
    scope = "trail"
    message = "코스 등록 이용이 정지되어 있습니다."


class IsCompanionAllowed(IsNotSuspended):
    scope = "companion"
    message = "동행 기능 이용이 정지되어 있습니다."


class IsReviewAllowed(IsNotSuspended):
    scope = "review"
    message = "리뷰/평점 이용이 정지되어 있습니다."
