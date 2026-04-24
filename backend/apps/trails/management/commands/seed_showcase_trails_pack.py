"""Seed the beta showcase trail pack — 북촌 + 반포–뚝섬.

Two flagship walks added alongside the Seoul Forest loop so Explore has
at least three dense, fully-populated trails (map polyline, spots,
stamps, segments, cover image, description) on launch day.

Anchor coordinates follow known streets / riverside bike paths so
straight-chord interpolation between adjacent points stays on walkable
surface. 6-sample-per-segment linear interpolation matches the style of
seed_showcase_trail.py.

Usage:
    python manage.py seed_showcase_trails_pack
    python manage.py seed_showcase_trails_pack --force   # replace existing
"""

from __future__ import annotations

import math
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import CustomUser
from apps.trails.models import StampPoint, Tag, Trail, TrailSegment
from apps.spots.models import Spot


# ──────────────────────────────────────────────────────────────────────
# 북촌 한옥 골목 — 감고당길 → 북촌8경 → 삼청동 → 정독도서관 루프 (~2.4 km)
# 앵커는 북촌 실제 보행로(감고당길/북촌로/북촌로11길/삼청로) 상의
# 포인트. 골목 폭이 좁아 200m 이상 간격이면 건물을 가로지를 수 있으므로
# 주요 교차점·관광 스팟 중심으로 조밀하게 배치.
# ──────────────────────────────────────────────────────────────────────
BUKCHON_ANCHORS = [
    (37.57617, 126.98549, 30.0, "안국역 3번 출구"),
    (37.57720, 126.98562, 33.0, "안국동사거리 북측"),
    (37.57820, 126.98562, 38.0, "감고당길 초입 (풍문여고 옆)"),
    (37.57900, 126.98515, 44.0, "감고당길 중앙"),
    (37.57985, 126.98455, 52.0, "가회동 11번지 (북촌8경 입구)"),
    (37.58095, 126.98423, 62.0, "북촌8경 — 포토 포인트"),
    (37.58170, 126.98470, 70.0, "북촌로 11길 (경사 정점)"),
    (37.58230, 126.98540, 72.0, "북촌로 오름 끝 (전망 포인트)"),
    (37.58280, 126.98440, 68.0, "가회동 주민센터"),
    (37.58320, 126.98310, 62.0, "삼청동길 초입"),
    (37.58390, 126.98215, 58.0, "삼청동 카페거리"),
    (37.58420, 126.98060, 55.0, "삼청파출소 사거리"),
    (37.58345, 126.98085, 50.0, "정독도서관 앞"),
    (37.58200, 126.98105, 42.0, "화동길 내려가는 길"),
    (37.58040, 126.98170, 35.0, "경복궁 담장 (율곡로 교차)"),
    (37.57850, 126.98370, 32.0, "윤보선길 입구"),
    (37.57730, 126.98480, 30.5, "안국역 1번 출구 근처"),
    (37.57617, 126.98549, 30.0, "안국역 3번 출구 (복귀)"),
]

