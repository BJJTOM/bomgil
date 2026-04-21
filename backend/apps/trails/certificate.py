"""Trail completion certificate image generation.

Generates a PNG certificate using Pillow when a user has completed a trail.
Design: clean white card with subtle green border, Korean/English bilingual.
"""
import io

from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from PIL import Image, ImageDraw, ImageFont


def _load_fonts():
    """Load fonts with graceful fallback to Pillow default."""
    try:
        title_font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 52
        )
        subtitle_font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 32
        )
        body_font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 26
        )
        small_font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20
        )
        brand_font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28
        )
    except (OSError, IOError):
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()
        body_font = ImageFont.load_default()
        small_font = ImageFont.load_default()
        brand_font = ImageFont.load_default()
    return title_font, subtitle_font, body_font, small_font, brand_font


def _draw_dashed_rect(draw, xy, dash_length=12, gap_length=8, width=2, fill=(45, 74, 46)):
    """Draw a dashed rectangle border."""
    x0, y0, x1, y1 = xy

    # Top edge
    x = x0
    while x < x1:
        end = min(x + dash_length, x1)
        draw.line([(x, y0), (end, y0)], fill=fill, width=width)
        x = end + gap_length

    # Bottom edge
    x = x0
    while x < x1:
        end = min(x + dash_length, x1)
        draw.line([(x, y1), (end, y1)], fill=fill, width=width)
        x = end + gap_length

    # Left edge
    y = y0
    while y < y1:
        end = min(y + dash_length, y1)
        draw.line([(x0, y), (x0, end)], fill=fill, width=width)
        y = end + gap_length

    # Right edge
    y = y0
    while y < y1:
        end = min(y + dash_length, y1)
        draw.line([(x1, y), (x1, end)], fill=fill, width=width)
        y = end + gap_length


