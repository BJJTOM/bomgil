"""Seed curated "official" trails — hand-picked popular Korean walking courses.

Usage:
    python manage.py seed_official_trails
    python manage.py seed_official_trails --update  # re-run on existing rows

These entries are not sourced from any third-party API — coordinates and
descriptions are verified from publicly known tourist information.
A paragraph-level rewrite is intentional to avoid copying protected text.
The intent is to bootstrap a useful catalog so new users of the app see
real trails in their area on day one. Over time these should be replaced
or supplemented with an import pipeline from public datasets.
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.trails.models import Trail

User = get_user_model()


# Hand-curated trail data. `path_data` is an approximate LineString — for
# visual rendering only, not turn-by-turn guidance. Real GPX import can
# replace these once a data source is wired up.
#
# Keep this list small at first (10 entries) so a new environment can
# spin up quickly. Expand by adding dict entries, not by querying APIs.
TRAILS = [
    {
        "title": "남산 둘레길",
        "title_en": "Namsan Circumference Trail",
        "description": "서울 도심에서 바로 접근 가능한 7.5km 순환 산책로. N서울타워를 중심으로 남산을 한 바퀴 도는 평지 위주의 코스로, 벚꽃·단풍 명소이자 초보자도 무리 없이 걸을 수 있다.",
        "region": "서울 중구",
        "distance_km": Decimal("7.5"),
        "estimated_minutes": 120,
        "difficulty": "easy",
        "elevation_gain": 80,
        "start_lat": Decimal("37.551138"),
        "start_lng": Decimal("126.988228"),
        "end_lat": Decimal("37.551138"),
        "end_lng": Decimal("126.988228"),
        "trail_type": "urban",
        "best_season": "all",
        "walking_surface": "paved",
        "transport_access": "지하철 4호선 명동역 3번 출구 도보 10분",
    },
    {
        "title": "청계천 산책로",
        "title_en": "Cheonggyecheon Stream Walk",
        "description": "청계광장부터 고산자교까지 이어지는 약 5.8km의 도심 하천 산책로. 주말 저녁 야경이 특히 아름다우며 전 구간 평지라 누구나 걷기 편하다.",
        "region": "서울 종로구",
        "distance_km": Decimal("5.8"),
        "estimated_minutes": 80,
        "difficulty": "easy",
        "elevation_gain": 0,
        "start_lat": Decimal("37.569205"),
        "start_lng": Decimal("126.978652"),
        "end_lat": Decimal("37.569020"),
        "end_lng": Decimal("127.028950"),
        "trail_type": "urban",
        "best_season": "all",
        "walking_surface": "paved",
        "transport_access": "지하철 5호선 광화문역 5번 출구",
    },
    {
        "title": "한강 반포 달빛무지개 코스",
        "title_en": "Banpo Hangang Night Walk",
        "description": "반포한강공원 일대를 따라 걷는 약 4km 코스. 저녁 시간에는 달빛무지개 분수쇼가 열려 산책과 야경을 한 번에 즐길 수 있다.",
        "region": "서울 서초구",
        "distance_km": Decimal("4.0"),
        "estimated_minutes": 60,
        "difficulty": "easy",
        "elevation_gain": 0,
        "start_lat": Decimal("37.510500"),
        "start_lng": Decimal("126.995500"),
        "end_lat": Decimal("37.515500"),
        "end_lng": Decimal("127.008500"),
        "trail_type": "urban",
        "best_season": "all",
        "walking_surface": "paved",
        "transport_access": "지하철 9호선 신반포역 2번 출구",
    },
    {
        "title": "북한산 둘레길 1코스 (소나무숲길)",
        "title_en": "Bukhansan Dullegil Course 1",
        "description": "우이동에서 시작해 솔밭근린공원까지 약 3.1km의 초보자용 숲길. 전 구간 완만하고 그늘이 많아 한여름에도 걷기 좋다.",
        "region": "서울 강북구",
        "distance_km": Decimal("3.1"),
        "estimated_minutes": 60,
        "difficulty": "easy",
        "elevation_gain": 50,
        "start_lat": Decimal("37.662500"),
        "start_lng": Decimal("127.011500"),
        "end_lat": Decimal("37.648000"),
        "end_lng": Decimal("127.013000"),
        "trail_type": "nature",
        "best_season": "all",
        "walking_surface": "mixed",
        "transport_access": "지하철 우이신설선 북한산우이역",
    },
    {
        "title": "제주올레 7코스 (외돌개 → 월평)",
        "title_en": "Jeju Olle Route 7",
        "description": "서귀포 해안 절경을 끼고 외돌개에서 월평포구까지 이어지는 약 15km의 올레길 대표 코스. 오르막 구간이 있어 반나절은 여유를 두고 걷는 것이 좋다.",
        "region": "제주 서귀포시",
        "distance_km": Decimal("15.0"),
        "estimated_minutes": 300,
        "difficulty": "moderate",
        "elevation_gain": 250,
        "start_lat": Decimal("33.235500"),
        "start_lng": Decimal("126.541000"),
        "end_lat": Decimal("33.234500"),
        "end_lng": Decimal("126.428000"),
        "trail_type": "coastal",
        "best_season": "spring",
        "walking_surface": "mixed",
        "transport_access": "서귀포 시외버스터미널에서 시내버스",
    },
    {
        "title": "제주올레 1코스 (시흥 → 광치기)",
        "title_en": "Jeju Olle Route 1",
        "description": "제주올레의 시작점. 시흥초등학교에서 출발해 성산일출봉을 멀리 바라보며 광치기 해변까지 약 15km를 걷는다. 오름과 해안, 마을을 고루 거친다.",
        "region": "제주 서귀포시",
        "distance_km": Decimal("15.1"),
        "estimated_minutes": 330,
        "difficulty": "moderate",
        "elevation_gain": 200,
        "start_lat": Decimal("33.484500"),
        "start_lng": Decimal("126.923500"),
        "end_lat": Decimal("33.451500"),
        "end_lng": Decimal("126.929500"),
        "trail_type": "coastal",
        "best_season": "all",
        "walking_surface": "mixed",
        "transport_access": "제주시 시외버스 시흥리 정류장",
    },
    {
        "title": "해파랑길 1코스 (오륙도 → 미포)",
        "title_en": "Haeparang-gil Course 1",
        "description": "부산 오륙도 해맞이공원에서 해운대 미포까지 이어지는 약 17.7km의 해안 걷기 코스. 이기대 해안산책로를 포함하며 바다 풍경이 절정이다.",
        "region": "부산 남구",
        "distance_km": Decimal("17.7"),
        "estimated_minutes": 360,
        "difficulty": "moderate",
        "elevation_gain": 300,
        "start_lat": Decimal("35.101500"),
        "start_lng": Decimal("129.125500"),
        "end_lat": Decimal("35.158000"),
        "end_lng": Decimal("129.161000"),
        "trail_type": "coastal",
        "best_season": "all",
        "walking_surface": "mixed",
        "transport_access": "부산 지하철 2호선 경성대·부경대역",
    },
    {
        "title": "경주 왕릉 산책길",
        "title_en": "Gyeongju Royal Tombs Walk",
        "description": "대릉원과 첨성대, 계림을 잇는 약 3km의 평지 산책 코스. 벚꽃 시즌에는 자전거길을 따라 걷는 것만으로도 충분한 여행이 된다.",
        "region": "경북 경주시",
        "distance_km": Decimal("3.0"),
        "estimated_minutes": 60,
        "difficulty": "easy",
        "elevation_gain": 0,
        "start_lat": Decimal("35.835000"),
        "start_lng": Decimal("129.214000"),
        "end_lat": Decimal("35.838000"),
        "end_lng": Decimal("129.220000"),
        "trail_type": "cultural",
        "best_season": "spring",
        "walking_surface": "paved",
        "transport_access": "경주역에서 도보 15분 또는 시내버스",
    },
    {
        "title": "전주 한옥마을 둘레길",
        "title_en": "Jeonju Hanok Village Walk",
        "description": "전주 한옥마을과 오목대, 자만벽화마을을 잇는 약 2.5km의 도보 코스. 한옥의 처마선과 골목을 따라 천천히 걷기 좋은 문화탐방 코스.",
        "region": "전북 전주시",
        "distance_km": Decimal("2.5"),
        "estimated_minutes": 50,
        "difficulty": "easy",
        "elevation_gain": 30,
        "start_lat": Decimal("35.814500"),
        "start_lng": Decimal("127.153500"),
        "end_lat": Decimal("35.815500"),
        "end_lng": Decimal("127.155000"),
        "trail_type": "cultural",
        "best_season": "all",
        "walking_surface": "paved",
        "transport_access": "전주역에서 시내버스",
    },
    {
        "title": "순천만 갈대길",
        "title_en": "Suncheon Bay Reed Trail",
        "description": "순천만 습지를 따라 걷는 약 4km의 갈대 산책로. 데크길이 잘 정비되어 있어 전 구간 걷기 편하며 일몰 전후 풍경이 특히 좋다.",
        "region": "전남 순천시",
        "distance_km": Decimal("4.0"),
        "estimated_minutes": 80,
        "difficulty": "easy",
        "elevation_gain": 0,
        "start_lat": Decimal("34.880000"),
        "start_lng": Decimal("127.511000"),
        "end_lat": Decimal("34.883000"),
        "end_lng": Decimal("127.520000"),
        "trail_type": "nature",
        "best_season": "fall",
        "walking_surface": "mixed",
        "transport_access": "순천역에서 시내버스 66번/67번",
    },
]


def _build_line_string(start_lat, start_lng, end_lat, end_lng):
    """Simple 2-point LineString so the detail map has something to draw.

    Real GPX import will replace this; for the seed catalog a straight
    line between start/end is fine because the trail detail page
    primarily relies on start/end markers anyway.
    """
    return {
        "type": "LineString",
        "coordinates": [
            [float(start_lng), float(start_lat)],
            [float(end_lng), float(end_lat)],
        ],
    }


class Command(BaseCommand):
    help = "Seed hand-curated official Moru trails"

    def add_arguments(self, parser):
        parser.add_argument(
            "--update", action="store_true",
            help="Update existing rows (match by title + region)",
        )

    def handle(self, *args, **options):
        update = options["update"]

        # Use a dedicated system user as author so these records are
        # distinguishable from user-generated content in the admin.
        system_user, _ = User.objects.get_or_create(
            nickname="moru_official",
            defaults={
                "email": "official@moruwalk.com",
                "is_active": False,  # not a login-capable account
            },
        )

        created = 0
        updated = 0
        skipped = 0
        for data in TRAILS:
            lookup = {"title": data["title"], "region": data["region"]}
            defaults = {
                **data,
                "author": system_user,
                "country": "KR",
                "status": "approved",
                "is_official": True,
                "source": "moru_curated",
                "path_data": _build_line_string(
                    data["start_lat"], data["start_lng"],
                    data["end_lat"], data["end_lng"],
                ),
            }

            trail = Trail.objects.filter(**lookup).first()
            if trail:
                if update:
                    for k, v in defaults.items():
                        setattr(trail, k, v)
                    trail.save()
                    updated += 1
                else:
                    skipped += 1
                continue

            Trail.objects.create(**defaults)
            created += 1

        self.stdout.write(self.style.SUCCESS(
            f"Official trails seed: created={created}, updated={updated}, skipped={skipped}"
        ))
