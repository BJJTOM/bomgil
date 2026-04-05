import io
import textwrap

from django.db.models import F
from django.http import HttpResponse
from django.utils.html import strip_tags
from PIL import Image, ImageDraw, ImageFont
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CommentLike, Notification, StoryComment, StoryLike, WalkStory
from .serializers import StoryCommentSerializer, WalkStoryCreateSerializer, WalkStorySerializer


class StoryFeedView(generics.ListAPIView):
    serializer_class = WalkStorySerializer

    def get_queryset(self):
        qs = WalkStory.objects.filter(is_public=True).select_related(
            "author", "trail", "walk_plan__trail"
        ).prefetch_related("photos", "companions_tagged", "comments__author")

        ordering = self.request.query_params.get("ordering", "-created_at")
        if ordering == "-like_count":
            qs = qs.order_by("-like_count")
        return qs


class StoryCreateView(generics.CreateAPIView):
    serializer_class = WalkStoryCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
        from apps.accounts.badges import check_and_award_badges
        check_and_award_badges(self.request.user)


class StoryDetailView(generics.RetrieveAPIView):
    queryset = WalkStory.objects.select_related(
        "author", "walk_plan__trail"
    ).prefetch_related("photos", "companions_tagged")
    serializer_class = WalkStorySerializer


class StoryLikeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        story = WalkStory.objects.get(pk=pk)
        like, created = StoryLike.objects.get_or_create(user=request.user, story=story)
        if not created:
            like.delete()
            WalkStory.objects.filter(pk=pk).update(like_count=F("like_count") - 1)
            return Response({"liked": False})
        WalkStory.objects.filter(pk=pk).update(like_count=F("like_count") + 1)
        if story.author != request.user:
            Notification.objects.create(
                recipient=story.author, sender=request.user,
                notification_type="story_like", story=story,
            )
        return Response({"liked": True}, status=status.HTTP_201_CREATED)


class TrailStoriesView(generics.ListAPIView):
    serializer_class = WalkStorySerializer

    def get_queryset(self):
        return WalkStory.objects.filter(
            walk_plan__trail_id=self.kwargs["trail_id"],
            is_public=True,
        ).select_related("author", "walk_plan__trail").prefetch_related("photos")


class UserStoriesView(generics.ListAPIView):
    serializer_class = WalkStorySerializer

    def get_queryset(self):
        from apps.accounts.models import CustomUser
        user = CustomUser.objects.get(nickname=self.kwargs["nickname"])
        return WalkStory.objects.filter(author=user, is_public=True).select_related(
            "author", "walk_plan__trail"
        ).prefetch_related("photos")


class StoryShareCardView(APIView):
    def get(self, request, pk):
        try:
            story = WalkStory.objects.select_related(
                "author", "walk_plan__trail"
            ).get(pk=pk)
        except WalkStory.DoesNotExist:
            return HttpResponse(status=404)

        trail = story.walk_plan.trail
        img = Image.new("RGB", (1080, 1920), color=(45, 74, 46))
        draw = ImageDraw.Draw(img)

        # Background gradient
        for y in range(960, 1920):
            ratio = (y - 960) / 960
            r = int(45 + (245 - 45) * ratio)
            g = int(74 + (240 - 74) * ratio)
            b = int(46 + (232 - 46) * ratio)
            draw.line([(0, y), (1080, y)], fill=(r, g, b))

        try:
            title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 42)
            body_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
            small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
        except (OSError, IOError):
            title_font = body_font = small_font = ImageFont.load_default()

        # Brand
        draw.text((60, 1000), "Roami", fill=(168, 230, 207), font=body_font)

        # Trail info
        draw.text((60, 1060), trail.title[:30], fill=(26, 26, 26), font=title_font)
        info = f"{story.walk_plan.planned_date} · {trail.distance_km}km"
        draw.text((60, 1120), info, fill=(100, 100, 100), font=body_font)

        # Content snippet
        content = textwrap.shorten(story.content, width=60, placeholder="...")
        wrapped = textwrap.wrap(content, width=28)
        y = 1200
        for line in wrapped[:4]:
            draw.text((60, y), f'"{line}"', fill=(26, 26, 26), font=body_font)
            y += 40

        # Companion count
        count = story.companions_tagged.count()
        if count > 0:
            draw.text((60, y + 30), f"{count + 1}명이 함께 걸었어요", fill=(100, 100, 100), font=small_font)

        # Footer
        draw.text((60, 1820), "roami.kr", fill=(168, 230, 207), font=small_font)

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        return HttpResponse(buffer.read(), content_type="image/png")


