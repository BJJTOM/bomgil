"""Seed a rich demo trail so the map + detail page can show off.

Everything is fabricated but realistic: a ~4.8km looping walk around
Yeouido Hangang Park (여의도 한강공원). The path carries ~60 GPS
points with synthesised elevation so the new elevation profile and
flythrough features have something to render, plus segments, spots,
stamp points, tags, and cover image.

Usage:
    python manage.py seed_showcase_trail
    python manage.py seed_showcase_trail --slug yeouido-cherry --force
"""

from __future__ import annotations

import math
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import CustomUser
from apps.trails.models import StampPoint, Tag, Trail, TrailSegment
from apps.spots.models import Spot


# ── Yeouido loop: real coordinates hand-picked for a scenic ~4.8km walk ──
# Generated below by sampling an ellipse through these anchor points.
YEOUIDO_ANCHORS = [
    (37.526470, 126.934170),  # 한강공원 여의도 입구
    (37.528150, 126.926830),  # 벚꽃길 중앙
    (37.526650, 126.919800),  # 국회의사당 앞
    (37.523620, 126.917400),  # 마포대교 남단
    (37.519330, 126.923050),  # 여의나루역 쪽
    (37.520650, 126.931500),  # 요트 선착장
    (37.524380, 126.935400),  # 한강공원 동쪽
    (37.526470, 126.934170),  # 다시 출발지 (loop close)
]


def _sample_path(anchors, points_per_segment=8):
    """Catmull-Rom-style smooth sampling for a nicer polyline."""
    coords = []
    for i in range(len(anchors) - 1):
        p0 = anchors[max(0, i - 1)]
        p1 = anchors[i]
        p2 = anchors[i + 1]
        p3 = anchors[min(len(anchors) - 1, i + 2)]
        for s in range(points_per_segment):
            t = s / points_per_segment
            t2, t3 = t * t, t * t * t
            lat = 0.5 * (
                (2 * p1[0])
                + (-p0[0] + p2[0]) * t
                + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
            )
            lng = 0.5 * (
                (2 * p1[1])
                + (-p0[1] + p2[1]) * t
                + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
            )
            coords.append((lat, lng))
    coords.append(anchors[-1])
    return coords


def _haversine_km(a, b):
    R = 6371.0
    lat1, lng1 = math.radians(a[0]), math.radians(a[1])
    lat2, lng2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlng = lat2 - lat1, lng2 - lng1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def _add_elevation(coords):
    """Add a gentle synthesised elevation (m) to each [lat, lng].

    Simulates a mild hill + riverside flat so the elevation chart has
    something interesting to plot without pretending to be real terrain.
    Returns `[lng, lat, ele]` tuples because our GeoJSON convention is
    [lng, lat] first.
    """
    n = len(coords)
    result = []
    for i, (lat, lng) in enumerate(coords):
        t = i / max(1, n - 1)
        # Two-peak wave, baseline 18m near Han river
        ele = 18 + 14 * math.sin(t * math.pi * 2) + 8 * math.sin(t * math.pi * 5)
        result.append([round(lng, 6), round(lat, 6), round(ele, 1)])
    return result


SHOWCASE = {
    "slug": "yeouido-cherry",
    "title": "여의도 벚꽃길 한강 루프",
    "title_en": "Yeouido Cherry Blossom Hangang Loop",
    "title_ja": "汝矣島の桜並木 漢江ループ",
    "description": (
        "봄이면 벚꽃이 터널을 이루고, 사계절 내내 한강 위 윤슬이 반짝이는 서울의 "
        "대표 산책 코스. 국회의사당·마포대교·요트 선착장을 한 바퀴 도는 4.8km "
        "순환 루트로, 어디서 시작해도 30분이면 카페와 전망 포인트를 만날 수 있습니다. "
        "초보자에게도 부담 없는 평지 위주의 포장길 + 자전거도로 병행 코스."
    ),
    "description_en": (
        "A spring cherry-blossom canopy and year-round Han River sparkle on Seoul's "
        "most beloved urban walk. A 4.8 km loop past the National Assembly, "
        "Mapo Bridge and the yacht marina — easy paved paths the whole way."
    ),
    "description_ja": (
        "春は桜のトンネル、四季を通じて漢江のきらめきが楽しめるソウル定番の散歩道。"
        "国会議事堂・麻浦大橋・ヨットマリーナを巡る4.8kmの周回コース、全線舗装路で初心者にもやさしい。"
    ),
    "region": "서울 영등포구",
    "country": "KR",
    "trail_type": "urban",
    "difficulty": "easy",
    "walking_surface": "paved",
    "best_season": "spring",
    "estimated_minutes": 70,
    "transport_access": "지하철 5호선 여의나루역 2번 출구 도보 5분 / 9호선 국회의사당역 4번 출구 도보 8분",
    "cover_image_url": "https://tong.visitkorea.or.kr/cms/resource/86/2596286_image2_1.jpg",
}

SEGMENTS = [
    ("한강공원 입구", "벚꽃길 중앙광장", 0.8, 12),
    ("벚꽃길 중앙광장", "국회의사당 앞 전망", 1.1, 17),
    ("국회의사당 앞 전망", "마포대교 남단 쉼터", 0.9, 14),
    ("마포대교 남단 쉼터", "여의나루 야경 포인트", 1.0, 15),
    ("여의나루 야경 포인트", "요트 선착장 & 복귀", 1.0, 12),
]

