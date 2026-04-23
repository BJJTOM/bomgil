"""
Admin enhancement tests:
  - UserSuspension scope/expiry logic
  - MoruJWTAuthentication blocks account-suspended / deleted users
  - IsCommunityAllowed blocks community writes but not reads
  - LoginHistory.record() populates table and updates user.last_login_ip/ua
"""
from datetime import timedelta
from unittest.mock import Mock

from django.test import RequestFactory, TestCase
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed

from apps.accounts.authentication import assert_account_accessible
from apps.accounts.models import CustomUser, LoginHistory, UserSuspension
from apps.accounts.permissions import (
    IsCommunityAllowed,
    IsReviewAllowed,
    IsTrailAllowed,
)


def _make_user(**kwargs):
    i = CustomUser.objects.count()
    defaults = dict(
        username=f"tester_{i}",
        email=f"tester_{i}@example.com",
        nickname=f"tester_{i}",
    )
    defaults.update(kwargs)
    return CustomUser.objects.create_user(**defaults)


def _suspend(user, scopes, *, duration_days=None):
    return UserSuspension.objects.create(
        user=user,
        reason="test",
        duration="permanent" if duration_days is None else f"{duration_days}d",
        scopes=list(scopes),
        expires_at=None if duration_days is None else timezone.now() + timedelta(days=duration_days),
    )


class SuspensionLogicTests(TestCase):
    def test_is_suspended_respects_scope(self):
        u = _make_user()
        self.assertFalse(u.is_suspended)
        _suspend(u, ["community"])
        u.refresh_from_db()
        self.assertTrue(u.is_suspended)
        self.assertTrue(u.is_suspended_for("community"))
        self.assertFalse(u.is_suspended_for("trail"))

    def test_account_scope_covers_everything(self):
        u = _make_user()
        _suspend(u, ["account"])
        self.assertTrue(u.is_suspended_for("community"))
        self.assertTrue(u.is_suspended_for("trail"))
        self.assertTrue(u.is_suspended_for("companion"))
        self.assertTrue(u.is_suspended_for("review"))

    def test_expired_suspension_not_active(self):
        u = _make_user()
        s = _suspend(u, ["community"], duration_days=1)
        s.expires_at = timezone.now() - timedelta(minutes=1)
        s.save(update_fields=["expires_at"])
        self.assertFalse(u.is_suspended)
        self.assertFalse(u.is_suspended_for("community"))

    def test_lifted_suspension_not_active(self):
        u = _make_user()
        s = _suspend(u, ["community"])
        s.lifted_at = timezone.now()
        s.save(update_fields=["lifted_at"])
        self.assertFalse(u.is_suspended)


class AuthGateTests(TestCase):
    def test_assert_allows_clean_user(self):
        u = _make_user()
        # should not raise
        assert_account_accessible(u)

    def test_assert_blocks_deleted(self):
        u = _make_user(is_deleted=True)
        with self.assertRaises(AuthenticationFailed):
            assert_account_accessible(u)

    def test_assert_blocks_account_suspended(self):
        u = _make_user()
        _suspend(u, ["account"])
        with self.assertRaises(AuthenticationFailed):
            assert_account_accessible(u)

    def test_assert_allows_community_only_suspended(self):
        u = _make_user()
        _suspend(u, ["community"])
        # not account-scope → login allowed
        assert_account_accessible(u)


class PermissionTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def _req(self, user, method="POST"):
        req = self.factory.generic(method, "/")
        req.user = user
        return req

    def _mock_view(self):
        v = Mock()
        return v

    def test_safe_method_always_allowed(self):
        u = _make_user()
        _suspend(u, ["community"])
        perm = IsCommunityAllowed()
        self.assertTrue(perm.has_permission(self._req(u, "GET"), self._mock_view()))
        self.assertTrue(perm.has_permission(self._req(u, "HEAD"), self._mock_view()))

    def test_unauthenticated_passes_through(self):
        from django.contrib.auth.models import AnonymousUser
        perm = IsCommunityAllowed()
        req = self.factory.post("/")
        req.user = AnonymousUser()
        self.assertTrue(perm.has_permission(req, self._mock_view()))

    def test_community_suspended_blocked_on_write(self):
        u = _make_user()
        _suspend(u, ["community"])
        perm = IsCommunityAllowed()
        self.assertFalse(perm.has_permission(self._req(u, "POST"), self._mock_view()))

    def test_community_suspended_not_blocked_on_trail_scope(self):
        u = _make_user()
        _suspend(u, ["community"])
        trail = IsTrailAllowed()
        review = IsReviewAllowed()
        self.assertTrue(trail.has_permission(self._req(u, "POST"), self._mock_view()))
        self.assertTrue(review.has_permission(self._req(u, "POST"), self._mock_view()))

    def test_account_suspended_blocks_all_scopes(self):
        u = _make_user()
        _suspend(u, ["account"])
        self.assertFalse(IsCommunityAllowed().has_permission(self._req(u, "POST"), self._mock_view()))
        self.assertFalse(IsTrailAllowed().has_permission(self._req(u, "POST"), self._mock_view()))
        self.assertFalse(IsReviewAllowed().has_permission(self._req(u, "POST"), self._mock_view()))

    def test_deleted_user_blocked_on_write(self):
        u = _make_user(is_deleted=True)
        self.assertFalse(IsCommunityAllowed().has_permission(self._req(u, "POST"), self._mock_view()))


class LoginHistoryTests(TestCase):
    def test_record_creates_row_and_updates_user(self):
        u = _make_user()
        factory = RequestFactory()
        req = factory.post("/login/", HTTP_USER_AGENT="Mozilla/5.0 test", REMOTE_ADDR="203.0.113.42")
        LoginHistory.record(u, req, method="password_email")
        u.refresh_from_db()
        self.assertEqual(u.last_login_ip, "203.0.113.42")
        self.assertIn("Mozilla", u.last_login_user_agent)
        self.assertEqual(LoginHistory.objects.filter(user=u).count(), 1)
        row = LoginHistory.objects.get(user=u)
        self.assertEqual(row.login_method, "password_email")

    def test_record_respects_x_forwarded_for(self):
        u = _make_user()
        factory = RequestFactory()
        req = factory.post(
            "/login/",
            HTTP_X_FORWARDED_FOR="198.51.100.10, 10.0.0.1",
            REMOTE_ADDR="10.0.0.1",
        )
        LoginHistory.record(u, req, method="phone_login")
        u.refresh_from_db()
        self.assertEqual(u.last_login_ip, "198.51.100.10")

    def test_record_with_no_request_skips_update(self):
        u = _make_user()
        LoginHistory.record(u, request=None, method="noop")
        u.refresh_from_db()
        self.assertIsNone(u.last_login_ip)
        # but row was still created
        self.assertEqual(LoginHistory.objects.filter(user=u).count(), 1)
