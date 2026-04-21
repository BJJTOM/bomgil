"""Seed curated TrailSeries from the existing official trail catalog.

Run AFTER `seed_official_trails` — this command looks up trails by
title and groups them. Trails that don't exist yet are silently
skipped, so the command is idempotent: re-running after new seeds
ship just adds the missing segments.

Usage:
    python manage.py seed_trail_series
    python manage.py seed_trail_series --reset  # delete + recreate
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.trails.models import Trail, TrailSeries, TrailSeriesTrail


# Each series is (slug, title, title_en, subtitle, description, region,
# emoji, sort_order, is_featured, [(segment_label, trail_title), ...])
SERIES = [
    {
        "slug": "seoul-city-walk",
        "title": "서울 도심 6코스",
        "title_en": "Seoul City 6 Walks",
        "subtitle": "지하철만 타면 닿는 도심 대표 산책 6개 코스 모음",
        "description": (
            "서울에서 가장 쉽게 접근할 수 있는 도심 산책 코스 6개를 하나의 "
            "챌린지로 묶었습니다. 첫 산책을 시작하는 사람도 지하철 한 번이면 "
            "닿을 수 있고, 한 코스당 30분에서 2시간이면 완주할 수 있습니다. "
            "6개를 모두 걷고 나면 서울의 분위기를 사계절 내내 다르게 느끼게 "
            "됩니다."
        ),
        "region": "서울",
        "emoji": "🏙",
        "sort_order": 10,
        "featured": True,
        "segments": [
            ("1코스", "남산 둘레길"),
            ("2코스", "청계천 산책로"),
            ("3코스", "한강 반포 달빛무지개 코스"),
            ("4코스", "서울숲 산책로"),
            ("5코스", "올림픽공원 둘레길"),
            ("6코스", "서울로 7017"),
        ],
    },
    {
        "slug": "jeju-olle-highlights",
        "title": "제주올레 대표 5코스",
        "title_en": "Jeju Olle Highlights",
        "subtitle": "제주올레 425km 중 가장 널리 알려진 5개 코스",
        "description": (
            "제주도 한 바퀴를 잇는 제주올레 전체 26개 코스 중 풍경·접근성·"
            "상징성을 기준으로 고른 대표 5개 코스입니다. 1코스의 시흥에서 "
            "시작해 7·8·10코스의 해안선을 지나 마지막 21코스의 종달까지, "
            "제주의 남·북·동·서를 고루 맛볼 수 있는 구성입니다."
        ),
        "region": "제주",
        "emoji": "🏝",
        "sort_order": 20,
        "featured": True,
        "segments": [
            ("1코스", "제주올레 1코스 (시흥 → 광치기)"),
            ("7코스", "제주올레 7코스 (외돌개 → 월평)"),
            ("8코스", "제주올레 8코스 (월평 → 대평)"),
            ("10코스", "제주올레 10코스 (화순 → 모슬포)"),
            ("21코스", "제주올레 21코스 (하도 → 종달)"),
        ],
    },
    {
        "slug": "east-coast-starter",
        "title": "동해안 첫 걷기 3코스",
        "title_en": "East Coast Starter Pack",
        "subtitle": "해파랑길과 강원 해안 산책을 잇는 동해 입문 3코스",
        "description": (
            "한 번에 해파랑길 770km를 걷긴 어려워도, 동해의 핵심 해안을 "
            "가볍게 체험할 수 있는 3개 코스를 모았습니다. 부산 오륙도에서 "
            "시작해 강원 속초·강릉까지, 동해를 따라 북상하는 여정의 "
            "시작점이 될 수 있습니다."
        ),
        "region": "동해",
        "emoji": "🌊",
        "sort_order": 30,
        "featured": True,
        "segments": [
            ("1", "해파랑길 1코스 (오륙도 → 미포)"),
            ("2", "속초 외옹치 바다향기로"),
            ("3", "강릉 경포호 둘레길"),
        ],
    },
    {
        "slug": "heritage-walks",
        "title": "역사와 마을 5코스",
        "title_en": "Heritage & Village 5 Walks",
        "subtitle": "옛 마을, 한옥, 왕릉을 잇는 문화 테마 걷기",
        "description": (
            "경주의 왕릉, 전주 한옥마을, 안동 하회마을, 담양 메타세쿼이아길, "
            "통영 동피랑까지 — 한국의 문화 유산과 마을 풍경을 따라 걷는 "
            "테마 시리즈. 짧지만 밀도 있는 코스가 모여 있어 주말 당일치기 "
            "여행으로 이어가기 좋습니다."
        ),
        "region": "전국",
        "emoji": "🏯",
        "sort_order": 40,
        "featured": False,
        "segments": [
            ("1", "경주 왕릉 산책길"),
            ("2", "전주 한옥마을 둘레길"),
            ("3", "안동 하회마을 둘레길"),
            ("4", "담양 메타세쿼이아길"),
            ("5", "통영 동피랑 벽화마을길"),
        ],
    },
    # --- ASIA SERIES ---
    {
        "slug": "kyoto-walks",
        "title": "교토 산책 시리즈",
        "title_en": "Kyoto Walking Series",
        "subtitle": "천년 고도 교토의 사찰과 골목을 걷는 시리즈",
        "description": (
            "일본 교토의 대표 산책 코스 5개를 묶은 시리즈입니다. "
            "철학의 길에서 시작해 기온의 등불 골목, 후시미이나리의 "
            "붉은 도리이, 아라시야마의 대나무숲, 히가시야마의 돌계단 "
            "골목까지 — 천 년 고도를 걸으며 교토의 사계절을 느낄 수 "
            "있습니다."
        ),
        "region": "Kyoto, Japan",
        "emoji": "🏯",
        "sort_order": 50,
        "featured": True,
        "segments": [
            ("1코스", "철학의 길"),
            ("2코스", "기온 거리 산책"),
            ("3코스", "후시미이나리 등산로"),
            ("4코스", "아라시야마 대나무숲 코스"),
            ("5코스", "히가시야마 산책"),
        ],
    },
    {
        "slug": "taipei-alleys",
        "title": "타이베이 골목 시리즈",
        "title_en": "Taipei Alley Series",
        "subtitle": "타이베이 옛 골목과 야시장을 걷는 시리즈",
        "description": (
            "타이베이와 근교의 매력적인 골목과 산책로 5곳을 묶은 "
            "시리즈입니다. 지우펀의 홍등 골목, 디화제의 바로크 건물, "
            "단수이의 석양 산책로, 시먼딩의 야간 네온, 샹산의 도심 "
            "전망 하이킹까지 — 타이베이를 발로 느끼는 가장 좋은 "
            "방법입니다."
        ),
        "region": "Taipei, Taiwan",
        "emoji": "🏮",
        "sort_order": 60,
        "featured": True,
        "segments": [
            ("1코스", "지우펀 올드 스트리트"),
            ("2코스", "디화제 역사거리"),
            ("3코스", "단수이 해안 산책"),
            ("4코스", "시먼딩 → 용캉제 야간 산책"),
            ("5코스", "샹산 하이킹"),
        ],
    },
    {
        "slug": "thailand-night-walks",
        "title": "방콕·치앙마이 야시장 산책 시리즈",
        "title_en": "Bangkok & Chiang Mai Night Walk Series",
        "subtitle": "태국의 활기찬 야시장과 사원을 걷는 야간 산책 시리즈",
        "description": (
            "방콕과 치앙마이의 야간 산책 코스 5개를 묶은 시리즈입니다. "
            "카오산 로드의 배낭여행자 거리, 야워랏의 차이나타운 야경, "
            "치앙마이 올드시티의 란나 사원, 선데이 마켓의 수공예품 골목, "
            "님만해민의 카페 문화까지 — 태국의 밤을 걸으며 현지 감각을 "
            "경험할 수 있습니다."
        ),
        "region": "Bangkok & Chiang Mai, Thailand",
        "emoji": "🌙",
        "sort_order": 70,
        "featured": True,
        "segments": [
            ("1코스", "카오산 로드 → 왕궁 산책"),
            ("2코스", "차이나타운 야워랏 야간 산책"),
            ("3코스", "치앙마이 올드시티 사원 순례"),
            ("4코스", "치앙마이 선데이 마켓 코스"),
            ("5코스", "님만해민 카페거리 산책"),
        ],
    },
]


class Command(BaseCommand):
    help = "Seed curated TrailSeries from existing official trails"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset", action="store_true",
            help="Delete existing series with matching slugs first",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        reset = options["reset"]
        created = 0
        updated = 0
        skipped_trails = 0

        for spec in SERIES:
            if reset:
                TrailSeries.objects.filter(slug=spec["slug"]).delete()

            series, was_created = TrailSeries.objects.update_or_create(
                slug=spec["slug"],
                defaults={
                    "title": spec["title"],
                    "title_en": spec["title_en"],
                    "subtitle": spec["subtitle"],
                    "description": spec["description"],
                    "region": spec["region"],
                    "accent_emoji": spec["emoji"],
                    "sort_order": spec["sort_order"],
                    "is_featured": spec["featured"],
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1

            # Rebuild memberships — simpler than diffing
            series.memberships.all().delete()
            for idx, (label, trail_title) in enumerate(spec["segments"]):
                trail = Trail.objects.filter(title=trail_title).first()
                if not trail:
                    skipped_trails += 1
                    self.stdout.write(self.style.WARNING(
                        f"  skip: trail not found '{trail_title}'"
                    ))
                    continue
                TrailSeriesTrail.objects.create(
                    series=series,
                    trail=trail,
                    order=idx,
                    segment_label=label,
                )

        self.stdout.write(self.style.SUCCESS(
            f"Trail series seed: created={created}, updated={updated}, "
            f"skipped_trails={skipped_trails}"
        ))
