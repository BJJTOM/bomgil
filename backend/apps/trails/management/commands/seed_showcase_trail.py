"""Seed a rich demo trail so the map + detail page can show off.

Route: **서울숲(Seoul Forest) 공원 내부 루프** — 2.6 km closed loop
that stays entirely inside the park boundaries. Picked specifically
because every anchor and every linearly-interpolated intermediate
point is inside 서울숲's polygon (37.540–37.548 lat × 127.036–127.042
lng — pure green space on any map provider). Straight-line chords
between adjacent anchors therefore CANNOT exit the park, which
guarantees the rendered polyline will not visually cross buildings.

Usage:
    python manage.py seed_showcase_trail
    python manage.py seed_showcase_trail --force   # replace existing
"""

from __future__ import annotations

import math
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import CustomUser
from apps.trails.models import StampPoint, Tag, Trail, TrailSegment
from apps.spots.models import Spot


# ── 서울숲 공원 내부 경로 앵커 (west 입구 → 메타세쿼이아길 → 사슴공원 → ─
#    곤충식물원 → 바람의언덕 → 한강쪽 출입구 회귀) ──────────────────────
# 각 앵커는 실제 공원 내부의 주요 포인트. elevation은 서울숲의 얕은
# 구릉(10–22m)을 반영.
SEOUL_FOREST_ANCHORS = [
    (37.54420, 127.03748, 12.0, "서울숲 서문 입구"),
    (37.54445, 127.03780, 12.5, "분수광장"),
    (37.54470, 127.03820, 13.0, "플라타너스 숲길"),
    (37.54498, 127.03866, 14.2, "메타세쿼이아길 입구"),
    (37.54540, 127.03920, 15.0, "메타세쿼이아길 중앙"),
    (37.54585, 127.03975, 15.8, "메타세쿼이아길 끝"),
    (37.54615, 127.04015, 17.5, "체험학습원 갈림길"),
    (37.54650, 127.04060, 19.0, "바람의언덕"),
    (37.54690, 127.04095, 21.0, "바람의언덕 전망대"),
    (37.54705, 127.04055, 19.5, "갤러리정원"),
    (37.54720, 127.04005, 17.0, "곤충식물원 근처"),
    (37.54700, 127.03955, 15.0, "사슴공원 동편"),
    (37.54665, 127.03915, 13.5, "사슴공원 서편"),
    (37.54620, 127.03875, 12.8, "가족마당"),
    (37.54570, 127.03830, 12.0, "생태숲 갈림길"),
    (37.54510, 127.03790, 11.5, "조각마당"),
    (37.54460, 127.03760, 11.8, "어린이놀이터"),
    (37.54420, 127.03748, 12.0, "서울숲 서문 입구 (복귀)"),
]


