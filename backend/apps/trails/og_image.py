import io
import textwrap

from django.http import HttpResponse
from PIL import Image, ImageDraw, ImageFont


def generate_og_image(request, pk):
    """Generate a dynamic OG image for a trail."""
    from .models import Trail

    try:
        trail = Trail.objects.get(pk=pk)
    except Trail.DoesNotExist:
        return HttpResponse(status=404)

    # Create 1200x630 OG image
    img = Image.new("RGB", (1200, 630), color=(45, 74, 46))  # primary color
    draw = ImageDraw.Draw(img)

    # Gradient overlay
    for y in range(630):
        alpha = int(255 * (y / 630) * 0.3)
        draw.line([(0, y), (1200, y)], fill=(0, 0, 0, alpha))

    # Try to use a default font, fall back to default
    try:
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
        body_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
        small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
    except (OSError, IOError):
        title_font = ImageFont.load_default()
        body_font = ImageFont.load_default()
        small_font = ImageFont.load_default()

    # Brand
    draw.text((60, 40), "Roami", fill=(168, 230, 207), font=body_font)

    # Title
    title = trail.title[:40]
    draw.text((60, 120), title, fill="white", font=title_font)

    # Info
    info_text = f"{trail.region} · {trail.distance_km}km · {trail.estimated_minutes}min"
    draw.text((60, 200), info_text, fill=(200, 200, 200), font=body_font)

    # Description
    desc = textwrap.shorten(trail.description, width=80, placeholder="...")
    wrapped = textwrap.wrap(desc, width=50)
    y_offset = 280
    for line in wrapped[:3]:
        draw.text((60, y_offset), line, fill=(220, 220, 220), font=small_font)
        y_offset += 35

    # Stats bar at bottom
    draw.rectangle([(0, 540), (1200, 630)], fill=(30, 55, 30))
    stats = f"❤️ {trail.like_count}  ·  👁 {trail.view_count}  ·  {trail.get_difficulty_display()}"
    draw.text((60, 570), stats, fill=(168, 230, 207), font=small_font)

    # Output
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return HttpResponse(buffer.read(), content_type="image/png")
