from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.trails.models import Trail
from config.permissions import IsOwnerOrReadOnly

from .models import Review, ReviewHelpful
from .serializers import ReviewCreateSerializer, ReviewSerializer


class TrailReviewListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

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
        serializer.save(author=self.request.user, trail=trail)

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


class ReviewHelpfulView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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
