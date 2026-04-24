"""Seed a rich demo trail so the map + detail page can show off.

The route is the 청계천 산책로 — a dedicated riverside pedestrian walkway
that runs east from 청계광장 past a sequence of historic bridges. It's the
right pick for a synthetic demo because:
  - The walking path is physically separated from traffic and buildings,
    so linear segments between bridge anchors (≈150 m apart) stay on
    the real path.
  - Every bridge is a well-known Seoul landmark, giving the segment and
    stamp lists instant recognisability.
  - The full stretch from 청계광장 to 영도교 is ~3.8 km, comfortable for
    a one-way walk and turning into a 7 km out-and-back loop.

Usage:
    python manage.py seed_showcase_trail
    python manage.py seed_showcase_trail --force
"""

from __future__ import annotations

import math
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import CustomUser
from apps.trails.models import StampPoint, Tag, Trail, TrailSegment
from apps.spots.models import Spot


# ── Real 청계천 bridge coordinates (west → east) ────────────────────────
# Each tuple: (lat, lng, altitude_m, bridge_name).
# Altitude is the sunken-riverbed level at that bridge, roughly 14~20 m
# above sea level; using the small variation makes the elevation profile
# chart readable without pretending the walk goes uphill.
CHEONGGYE_BRIDGES = [
    (37.56930, 126.97832, 17.0, "청계광장"),
    (37.56921, 126.97920, 16.8, "모전교"),
    (37.56915, 126.98014, 16.5, "광통교"),
    (37.56908, 126.98102, 16.2, "광교"),
    (37.56898, 126.98196, 15.9, "장통교"),
    (37.56891, 126.98280, 15.7, "삼일교"),
    (37.56882, 126.98373, 15.5, "수표교"),
    (37.56875, 126.98464, 15.3, "관수교"),
    (37.56862, 126.98645, 15.1, "세운교"),
    (37.56847, 126.98826, 14.9, "배오개다리"),
    (37.56829, 126.99010, 14.7, "새벽다리"),
    (37.56811, 126.99193, 14.5, "마전교"),
    (37.56794, 126.99370, 14.3, "나래교"),
    (37.56773, 126.99552, 14.1, "버들다리"),
    (37.56746, 126.99730, 13.9, "오간수교"),
    (37.56714, 126.99898, 13.7, "맑은내다리"),
    (37.56680, 127.00059, 13.5, "다산교"),
    (37.56626, 127.00220, 13.3, "영도교"),
]


def _interpolate_path(anchors, samples_per_segment=5):
    """Straight-line sample between adjacent anchors.

    Dense enough sampling (5 per segment of ≈150 m) means the rendered
    polyline hugs the river without visible angles — and since each
    sub-segment is a chord of a <1° bearing change, none of the
    straight pieces wander into buildings.
    """
    out = []
    for i in range(len(anchors) - 1):
        a, b = anchors[i], anchors[i + 1]
        for s in range(samples_per_segment):
            t = s / samples_per_segment
            lat = a[0] + (b[0] - a[0]) * t
            lng = a[1] + (b[1] - a[1]) * t
            ele = a[2] + (b[2] - a[2]) * t
            out.append([round(lng, 6), round(lat, 6), round(ele, 2)])
    a = anchors[-1]
    out.append([round(a[1], 6), round(a[0], 6), round(a[2], 2)])
    return out


def _haversine_km(lat1, lng1, lat2, lng2):
    R = 6371.0
    rlat1, rlat2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    h = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


SHOWCASE = {
    "title": "청계천 산책로 — 청계광장 → 영도교",
    "title_en": "Cheonggyecheon Walk — Cheonggye Plaza to Yeongdo Bridge",
    "title_ja": "清渓川散歩道 — 清渓広場から永渡橋まで",
    "description": (
        "서울 도심 한복판, 차량과 완전히 분리된 하천변 산책로를 따라 18개 "
        "다리를 순서대로 만나는 3.8km 워크입니다. 청계광장의 모던한 분수에서 "
        "시작해 광통교·수표교 같은 조선시대 석교들을 지나 장수 복원지의 "
        "갈대밭까지 이어지는, 도보 초심자에게 가장 추천할 만한 서울 대표 "
        "코스. 전체 구간이 포장된 평지라 유모차·휠체어 이동도 가능하며, "
        "여름엔 물놀이 구간이, 가을엔 단풍 터널이, 겨울엔 빛초롱축제가 "
        "기다립니다."
    ),
    "description_en": (
        "A 3.8 km car-free riverside walk through the heart of Seoul, passing "
        "18 historic bridges from the modern Cheonggye Plaza to the restored "
        "reed fields near Yeongdo Bridge. The entire route is paved and "
        "accessible — ideal for first-time walkers, strollers and wheelchair "
        "users."
    ),
    "description_ja": (
        "ソウル都心を貫く清渓川沿いの歩行者専用路を3.8km。清渓広場から広通橋や"
        "水標橋など朝鮮時代の石橋を次々に渡り、復元された葦原で終わる。全線が平地舗装路で、"
        "初心者にも安心のコース。"
    ),
    "region": "서울 종로구 / 중구",
    "country": "KR",
    "trail_type": "urban",
    "difficulty": "easy",
    "walking_surface": "paved",
    "best_season": "all",
    "estimated_minutes": 55,
    "transport_access": (
        "지하철 5호선 광화문역 5번 출구 도보 2분 / 종각역 5번 출구 도보 3분 "
        "· 도착 후 지하철 5호선 신금호역 또는 6호선 신당역에서 귀가"
    ),
    "cover_image_url": "https://tong.visitkorea.or.kr/cms/resource/01/2639501_image2_1.jpg",
}

