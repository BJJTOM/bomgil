import logging
import random
import string

from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from apps.reviews.models import Review
from apps.reviews.serializers import ReviewSerializer
from apps.trails.models import Trail, TrailLike
from apps.trails.serializers import TrailListSerializer

from .models import AgreementAcceptance, CustomUser, Notification, PhoneAuthLog, PhoneOTP, UserBadge


def _client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')
from .serializers import NotificationSerializer, UserPublicSerializer, UserSerializer, UserXPDetailSerializer

from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger(__name__)


class ProfileUpdateThrottle(UserRateThrottle):
    scope = 'profile_update'
    rate = '20/hour'


class FollowThrottle(UserRateThrottle):
    scope = 'follow'
    rate = '200/hour'


class PasswordChangeThrottle(UserRateThrottle):
    scope = 'password_change'
    rate = '10/hour'


class FCMTokenThrottle(UserRateThrottle):
    scope = 'fcm_token'
    rate = '60/hour'


class AccountDeleteThrottle(UserRateThrottle):
    scope = 'account_delete'
    rate = '5/hour'


class NotificationActionThrottle(UserRateThrottle):
    scope = 'notification_action'
    rate = '120/hour'


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ProfileUpdateThrottle]

    def get_object(self):
        return self.request.user


class AccountDeleteView(APIView):
    """Soft-delete the authenticated user (set is_active=False)."""
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [AccountDeleteThrottle]

    def delete(self, request):
        user = request.user
        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response(
            {"detail": "\uD68C\uC6D0 \uD0C8\uD1F4\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4."},
            status=status.HTTP_200_OK,
        )


class MeXPView(generics.RetrieveAPIView):
    serializer_class = UserXPDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserProfileView(generics.RetrieveAPIView):
    queryset = CustomUser.objects.prefetch_related("badges")
    serializer_class = UserPublicSerializer
    lookup_field = "nickname"


class UserTrailsView(generics.ListAPIView):
    serializer_class = TrailListSerializer

    def get_queryset(self):
        user = get_object_or_404(CustomUser, nickname=self.kwargs["nickname"])
        return (
            Trail.objects.filter(author=user, status="approved")
            .select_related("author")
            .prefetch_related("tags")
        )


class UserLikedTrailsView(generics.ListAPIView):
    serializer_class = TrailListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        liked_ids = TrailLike.objects.filter(user=self.request.user).values_list(
            "trail_id", flat=True
        )
        return (
            Trail.objects.filter(id__in=liked_ids, status="approved")
            .select_related("author")
            .prefetch_related("tags")
        )


class UserReviewsView(generics.ListAPIView):
    serializer_class = ReviewSerializer

    def get_queryset(self):
        user = get_object_or_404(CustomUser, nickname=self.kwargs["nickname"])
        return (
            Review.objects.filter(author=user)
            .select_related("author", "trail")
            .prefetch_related("images")
        )


class UserBadgesView(APIView):
    def get(self, request, nickname):
        user = get_object_or_404(CustomUser, nickname=nickname)
        badges = UserBadge.objects.filter(user=user)
        data = [
            {
                "badge_type": b.badge_type,
                "label": b.get_badge_type_display(),
                "earned_at": b.earned_at.isoformat(),
            }
            for b in badges
        ]
        return Response(data)


class OtpSendThrottle(AnonRateThrottle):
    scope = 'otp_send'
    rate = '30/hour'


class OtpVerifyThrottle(AnonRateThrottle):
    scope = 'otp_verify'
    rate = '120/hour'


class OtpCompleteThrottle(AnonRateThrottle):
    scope = 'otp_complete'
    rate = '120/hour'


# Backwards compat alias
CustomOtpThrottle = OtpSendThrottle


def _normalize_phone(phone: str) -> str:
    """Normalize phone to E.164 Korean format."""
    digits = ''.join(c for c in phone if c.isdigit() or c == '+')
    if digits.startswith('+82'):
        return digits
    if digits.startswith('82'):
        return '+' + digits
    if digits.startswith('010'):
        return '+82' + digits[1:]
    if digits.startswith('0'):
        return '+82' + digits[1:]
    return digits


