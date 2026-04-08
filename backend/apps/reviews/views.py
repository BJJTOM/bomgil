from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.trails.models import Trail
from config.permissions import IsOwnerOrReadOnly
from config.validators import is_valid_image_file

from .models import Review, ReviewHelpful, ReviewImage
from .serializers import ReviewCreateSerializer, ReviewImageSerializer, ReviewSerializer


class ReviewCreateThrottle(UserRateThrottle):
    scope = 'review_create'
    rate = '20/hour'


class ReviewHelpfulThrottle(UserRateThrottle):
    scope = 'review_helpful'
    rate = '200/hour'


class ReviewImageUploadThrottle(UserRateThrottle):
    scope = 'review_image_upload'
    rate = '30/hour'


class TrailReviewListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_throttles(self):
        if self.request.method == 'POST':
            return [ReviewCreateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        return (
            Review.objects.filter(
                trail_id=self.kwargs["trail_id"], status="approved"
            )
            .select_related("author")
            .prefetch_related("images")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ReviewCreateSerializer
        return ReviewSerializer

    def perform_create(self, serializer):
        trail = get_object_or_404(Trail, pk=self.kwargs["trail_id"])
        if Review.objects.filter(trail=trail, author=self.request.user).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"detail": "이미 이 코스에 리뷰를 작성했습니다."})
        serializer.save(author=self.request.user, trail=trail, status="approved")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        # Return full review data
        review = Review.objects.select_related("author").get(pk=serializer.instance.pk)
        return Response(
            ReviewSerializer(review, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ReviewDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Review.objects.select_related("author").prefetch_related("images")
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_throttles(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return [ReviewCreateThrottle()]
        return super().get_throttles()


class ReviewHelpfulView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ReviewHelpfulThrottle]

    def post(self, request, pk):
        review = get_object_or_404(Review, pk=pk)
        helpful, created = ReviewHelpful.objects.get_or_create(
            user=request.user, review=review
        )
        if not created:
            helpful.delete()
            Review.objects.filter(pk=pk).update(helpful_count=F("helpful_count") - 1)
            return Response({"helpful": False}, status=status.HTTP_200_OK)
        Review.objects.filter(pk=pk).update(helpful_count=F("helpful_count") + 1)
        return Response({"helpful": True}, status=status.HTTP_201_CREATED)


class ReviewImageUploadView(APIView):
    """Upload images to a review (max 3)."""
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ReviewImageUploadThrottle]

    def post(self, request, pk):
        review = get_object_or_404(Review, pk=pk, author=request.user)
        existing_count = review.images.count()
        images = request.FILES.getlist("images")
        created = []
        for i, img in enumerate(images[:3 - existing_count]):
            if not is_valid_image_file(img):
                continue
            obj = ReviewImage.objects.create(
                review=review, image=img, order=existing_count + i
            )
            created.append(ReviewImageSerializer(obj).data)
        return Response(created, status=status.HTTP_201_CREATED)
