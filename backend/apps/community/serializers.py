import re
from rest_framework import serializers
from .models import (
    Post, PostImage, PostComment, PostLike, CommentLike, PostBookmark, Report, UserBlock,
    Group, GroupMember, GroupMessage,
    Challenge, ChallengeParticipant,
    Notice,
)


def sanitize(text):
    return re.sub(r'<[^>]+>', '', text)


# ──────────────────────────────────────
# 게시판
# ──────────────────────────────────────

class PostImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostImage
        fields = ['id', 'image', 'order']


class PostCommentSerializer(serializers.ModelSerializer):
    author_nickname = serializers.CharField(source='author.nickname', read_only=True)
    author_image = serializers.ImageField(source='author.profile_image', read_only=True)
    replies = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = PostComment
        fields = [
            'id', 'author', 'author_nickname', 'author_image',
            'parent', 'content', 'like_count', 'replies',
            'is_liked', 'is_mine', 'is_deleted', 'created_at', 'updated_at',
        ]
        read_only_fields = ['author', 'like_count', 'is_deleted']

    def get_replies(self, obj):
        if obj.parent is not None:
            return []
        replies = obj.replies.filter(is_deleted=False).select_related('author').all()[:20]
        return PostCommentSerializer(replies, many=True, context=self.context).data

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def get_is_mine(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.author_id == request.user.id
        return False


class PostListSerializer(serializers.ModelSerializer):
    author_nickname = serializers.CharField(source='author.nickname', read_only=True)
    author_image = serializers.ImageField(source='author.profile_image', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    thumbnail = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'author', 'author_nickname', 'author_image',
            'category', 'category_display', 'title', 'thumbnail',
            'like_count', 'comment_count', 'view_count', 'bookmark_count',
            'is_liked', 'is_bookmarked', 'is_pinned', 'created_at',
        ]

    def get_thumbnail(self, obj):
        first = obj.post_images.first()
        return first.image.url if first else None

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.bookmarks.filter(user=request.user).exists()
        return False


class PostDetailSerializer(serializers.ModelSerializer):
    author_nickname = serializers.CharField(source='author.nickname', read_only=True)
    author_image = serializers.ImageField(source='author.profile_image', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    images = PostImageSerializer(source='post_images', many=True, read_only=True)
    comments = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'author', 'author_nickname', 'author_image',
            'category', 'category_display', 'title', 'content',
            'images', 'trail', 'like_count', 'comment_count', 'view_count',
            'bookmark_count', 'comments', 'is_liked', 'is_bookmarked',
            'is_mine', 'is_pinned', 'created_at', 'updated_at',
        ]

    def get_comments(self, obj):
        top_level = obj.comments.filter(
            parent__isnull=True, is_deleted=False
        ).select_related('author')[:30]
        return PostCommentSerializer(top_level, many=True, context=self.context).data

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.bookmarks.filter(user=request.user).exists()
        return False

    def get_is_mine(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.author_id == request.user.id
        return False


class PostCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ['id', 'category', 'title', 'content', 'trail']
        read_only_fields = ['id']

    def validate_title(self, value):
        return sanitize(value)

    def validate_content(self, value):
        return sanitize(value)


class PostUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ['category', 'title', 'content']

    def validate_title(self, value):
        return sanitize(value)

    def validate_content(self, value):
        return sanitize(value)


# ──────────────────────────────────────
# 신고 / 차단
# ──────────────────────────────────────

class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ['target_type', 'target_id', 'reason', 'detail']

    def validate_detail(self, value):
        return sanitize(value)


class UserBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserBlock
        fields = ['blocked']


# ──────────────────────────────────────
# 모임
# ──────────────────────────────────────

class GroupMemberSerializer(serializers.ModelSerializer):
    nickname = serializers.CharField(source='user.nickname', read_only=True)
    profile_image = serializers.ImageField(source='user.profile_image', read_only=True)

    class Meta:
        model = GroupMember
        fields = ['id', 'user', 'nickname', 'profile_image', 'role', 'joined_at']


class GroupListSerializer(serializers.ModelSerializer):
    owner_nickname = serializers.CharField(source='owner.nickname', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    is_member = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = [
            'id', 'name', 'description', 'category', 'category_display',
            'emoji', 'cover_image', 'owner', 'owner_nickname',
            'region', 'member_count', 'max_members', 'is_public',
            'is_member', 'created_at',
        ]

    def get_is_member(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.members.filter(user=request.user).exists()
        return False


class GroupDetailSerializer(GroupListSerializer):
    members = serializers.SerializerMethodField()
    recent_messages = serializers.SerializerMethodField()

    class Meta(GroupListSerializer.Meta):
        fields = GroupListSerializer.Meta.fields + ['members', 'recent_messages']

    def get_members(self, obj):
        members = obj.members.select_related('user').all()[:20]
        return GroupMemberSerializer(members, many=True).data

    def get_recent_messages(self, obj):
        msgs = obj.messages.select_related('sender').order_by('-created_at')[:30]
        return GroupMessageSerializer(msgs, many=True).data


class GroupCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ['name', 'description', 'category', 'emoji', 'region', 'max_members', 'is_public']

    def validate_name(self, value):
        return sanitize(value)

    def validate_description(self, value):
        return sanitize(value)


class GroupMessageSerializer(serializers.ModelSerializer):
    sender_nickname = serializers.CharField(source='sender.nickname', read_only=True)
    sender_image = serializers.ImageField(source='sender.profile_image', read_only=True)

    class Meta:
        model = GroupMessage
        fields = ['id', 'sender', 'sender_nickname', 'sender_image', 'content', 'image', 'created_at']
        read_only_fields = ['sender']


# ──────────────────────────────────────
# 챌린지
# ──────────────────────────────────────

class ChallengeParticipantSerializer(serializers.ModelSerializer):
    nickname = serializers.CharField(source='user.nickname', read_only=True)
    profile_image = serializers.ImageField(source='user.profile_image', read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = ChallengeParticipant
        fields = [
            'id', 'user', 'nickname', 'profile_image',
            'current_value', 'progress', 'completed', 'completed_at', 'joined_at',
        ]

    def get_progress(self, obj):
        goal = obj.challenge.goal_value
        if goal <= 0:
            return 0
        return min(round(obj.current_value / goal * 100, 1), 100)


class ChallengeListSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_challenge_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_joined = serializers.SerializerMethodField()
    my_progress = serializers.SerializerMethodField()

    class Meta:
        model = Challenge
        fields = [
            'id', 'title', 'description', 'emoji', 'cover_image',
            'challenge_type', 'type_display', 'goal_value', 'goal_unit',
            'status', 'status_display', 'start_date', 'end_date',
            'participant_count', 'max_participants',
            'is_joined', 'my_progress',
        ]

    def get_is_joined(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.participants.filter(user=request.user).exists()
        return False

    def get_my_progress(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            p = obj.participants.filter(user=request.user).first()
            if p and obj.goal_value > 0:
                return min(round(p.current_value / obj.goal_value * 100, 1), 100)
        return 0


class ChallengeDetailSerializer(ChallengeListSerializer):
    leaderboard = serializers.SerializerMethodField()

    class Meta(ChallengeListSerializer.Meta):
        fields = ChallengeListSerializer.Meta.fields + ['leaderboard']

    def get_leaderboard(self, obj):
        top = obj.participants.select_related('user').all()[:20]
        return ChallengeParticipantSerializer(top, many=True).data


class NoticeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notice
        fields = ['id', 'title', 'content', 'is_pinned', 'created_at', 'updated_at']