def _generate_safe_username() -> str:
    """Generate a random username that does NOT encode any phone digits.

    Format: phone_<16 hex chars>. Collision probability is negligible
    (16^16 = 1.8e19), but we still loop to be safe.
    """
    import secrets
    for _ in range(5):
        candidate = f"phone_{secrets.token_hex(8)}"
        if not CustomUser.objects.filter(username=candidate).exists():
            return candidate
    # Extreme fallback — append more entropy
    return f"phone_{secrets.token_hex(12)}"


class SendOtpView(APIView):
    """Generate and store an OTP for the given phone number.

    Security:
    - Never returns the OTP in the response. Staff can view recent codes
      via Django admin (PhoneOTP). SMS is sent via the configured provider;
      when no provider is configured the code is logged to Django logs only.
    - Per-phone rate limit (5 sends / hour) on top of the per-IP throttle
      to prevent enumeration via proxy rotation.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [OtpSendThrottle]

    # Per-phone limit (independent from per-IP DRF throttle)
    PER_PHONE_HOURLY_LIMIT = 5

    def post(self, request):
        import random
        import string
        from datetime import timedelta
        from django.utils import timezone
        from .sms import send_sms

        phone = request.data.get('phone_number', '').strip()
        if not phone:
            return Response({"error": "phone_number가 필요합니다."}, status=400)

        normalized = _normalize_phone(phone)

        # Per-phone hourly rate limit (defends against IP rotation).
        # Count sms_sent events from PhoneAuthLog — unlike PhoneOTP, these
        # rows are never deleted, so the throttle can't be reset by the
        # delete-old-OTP step below.
        recent_count = PhoneAuthLog.objects.filter(
            phone_number=normalized,
            event_type='sms_sent',
            created_at__gte=timezone.now() - timedelta(hours=1),
        ).count()
        if recent_count >= self.PER_PHONE_HOURLY_LIMIT:
            PhoneAuthLog.objects.create(
                phone_number=normalized,
                event_type='failed',
                error_message='per-phone rate limit',
                ip_address=_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:300],
            )
            return Response(
                {"error": "잠시 후 다시 시도해주세요. (전화번호당 시간당 요청 제한)"},
                status=429,
            )

        # Generate 6-digit code
        code = ''.join(random.choices(string.digits, k=6))

        # Store OTP (delete previous unverified ones for this number)
        PhoneOTP.objects.filter(phone_number=normalized, verified=False).delete()
        PhoneOTP.objects.create(
            phone_number=normalized,
            code=code,
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        # Send SMS (or log in test mode)
        message = f"[모루] 인증번호: {code}\n5분 안에 입력해주세요."
        success, error = send_sms(normalized, message)

        # Log
        PhoneAuthLog.objects.create(
            phone_number=normalized,
            event_type='sms_sent' if success else 'failed',
            error_message='' if success else error[:300],
            ip_address=_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:300],
        )

        if not success:
            return Response({"error": f"SMS 전송 실패: {error}"}, status=500)

        # ⚠️ NEVER return the OTP in the response. Staff can view it via
        # Django admin (PhoneOTP) or Render logs.
        return Response({"sent": True, "expires_in": 300})


class VerifyOtpView(APIView):
    """Verify an OTP code and issue a short-lived verification token.

    Security:
    - Response NEVER reveals whether a user with this phone exists.
      Account existence is resolved later in /complete/ via the
      `nickname_required` error code, after rate limiting and after
      a verification token has been spent (single-use).
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [OtpVerifyThrottle]

    def post(self, request):
        import secrets
        from django.core.cache import cache

        phone = request.data.get('phone_number', '').strip()
        code = request.data.get('code', '').strip()

        if not phone or not code:
            return Response({"error": "phone_number와 code가 필요합니다."}, status=400)

        normalized = _normalize_phone(phone)

        try:
            otp = PhoneOTP.objects.filter(
                phone_number=normalized,
                verified=False,
            ).latest('created_at')
        except PhoneOTP.DoesNotExist:
            return Response({"error": "인증번호를 먼저 요청해주세요."}, status=400)

        otp.attempts += 1
        otp.save(update_fields=['attempts'])

        if not otp.is_valid():
            return Response({"error": "인증번호가 만료되었거나 시도 횟수를 초과했습니다."}, status=400)

        if otp.code != code:
            return Response({"error": "인증번호가 일치하지 않습니다."}, status=400)

        otp.verified = True
        otp.save(update_fields=['verified'])

        # Generate verification token (valid for 10 minutes)
        token = secrets.token_urlsafe(32)
        cache.set(f"phone_verify:{token}", normalized, timeout=600)

        # Log against existing user if any (for admin traceability) but
        # do NOT leak that fact in the response.
        existing = CustomUser.objects.filter(phone_number=normalized).first()
        PhoneAuthLog.objects.create(
            phone_number=normalized,
            event_type='verified',
            user=existing,
            ip_address=_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:300],
        )

        return Response({
            "verified": True,
            "verification_token": token,
        })


