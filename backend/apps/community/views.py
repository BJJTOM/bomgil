from django.db import transaction
from django.db.models import F, Q
from rest_framework import generics, status, permissions, throttling
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.accounts.notifications import create_notification
from apps.accounts.permissions import IsCommunityAllowed
from config.validators import validate_image_file
from .models import (
    Post, PostComment, PostLike, CommentLike, PostImage, PostBookmark,
    Report, UserBlock,
    Group, GroupMember, GroupMessage,
    Challenge, ChallengeParticipant,
    Notice, SiteConfig,
    LegalDocument,
)
from .serializers import (
    PostListSerializer, PostDetailSerializer, PostCreateSerializer, PostUpdateSerializer,
    PostCommentSerializer, ReportSerializer, UserBlockSerializer,
    GroupListSerializer, GroupDetailSerializer, GroupCreateSerializer,
    GroupMessageSerializer, GroupMemberSerializer,
    ChallengeListSerializer, ChallengeDetailSerializer,
    ChallengeParticipantSerializer,
    NoticeSerializer,
)


# ──────────────────────────────────────
# 게시판
# ──────────────────────────────────────

class PostListView(generics.ListAPIView):
    serializer_class = PostListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        # Hide admin-moderated posts from public lists. Authors still see
        # their own hidden posts via the dedicated my-posts endpoint.
        qs = (
            Post.objects.filter(is_hidden=False)
            .select_related('author')
            .prefetch_related('post_images')
        )

        # 차단된 유저 필터링
        if self.request.user.is_authenticated:
            blocked_ids = UserBlock.objects.filter(
                blocker=self.request.user
            ).values_list('blocked_id', flat=True)
            qs = qs.exclude(author_id__in=blocked_ids)

        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)

        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(content__icontains=q))

        ordering = self.request.query_params.get('ordering', '-created_at')
        if ordering in ['-created_at', '-like_count', '-view_count', '-comment_count']:
            qs = qs.order_by('-is_pinned', ordering)
        return qs


class PopularPostListView(generics.ListAPIView):
    """인기글 — 좋아요순 상위 게시글"""
    serializer_class = PostListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        from django.utils import timezone
        from datetime import timedelta
        week_ago = timezone.now() - timedelta(days=7)
        return Post.objects.filter(
            created_at__gte=week_ago,
            is_hidden=False,
        ).select_related('author').prefetch_related('post_images').order_by('-like_count')[:20]


class MyBookmarkedPostsView(generics.ListAPIView):
    """내 북마크 목록"""
    serializer_class = PostListSerializer
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]

    def get_queryset(self):
        bookmarked_ids = PostBookmark.objects.filter(
            user=self.request.user
        ).values_list('post_id', flat=True)
        return Post.objects.filter(
            id__in=bookmarked_ids
        ).select_related('author').prefetch_related('post_images')


class PostCreateThrottle(throttling.UserRateThrottle):
    scope = 'post_create'
    rate = '30/hour'


class CommentCreateThrottle(throttling.UserRateThrottle):
    scope = 'comment_create'
    rate = '60/hour'


class LikeBookmarkThrottle(throttling.UserRateThrottle):
    scope = 'like_bookmark'
    rate = '200/hour'


class ImageUploadThrottle(throttling.UserRateThrottle):
    scope = 'image_upload'
    rate = '30/hour'


class PostUpdateThrottle(throttling.UserRateThrottle):
    scope = 'post_update'
    rate = '60/hour'


class ReportThrottle(throttling.UserRateThrottle):
    scope = 'report'
    rate = '30/hour'


class GroupCreateThrottle(throttling.UserRateThrottle):
    scope = 'group_create'
    rate = '20/hour'


class GroupMessageThrottle(throttling.UserRateThrottle):
    scope = 'group_message'
    rate = '120/hour'


class PostCreateView(generics.CreateAPIView):
    serializer_class = PostCreateSerializer
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [PostCreateThrottle]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class PostDetailView(generics.RetrieveAPIView):
    serializer_class = PostDetailSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Post.objects.select_related('author').prefetch_related(
        'post_images', 'comments__author'
    )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        Post.objects.filter(pk=instance.pk).update(view_count=F('view_count') + 1)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class PostUpdateView(generics.UpdateAPIView):
    serializer_class = PostUpdateSerializer
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [PostUpdateThrottle]
    http_method_names = ['patch']

    def get_queryset(self):
        return Post.objects.filter(author=self.request.user)


