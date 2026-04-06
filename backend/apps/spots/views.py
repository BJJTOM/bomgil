from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response

from config.permissions import IsOwnerOrReadOnly

from .models import Spot, SpotImage
from .serializers import SpotCreateSerializer, SpotImageSerializer, SpotSerializer


class SpotViewSet(viewsets.ModelViewSet):
    queryset = Spot.objects.select_related("trail", "author").prefetch_related("images")
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return SpotCreateSerializer
        return SpotSerializer

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class SpotImageUploadView(viewsets.ModelViewSet):
    queryset = SpotImage.objects.all()
    serializer_class = SpotImageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        spot = get_object_or_404(Spot, pk=self.request.data.get("spot"))
        if spot.author != self.request.user and not self.request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("이 경유지의 이미지를 업로드할 권한이 없습니다.")
        serializer.save()
