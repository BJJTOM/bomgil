import random
import string

from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.reviews.models import Review
from apps.reviews.serializers import ReviewSerializer
from apps.trails.models import Trail, TrailLike
from apps.trails.serializers import TrailListSerializer

from .models import CustomUser, PhoneVerification, UserBadge
from .serializers import UserPublicSerializer, UserSerializer

from rest_framework_simplejwt.tokens import RefreshToken


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
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
        user = CustomUser.objects.get(nickname=self.kwargs["nickname"])
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
        user = CustomUser.objects.get(nickname=self.kwargs["nickname"])
        return (
            Review.objects.filter(author=user)
            .select_related("author", "trail")
            .prefetch_related("images")
        )


class UserBadgesView(APIView):
    def get(self, request, nickname):
        user = CustomUser.objects.get(nickname=nickname)
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

    def post(self, request):
        phone = request.data.get("phone_number", "")
        if not phone:
            return Response({"error": "전화번호를 입력해주세요."}, status=status.HTTP_400_BAD_REQUEST)

        code = "".join(random.choices(string.digits, k=6))
        PhoneVerification.objects.create(
            user=request.user, phone_number=phone, code=code
        )

        # Dev: print to console. Prod: send SMS.
        print(f"[SMS Verification] {phone}: {code}")

        return Response({"message": "인증번호가 발송되었습니다.", "dev_code": code})


class PhoneVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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


class EmailLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

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

    def post(self, request, nickname):
        target = CustomUser.objects.get(nickname=nickname)
        if target == request.user:
            return Response({"error": "자신을 팔로우할 수 없습니다"}, status=400)
        if request.user.following.filter(pk=target.pk).exists():
            request.user.following.remove(target)
            return Response({"following": False})
        request.user.following.add(target)
        return Response({"following": True}, status=201)


class FollowersView(generics.ListAPIView):
    serializer_class = UserPublicSerializer

    def get_queryset(self):
        user = CustomUser.objects.get(nickname=self.kwargs['nickname'])
        return user.followers.all()


class FollowingView(generics.ListAPIView):
    serializer_class = UserPublicSerializer

    def get_queryset(self):
        user = CustomUser.objects.get(nickname=self.kwargs['nickname'])
        return user.following.all()


class GuestLoginThrottle(AnonRateThrottle):
    rate = '10/hour'


class GuestLoginView(APIView):
    """Create a temporary guest user and return JWT tokens."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [GuestLoginThrottle]

    def post(self, request):
        import uuid

        from rest_framework_simplejwt.tokens import RefreshToken

        guest_id = uuid.uuid4().hex[:8]
        nickname = f"게스트_{guest_id}"
        username = f"guest_{guest_id}"
        email = f"guest_{guest_id}@roami.guest"

        user = CustomUser.objects.create_user(
            username=username,
            email=email,
            nickname=nickname,
            password=None,
            bio="게스트 사용자입니다 (24시간 후 자동 삭제)",
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
