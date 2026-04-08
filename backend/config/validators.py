"""Shared validators for uploaded files and other inputs."""
import os

from rest_framework.exceptions import ValidationError

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def validate_image_file(uploaded_file, max_size=MAX_IMAGE_SIZE_BYTES):
    """Validate an uploaded image file's extension and size.

    Raises rest_framework.exceptions.ValidationError on failure.
    """
    if uploaded_file is None:
        raise ValidationError("이미지 파일이 필요합니다.")
    name = getattr(uploaded_file, "name", "") or ""
    ext = os.path.splitext(name)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError(
            f"허용되지 않는 파일 형식입니다. 사용 가능: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}"
        )
    size = getattr(uploaded_file, "size", 0) or 0
    if size > max_size:
        raise ValidationError(
            f"파일 크기가 너무 큽니다. 최대 {max_size // (1024 * 1024)}MB."
        )
    return True


def is_valid_image_file(uploaded_file, max_size=MAX_IMAGE_SIZE_BYTES):
    """Non-raising variant — returns True/False."""
    try:
        validate_image_file(uploaded_file, max_size=max_size)
        return True
    except ValidationError:
        return False