class StoryCommentListView(generics.ListAPIView):
    serializer_class = StoryCommentSerializer

    def get_queryset(self):
        return StoryComment.objects.filter(
            story_id=self.kwargs["pk"], parent__isnull=True
        ).select_related("author").prefetch_related("replies__author")


class StoryCommentCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        content = strip_tags(request.data.get("content", "")).strip()
        if not content:
            return Response({"error": "댓글 내용을 입력해주세요."}, status=status.HTTP_400_BAD_REQUEST)

        parent_id = request.data.get("parent")
        parent = None
        if parent_id:
            try:
                parent = StoryComment.objects.get(pk=parent_id)
            except StoryComment.DoesNotExist:
                pass

        story = WalkStory.objects.get(pk=pk)
        comment = StoryComment.objects.create(
            story=story,
            author=request.user,
            content=content,
            parent=parent,
        )
        WalkStory.objects.filter(pk=pk).update(comment_count=F("comment_count") + 1)

        # Create notification
        if parent and parent.author != request.user:
            Notification.objects.create(
                recipient=parent.author, sender=request.user,
                notification_type="comment_reply", comment=comment, story=story,
            )
        elif story.author != request.user:
            Notification.objects.create(
                recipient=story.author, sender=request.user,
                notification_type="story_comment", comment=comment, story=story,
            )

        return Response(
            StoryCommentSerializer(comment).data,
            status=status.HTTP_201_CREATED,
        )


class CommentLikeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, comment_id):
        comment = StoryComment.objects.get(pk=comment_id)
        like, created = CommentLike.objects.get_or_create(user=request.user, comment=comment)
        if not created:
            like.delete()
            StoryComment.objects.filter(pk=comment_id).update(like_count=F("like_count") - 1)
            return Response({"liked": False})
        StoryComment.objects.filter(pk=comment_id).update(like_count=F("like_count") + 1)
        if comment.author != request.user:
            Notification.objects.create(
                recipient=comment.author, sender=request.user,
                notification_type="comment_like", comment=comment, story=comment.story,
            )
        return Response({"liked": True}, status=status.HTTP_201_CREATED)


class CommentReplyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, comment_id):
        parent = StoryComment.objects.get(pk=comment_id)
        content = strip_tags(request.data.get("content", "")).strip()
        if not content:
            return Response({"error": "내용을 입력해주세요."}, status=400)
        reply = StoryComment.objects.create(
            story=parent.story, author=request.user, content=content, parent=parent
        )
        WalkStory.objects.filter(pk=parent.story_id).update(comment_count=F("comment_count") + 1)
        if parent.author != request.user:
            Notification.objects.create(
                recipient=parent.author, sender=request.user,
                notification_type="comment_reply", comment=reply, story=parent.story,
            )
        return Response(StoryCommentSerializer(reply).data, status=201)


class NotificationListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(
            recipient=self.request.user
        ).select_related("sender", "story")[:50]

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        unread_count = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).count()
        data = [{
            "id": n.id,
            "type": n.notification_type,
            "sender": {
                "nickname": n.sender.nickname,
                "profile_image": n.sender.profile_image.url if n.sender.profile_image else None,
            },
            "story_id": n.story_id,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat(),
        } for n in qs]
        return Response({"unread_count": unread_count, "results": data})


class NotificationReadAllView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({"success": True})
