from rest_framework import permissions


class IsOwnerOrReadOnly(permissions.BasePermission):
    """작성자만 수정/삭제 가능, 나머지는 읽기만."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        author = getattr(obj, "author", None)
        if author is None:
            author = getattr(obj, "user", None)
        return author == request.user or request.user.is_staff