# Segments tie consecutive bridge anchors together. We read distances
# straight from the interpolated polyline so they match the rendered
# map exactly.
SEGMENT_WAYPOINTS = [
    (0, 3,  "청계광장",       "광교",          "도심 빌딩 사이를 흐르는 물줄기, 스타트 구간"),
    (3, 7,  "광교",           "관수교",        "조선시대 석교가 차례로 나타나는 역사 구간"),
    (7, 11, "관수교",         "마전교",        "옛 시장 골목과 나란한 중간 구간 · 포토존 다수"),
    (11, 15, "마전교",        "오간수교",      "한양 성곽의 흔적 오간수문이 남아있는 구간"),
    (15, 17, "오간수교",      "영도교",        "갈대밭과 복원 생태 공간으로 이어지는 피날레"),
]

# Spots at or near specific bridges. lat/lng use the bridge anchor.
SPOTS = [
    # (spot_type, name, dist_km, bridge_idx, desc, menu_highlight)
    ("start", "청계광장", 0.00, 0,
        "모전교 아래 분수 조형물에서 출발. 지하철 광화문역 5번 출구 2분.", ""),
    ("photo", "광통교 돌다리 포토존", 0.30, 2,
        "조선시대 화강암 석교가 그대로 복원된 구간. 아침 7~9시 빛이 가장 부드럽습니다.", ""),
    ("cafe", "청계 북카페 '더클래식'", 0.90, 5,
        "삼일교 쪽 출구 계단 위, 책장에 둘러싸인 로스터리. 물결 소리 BGM은 덤.",
        "핸드드립 한강 블렌드 6,500원"),
    ("view", "수표교 역사 전망", 1.35, 6,
        "세종대왕이 한강 수위를 측정하던 수표석이 옆에 복원돼 있습니다.", ""),
    ("rest", "세운상가 쉼터", 1.95, 8,
        "그늘 벤치와 식수대. 하천 바람이 도심 더위를 크게 낮춰주는 구간.", ""),
    ("tip", "자전거 도로 주의", 2.40, 10,
        "청계천 북측로는 자전거 겸용. 이어폰은 한쪽만, 좌측 보행 원칙.", ""),
    ("restaurant", "마전교 노포거리 '옛장독대'", 2.90, 12,
        "종로 옛 장맛을 살린 한정식. 점심 특선 1인 12,000원부터.",
        "보리굴비 정식 18,000원"),
    ("photo", "오간수교 성곽 뷰", 3.30, 14,
        "한양 성곽의 수문이었던 오간수문이 복원돼 있어 야경 포토스팟으로 유명.", ""),
    ("end", "영도교 · 복원 갈대밭", 3.80, 17,
        "수고하셨어요. 영도교 아래 생태복원지에서 갈대와 오리를 만나고, "
        "건너편 6호선 신당역으로 귀가할 수 있습니다.", ""),
]

STAMPS = [
    ("🏁", "청계광장 출발", 0, "스타트 스탬프 · 분수 조형물 옆"),
    ("🌉", "광통교", 2, "조선시대 최고(最古) 석교 · 복원 완료"),
    ("📜", "수표교", 6, "세종대왕 수표석과 역사 흔적"),
    ("🏯", "오간수교 성곽", 14, "한양도성 오간수문 복원 구간"),
]

TAG_NAMES = ["청계천", "도심산책", "역사탐방", "초보추천", "포장길", "평지"]