def _text_center_x(draw, text, font, canvas_width):
    """Calculate x position to center text horizontally."""
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    return (canvas_width - text_width) // 2


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def generate_certificate(request, pk):
    """Generate a completion certificate image (PNG) for a trail.

    Returns 404 if:
    - Trail does not exist
    - User has not completed this trail
    """
    from .models import Trail, TrailCompletion

    try:
        trail = Trail.objects.get(pk=pk)
    except Trail.DoesNotExist:
        return HttpResponse(
            '{"detail": "Trail not found"}',
            content_type="application/json",
            status=404,
        )

    completion = (
        TrailCompletion.objects
        .filter(user=request.user, trail=trail)
        .order_by("-completed_at")
        .first()
    )
    if completion is None:
        return HttpResponse(
            '{"detail": "Trail not completed"}',
            content_type="application/json",
            status=404,
        )

    # ── Canvas setup ─────────────────────────────────────
    W, H = 1200, 850
    img = Image.new("RGB", (W, H), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    title_font, subtitle_font, body_font, small_font, brand_font = _load_fonts()

    # Colors
    PRIMARY = (45, 74, 46)       # dark forest green
    ACCENT = (168, 230, 207)     # moru mint
    LIGHT_GREEN = (240, 247, 240)
    TEXT_DARK = (33, 33, 33)
    TEXT_MED = (100, 100, 100)
    GOLD = (180, 150, 60)

    # ── Background decoration ────────────────────────────
    # Subtle top/bottom green bars
    draw.rectangle([(0, 0), (W, 12)], fill=PRIMARY)
    draw.rectangle([(0, H - 12), (W, H)], fill=PRIMARY)

    # Inner dashed border frame
    _draw_dashed_rect(draw, (30, 30, W - 30, H - 30), width=2, fill=ACCENT)

    # Inner solid border
    draw.rectangle([(50, 50), (W - 50, H - 50)], outline=PRIMARY, width=2)

    # ── Decorative corner elements ───────────────────────
    corner_size = 20
    for cx, cy in [(60, 60), (W - 60, 60), (60, H - 60), (W - 60, H - 60)]:
        draw.ellipse(
            [cx - corner_size // 2, cy - corner_size // 2,
             cx + corner_size // 2, cy + corner_size // 2],
            fill=ACCENT,
        )

    # ── Brand name ───────────────────────────────────────
    brand_text = "MORU"
    x = _text_center_x(draw, brand_text, brand_font, W)
    draw.text((x, 80), brand_text, fill=ACCENT, font=brand_font)

    # ── Title ────────────────────────────────────────────
    # Korean title
    cert_title_ko = "Completion Certificate"
    x = _text_center_x(draw, cert_title_ko, title_font, W)
    draw.text((x, 130), cert_title_ko, fill=PRIMARY, font=title_font)

    # Decorative line under title
    line_y = 200
    line_w = 300
    draw.line(
        [(W // 2 - line_w, line_y), (W // 2 + line_w, line_y)],
        fill=ACCENT, width=3,
    )

    # ── Trail name ───────────────────────────────────────
    trail_name = trail.title[:50]
    x = _text_center_x(draw, trail_name, subtitle_font, W)
    draw.text((x, 230), trail_name, fill=TEXT_DARK, font=subtitle_font)

    # Region + Country
    region_text = f"{trail.region}, {trail.country}" if trail.region else trail.country
    x = _text_center_x(draw, region_text, small_font, W)
    draw.text((x, 278), region_text, fill=TEXT_MED, font=small_font)

    # ── Green banner area ────────────────────────────────
    banner_y = 320
    draw.rectangle([(100, banner_y), (W - 100, banner_y + 80)], fill=LIGHT_GREEN)

    # Stats inside banner
    distance_text = f"{trail.distance_km} km"
    x = _text_center_x(draw, distance_text, subtitle_font, W)
    draw.text((x, banner_y + 20), distance_text, fill=PRIMARY, font=subtitle_font)

    # ── User info ────────────────────────────────────────
    user = request.user
    nickname = user.nickname or user.username

    walker_label = "Walker"
    x = _text_center_x(draw, walker_label, small_font, W)
    draw.text((x, 440), walker_label, fill=TEXT_MED, font=small_font)

    x = _text_center_x(draw, nickname, subtitle_font, W)
    draw.text((x, 470), nickname, fill=TEXT_DARK, font=subtitle_font)

    # ── Completion date ──────────────────────────────────
    completed_date = completion.completed_at.strftime("%Y. %m. %d")
    date_label = "Completed on"
    x = _text_center_x(draw, date_label, small_font, W)
    draw.text((x, 540), date_label, fill=TEXT_MED, font=small_font)

    x = _text_center_x(draw, completed_date, body_font, W)
    draw.text((x, 570), completed_date, fill=TEXT_DARK, font=body_font)

    # ── Coverage percentage ──────────────────────────────
    coverage_pct = int(float(completion.coverage) * 100)
    if coverage_pct < 100:
        coverage_text = f"Coverage: {coverage_pct}%"
        x = _text_center_x(draw, coverage_text, small_font, W)
        draw.text((x, 620), coverage_text, fill=TEXT_MED, font=small_font)

    # ── Bottom decorative line ───────────────────────────
    draw.line(
        [(W // 2 - line_w, 680), (W // 2 + line_w, 680)],
        fill=ACCENT, width=2,
    )

    # ── Certificate stamp / seal area ────────────────────
    seal_cx, seal_cy = W // 2, 740
    seal_r = 40
    draw.ellipse(
        [seal_cx - seal_r, seal_cy - seal_r,
         seal_cx + seal_r, seal_cy + seal_r],
        outline=GOLD, width=3,
    )
    draw.ellipse(
        [seal_cx - seal_r + 6, seal_cy - seal_r + 6,
         seal_cx + seal_r - 6, seal_cy + seal_r - 6],
        outline=GOLD, width=1,
    )
    # Checkmark inside seal
    check_text = "V"
    x = _text_center_x(draw, check_text, brand_font, W)
    draw.text((x, seal_cy - 16), check_text, fill=GOLD, font=brand_font)

    # ── Footer text ──────────────────────────────────────
    footer = "Moru Walking Trail App"
    x = _text_center_x(draw, footer, small_font, W)
    draw.text((x, H - 70), footer, fill=TEXT_MED, font=small_font)

    # ── Output as PNG ────────────────────────────────────
    buffer = io.BytesIO()
    img.save(buffer, format="PNG", quality=95)
    buffer.seek(0)

    response = HttpResponse(buffer.read(), content_type="image/png")
    response["Content-Disposition"] = (
        f'inline; filename="moru-certificate-{trail.pk}.png"'
    )
    return response