BUKCHON_META = {
    "title": "북촌 한옥 골목 한 바퀴",
    "title_en": "Bukchon Hanok Village Alley Loop",
    "title_ja": "北村韓屋村 路地めぐり",
    "description": (
        "안국역에서 출발해 감고당길·북촌8경·북촌로11길·삼청동 카페거리·"
        "정독도서관을 거쳐 경복궁 담장으로 내려오는 ~2.4km 도심 한옥 산책. "
        "외국인 관광객에게도 가장 인기 있는 서울 대표 도보 코스이며, "
        "오르막이 짧게 있지만 포장된 길이라 운동화만 있으면 충분합니다. "
        "이른 오전(7~9시)에는 사람이 적어 사진 찍기 좋고, 해질녘엔 한옥 지붕 "
        "실루엣이 아름답습니다."
    ),
    "description_en": (
        "A 2.4 km stroll through Seoul's most iconic hanok village. "
        "Starts at Anguk Station, winds up Gamgodang-gil to the famous "
        "Bukchon 8 Scene viewpoint, over the ridge to Samcheong-dong "
        "café street, past Jeongdok Library, and back along the "
        "Gyeongbokgung palace wall."
    ),
    "description_ja": (
        "安国駅から甘古堂キル・北村八景・三清洞カフェ通り・正読図書館・"
        "景福宮の塀を巡る2.4kmの韓屋村散策コース。舗装された路地で歩きやすく、"
        "早朝は静かな撮影時間、夕刻は屋根のシルエットが美しい。"
    ),
    "region": "서울 종로구",
    "country": "KR",
    "trail_type": "urban",
    "difficulty": "easy",
    "walking_surface": "paved",
    "best_season": "all",
    "estimated_minutes": 50,
    "transport_access": (
        "지하철 3호선 안국역 3번 출구 도보 0분 · 경복궁역 도보 10분 · "
        "주차는 강력히 비추(좁은 골목 · 인근 공영주차장 만차 상시)"
    ),
    "cover_image_url": "https://images.unsplash.com/photo-1578986568381-0c3f9f1c7c5a?w=1200&h=800&fit=crop",
    "elevation_gain_hint": 45,
}

BUKCHON_SEGMENTS = [
    (0, 4,   "안국역 3번 출구",   "가회동 11번지",        "감고당길 완만한 오르막"),
    (4, 7,   "가회동 11번지",     "북촌로 11길 정점",     "북촌8경·포토존 + 경사 구간"),
    (7, 11,  "북촌로 11길 정점",  "삼청파출소 사거리",    "북촌 능선 → 삼청동 카페거리"),
    (11, 14, "삼청파출소 사거리", "화동길 내림",          "정독도서관 앞 내리막"),
    (14, 17, "화동길 내림",       "안국역 복귀",          "경복궁 담장 따라 복귀"),
]

BUKCHON_SPOTS = [
    ("start", "안국역 3번 출구", 0.00, 0,
        "지하철 3호선 안국역 3번 출구에서 바로 출발. 횡단보도 건너 감고당길 방향.", ""),
    ("view", "감고당길 중앙", 0.32, 3,
        "풍문여고·덕성여고로 이어지는 깔끔한 은행나무길. 가을이 하이라이트.", ""),
    ("photo", "북촌8경 포토 포인트", 0.72, 5,
        "한옥 지붕 너머 멀리 남산서울타워가 겹치는 북촌 대표 포토존. "
        "관광객 많으니 이른 오전 추천.", ""),
    ("view", "북촌로 11길 전망", 0.98, 7,
        "북촌 최고지점(약 72m). 한옥마을 전체가 한눈에 내려다 보임.", ""),
    ("cafe", "삼청동 카페거리", 1.45, 10,
        "한옥을 개조한 카페·공방·갤러리가 이어지는 거리. 평일 오후가 여유.",
        "한옥카페 추천 — 평균 아메리카노 5,500원"),
    ("rest", "정독도서관 앞마당", 1.78, 12,
        "벤치와 그늘이 많고 화장실·식수대 완비. 중간 휴식 + 조선 왕조 유적.", ""),
    ("photo", "경복궁 담장길", 2.10, 14,
        "율곡로 교차 구간. 경복궁 기와담과 현대 고층빌딩이 한 프레임에.", ""),
    ("end", "안국역 복귀", 2.42, 17,
        "수고하셨어요. 안국역 2/3번 출구로 다시 하차 지점 복귀.", ""),
]

BUKCHON_STAMPS = [
    ("🏯", "북촌8경 포토존",     5, "북촌 대표 뷰 — 한옥 지붕과 남산"),
    ("📚", "정독도서관",         12, "조선 왕족 유적지를 개조한 도서관"),
    ("🌿", "삼청동 카페거리",    10, "한옥 카페 문화 체험"),
    ("👑", "경복궁 담장",        14, "600년 궁궐과 현대 도심의 경계"),
]

