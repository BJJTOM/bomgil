import io
import textwrap

from django.db.models import F
from django.http import HttpResponse
from django.utils.html import strip_tags
from PIL import Image, ImageDraw, ImageFont
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import StoryComment, StoryLike, WalkStory
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
        draw.text((60, 1000), "Bomgil", fill=(168, 230, 207), font=body_font)

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
        draw.text((60, 1820), "bomgil.kr", fill=(168, 230, 207), font=small_font)

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        return HttpResponse(buffer.read(), content_type="image/png")


class StoryCommentListView(generics.ListAPIView):
    serializer_class = StoryCommentSerializer

    def get_queryset(self):
        return StoryComment.objects.filter(story_id=self.kwargs["pk"]).select_related("author")


class StoryCommentCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        content = strip_tags(request.data.get("content", "")).strip()
        if not content:
            return Response({"error": "댓글 내용을 입력해주세요."}, status=status.HTTP_400_BAD_REQUEST)

        story = WalkStory.objects.get(pk=pk)
        comment = StoryComment.objects.create(
            story=story,
            author=request.user,
            content=content,
        )
        WalkStory.objects.filter(pk=pk).update(comment_count=F("comment_count") + 1)
        return Response(
            StoryCommentSerializer(comment).data,
            status=status.HTTP_201_CREATED,
        )