class Command(BaseCommand):
    help = "Create a rich showcase trail (청계천 산책로) with real riverside coordinates."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Wipe and recreate if any showcase trail exists (matches title prefix).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        force = options["force"]

        # Author — prefer moru_official so the trail shows up as curated.
        author = (
            CustomUser.objects.filter(nickname="moru_official").first()
            or CustomUser.objects.filter(is_superuser=True).order_by("pk").first()
        )
        if not author:
            author = CustomUser.objects.create_user(
                username="moru_official",
                email="moru_official@moruwalk.com",
                nickname="moru_official",
            )
            author.set_unusable_password()
            author.save()

        # Match by title prefix so old Yeouido showcase rows get cleaned
        # up too when --force flips on.
        existing_qs = Trail.objects.filter(
            source="moru_curated",
        ).filter(
            title__startswith="청계천",
        ) | Trail.objects.filter(
            source="moru_curated",
        ).filter(
            title__startswith="여의도",
        )
        existing = existing_qs.first()
        if existing and not force:
            self.stdout.write(
                self.style.WARNING(
                    f"Showcase trail already present (id={existing.pk}). Re-run with --force to replace."
                )
            )
            return
        if existing_qs.exists() and force:
            count = existing_qs.count()
            existing_qs.delete()
            self.stdout.write(self.style.NOTICE(f"  ✖ deleted {count} previous showcase trail(s)"))

        # Build the dense polyline.
        path_coords = _interpolate_path(CHEONGGYE_BRIDGES, samples_per_segment=5)

        # Total distance from the polyline itself.
        total_km = 0.0
        for i in range(len(path_coords) - 1):
            lng1, lat1 = path_coords[i][0], path_coords[i][1]
            lng2, lat2 = path_coords[i + 1][0], path_coords[i + 1][1]
            total_km += _haversine_km(lat1, lng1, lat2, lng2)
        total_km = round(total_km, 2)

        elevation_gain = int(
            sum(
                max(0, path_coords[i + 1][2] - path_coords[i][2])
                for i in range(len(path_coords) - 1)
            )
        )

        trail = Trail.objects.create(
            author=author,
            title=SHOWCASE["title"],
            title_en=SHOWCASE["title_en"],
            title_ja=SHOWCASE["title_ja"],
            description=SHOWCASE["description"],
            description_en=SHOWCASE["description_en"],
            description_ja=SHOWCASE["description_ja"],
            region=SHOWCASE["region"],
            country=SHOWCASE["country"],
            distance_km=Decimal(str(total_km)),
            estimated_minutes=SHOWCASE["estimated_minutes"],
            difficulty=SHOWCASE["difficulty"],
            elevation_gain=elevation_gain,
            start_lat=Decimal(str(CHEONGGYE_BRIDGES[0][0])),
            start_lng=Decimal(str(CHEONGGYE_BRIDGES[0][1])),
            end_lat=Decimal(str(CHEONGGYE_BRIDGES[-1][0])),
            end_lng=Decimal(str(CHEONGGYE_BRIDGES[-1][1])),
            path_data={
                "type": "LineString",
                "coordinates": path_coords,
            },
            thumbnail_url=SHOWCASE["cover_image_url"],
            trail_type=SHOWCASE["trail_type"],
            best_season=SHOWCASE["best_season"],
            walking_surface=SHOWCASE["walking_surface"],
            transport_access=SHOWCASE["transport_access"],
            status="approved",
            visibility="public",
            is_official=True,
            source="moru_curated",
            source_url="",
        )

        for name in TAG_NAMES:
            tag, _ = Tag.objects.get_or_create(name=name)
            trail.tags.add(tag)

        # Segments. Distance is computed from the real polyline between
        # the bridge anchors that bound each segment.
        bridge_cumulative = [0.0]
        for i in range(len(CHEONGGYE_BRIDGES) - 1):
            a = CHEONGGYE_BRIDGES[i]
            b = CHEONGGYE_BRIDGES[i + 1]
            bridge_cumulative.append(
                bridge_cumulative[-1] + _haversine_km(a[0], a[1], b[0], b[1])
            )

        for order, (start_idx, end_idx, start_name, end_name, _desc) in enumerate(SEGMENT_WAYPOINTS):
            km = bridge_cumulative[end_idx] - bridge_cumulative[start_idx]
            TrailSegment.objects.create(
                trail=trail,
                order=order,
                start_name=start_name,
                end_name=end_name,
                distance_km=Decimal(str(round(km, 2))),
                duration_minutes=max(5, int(round(km * 15))),  # 4 km/h ≈ 15 min/km
            )

        # Spots.
        for i, (stype, name, dist_km, bridge_idx, desc, menu) in enumerate(SPOTS):
            bridge = CHEONGGYE_BRIDGES[bridge_idx]
            Spot.objects.create(
                trail=trail,
                author=author,
                name=name,
                spot_type=stype,
                lat=Decimal(str(bridge[0])),
                lng=Decimal(str(bridge[1])),
                order=i,
                distance_from_start_km=Decimal(str(dist_km)),
                description=desc,
                menu_highlight=menu,
                status="approved",
                is_must_visit=stype in ("photo", "view"),
            )

        # Stamp points.
        for i, (emoji, name, bridge_idx, desc) in enumerate(STAMPS):
            bridge = CHEONGGYE_BRIDGES[bridge_idx]
            StampPoint.objects.create(
                trail=trail,
                name=name,
                lat=Decimal(str(bridge[0])),
                lng=Decimal(str(bridge[1])),
                radius_meters=50,
                description=desc,
                emoji=emoji,
                order=i,
            )

        self.stdout.write(self.style.SUCCESS(
            f"\n✓ showcase trail created — id={trail.pk}  /  {total_km}km  /  "
            f"{len(path_coords)}pts  /  {len(SEGMENT_WAYPOINTS)}segments  /  "
            f"{len(SPOTS)}spots  /  {len(STAMPS)}stamps"
        ))
        self.stdout.write(f"  web: https://moruwalk.com/trails/{trail.pk}")