BUKCHON_TAGS = ["북촌", "한옥마을", "삼청동", "경복궁", "도심산책", "인생샷", "외국인추천"]


# ──────────────────────────────────────────────────────────────────────
# 한강 반포–뚝섬 리버사이드 ~6 km
# 남단 한강공원 자전거/보행 겸용도 → 성수대교 횡단 → 뚝섬지구
# 앵커는 실제 한강공원 보행로 좌표에 근접. 강변 보행로는 강 곡선을
# 완만히 따라가므로 100~300m 간격 체이닝이 시각적으로 자연스러움.
# ──────────────────────────────────────────────────────────────────────
BANPO_TTUKSEOM_ANCHORS = [
    (37.51220, 126.99665, 8.0,  "반포한강공원 세빛섬 입구"),
    (37.51335, 126.99835, 7.5,  "반포대교 남단 (달빛무지개분수)"),
    (37.51450, 127.00110, 7.0,  "서래섬 접근로"),
    (37.51555, 127.00470, 6.8,  "서빙고 나들목"),
    (37.51700, 127.00920, 6.5,  "한강진 나들목"),
    (37.51830, 127.01380, 6.2,  "동호대교 남단"),
    (37.51950, 127.01890, 6.0,  "금호동 리버사이드"),
    (37.52100, 127.02420, 6.0,  "성수대교 남단 진입"),
    (37.52580, 127.03100, 6.0,  "성수대교 북단 (뚝섬 진입)"),
    (37.52780, 127.03820, 6.0,  "뚝섬한강공원 서측 입구"),
    (37.52900, 127.04650, 6.0,  "자벌레 전망대 (지형체험관)"),
    (37.53040, 127.05500, 6.0,  "뚝섬 수영장 광장"),
    (37.53120, 127.06200, 6.0,  "뚝섬역 8번 출구 접근"),
    (37.53150, 127.06620, 6.5,  "뚝섬유원지역 8번 출구"),
]

BANPO_META = {
    "title": "한강 반포 → 뚝섬 리버사이드 6km",
    "title_en": "Han River: Banpo to Ttukseom Riverside Walk",
    "title_ja": "漢江 盤浦 → ソウル林 リバーサイド 6km",
    "description": (
        "반포한강공원 세빛섬에서 출발해 반포대교 달빛무지개분수·서래섬·"
        "동호대교·성수대교를 건너 뚝섬한강공원·자벌레 전망대·뚝섬유원지역까지 "
        "이어지는 6km 리버사이드 평지 코스. 완벽한 평지이고 모든 구간에 "
        "자전거/보행로가 분리돼 있어 러닝·산책·야경 감상 모두 적합합니다. "
        "해진 직후(19~21시)의 반포대교 무지개분수 + 성수대교 야경이 하이라이트."
    ),
    "description_en": (
        "A 6 km flat riverside walk along the Han River from Banpo "
        "(Sebitseom · Moonlight Rainbow Fountain) eastbound across "
        "Seongsu Bridge to Ttukseom Han River Park and Ttukseom Resort "
        "Station. Fully paved, separated bike/pedestrian path, best "
        "right after sunset."
    ),
    "description_ja": (
        "盤浦漢江公園のセビッ島を出発し、盤浦大橋の月光虹噴水・聖水大橋を"
        "渡ってトゥクソム漢江公園・トゥクソム遊園地駅に至る6kmの平坦な"
        "リバーサイドコース。歩道と自転車道は完全分離。"
    ),
    "region": "서울 서초구·성동구",
    "country": "KR",
    "trail_type": "river",
    "difficulty": "easy",
    "walking_surface": "paved",
    "best_season": "all",
    "estimated_minutes": 95,
    "transport_access": (
        "출발: 지하철 3/7/9호선 고속터미널역 8-1번 출구 도보 8분 · "
        "도착: 지하철 7호선 뚝섬유원지역 1번 출구 · "
        "편도 이동이라 지하철 복귀 권장"
    ),
    "cover_image_url": "https://images.unsplash.com/photo-1617005082134-5a9e7a56d79f?w=1200&h=800&fit=crop",
    "elevation_gain_hint": 8,
}

