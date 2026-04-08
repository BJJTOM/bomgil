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

from .models import CustomUser, Notification, PhoneAuthLog, PhoneVerification, UserBadge


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


class PhoneSendThrottle(UserRateThrottle):
    scope = 'phone_send'
    rate = '5/hour'


class PhoneVerifyThrottle(UserRateThrottle):
    scope = 'phone_verify'
    rate = '10/hour'


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


# Phase 11: 휴대폰 인증
class PhoneSendView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [PhoneSendThrottle]

    def post(self, request):
        phone = request.data.get("phone_number", "")
        if not phone:
            return Response({"error": "전화번호를 입력해주세요."}, status=status.HTTP_400_BAD_REQUEST)

        code = "".join(random.choices(string.digits, k=6))
        PhoneVerification.objects.create(
            user=request.user, phone_number=phone, code=code
        )

        # TODO: integrate real SMS provider for production
        logger.debug("SMS verification code generated for phone=%s", phone)

        return Response({"message": "인증번호가 발송되었습니다."})


class PhoneVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [PhoneVerifyThrottle]

    def post(self, request):
        phone = request.data.get("phone_number", "")
        code = request.data.get("code", "")

        try:
            verification = PhoneVerification.objects.filter(
                user=request.user, phone_number=phone, code=code, is_verified=False
            ).latest("created_at")
        except PhoneVerification.DoesNotExist:
            return Response(
                {"error": "인증번호가 일치하지 않습니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        verification.is_verified = True
        verification.save(update_fields=["is_verified"])

        user = request.user
        user.phone_number = phone
        user.is_verified = True
        user.verification_level = max(user.verification_level, 2)
        user.save(update_fields=["phone_number", "is_verified", "verification_level"])

        # Award badge
        UserBadge.objects.get_or_create(user=user, badge_type="verified")

        return Response({"verified": True})


class FirebasePhoneAuthThrottle(AnonRateThrottle):
    rate = '20/hour'


class PhoneSmsSentLogView(APIView):
    """Log when client sends SMS verification request via Firebase."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [FirebasePhoneAuthThrottle]

    def post(self, request):
        phone = request.data.get('phone_number', '').strip()
        if not phone:
            return Response({"error": "phone_number required"}, status=400)
        PhoneAuthLog.objects.create(
            phone_number=phone,
            event_type='sms_sent',
            ip_address=_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:300],
        )
        return Response({"logged": True})


class FirebasePhoneAuthView(APIView):
    """Authenticate or register a user via Firebase phone ID token.

    Body: { id_token: "...", nickname: "..." (optional, only for new users) }

    Returns: { access, refresh, user, is_new }
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [FirebasePhoneAuthThrottle]

    def post(self, request):
        from .firebase_auth import verify_id_token

        id_token = request.data.get('id_token', '').strip()
        nickname = request.data.get('nickname', '').strip()

        if not id_token:
            return Response({"error": "id_token이 필요합니다."}, status=400)

        decoded = verify_id_token(id_token)
        if not decoded:
            PhoneAuthLog.objects.create(
                phone_number='', event_type='failed',
                error_message='Invalid Firebase token',
                ip_address=_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:300],
            )
            return Response({"error": "유효하지 않은 인증 토큰입니다."}, status=401)

        firebase_uid = decoded.get('uid', '')
        phone_number = decoded.get('phone_number', '')

        if not firebase_uid or not phone_number:
            return Response({"error": "전화번호 정보를 찾을 수 없습니다."}, status=400)

        # Lookup by firebase_uid first, then by phone_number
        user = CustomUser.objects.filter(firebase_uid=firebase_uid).first()
        if not user:
            user = CustomUser.objects.filter(phone_number=phone_number).first()

        is_new = False
        if not user:
            # Create new user
            if not nickname:
                # Auto-generate nickname from phone tail
                nickname = f"user{phone_number[-4:]}"
            # Ensure unique nickname
            base = nickname
            i = 1
            while CustomUser.objects.filter(nickname=nickname).exists():
                nickname = f"{base}{i}"
                i += 1

            username = f"phone_{firebase_uid[:20]}"
            i2 = 1
            while CustomUser.objects.filter(username=username).exists():
                username = f"phone_{firebase_uid[:18]}{i2}"
                i2 += 1

            user = CustomUser.objects.create(
                username=username,
                nickname=nickname,
                phone_number=phone_number,
                phone_verified=True,
                firebase_uid=firebase_uid,
                is_verified=True,
                verification_level=2,
                email=f"{firebase_uid}@phone.moruwalk.com",
            )
            user.set_unusable_password()
            user.save()
            is_new = True
        else:
            # Update phone verification status
            updated_fields = []
            if not user.phone_verified:
                user.phone_verified = True
                updated_fields.append('phone_verified')
            if not user.firebase_uid:
                user.firebase_uid = firebase_uid
                updated_fields.append('firebase_uid')
            if user.phone_number != phone_number:
                user.phone_number = phone_number
                updated_fields.append('phone_number')
            if updated_fields:
                user.save(update_fields=updated_fields)

        # Log the auth event
        PhoneAuthLog.objects.create(
            phone_number=phone_number,
            event_type='signup' if is_new else 'login',
            user=user,
            firebase_uid=firebase_uid,
            nickname=user.nickname,
            email=user.email,
            ip_address=_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:300],
        )

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
            'is_new': is_new,
        })


class LoginRateThrottle(AnonRateThrottle):
    rate = '5/minute'


class RegisterRateThrottle(AnonRateThrottle):
    rate = '3/minute'


class EmailLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        from .serializers import EmailLoginSerializer
        serializer = EmailLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)
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


class ThrottledRegisterView(APIView):
    """Proxy to dj-rest-auth RegisterView with rate limiting."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [RegisterRateThrottle]

    def post(self, request, *args, **kwargs):
        from dj_rest_auth.registration.views import RegisterView
        view = RegisterView.as_view()
        return view(request, *args, **kwargs)


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