SPOTS = [
    # (spot_type, name, dist_km, lat, lng, desc, menu_highlight)
    ("start", "한강공원 여의도 입구", 0.0, 37.526470, 126.934170,
        "지하철 5호선 여의나루역 2번 출구에서 5분. 지도 간판 옆이 출발점입니다.", ""),
    ("cafe", "더리버 카페", 0.4, 37.527120, 126.930600,
        "한강 뷰가 풍경화처럼 펼쳐지는 2층 루프탑 카페. 평일 오전은 자리 여유 있음.",
        "시그니처 '한강 라떼' 6,500원"),
    ("photo", "벚꽃 터널 포토존", 0.9, 37.528020, 126.926440,
        "3~4월 벚꽃 만개 시 가장 붐비는 구간. 이른 아침 7~8시가 인생샷 골든타임.", ""),
    ("view", "국회의사당 뷰 전망대", 1.9, 37.526650, 126.919800,
        "의사당 돔과 한강 다리가 한 프레임. 일몰 20분 전부터 조명이 켜집니다.", ""),
    ("rest", "마포대교 남단 쉼터", 2.8, 37.523620, 126.917400,
        "그늘 벤치 8개, 식수대 있음. 한강 바람이 가장 시원한 구간.", ""),
    ("tip", "자전거 주의 구간", 3.1, 37.521600, 126.919200,
        "보행자-자전거 분리선이 흐립니다. 이어폰은 한쪽만 끼시는 걸 추천.", ""),
    ("view", "여의나루 야경 포인트", 3.8, 37.519330, 126.923050,
        "해 질 녘 마포대교가 황금빛으로 물듭니다. 삼각대 설치 가능.", ""),
    ("restaurant", "한강 치맥 포장마차", 4.2, 37.520650, 126.931500,
        "요트 선착장 앞 간이 포차. 라면·치킨·맥주 기본 세트. 현금/카드 모두 OK.",
        "치킨 한 마리 + 맥주 23,000원"),
    ("end", "복귀 · 출발지", 4.8, 37.526470, 126.934170,
        "수고하셨어요! 스탬프 4개를 모두 모으면 완주 배지가 지급됩니다.", ""),
]

STAMPS = [
    ("🌸", "벚꽃 터널", 37.528020, 126.926440, "봄 벚꽃 터널의 한복판"),
    ("🏛️", "국회 전망", 37.526650, 126.919800, "국회의사당 전망 포인트"),
    ("🌉", "마포대교", 37.523620, 126.917400, "마포대교 남단 쉼터"),
    ("🌃", "여의나루 야경", 37.519330, 126.923050, "한강 야경 포토 포인트"),
]

TAG_NAMES = ["한강", "벚꽃", "도심산책", "야경", "초보추천", "포장길"]


class Command(BaseCommand):
    help = "Create a rich showcase trail (여의도 한강 벚꽃길) with path, segments, spots, stamps."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Wipe and recreate if the showcase trail already exists.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        force = options["force"]

        # Pick an author — prefer existing moru_official, else the first superuser.
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

        # Identify existing showcase by title to make the command idempotent.
        existing = Trail.objects.filter(title=SHOWCASE["title"]).first()
        if existing and not force:
            self.stdout.write(
                self.style.WARNING(
                    f"Trail already exists (id={existing.pk}). Re-run with --force to replace."
                )
            )
            return
        if existing and force:
            existing.delete()
            self.stdout.write(self.style.NOTICE("  ✖ deleted previous showcase trail"))

        # Build the path with elevation.
        raw_coords = _sample_path(YEOUIDO_ANCHORS, points_per_segment=9)
        path_coords = _add_elevation(raw_coords)  # [[lng, lat, ele], …]

        # Accurate distance from the sampled polyline (override the 4.8 guess).
        total_km = sum(
            _haversine_km(raw_coords[i], raw_coords[i + 1])
            for i in range(len(raw_coords) - 1)
        )
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
            start_lat=Decimal(str(raw_coords[0][0])),
            start_lng=Decimal(str(raw_coords[0][1])),
            end_lat=Decimal(str(raw_coords[-1][0])),
            end_lng=Decimal(str(raw_coords[-1][1])),
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

        # Tags
        for name in TAG_NAMES:
            tag, _ = Tag.objects.get_or_create(name=name)
            trail.tags.add(tag)

        # Segments
        for i, (start, end, km, minutes) in enumerate(SEGMENTS):
            TrailSegment.objects.create(
                trail=trail,
                order=i,
                start_name=start,
                end_name=end,
                distance_km=Decimal(str(km)),
                duration_minutes=minutes,
            )

        # Spots
        for i, (stype, name, dist_km, lat, lng, desc, menu) in enumerate(SPOTS):
            Spot.objects.create(
                trail=trail,
                author=author,
                name=name,
                spot_type=stype,
                lat=Decimal(str(lat)),
                lng=Decimal(str(lng)),
                order=i,
                distance_from_start_km=Decimal(str(dist_km)),
                description=desc,
                menu_highlight=menu,
                status="approved",
                is_must_visit=stype in ("photo", "view"),
            )

        # Stamp points
        for i, (emoji, name, lat, lng, desc) in enumerate(STAMPS):
            StampPoint.objects.create(
                trail=trail,
                name=name,
                lat=Decimal(str(lat)),
                lng=Decimal(str(lng)),
                radius_meters=50,
                description=desc,
                emoji=emoji,
                order=i,
            )

        self.stdout.write(self.style.SUCCESS(
            f"\n✓ showcase trail created — id={trail.pk}  /  {total_km}km  /  "
            f"{len(path_coords)}pts  /  {len(SEGMENTS)}segments  /  "
            f"{len(SPOTS)}spots  /  {len(STAMPS)}stamps"
        ))
        self.stdout.write(f"  web: https://moruwalk.com/trails/{trail.pk}")