class PostLikeView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [LikeBookmarkThrottle]

    @transaction.atomic
    def post(self, request, pk):
        post = generics.get_object_or_404(Post.objects.select_for_update(), pk=pk)
        like, created = PostLike.objects.get_or_create(user=request.user, post=post)
        if created:
            Post.objects.filter(pk=pk).update(like_count=F('like_count') + 1)
            # Notify post author
            create_notification(
                user=post.author,
                actor=request.user,
                title='좋아요',
                body=f'{request.user.nickname}님이 회원님의 게시글을 좋아합니다.',
                notification_type='like',
                target_type='post',
                target_id=post.pk,
            )
            return Response({'liked': True}, status=status.HTTP_201_CREATED)
        like.delete()
        Post.objects.filter(pk=pk).update(like_count=F('like_count') - 1)
        return Response({'liked': False})


class PostBookmarkView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [LikeBookmarkThrottle]

    @transaction.atomic
    def post(self, request, pk):
        post = generics.get_object_or_404(Post.objects.select_for_update(), pk=pk)
        bm, created = PostBookmark.objects.get_or_create(user=request.user, post=post)
        if created:
            Post.objects.filter(pk=pk).update(bookmark_count=F('bookmark_count') + 1)
            return Response({'bookmarked': True}, status=status.HTTP_201_CREATED)
        bm.delete()
        Post.objects.filter(pk=pk).update(bookmark_count=F('bookmark_count') - 1)
        return Response({'bookmarked': False})


class PostDeleteView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [PostUpdateThrottle]

    def get_queryset(self):
        return Post.objects.filter(author=self.request.user)


class PostCommentListView(generics.ListAPIView):
    serializer_class = PostCommentSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = PostComment.objects.filter(
            post_id=self.kwargs['pk'],
            parent__isnull=True,
            is_deleted=False,
            is_hidden=False,
        ).select_related('author')

        if self.request.user.is_authenticated:
            blocked_ids = UserBlock.objects.filter(
                blocker=self.request.user
            ).values_list('blocked_id', flat=True)
            qs = qs.exclude(author_id__in=blocked_ids)
        return qs


class PostCommentCreateView(generics.CreateAPIView):
    serializer_class = PostCommentSerializer
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [CommentCreateThrottle]

    def perform_create(self, serializer):
        post = generics.get_object_or_404(Post, pk=self.kwargs['pk'])
        comment = serializer.save(author=self.request.user, post=post)
        Post.objects.filter(pk=post.pk).update(comment_count=F('comment_count') + 1)
        # Notify post author about new comment
        create_notification(
            user=post.author,
            actor=self.request.user,
            title='새 댓글',
            body=f'{self.request.user.nickname}님이 회원님의 게시글에 댓글을 달았습니다.',
            notification_type='comment',
            target_type='post',
            target_id=post.pk,
        )


class PostCommentUpdateView(APIView):
    """댓글 수정"""
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [CommentCreateThrottle]

    def patch(self, request, comment_id):
        from .serializers import sanitize
        comment = generics.get_object_or_404(
            PostComment, pk=comment_id, author=request.user
        )
        content = sanitize(request.data.get('content', '') or '').strip()
        if not content:
            return Response({'error': '내용을 입력하세요.'}, status=status.HTTP_400_BAD_REQUEST)
        comment.content = content
        comment.save(update_fields=['content', 'updated_at'])
        return Response(PostCommentSerializer(comment, context={'request': request}).data)


class PostCommentDeleteView(APIView):
    """댓글 삭제 (soft delete)"""
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [CommentCreateThrottle]

    def delete(self, request, comment_id):
        comment = generics.get_object_or_404(
            PostComment, pk=comment_id, author=request.user
        )
        comment.is_deleted = True
        comment.content = '삭제된 댓글입니다.'
        comment.save(update_fields=['is_deleted', 'content'])
        Post.objects.filter(pk=comment.post_id).update(comment_count=F('comment_count') - 1)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CommentLikeView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [LikeBookmarkThrottle]

    @transaction.atomic
    def post(self, request, comment_id):
        comment = generics.get_object_or_404(PostComment.objects.select_for_update(), pk=comment_id)
        like, created = CommentLike.objects.get_or_create(user=request.user, comment=comment)
        if created:
            PostComment.objects.filter(pk=comment_id).update(like_count=F('like_count') + 1)
            return Response({'liked': True}, status=status.HTTP_201_CREATED)
        like.delete()
        PostComment.objects.filter(pk=comment_id).update(like_count=F('like_count') - 1)
        return Response({'liked': False})


