from django.db.models import F
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import (
    Post, PostComment, PostLike, CommentLike, PostImage,
    Group, GroupMember, GroupMessage,
    Challenge, ChallengeParticipant,
)
from .serializers import (
    PostListSerializer, PostDetailSerializer, PostCreateSerializer,
    PostCommentSerializer,
    GroupListSerializer, GroupDetailSerializer, GroupCreateSerializer,
    GroupMessageSerializer, GroupMemberSerializer,
    ChallengeListSerializer, ChallengeDetailSerializer,
    ChallengeParticipantSerializer,
)


# ──────────────────────────────────────
# 게시판
# ──────────────────────────────────────

class PostListView(generics.ListAPIView):
    serializer_class = PostListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Post.objects.select_related('author').prefetch_related('post_images')
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        ordering = self.request.query_params.get('ordering', '-created_at')
        if ordering in ['-created_at', '-like_count', '-view_count', '-comment_count']:
            qs = qs.order_by('-is_pinned', ordering)
        return qs


class PostCreateView(generics.CreateAPIView):
    serializer_class = PostCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

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


class PostLikeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        post = generics.get_object_or_404(Post, pk=pk)
        like, created = PostLike.objects.get_or_create(user=request.user, post=post)
        if created:
            Post.objects.filter(pk=pk).update(like_count=F('like_count') + 1)
            return Response({'liked': True}, status=status.HTTP_201_CREATED)
        like.delete()
        Post.objects.filter(pk=pk).update(like_count=F('like_count') - 1)
        return Response({'liked': False})


class PostDeleteView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Post.objects.filter(author=self.request.user)


class PostCommentListView(generics.ListAPIView):
    serializer_class = PostCommentSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return PostComment.objects.filter(
            post_id=self.kwargs['pk'], parent__isnull=True
        ).select_related('author')


class PostCommentCreateView(generics.CreateAPIView):
    serializer_class = PostCommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        post = generics.get_object_or_404(Post, pk=self.kwargs['pk'])
        serializer.save(author=self.request.user, post=post)
        Post.objects.filter(pk=post.pk).update(comment_count=F('comment_count') + 1)


class CommentLikeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, comment_id):
        comment = generics.get_object_or_404(PostComment, pk=comment_id)
        like, created = CommentLike.objects.get_or_create(user=request.user, comment=comment)
        if created:
            PostComment.objects.filter(pk=comment_id).update(like_count=F('like_count') + 1)
            return Response({'liked': True}, status=status.HTTP_201_CREATED)
        like.delete()
        PostComment.objects.filter(pk=comment_id).update(like_count=F('like_count') - 1)
        return Response({'liked': False})


class CommentReplyView(generics.CreateAPIView):
    serializer_class = PostCommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        parent = generics.get_object_or_404(PostComment, pk=self.kwargs['comment_id'])
        serializer.save(author=self.request.user, post=parent.post, parent=parent)
        Post.objects.filter(pk=parent.post_id).update(comment_count=F('comment_count') + 1)


class PostImageUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        post = generics.get_object_or_404(Post, pk=pk, author=request.user)
        images = request.FILES.getlist('images')
        created = []
        for i, img in enumerate(images[:10]):
            obj = PostImage.objects.create(post=post, image=img, order=i)
            created.append({'id': obj.id, 'image': obj.image.url, 'order': obj.order})
        return Response(created, status=status.HTTP_201_CREATED)


# ──────────────────────────────────────
# 모임
# ──────────────────────────────────────

class GroupListView(generics.ListAPIView):
    serializer_class = GroupListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Group.objects.select_related('owner')
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
    queryset = Group.objects.select_related('owner').prefetch_related('members__user')


class GroupCreateView(generics.CreateAPIView):
    serializer_class = GroupCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        group = serializer.save(owner=self.request.user)
        GroupMember.objects.create(group=group, user=self.request.user, role='owner')


class GroupJoinView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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
    permission_classes = [permissions.IsAuthenticated]

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
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return GroupMessage.objects.filter(
            group_id=self.kwargs['pk']
        ).select_related('sender').order_by('-created_at')[:100]


class GroupMessageCreateView(generics.CreateAPIView):
    serializer_class = GroupMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

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
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        challenge = generics.get_object_or_404(Challenge, pk=pk)
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


class ChallengeLeaderboardView(generics.ListAPIView):
    serializer_class = ChallengeParticipantSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return ChallengeParticipant.objects.filter(
            challenge_id=self.kwargs['pk']
        ).select_related('user').order_by('-current_value')[:50]