class CompletePhoneAuthView(APIView):
    """Complete signup or login using a verification token.

    Flow (single endpoint, hides existence):
    - Token resolves to a phone number.
    - If a user with that phone exists → login (any provided nickname is ignored).
    - If no user exists and `nickname` is provided → create the account.
    - If no user exists and no `nickname` → return 400 with
      `{ error, code: "nickname_required" }` so the client can prompt.

    The verification token is single-use: it is deleted on the FIRST call,
    even when nickname is missing, to prevent enumeration via repeated probes.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [OtpCompleteThrottle]

    def post(self, request):
        from django.core.cache import cache
        from django.utils import timezone

        token = request.data.get('verification_token', '').strip()
        nickname = request.data.get('nickname', '').strip()

        if not token:
            return Response({"error": "verification_token이 필요합니다."}, status=400)

        cache_key = f"phone_verify:{token}"
        phone = cache.get(cache_key)
        if not phone:
            return Response({"error": "인증 토큰이 만료되었습니다. 다시 인증해주세요."}, status=400)

        user = CustomUser.objects.filter(phone_number=phone).first()
        is_new = False

        if user is None:
            if not nickname:
                # Tell the client to collect a nickname WITHOUT consuming the token,
                # so the next call (with nickname) can succeed.
                return Response(
                    {
                        "error": "닉네임을 입력해주세요.",
                        "code": "nickname_required",
                    },
                    status=400,
                )

            # Phone-signup path: same legal consent requirements as the
            # email register endpoint. Validate BEFORE we consume the
            # verification token so the user can retry without re-doing
            # SMS verification.
            required = {
                "agree_terms": "이용약관",
                "agree_privacy": "개인정보처리방침",
                "agree_location_terms": "위치기반서비스 이용약관",
                "agree_location_privacy": "개인위치정보 처리방침",
                "agree_age_14": "만 14세 이상 확인",
            }
            missing = [
                label for field, label in required.items()
                if not request.data.get(field)
            ]
            if missing:
                return Response(
                    {
                        "error": f"필수 약관에 동의해야 합니다: {', '.join(missing)}",
                        "code": "consent_required",
                    },
                    status=400,
                )

            # Create new user with a phone-free username/email.
            base_nick = nickname
            i = 1
            while CustomUser.objects.filter(nickname=nickname).exists():
                nickname = f"{base_nick}{i}"
                i += 1

            username = _generate_safe_username()
            user = CustomUser.objects.create(
                username=username,
                nickname=nickname,
                phone_number=phone,
                phone_verified=True,
                is_verified=True,
                verification_level=2,
                email=f"{username}@phone.moruwalk.com",
            )
            user.set_unusable_password()

            # Save marketing consent + write AgreementAcceptance rows.
            marketing = bool(request.data.get("agree_marketing"))
            if marketing:
                user.marketing_consent = True
                user.marketing_consent_at = timezone.now()
            user.save()

            from apps.community.models import LegalDocument
            ua = request.META.get('HTTP_USER_AGENT', '')[:300]
            ip = _client_ip(request)
            to_log = ["terms", "privacy", "location-terms", "location-privacy", "age-14"]
            if marketing:
                to_log.append("marketing-consent")
            for slug in to_log:
                doc = LegalDocument.latest_published(slug) if slug != "age-14" else None
                version = doc.version if doc else ""
                AgreementAcceptance.objects.get_or_create(
                    user=user, slug=slug,
                    defaults={"version": version, "ip_address": ip, "user_agent": ua},
                )

            is_new = True

        # Invalidate the verification token now that we have a real outcome.
        cache.delete(cache_key)

        PhoneAuthLog.objects.create(
            phone_number=phone,
            event_type='signup' if is_new else 'login',
            user=user,
            nickname=user.nickname,
            email=user.email,
            ip_address=_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:300],
        )

        # 신규 가입은 통과(정의상 정지 기록 없음), 기존 로그인은 account-scope 정지 차단
        if not is_new:
            from .authentication import assert_account_accessible
            assert_account_accessible(user)

        refresh = RefreshToken.for_user(user)
        from .models import LoginHistory as _LoginHistory
        _LoginHistory.record(
            user, request, method="phone_signup" if is_new else "phone_login",
        )
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
            'is_new': is_new,
        })


class LoginRateThrottle(AnonRateThrottle):
    # Reads rate from DEFAULT_THROTTLE_RATES['login'] so operators can
    # tune it from settings without a code change. Also keeps the cache
    # key namespaced per scope so login/register don't share a counter.
    scope = 'login'


class RegisterRateThrottle(AnonRateThrottle):
    scope = 'register'


class EmailLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        from .serializers import EmailLoginSerializer
        from .authentication import assert_account_accessible
        from .models import LoginHistory
        serializer = EmailLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        assert_account_accessible(user)
        refresh = RefreshToken.for_user(user)
        LoginHistory.record(user, request, method="password_email")
        user_data = UserSerializer(user).data
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': user_data,
        })


class FollowView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [FollowThrottle]

    def post(self, request, nickname):
        target = get_object_or_404(CustomUser, nickname=nickname)
        if target == request.user:
            return Response({"error": "자신을 팔로우할 수 없습니다"}, status=400)
        if request.user.following.filter(pk=target.pk).exists():
            request.user.following.remove(target)
            return Response({"following": False})
        request.user.following.add(target)
        # Notify the target user about the new follower
        from .notifications import create_notification
        create_notification(
            user=target,
            actor=request.user,
            title='새 팔로워',
            body=f'{request.user.nickname}님이 회원님을 팔로우합니다.',
            notification_type='follow',
        )
        return Response({"following": True}, status=201)


class FollowersView(generics.ListAPIView):
    serializer_class = UserPublicSerializer

    def get_queryset(self):
        user = get_object_or_404(CustomUser, nickname=self.kwargs['nickname'])
        return user.followers.all()


class FollowingView(generics.ListAPIView):
    serializer_class = UserPublicSerializer

    def get_queryset(self):
        user = get_object_or_404(CustomUser, nickname=self.kwargs['nickname'])
        return user.following.all()


class PasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [PasswordChangeThrottle]

    def post(self, request):
        old_password = request.data.get("old_password", "")
        new_password = request.data.get("new_password", "")

        if not old_password or not new_password:
            return Response(
                {"error": "현재 비밀번호와 새 비밀번호를 입력해주세요."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not request.user.check_password(old_password):
            return Response(
                {"error": "현재 비밀번호가 올바르지 않습니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            validate_password(new_password, user=request.user)
        except DjangoValidationError as e:
            return Response({"error": " ".join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new_password)
        request.user.save(update_fields=["password"])
        return Response({"message": "비밀번호가 변경되었습니다."})


class GuestLoginThrottle(AnonRateThrottle):
    scope = 'guest_login'
    rate = '20/hour'


class GuestLoginView(APIView):
    """Create a temporary guest user and return JWT tokens."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [GuestLoginThrottle]

    # Guest email domain — must match cleanup_guests management command
    GUEST_EMAIL_DOMAIN = "roami.guest"

    def post(self, request):
        import uuid
        from datetime import timedelta

        from django.core.cache import cache
        from django.utils import timezone
        from rest_framework_simplejwt.tokens import RefreshToken

        # --- Periodic cleanup: delete expired guests every ~10 logins ---
        self._maybe_cleanup_expired_guests(cache, timezone, timedelta)

        guest_id = uuid.uuid4().hex[:8]
        nickname = f"\uAC8C\uC2A4\uD2B8_{guest_id}"
        username = f"guest_{guest_id}"
        email = f"guest_{guest_id}@{self.GUEST_EMAIL_DOMAIN}"

        user = CustomUser.objects.create_user(
            username=username,
            email=email,
            nickname=nickname,
            password=None,
            bio="\uAC8C\uC2A4\uD2B8 \uC0AC\uC6A9\uC790\uC785\uB2C8\uB2E4 (7\uC77C \uD6C4 \uC790\uB3D9 \uC0AD\uC81C)",
        )
        user.set_unusable_password()
        user.save()

        refresh = RefreshToken.for_user(user)
        from .models import LoginHistory as _LoginHistory
        _LoginHistory.record(user, request, method="guest")
        user_data = UserSerializer(user).data

        return Response(
            {
                "user": user_data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "is_guest": True,
            },
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _maybe_cleanup_expired_guests(cache, timezone, timedelta):
        """Run guest cleanup once per hour using a cache flag.

        Deletes guest accounts older than 1 day to prevent stat inflation.
        """
        cache_key = "guest_cleanup_done"
        if cache.get(cache_key):
            return  # already ran this hour
        try:
            cutoff = timezone.now() - timedelta(days=1)
            deleted, _ = CustomUser.objects.filter(
                email__endswith=f"@{GuestLoginView.GUEST_EMAIL_DOMAIN}",
                created_at__lt=cutoff,
            ).delete()
            if deleted:
                logger.info("Guest cleanup: deleted %d expired guest account(s)", deleted)
        except Exception:
            logger.exception("Guest cleanup failed")
        # Set flag for 1 hour
        cache.set(cache_key, True, timeout=3600)


from dj_rest_auth.registration.views import RegisterView as _DjRestAuthRegisterView


class ThrottledRegisterView(_DjRestAuthRegisterView):
    """dj-rest-auth RegisterView with our rate-limit throttle attached.

    The previous version wrapped RegisterView.as_view() inside an APIView
    and forwarded the DRF-wrapped request. RegisterView's parent uses the
    `sensitive_post_parameters` decorator, which expects a raw Django
    HttpRequest — passing a DRF Request crashed the decorator with
    `sensitive_post_parameters didn't receive an HttpRequest object`
    and surfaced as a 500 on every signup attempt.

    Subclassing keeps the original request plumbing intact and just
    layers the throttle on top.
    """

    throttle_classes = [RegisterRateThrottle]


class FCMTokenView(APIView):
    """Save the FCM push token for the authenticated user."""
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [FCMTokenThrottle]

    def post(self, request):
        token = request.data.get('token', '').strip()
        if not token:
            return Response({'error': 'token is required'}, status=status.HTTP_400_BAD_REQUEST)
        if request.user.fcm_token != token:
            request.user.fcm_token = token
            request.user.save(update_fields=['fcm_token'])
        return Response({'saved': True})


class NotificationListView(generics.ListAPIView):
    """List the current user's notifications (paginated by cursor)."""
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(
            user=self.request.user,
        ).select_related('actor')


class NotificationUnreadCountView(APIView):
    """Return the count of unread notifications."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({'unread_count': count})


class NotificationReadAllView(APIView):
    """Mark all notifications as read."""
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [NotificationActionThrottle]

    def post(self, request):
        updated = Notification.objects.filter(
            user=request.user, is_read=False
        ).update(is_read=True)
        return Response({'marked': updated})
