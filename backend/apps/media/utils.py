import io

from django.conf import settings
from PIL import Image


def resize_image(image_file, max_width=None):
    """Resize image to max width, maintaining aspect ratio."""
    if max_width is None:
        max_width = settings.IMAGE_MAX_WIDTH

    img = Image.open(image_file)

    if img.width > max_width:
        ratio = max_width / img.width
        new_height = int(img.height * ratio)
        img = img.resize((max_width, new_height), Image.LANCZOS)

    output = io.BytesIO()
    img.save(output, format="WEBP", quality=85)
    output.seek(0)
    return output


def create_thumbnail(image_file, size=None):
    """Create a thumbnail of the given size."""
    if size is None:
        size = settings.THUMBNAIL_SIZE

    img = Image.open(image_file)
    img.thumbnail(size, Image.LANCZOS)

    output = io.BytesIO()
    img.save(output, format="WEBP", quality=80)
    output.seek(0)
    return output