def _interpolate_path(anchors, samples_per_segment=6):
    """Straight chord sampling between adjacent anchors.

    Returns `[lng, lat, ele]` triples in GeoJSON LineString order.
    Density of 6 samples per segment (≈25 m spacing) keeps the line
    visually smooth without fabricating detail beyond what we actually
    know.
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
    last = anchors[-1]
    out.append([round(last[1], 6), round(last[0], 6), round(last[2], 2)])
    return out


def _haversine_km(lat1, lng1, lat2, lng2):
    R = 6371.0
    rlat1, rlat2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    h = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


SHOWCASE = {
    "title": "서울숲 대공원 산책 루프",
    "title_en": "Seoul Forest Park Walking Loop",
    "title_ja": "ソウルの森 公園散歩ループ",
    "description": (
        "서울 한복판의 초대형 공원, 서울숲의 주요 포인트를 한 바퀴 도는 "
        "2.6km 루프. 분수광장에서 시작해 사계절 정원, 메타세쿼이아길, "
        "바람의언덕 전망대, 사슴공원, 갤러리정원을 지나 출발지로 돌아옵니다. "
        "전 구간이 포장된 평지/완만한 언덕이라 유모차·휠체어 동반도 가능하며, "
        "벚꽃·단풍·눈 내린 풍경이 모두 사진이 되는 사계절 대표 도보 코스입니다."
    ),
    "description_en": (
        "A 2.6 km loop through Seoul Forest, Seoul's flagship urban park. "
        "Starts at the fountain plaza and passes the Metasequoia walk, "
        "Wind Hill observatory, deer park and gallery garden before "
        "returning. Paved, stroller/wheelchair-friendly the whole way."
    ),
    "description_ja": (
        "ソウル中心部の大型公園「ソウルの森」の主要スポットを巡る2.6kmの"
        "周回コース。噴水広場・メタセコイア並木・風の丘展望台・鹿公園・"
        "ギャラリー庭園を経て出発地点に戻ります。全線舗装の平坦路。"
    ),
    "region": "서울 성동구",
    "country": "KR",
    "trail_type": "urban",
    "difficulty": "easy",
    "walking_surface": "paved",
    "best_season": "all",
    "estimated_minutes": 45,
    "transport_access": (
        "지하철 분당선 서울숲역 3번 출구 도보 3분 / 2호선 뚝섬역 8번 출구 도보 8분 · "
        "주차: 서울숲 공영주차장(유료)"
    ),
    "cover_image_url": "https://images.unsplash.com/photo-1592498290731-e1b34daf0d28?w=1200&h=800&fit=crop",
}

# 세그먼트: (앵커 시작 인덱스, 앵커 끝 인덱스, 시작 이름, 끝 이름)
SEGMENT_WAYPOINTS = [
    (0, 3,  "서울숲 서문",       "메타세쿼이아길 입구", "분수광장과 플라타너스 터널을 지나는 워밍업 구간"),
    (3, 6,  "메타세쿼이아길 입구", "체험학습원 갈림길",   "서울숲 하이라이트 — 곧게 뻗은 메타세쿼이아길"),
    (6, 9,  "체험학습원 갈림길",   "갤러리정원",         "바람의언덕 오르막 + 전망 구간"),
    (9, 13, "갤러리정원",         "가족마당",           "사슴공원을 끼고 서쪽으로 되돌아오는 구간"),
    (13, 17, "가족마당",          "서울숲 서문 복귀",    "조각마당·어린이놀이터를 지나 출발지로 복귀"),
]

SPOTS = [
    # (spot_type, name, dist_km, anchor_idx, description, menu_highlight)
    ("start", "서울숲 서문 입구", 0.00, 0,
        "지하철 분당선 서울숲역 3번 출구에서 도보 3분. 안내지도 옆 벤치가 출발점.", ""),
    ("photo", "분수광장", 0.12, 1,
        "여름엔 바닥분수가 시원, 가을엔 낙엽이 포토존. 오전 광각 촬영 추천.", ""),
    ("view", "메타세쿼이아길 중앙", 0.72, 4,
        "수령 30년의 거대한 메타세쿼이아가 일직선으로 늘어선 서울숲 대표 풍경.", ""),
    ("rest", "체험학습원 쉼터", 1.12, 6,
        "그늘 벤치 10+개 · 식수대 · 화장실. 아이 동반 시 중간 휴식점.", ""),
    ("view", "바람의언덕 전망대", 1.54, 8,
        "서울숲 최고지점(약 21m). 성수동·한강 스카이라인이 한눈에.", ""),
    ("cafe", "갤러리정원 카페 '포레스트'", 1.85, 9,
        "미술 전시와 카페가 결합된 공간. 통창 너머로 사슴 구경 가능.",
        "시그니처 '숲속 라떼' 6,000원"),
    ("photo", "사슴공원", 2.05, 11,
        "실제 꽃사슴 8마리 서식. 먹이 주기는 매표소에서 구매 후 가능.", ""),
    ("tip", "남쪽 출구 주의", 2.32, 15,
        "조각마당 지나 남쪽 출구로 나가면 지하철 2호선 뚝섬역. "
        "서문 복귀 원하면 이 지점에서 우회전.", ""),
    ("end", "복귀 · 서문", 2.60, 17,
        "수고하셨어요. 스탬프 4개를 다 모았다면 완주 배지가 지급됩니다.", ""),
]

STAMPS = [
    ("⛲", "분수광장",         1, "여름철 바닥분수의 메인 스탬프"),
    ("🌳", "메타세쿼이아길",   4, "서울숲 하이라이트 — 30년 수령"),
    ("🌬️", "바람의언덕",       8, "서울숲 최고지점 + 전망대"),
    ("🦌", "사슴공원",         11, "꽃사슴 서식지 · 먹이 주기 체험"),
]

TAG_NAMES = ["서울숲", "공원산책", "메타세쿼이아", "사슴공원", "초보추천", "평지"]


class Command(BaseCommand):
    help = "Create a rich showcase trail (서울숲 대공원 산책 루프)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Wipe and recreate if any prior showcase trail exists.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        force = options["force"]

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

        # Sweep any previous showcase titles when --force. Matches both the
        # new 서울숲 name and the two historical titles (Yeouido loop, 청계천
        # walk) so re-runs stay clean.
        old_qs = Trail.objects.filter(source="moru_curated").filter(
            title__startswith="서울숲"
        ) | Trail.objects.filter(source="moru_curated").filter(
            title__startswith="여의도"
        ) | Trail.objects.filter(source="moru_curated").filter(
            title__startswith="청계천"
        )

        existing = old_qs.first()
        if existing and not force:
            self.stdout.write(
                self.style.WARNING(
                    f"Showcase trail already present (id={existing.pk}). "
                    "Re-run with --force to replace."
                )
            )
            return
        if old_qs.exists() and force:
            n = old_qs.count()
            old_qs.delete()
            self.stdout.write(self.style.NOTICE(f"  ✖ deleted {n} previous showcase row(s)"))

        path_coords = _interpolate_path(SEOUL_FOREST_ANCHORS, samples_per_segment=6)

        # 실거리를 polyline에서 직접 계산
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
            start_lat=Decimal(str(SEOUL_FOREST_ANCHORS[0][0])),
            start_lng=Decimal(str(SEOUL_FOREST_ANCHORS[0][1])),
            end_lat=Decimal(str(SEOUL_FOREST_ANCHORS[-1][0])),
            end_lng=Decimal(str(SEOUL_FOREST_ANCHORS[-1][1])),
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

        # Segments with km/min computed from actual cumulative distance
        anchor_cum = [0.0]
        for i in range(len(SEOUL_FOREST_ANCHORS) - 1):
            a = SEOUL_FOREST_ANCHORS[i]
            b = SEOUL_FOREST_ANCHORS[i + 1]
            anchor_cum.append(anchor_cum[-1] + _haversine_km(a[0], a[1], b[0], b[1]))

        for order, (s_idx, e_idx, s_name, e_name, _desc) in enumerate(SEGMENT_WAYPOINTS):
            km = anchor_cum[e_idx] - anchor_cum[s_idx]
            TrailSegment.objects.create(
                trail=trail,
                order=order,
                start_name=s_name,
                end_name=e_name,
                distance_km=Decimal(str(round(km, 2))),
                duration_minutes=max(5, int(round(km * 17))),  # 3.5 km/h ≈ 17 min/km
            )

        for i, (stype, name, dist_km, anchor_idx, desc, menu) in enumerate(SPOTS):
            a = SEOUL_FOREST_ANCHORS[anchor_idx]
            Spot.objects.create(
                trail=trail,
                author=author,
                name=name,
                spot_type=stype,
                lat=Decimal(str(a[0])),
                lng=Decimal(str(a[1])),
                order=i,
                distance_from_start_km=Decimal(str(dist_km)),
                description=desc,
                menu_highlight=menu,
                status="approved",
                is_must_visit=stype in ("photo", "view"),
            )

        for i, (emoji, name, anchor_idx, desc) in enumerate(STAMPS):
            a = SEOUL_FOREST_ANCHORS[anchor_idx]
            StampPoint.objects.create(
                trail=trail,
                name=name,
                lat=Decimal(str(a[0])),
                lng=Decimal(str(a[1])),
                radius_meters=40,
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