class CommentReplyView(generics.CreateAPIView):
    serializer_class = PostCommentSerializer
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [CommentCreateThrottle]

    def perform_create(self, serializer):
        parent = generics.get_object_or_404(PostComment, pk=self.kwargs['comment_id'])
        reply = serializer.save(author=self.request.user, post=parent.post, parent=parent)
        Post.objects.filter(pk=parent.post_id).update(comment_count=F('comment_count') + 1)
        # Notify the parent comment author about the reply
        create_notification(
            user=parent.author,
            actor=self.request.user,
            title='답글',
            body=f'{self.request.user.nickname}님이 회원님의 댓글에 답글을 달았습니다.',
            notification_type='reply',
            target_type='post',
            target_id=parent.post_id,
        )


class PostImageUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [ImageUploadThrottle]

    def post(self, request, pk):
        """Upload up to 10 images to a post.

        Returns:
          { "created": [...], "rejected": [{"index": i, "name": str, "reason": str}] }
        with status 201 if at least one was created, or 400 if every
        upload failed validation. Previous version silently skipped
        invalid files and returned a partial list, leaving the user
        wondering why some images vanished.
        """
        from config.validators import is_valid_image_file
        post = generics.get_object_or_404(Post, pk=pk, author=request.user)
        images = request.FILES.getlist('images')
        created = []
        rejected = []
        for i, img in enumerate(images[:10]):
            if not is_valid_image_file(img):
                rejected.append({
                    'index': i,
                    'name': getattr(img, 'name', f'image_{i}'),
                    'reason': '잘못된 이미지 파일 (포맷 또는 크기)',
                })
                continue
            obj = PostImage.objects.create(post=post, image=img, order=i)
            created.append({'id': obj.id, 'image': obj.image.url, 'order': obj.order})

        payload = {'created': created, 'rejected': rejected}
        if not created and rejected:
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload, status=status.HTTP_201_CREATED)


class PostImageDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [ImageUploadThrottle]

    def delete(self, request, pk, image_id):
        img = generics.get_object_or_404(PostImage, pk=image_id, post__pk=pk, post__author=request.user)
        img.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ──────────────────────────────────────
# 신고 / 차단
# ──────────────────────────────────────

class ReportCreateView(generics.CreateAPIView):
    serializer_class = ReportSerializer
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [ReportThrottle]

    def perform_create(self, serializer):
        serializer.save(reporter=self.request.user)


class UserBlockView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [LikeBookmarkThrottle]

    def post(self, request):
        blocked_id = request.data.get('user_id')
        if not blocked_id or int(blocked_id) == request.user.id:
            return Response({'error': '차단할 수 없습니다.'}, status=status.HTTP_400_BAD_REQUEST)
        _, created = UserBlock.objects.get_or_create(
            blocker=request.user, blocked_id=blocked_id
        )
        if created:
            return Response({'blocked': True}, status=status.HTTP_201_CREATED)
        return Response({'blocked': True})


class UserUnblockView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [LikeBookmarkThrottle]

    def post(self, request):
        blocked_id = request.data.get('user_id')
        UserBlock.objects.filter(blocker=request.user, blocked_id=blocked_id).delete()
        return Response({'unblocked': True})


class BlockedUsersView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]

    def get(self, request):
        blocks = UserBlock.objects.filter(blocker=request.user).select_related('blocked')
        data = [
            {'user_id': b.blocked_id, 'nickname': b.blocked.nickname, 'created_at': b.created_at}
            for b in blocks
        ]
        return Response(data)


# ──────────────────────────────────────
# 모임
# ──────────────────────────────────────

class GroupListView(generics.ListAPIView):
    serializer_class = GroupListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Group.objects.filter(is_hidden=False).select_related('owner')
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(name__icontains=q)
        return qs


