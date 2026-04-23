from datetime import timedelta

from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCompanionAllowed
from apps.moderation.reports import Notification

from .models import (
    ChatMessage,
    ChatRoom,
    CompanionRequest,
    CompanionReview,
    SafetyReport,
    WalkPlan,
)
from .matching import compute_compatibility, get_suggested_companions
from .serializers import (
    ChatMessageCreateSerializer,
    ChatMessageSerializer,
    ChatRoomSerializer,
    CompanionRequestCreateSerializer,
    CompanionRequestSerializer,
    CompanionRequestWithScoreSerializer,
    CompanionReviewCreateSerializer,
    CompanionReviewSerializer,
    SafetyReportSerializer,
    SuggestedCompanionSerializer,
    WalkPlanCreateSerializer,
    WalkPlanDetailSerializer,
    WalkPlanListSerializer,
)

SAFETY_BAN_THRESHOLD = 2


def _check_companion_eligible(user):
    """Check if user is eligible for companion features."""
    from django.conf import settings

    if not user.email:
        return False, "이메일 인증이 필요합니다."
    # Profile image & 24h wait only enforced in production
    if not settings.DEBUG:
        if not user.profile_image:
            return False, "프로필 사진을 등록해주세요."
        if user.date_joined > timezone.now() - timedelta(hours=24):
            return False, "가입 후 24시간이 지나야 동행 기능을 이용할 수 있습니다."
    report_count = SafetyReport.objects.filter(
        reported_user=user, is_resolved=False
    ).count()
    if report_count >= SAFETY_BAN_THRESHOLD:
        return False, "안전 신고로 인해 동행 기능이 제한되었습니다."
    return True, ""


class WalkPlanViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsCompanionAllowed]

    def get_queryset(self):
        qs = WalkPlan.objects.select_related("user", "trail").annotate(
            accepted_count_db=Count("requests", filter=Q(requests__status="accepted"))
        )
        if self.action == "list":
            qs = qs.filter(
                companion_status="open",
                is_visible=True,
                planned_date__gte=timezone.now().date(),
            )
            # Filters
            trail_id = self.request.query_params.get("trail")
            if trail_id:
                qs = qs.filter(trail_id=trail_id)
            date = self.request.query_params.get("date")
            if date:
                qs = qs.filter(planned_date=date)
            pace = self.request.query_params.get("pace")
            if pace:
                qs = qs.filter(pace=pace)
            region = self.request.query_params.get("region")
            if region:
                qs = qs.filter(trail__region=region)
            trail_type = self.request.query_params.get("trail_type")
            if trail_type:
                qs = qs.filter(trail__trail_type=trail_type)
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return WalkPlanCreateSerializer
        if self.action == "retrieve":
            return WalkPlanDetailSerializer
        return WalkPlanListSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        plan = WalkPlan.objects.select_related("user", "trail").get(pk=serializer.instance.pk)
        return Response(
            WalkPlanListSerializer(plan, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsCompanionAllowed])
    def close(self, request, pk=None):
        plan = self.get_object()
        if plan.user != request.user:
            return Response({"error": "권한이 없습니다."}, status=status.HTTP_403_FORBIDDEN)
        plan.companion_status = "closed"
        plan.save(update_fields=["companion_status"])
        return Response({"status": "closed"})

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsCompanionAllowed])
    def complete(self, request, pk=None):
        plan = self.get_object()
        if plan.user != request.user:
            return Response({"error": "권한이 없습니다."}, status=status.HTTP_403_FORBIDDEN)
        plan.companion_status = "completed"
        plan.save(update_fields=["companion_status"])

        # Update user stats
        participants = [plan.user]
        for req in plan.requests.filter(status="accepted"):
            participants.append(req.requester)
        for user in participants:
            user.total_walks += 1
            user.companion_count += len(participants) - 1
            user.save(update_fields=["total_walks", "companion_count"])

        # Send review notifications
        for user in participants:
            Notification.objects.create(
                user=user,
                message=f"어제 걷기 어떠셨나요? 동행 후기를 남겨주세요!",
                link=f"/walk-plans/{plan.id}/review",
            )

        return Response({"status": "completed"})

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsCompanionAllowed])
    def request_companion(self, request, pk=None):
        plan = self.get_object()
        eligible, reason = _check_companion_eligible(request.user)
        if not eligible:
            return Response({"error": reason}, status=status.HTTP_400_BAD_REQUEST)

        if plan.user == request.user:
            return Response({"error": "자신의 일정에 신청할 수 없습니다."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = CompanionRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        comp_req, created = CompanionRequest.objects.get_or_create(
            requester=request.user,
            walk_plan=plan,
            defaults={"message": serializer.validated_data["message"]},
        )
        if not created:
            return Response({"error": "이미 신청한 일정입니다."}, status=status.HTTP_400_BAD_REQUEST)

        Notification.objects.create(
            user=plan.user,
            message=f"{request.user.nickname}님이 동행을 신청했어요!",
            link=f"/me/walk-plans",
        )
        return Response(CompanionRequestSerializer(comp_req).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], permission_classes=[permissions.IsAuthenticated, IsCompanionAllowed])
    def requests(self, request, pk=None):
        plan = self.get_object()
        if plan.user != request.user:
            return Response({"error": "권한이 없습니다."}, status=status.HTTP_403_FORBIDDEN)
        qs = plan.requests.select_related("requester")
        return Response(CompanionRequestSerializer(qs, many=True).data)

    @action(
        detail=True,
        methods=["get"],
        permission_classes=[permissions.IsAuthenticated, IsCompanionAllowed],
        url_path="suggested-companions",
    )
    def suggested_companions(self, request, pk=None):
        """Return top 10 users ranked by compatibility score for this walk plan."""
        plan = self.get_object()
        if plan.user != request.user:
            return Response({"error": "권한이 없습니다."}, status=status.HTTP_403_FORBIDDEN)
        if plan.companion_status not in ("open",):
            return Response(
                {"error": "동행 구하는 중인 일정만 추천을 받을 수 있습니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lang = getattr(request.user, "preferred_language", "ko") or "ko"
        limit = min(int(request.query_params.get("limit", 10)), 20)
        suggestions = get_suggested_companions(plan, limit=limit, lang=lang)
        serializer = SuggestedCompanionSerializer(suggestions, many=True)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["get"],
        permission_classes=[permissions.IsAuthenticated, IsCompanionAllowed],
        url_path="scored-requests",
    )
    def scored_requests(self, request, pk=None):
        """Incoming requests with compatibility scores.

        Same as the `requests` action but each request includes
        `compatibility_score` and `compatibility_reasons`.
        """
        plan = self.get_object()
        if plan.user != request.user:
            return Response({"error": "권한이 없습니다."}, status=status.HTTP_403_FORBIDDEN)

        lang = getattr(request.user, "preferred_language", "ko") or "ko"
        qs = plan.requests.filter(status="pending").select_related("requester")

        results = []
        for comp_req in qs:
            compat = compute_compatibility(
                request.user, comp_req.requester, walk_plan=plan, lang=lang,
            )
            results.append({
                "id": comp_req.id,
                "requester": comp_req.requester,
                "walk_plan": comp_req.walk_plan_id,
                "message": comp_req.message,
                "status": comp_req.status,
                "created_at": comp_req.created_at,
                "compatibility_score": compat["score"],
                "compatibility_reasons": compat["reasons"],
            })

        # Sort by compatibility score descending
        results.sort(key=lambda x: x["compatibility_score"], reverse=True)
        serializer = CompanionRequestWithScoreSerializer(results, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsCompanionAllowed])
    def companion_review(self, request, pk=None):
        plan = self.get_object()
        if plan.companion_status != "completed":
            return Response({"error": "완료된 일정만 후기 작성 가능합니다."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = CompanionReviewCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        review = CompanionReview.objects.create(
            reviewer=request.user,
            reviewed_user_id=serializer.validated_data["reviewed_user_id"],
            walk_plan=plan,
            rating=serializer.validated_data["rating"],
            tags=serializer.validated_data.get("tags", []),
            content=serializer.validated_data.get("content", ""),
        )

        # Update companion_rating
        reviewed = review.reviewed_user
        avg = CompanionReview.objects.filter(reviewed_user=reviewed).aggregate(
            avg=Avg("rating")
        )["avg"]
        if avg:
            reviewed.companion_rating = round(avg, 1)
            reviewed.save(update_fields=["companion_rating"])

        return Response(CompanionReviewSerializer(review).data, status=status.HTTP_201_CREATED)


class CompatibilityCheckView(APIView):
    """Check compatibility score between the current user and another user.

    GET /api/v1/compatibility/<user_id>/
    Optionally accepts ?walk_plan=<id> to include availability scoring.
    """

    permission_classes = [permissions.IsAuthenticated, IsCompanionAllowed]

    def get(self, request, user_id):
        from apps.accounts.models import CustomUser

        try:
            other_user = CustomUser.objects.get(pk=user_id, is_active=True)
        except CustomUser.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if other_user.pk == request.user.pk:
            return Response(
                {"error": "자기 자신과의 호환성은 확인할 수 없습니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        walk_plan = None
        wp_id = request.query_params.get("walk_plan")
        if wp_id:
            try:
                walk_plan = WalkPlan.objects.get(pk=wp_id)
            except WalkPlan.DoesNotExist:
                pass

        lang = getattr(request.user, "preferred_language", "ko") or "ko"
        compat = compute_compatibility(request.user, other_user, walk_plan=walk_plan, lang=lang)
        return Response(compat)


class CompanionRequestAcceptView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCompanionAllowed]

    def post(self, request, pk):
        try:
            comp_req = CompanionRequest.objects.select_related("walk_plan").get(pk=pk)
        except CompanionRequest.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if comp_req.walk_plan.user != request.user:
            return Response({"error": "권한이 없습니다."}, status=status.HTTP_403_FORBIDDEN)

        comp_req.status = "accepted"
        comp_req.save(update_fields=["status"])

        plan = comp_req.walk_plan

        # Create or get chat room
        room, _ = ChatRoom.objects.get_or_create(walk_plan=plan)
        room.participants.add(plan.user, comp_req.requester)

        # Auto-match if full
        if plan.is_full:
            plan.companion_status = "matched"
            plan.save(update_fields=["companion_status"])

        Notification.objects.create(
            user=comp_req.requester,
            message=f"{request.user.nickname}님이 동행 신청을 수락했어요!",
            link=f"/chat",
        )

        return Response({"status": "accepted"})


class CompanionRequestRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCompanionAllowed]

    def post(self, request, pk):
        try:
            comp_req = CompanionRequest.objects.select_related("walk_plan").get(pk=pk)
        except CompanionRequest.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if comp_req.walk_plan.user != request.user:
            return Response({"error": "권한이 없습니다."}, status=status.HTTP_403_FORBIDDEN)

        comp_req.status = "rejected"
        comp_req.save(update_fields=["status"])

        Notification.objects.create(
            user=comp_req.requester,
            message="이번에는 어려울 것 같아요. 다음에 함께 걸어요!",
            link=f"/companions",
        )

        return Response({"status": "rejected"})


class UserCompanionReviewsView(generics.ListAPIView):
    serializer_class = CompanionReviewSerializer

    def get_queryset(self):
        from apps.accounts.models import CustomUser
        user = get_object_or_404(CustomUser, nickname=self.kwargs["nickname"])
        return CompanionReview.objects.filter(reviewed_user=user).select_related(
            "reviewer", "reviewed_user"
        )


class MyWalkPlansView(generics.ListAPIView):
    serializer_class = WalkPlanListSerializer
    permission_classes = [permissions.IsAuthenticated, IsCompanionAllowed]

    def get_queryset(self):
        return WalkPlan.objects.filter(user=self.request.user).select_related("user", "trail")


class MyCompanionRequestsView(generics.ListAPIView):
    serializer_class = CompanionRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsCompanionAllowed]

    def get_queryset(self):
        return CompanionRequest.objects.filter(
            requester=self.request.user
        ).select_related("requester")


class SafetyReportCreateView(generics.CreateAPIView):
    serializer_class = SafetyReportSerializer
    permission_classes = [permissions.IsAuthenticated, IsCompanionAllowed]

    def perform_create(self, serializer):
        report = serializer.save(reporter=self.request.user)
        # Check if threshold reached
        count = SafetyReport.objects.filter(
            reported_user=report.reported_user, is_resolved=False
        ).count()
        if count >= SAFETY_BAN_THRESHOLD:
            Notification.objects.create(
                user=report.reported_user,
                message="안전 신고 누적으로 동행 기능이 제한되었습니다.",
                link="/profile",
            )


# Chat views
class ChatRoomListView(generics.ListAPIView):
    serializer_class = ChatRoomSerializer
    permission_classes = [permissions.IsAuthenticated, IsCompanionAllowed]

    def get_queryset(self):
        from django.db.models import Q
        # My companion rooms + all open rooms
        return ChatRoom.objects.filter(
            Q(participants=self.request.user) | Q(walk_plan__isnull=True)
        ).distinct().prefetch_related("participants")

    def post(self, request):
        """Create an open chat room."""
        name = request.data.get("name", "").strip()
        if not name:
            return Response({"error": "채팅방 이름을 입력해주세요."}, status=status.HTTP_400_BAD_REQUEST)
        room = ChatRoom.objects.create(name=name)
        room.participants.add(request.user)
        return Response(ChatRoomSerializer(room).data, status=status.HTTP_201_CREATED)


class ChatMessageListView(generics.ListAPIView):
    serializer_class = ChatMessageSerializer
    permission_classes = [permissions.IsAuthenticated, IsCompanionAllowed]

    def get_queryset(self):
        room = get_object_or_404(ChatRoom, pk=self.kwargs["room_id"])
        if self.request.user not in room.participants.all():
            return ChatMessage.objects.none()
        return room.messages.select_related("sender")


class ChatMessageCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCompanionAllowed]

    def post(self, request, room_id):
        try:
            room = ChatRoom.objects.get(pk=room_id)
        except ChatRoom.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if request.user not in room.participants.all():
            return Response({"error": "이 채팅방에 참여하지 않았습니다."}, status=status.HTTP_403_FORBIDDEN)

        serializer = ChatMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        msg = ChatMessage.objects.create(
            room=room,
            sender=request.user,
            content=serializer.validated_data["content"],
        )
        return Response(ChatMessageSerializer(msg).data, status=status.HTTP_201_CREATED)