BANPO_SEGMENTS = [
    (0, 3,   "반포한강공원 세빛섬", "서빙고 나들목",     "세빛섬 + 무지개분수 + 서래섬 구간"),
    (3, 6,   "서빙고 나들목",       "금호동 리버사이드", "한강진·동호대교 통과 리버사이드"),
    (6, 8,   "금호동 리버사이드",   "성수대교 북단",     "성수대교 횡단 — 북측 스카이라인 뷰"),
    (8, 11,  "성수대교 북단",       "뚝섬 수영장 광장",  "뚝섬한강공원 진입 + 자벌레"),
    (11, 13, "뚝섬 수영장 광장",    "뚝섬유원지역",      "뚝섬유원지 복귀 + 지하철 접속"),
]

BANPO_SPOTS = [
    ("start", "반포한강공원 세빛섬", 0.00, 0,
        "고속터미널역 8-1번 출구에서 한강공원 방면 도보 8분. 세빛섬 안내소 앞 출발.", ""),
    ("view", "반포대교 달빛무지개분수", 0.18, 1,
        "세계 최장 교량분수(≈1140m). 4~10월 일몰 후 매시 정각 운영(20분).", ""),
    ("photo", "서래섬", 0.58, 2,
        "봄엔 유채꽃, 가을엔 코스모스로 덮이는 인공섬. 인생샷 포인트.", ""),
    ("rest", "동호대교 남단 그늘", 2.15, 5,
        "벤치·자판기 · 한강공원 화장실. 리버사이드 중간 휴식점.", ""),
    ("view", "성수대교 횡단 중앙", 3.95, 8,
        "한강 북측 성수동 스카이라인과 멀리 남산이 겹쳐 보이는 뷰.", ""),
    ("cafe", "자벌레 전망대 내부 카페", 4.85, 10,
        "뚝섬한강공원 랜드마크. 예술 설치물 겸 전시공간·카페.",
        "전망층 무료 입장 · 커피 4,800원"),
    ("photo", "뚝섬 수영장 야경", 5.35, 11,
        "여름(7~8월)만 개장하는 야외 수영장. 밤엔 조명이 감성 포인트.", ""),
    ("end", "뚝섬유원지역 8번 출구", 6.20, 13,
        "수고하셨어요. 지하철 7호선으로 반포 복귀 가능.", ""),
]

BANPO_STAMPS = [
    ("🌈", "반포대교 무지개분수",    1, "세계 최장 교량분수"),
    ("🌼", "서래섬",                2, "유채·코스모스 인생샷"),
    ("🌉", "성수대교 횡단",          8, "한강 남북 연결의 뷰 포인트"),
    ("🐛", "자벌레 전망대",          10, "뚝섬의 랜드마크 예술 공간"),
]

BANPO_TAGS = ["한강", "반포", "뚝섬", "리버사이드", "평지", "야경", "러닝"]


# ──────────────────────────────────────────────────────────────────────
# Helpers (shared with seed_showcase_trail.py style)
# ──────────────────────────────────────────────────────────────────────
def _interpolate_path(anchors, samples_per_segment=6):
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


def _cumulative_km(anchors):
    cum = [0.0]
    for i in range(len(anchors) - 1):
        a, b = anchors[i], anchors[i + 1]
        cum.append(cum[-1] + _haversine_km(a[0], a[1], b[0], b[1]))
    return cum