class GroupDetailView(generics.RetrieveAPIView):
    serializer_class = GroupDetailSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Group.objects.filter(is_hidden=False).select_related('owner').prefetch_related('members__user')


class GroupCreateView(generics.CreateAPIView):
    serializer_class = GroupCreateSerializer
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [GroupCreateThrottle]

    def perform_create(self, serializer):
        group = serializer.save(owner=self.request.user)
        GroupMember.objects.create(group=group, user=self.request.user, role='owner')


class GroupJoinView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [LikeBookmarkThrottle]

    def post(self, request, pk):
        group = generics.get_object_or_404(Group, pk=pk)
        if group.max_members > 0 and group.member_count >= group.max_members:
            return Response({'error': '모임 정원이 가득 찼습니다.'}, status=status.HTTP_400_BAD_REQUEST)
        _, created = GroupMember.objects.get_or_create(group=group, user=request.user)
        if created:
            Group.objects.filter(pk=pk).update(member_count=F('member_count') + 1)
            return Response({'joined': True}, status=status.HTTP_201_CREATED)
        return Response({'joined': True})


class GroupLeaveView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [LikeBookmarkThrottle]

    def post(self, request, pk):
        deleted, _ = GroupMember.objects.filter(
            group_id=pk, user=request.user
        ).exclude(role='owner').delete()
        if deleted:
            Group.objects.filter(pk=pk).update(member_count=F('member_count') - 1)
        return Response({'left': True})


class GroupMemberListView(generics.ListAPIView):
    serializer_class = GroupMemberSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return GroupMember.objects.filter(group_id=self.kwargs['pk']).select_related('user')


class GroupMessageListView(generics.ListAPIView):
    serializer_class = GroupMessageSerializer
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    pagination_class = None  # Return flat list for chat

    def get_queryset(self):
        return GroupMessage.objects.filter(
            group_id=self.kwargs['pk'],
            is_hidden=False,
        ).select_related('sender').order_by('-created_at')[:100]


class GroupMessageCreateView(generics.CreateAPIView):
    serializer_class = GroupMessageSerializer
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [GroupMessageThrottle]

    def perform_create(self, serializer):
        group = generics.get_object_or_404(Group, pk=self.kwargs['pk'])
        if not group.members.filter(user=self.request.user).exists():
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('모임 멤버만 메시지를 보낼 수 있습니다.')
        serializer.save(sender=self.request.user, group=group)


# ──────────────────────────────────────
# 챌린지
# ──────────────────────────────────────

class ChallengeListView(generics.ListAPIView):
    serializer_class = ChallengeListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Challenge.objects.all()
        s = self.request.query_params.get('status')
        if s:
            qs = qs.filter(status=s)
        return qs


class ChallengeDetailView(generics.RetrieveAPIView):
    serializer_class = ChallengeDetailSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Challenge.objects.prefetch_related('participants__user')


class ChallengeJoinView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [LikeBookmarkThrottle]

    @transaction.atomic
    def post(self, request, pk):
        challenge = generics.get_object_or_404(Challenge.objects.select_for_update(), pk=pk)
        if challenge.status != 'active':
            return Response({'error': '참가할 수 없는 챌린지입니다.'}, status=status.HTTP_400_BAD_REQUEST)
        if challenge.is_full:
            return Response({'error': '정원이 가득 찼습니다.'}, status=status.HTTP_400_BAD_REQUEST)
        _, created = ChallengeParticipant.objects.get_or_create(
            challenge=challenge, user=request.user
        )
        if created:
            Challenge.objects.filter(pk=pk).update(participant_count=F('participant_count') + 1)
        return Response({'joined': True}, status=status.HTTP_201_CREATED)


class ChallengeLeaveView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [LikeBookmarkThrottle]

    @transaction.atomic
    def post(self, request, pk):
        deleted, _ = ChallengeParticipant.objects.filter(
            challenge_id=pk, user=request.user
        ).delete()
        if deleted:
            Challenge.objects.filter(pk=pk).update(participant_count=F('participant_count') - 1)
        return Response({'left': True})


class ChallengeProgressUpdateView(APIView):
    """Update the current user's progress for a challenge."""
    permission_classes = [permissions.IsAuthenticated, IsCommunityAllowed]
    throttle_classes = [LikeBookmarkThrottle]

    def post(self, request, pk):
        value = request.data.get('value')
        if value is None:
            return Response({'error': '값을 입력하세요.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            value = float(value)
        except (TypeError, ValueError):
            return Response({'error': '올바른 숫자를 입력하세요.'}, status=status.HTTP_400_BAD_REQUEST)

        participant = ChallengeParticipant.objects.filter(
            challenge_id=pk, user=request.user
        ).select_related('challenge').first()
        if not participant:
            return Response({'error': '참여하지 않은 챌린지입니다.'}, status=status.HTTP_404_NOT_FOUND)

        participant.current_value = value
        if value >= participant.challenge.goal_value and not participant.completed:
            from django.utils import timezone as tz
            participant.completed = True
            participant.completed_at = tz.now()
        participant.save(update_fields=['current_value', 'completed', 'completed_at'])
        return Response(ChallengeParticipantSerializer(participant).data)


class ChallengeLeaderboardView(generics.ListAPIView):
    serializer_class = ChallengeParticipantSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return ChallengeParticipant.objects.filter(
            challenge_id=self.kwargs['pk']
        ).select_related('user').order_by('-current_value')[:50]


class NoticeListView(generics.ListAPIView):
    serializer_class = NoticeSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Notice.objects.filter(is_published=True)


class SiteConfigView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        config = SiteConfig.load()
        return Response({
            'instagram_url': config.instagram_url,
            'threads_url': config.threads_url,
            'youtube_url': config.youtube_url,
            'business_name': config.business_name,
            'representative': config.representative,
            'business_number': config.business_number,
            'location_service_number': config.location_service_number,
            'telecom_number': config.telecom_number,
            'contact_email': config.contact_email,
        })


# ──────────────────────────────────────
# LegalDocument (약관·방침)
# ──────────────────────────────────────
def _legal_to_dict(doc):
    return {
        "slug": doc.slug,
        "slug_display": doc.get_slug_display(),
        "title": doc.title,
        "body_markdown": doc.body_markdown,
        "version": doc.version,
        "effective_from": doc.effective_from.isoformat(),
        "is_published": doc.is_published,
        "updated_at": doc.updated_at.isoformat(),
    }


class LegalDocumentPublicView(APIView):
    """Public: return the latest published version for a given slug."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        doc = LegalDocument.latest_published(slug)
        if not doc:
            return Response({"detail": "문서를 찾을 수 없습니다."}, status=404)
        return Response(_legal_to_dict(doc))


class LegalDocumentListAdminView(APIView):
    """Admin: list all documents (all versions, all slugs)."""

    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        slug = request.query_params.get("slug")
        qs = LegalDocument.objects.all()
        if slug:
            qs = qs.filter(slug=slug)
        return Response([_legal_to_dict(d) for d in qs])

    def post(self, request):
        """Create a new version for a slug."""
        slug = request.data.get("slug", "")
        if slug not in dict(LegalDocument.SLUG_CHOICES):
            return Response({"detail": "invalid slug"}, status=400)
        doc = LegalDocument.objects.create(
            slug=slug,
            title=request.data.get("title", "").strip() or dict(LegalDocument.SLUG_CHOICES)[slug],
            body_markdown=request.data.get("body_markdown", ""),
            version=request.data.get("version", "1.0"),
            effective_from=request.data.get("effective_from"),
            is_published=bool(request.data.get("is_published", False)),
        )
        return Response(_legal_to_dict(doc), status=201)


class LegalDocumentAdminDetailView(APIView):
    """Admin: retrieve, update, delete a specific version."""

    permission_classes = [permissions.IsAdminUser]

    def get_object(self, pk):
        try:
            return LegalDocument.objects.get(pk=pk)
        except LegalDocument.DoesNotExist:
            return None

    def get(self, request, pk):
        doc = self.get_object(pk)
        if not doc:
            return Response(status=404)
        return Response(_legal_to_dict(doc))

    def patch(self, request, pk):
        doc = self.get_object(pk)
        if not doc:
            return Response(status=404)
        for field in ("title", "body_markdown", "version", "effective_from", "is_published"):
            if field in request.data:
                setattr(doc, field, request.data[field])
        doc.save()
        return Response(_legal_to_dict(doc))

    def delete(self, request, pk):
        doc = self.get_object(pk)
        if not doc:
            return Response(status=404)
        doc.delete()
        return Response(status=204)