def _create_trail(author, anchors, meta, segments, spots, stamps, tags):
    path_coords = _interpolate_path(anchors, samples_per_segment=6)
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
        title=meta["title"],
        title_en=meta["title_en"],
        title_ja=meta["title_ja"],
        description=meta["description"],
        description_en=meta["description_en"],
        description_ja=meta["description_ja"],
        region=meta["region"],
        country=meta["country"],
        distance_km=Decimal(str(total_km)),
        estimated_minutes=meta["estimated_minutes"],
        difficulty=meta["difficulty"],
        elevation_gain=elevation_gain,
        start_lat=Decimal(str(anchors[0][0])),
        start_lng=Decimal(str(anchors[0][1])),
        end_lat=Decimal(str(anchors[-1][0])),
        end_lng=Decimal(str(anchors[-1][1])),
        path_data={"type": "LineString", "coordinates": path_coords},
        thumbnail_url=meta["cover_image_url"],
        trail_type=meta["trail_type"],
        best_season=meta["best_season"],
        walking_surface=meta["walking_surface"],
        transport_access=meta["transport_access"],
        status="approved",
        visibility="public",
        is_official=True,
        source="moru_curated",
        source_url="",
    )

    for name in tags:
        tag, _ = Tag.objects.get_or_create(name=name)
        trail.tags.add(tag)

    anchor_cum = _cumulative_km(anchors)
    for order, (s_idx, e_idx, s_name, e_name, _desc) in enumerate(segments):
        km = anchor_cum[e_idx] - anchor_cum[s_idx]
        TrailSegment.objects.create(
            trail=trail,
            order=order,
            start_name=s_name,
            end_name=e_name,
            distance_km=Decimal(str(round(km, 2))),
            duration_minutes=max(5, int(round(km * 17))),  # 3.5 km/h ≈ 17 min/km
        )

    for i, (stype, name, dist_km, anchor_idx, desc, menu) in enumerate(spots):
        a = anchors[anchor_idx]
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

    for i, (emoji, name, anchor_idx, desc) in enumerate(stamps):
        a = anchors[anchor_idx]
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
    return trail, total_km, len(path_coords)


# ──────────────────────────────────────────────────────────────────────
# Command
# ──────────────────────────────────────────────────────────────────────
class Command(BaseCommand):
    help = "Create the beta showcase trail pack — 북촌 한옥 골목 + 한강 반포→뚝섬."

    PACK = [
        dict(
            key="bukchon",
            anchors=BUKCHON_ANCHORS,
            meta=BUKCHON_META,
            segments=BUKCHON_SEGMENTS,
            spots=BUKCHON_SPOTS,
            stamps=BUKCHON_STAMPS,
            tags=BUKCHON_TAGS,
        ),
        dict(
            key="banpo_ttukseom",
            anchors=BANPO_TTUKSEOM_ANCHORS,
            meta=BANPO_META,
            segments=BANPO_SEGMENTS,
            spots=BANPO_SPOTS,
            stamps=BANPO_STAMPS,
            tags=BANPO_TAGS,
        ),
    ]

    def add_arguments(self, parser):
        parser.add_argument(
            "--force", action="store_true",
            help="Delete and recreate existing 북촌/반포 showcase rows.",
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

        created = 0
        skipped = 0
        for entry in self.PACK:
            meta = entry["meta"]
            title = meta["title"]
            existing = Trail.objects.filter(
                source="moru_curated", title=title,
            ).first()
            if existing:
                if not force:
                    self.stdout.write(self.style.WARNING(
                        f"  · '{title}' already exists (id={existing.pk}) — skipping"
                    ))
                    skipped += 1
                    continue
                existing.delete()
                self.stdout.write(self.style.NOTICE(
                    f"  ✖ deleted previous '{title}'"
                ))

            trail, total_km, n_pts = _create_trail(
                author=author,
                anchors=entry["anchors"],
                meta=meta,
                segments=entry["segments"],
                spots=entry["spots"],
                stamps=entry["stamps"],
                tags=entry["tags"],
            )
            created += 1
            self.stdout.write(self.style.SUCCESS(
                f"  ✓ '{title}' (id={trail.pk}, {total_km}km, {n_pts}pts)"
            ))

        self.stdout.write(self.style.SUCCESS(
            f"\n✓ showcase pack created — {created} new / {skipped} skipped"
        ))
