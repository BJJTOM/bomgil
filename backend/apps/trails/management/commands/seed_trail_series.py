"""Seed curated TrailSeries from the existing official trail catalog.

Run AFTER `import_durunubi_trails` -- this command looks up trails by
title and groups them. Trails that don't exist yet are silently
skipped, so the command is idempotent: re-running after new seeds
ship just adds the missing segments.

The Durunubi API names trails with a consistent scheme:
  해파랑길 01코스, 남파랑길 23코스, 서해랑길 05코스, DMZ 평화의 길 01코스
This seed file references those exact titles.

Usage:
    python manage.py seed_trail_series
    python manage.py seed_trail_series --reset  # delete + recreate
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.trails.models import Trail, TrailSeries, TrailSeriesTrail


# Each series is a dict with slug, title, title_en, subtitle,
# description, region, emoji, sort_order, featured, and segments
# (list of (segment_label, trail_title) pairs). Trail titles must
# match the exact titles produced by import_durunubi_trails.

SERIES = [
    # ── Korean national trails (Durunubi source) ──────────
    {
        "slug": "namparang-best-5",
        "title": "남파랑길 베스트 5코스",
        "title_en": "Namparang Best 5",
        "subtitle": "남해안의 절경을 따라 걷는 대표 5개 코스",
        "description": (
            "부산에서 해남까지 이어지는 남파랑길 90개 구간 중 풍경, "
            "접근성, 난이도를 기준으로 엄선한 5개 코스입니다. 쪽빛 남해 "
            "바다를 곁에 두고 해안 절벽, 어촌 마을, 동백숲을 지나는 "
            "구간들로 구성되어 있습니다. 남해안의 아름다움을 가장 밀도 "
            "있게 경험할 수 있는 시리즈입니다."
        ),
        "region": "남해안",
        "emoji": "🌅",
        "sort_order": 10,
        "featured": True,
        "segments": [
            ("01코스", "남파랑길 01코스"),
            ("05코스", "남파랑길 05코스"),
            ("12코스", "남파랑길 12코스"),
            ("23코스", "남파랑길 23코스"),
            ("45코스", "남파랑길 45코스"),
        ],
    },
    {
        "slug": "haeparang-starter-3",
        "title": "해파랑길 입문 3코스",
        "title_en": "Haeparang Starter 3",
        "subtitle": "동해안 걷기의 첫걸음, 가장 쉽고 아름다운 3개 코스",
        "description": (
            "부산 오륙도에서 강원 고성까지 770km를 잇는 해파랑길. "
            "그중 초보자도 부담 없이 걸을 수 있고 동해 바다의 매력을 "
            "가장 잘 느낄 수 있는 3개 코스를 골랐습니다. 해안 절벽 "
            "위의 산책로, 탁 트인 백사장, 어촌 마을의 정취를 한 번에 "
            "경험할 수 있습니다."
        ),
        "region": "동해안",
        "emoji": "🌊",
        "sort_order": 20,
        "featured": True,
        "segments": [
            ("01코스", "해파랑길 01코스"),
            ("02코스", "해파랑길 02코스"),
            ("03코스", "해파랑길 03코스"),
        ],
    },
    {
        "slug": "seoharang-highlights-5",
        "title": "서해랑길 하이라이트 5코스",
        "title_en": "Seoharang Highlights 5",
        "subtitle": "서해안의 갯벌과 낙조를 만끽하는 5개 코스",
        "description": (
            "인천에서 해남까지 서해안을 따라 이어지는 서해랑길. "
            "광활한 갯벌, 소금밭, 염전 마을, 그리고 서해의 장엄한 "
            "일몰을 감상할 수 있는 구간들을 모았습니다. 동해안과는 "
            "전혀 다른 서해안만의 여유로운 걷기를 경험해보세요."
        ),
        "region": "서해안",
        "emoji": "🌾",
        "sort_order": 30,
        "featured": True,
        "segments": [
            ("01코스", "서해랑길 01코스"),
            ("05코스", "서해랑길 05코스"),
            ("10코스", "서해랑길 10코스"),
            ("15코스", "서해랑길 15코스"),
            ("20코스", "서해랑길 20코스"),
        ],
    },
    {
        "slug": "dmz-peace-trail",
        "title": "DMZ 평화의 길",
        "title_en": "DMZ Peace Trail",
        "subtitle": "분단의 역사와 자연이 공존하는 비무장지대 걷기",
        "description": (
            "민간인 통제구역 안쪽, 수십 년간 사람의 발길이 닿지 않아 "
            "원시 자연이 살아 있는 DMZ 평화의 길. 철원, 파주, 고성 등 "
            "접경 지역의 코스를 걸으며 분단의 역사를 되새기고, 자연이 "
            "되찾은 생태계를 눈으로 확인할 수 있습니다. 사전 예약이 "
            "필요한 특별한 걷기 코스입니다."
        ),
        "region": "접경지역",
        "emoji": "🕊",
        "sort_order": 40,
        "featured": True,
        "segments": [
            ("01코스", "DMZ 평화의 길 01코스"),
            ("02코스", "DMZ 평화의 길 02코스"),
            ("03코스", "DMZ 평화의 길 03코스"),
            ("04코스", "DMZ 평화의 길 04코스"),
            ("05코스", "DMZ 평화의 길 05코스"),
        ],
    },
    {
        "slug": "haeparang-east-coast-10",
        "title": "해파랑길 동해안 종주 10코스",
        "title_en": "Haeparang East Coast 10",
        "subtitle": "해파랑길의 핵심 구간 10개를 연속으로 걷는 도전 코스",
        "description": (
            "해파랑길 770km 중 부산에서 울산, 경주를 지나 포항까지 "
            "이어지는 핵심 10개 구간입니다. 해안 절벽, 몽돌 해변, "
            "등대, 어촌 마을을 두루 지나며 동해안의 진수를 만끽할 수 "
            "있습니다. 주말마다 1~2코스씩 걸으며 도전해보세요."
        ),
        "region": "동해안",
        "emoji": "🏔",
        "sort_order": 50,
        "featured": False,
        "segments": [
            ("01코스", "해파랑길 01코스"),
            ("02코스", "해파랑길 02코스"),
            ("03코스", "해파랑길 03코스"),
            ("04코스", "해파랑길 04코스"),
            ("05코스", "해파랑길 05코스"),
            ("06코스", "해파랑길 06코스"),
            ("07코스", "해파랑길 07코스"),
            ("08코스", "해파랑길 08코스"),
            ("09코스", "해파랑길 09코스"),
            ("10코스", "해파랑길 10코스"),
        ],
    },
    {
        "slug": "namparang-south-coast-10",
        "title": "남파랑길 남해안 종주 10코스",
        "title_en": "Namparang South Coast 10",
        "subtitle": "남파랑길 초반 10개 구간을 연속으로 걷는 도전 코스",
        "description": (
            "부산 오륙도해맞이공원에서 시작해 남해안을 따라 서쪽으로 "
            "향하는 남파랑길 초반 10개 구간입니다. 부산의 도심 해안부터 "
            "거제, 통영의 한려해상 풍경까지 남해안의 다채로운 매력을 "
            "체험할 수 있습니다."
        ),
        "region": "남해안",
        "emoji": "🐚",
        "sort_order": 60,
        "featured": False,
        "segments": [
            ("01코스", "남파랑길 01코스"),
            ("02코스", "남파랑길 02코스"),
            ("03코스", "남파랑길 03코스"),
            ("04코스", "남파랑길 04코스"),
            ("05코스", "남파랑길 05코스"),
            ("06코스", "남파랑길 06코스"),
            ("07코스", "남파랑길 07코스"),
            ("08코스", "남파랑길 08코스"),
            ("09코스", "남파랑길 09코스"),
            ("10코스", "남파랑길 10코스"),
        ],
    },
    {
        "slug": "korea-perimeter-trail",
        "title": "코리아둘레길 입문 5코스",
        "title_en": "Korea Perimeter Starter 5",
        "subtitle": "대한민국 한 바퀴를 잇는 코리아둘레길 입문 구간",
        "description": (
            "해파랑길, 남파랑길, 서해랑길, DMZ 평화의 길을 모두 잇는 "
            "코리아둘레길 4,500km 중 걷기 좋은 입문 구간 5개를 "
            "선별했습니다. 대한민국 해안과 접경 지역을 한 바퀴 도는 "
            "대장정의 맛보기로, 각 구간은 당일 완주가 가능한 거리입니다."
        ),
        "region": "전국",
        "emoji": "🇰🇷",
        "sort_order": 70,
        "featured": False,
        "segments": [
            ("1구간", "코리아둘레길 서울 01코스"),
            ("2구간", "코리아둘레길 서울 02코스"),
            ("3구간", "코리아둘레길 서울 03코스"),
            ("4구간", "코리아둘레길 서울 04코스"),
            ("5구간", "코리아둘레길 서울 05코스"),
        ],
    },
    {
        "slug": "jirisan-dullegil",
        "title": "지리산둘레길 체험 3코스",
        "title_en": "Jirisan Dullegil 3",
        "subtitle": "지리산 자락을 감싸 도는 마을길 3개 코스",
        "description": (
            "지리산 둘레 300km를 잇는 지리산둘레길 중 접근이 쉽고 "
            "마을의 정취가 가장 좋은 3개 코스를 골랐습니다. 산골 마을 "
            "사이 오솔길, 대나무숲, 차밭, 계곡을 걸으며 지리산 "
            "자락의 고즈넉한 풍경을 즐길 수 있습니다."
        ),
        "region": "지리산",
        "emoji": "🌲",
        "sort_order": 80,
        "featured": False,
        "segments": [
            ("01코스", "지리산둘레길 01코스"),
            ("02코스", "지리산둘레길 02코스"),
            ("03코스", "지리산둘레길 03코스"),
        ],
    },
    # ── Non-Durunubi series (kept from original seed) ──────
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
        "sort_order": 100,
        "featured": False,
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
        "sort_order": 110,
        "featured": False,
        "segments": [
            ("1코스", "제주올레 1코스 (시흥 → 광치기)"),
            ("7코스", "제주올레 7코스 (외돌개 → 월평)"),
            ("8코스", "제주올레 8코스 (월평 → 대평)"),
            ("10코스", "제주올레 10코스 (화순 → 모슬포)"),
            ("21코스", "제주올레 21코스 (하도 → 종달)"),
        ],
    },
    {
        "slug": "heritage-walks",
        "title": "역사와 마을 5코스",
        "title_en": "Heritage & Village 5 Walks",
        "subtitle": "옛 마을, 한옥, 왕릉을 잇는 문화 테마 걷기",
        "description": (
            "경주의 왕릉, 전주 한옥마을, 안동 하회마을, 담양 메타세쿼이아길, "
            "통영 동피랑까지 -- 한국의 문화 유산과 마을 풍경을 따라 걷는 "
            "테마 시리즈. 짧지만 밀도 있는 코스가 모여 있어 주말 당일치기 "
            "여행으로 이어가기 좋습니다."
        ),
        "region": "전국",
        "emoji": "🏯",
        "sort_order": 120,
        "featured": False,
        "segments": [
            ("1", "경주 왕릉 산책길"),
            ("2", "전주 한옥마을 둘레길"),
            ("3", "안동 하회마을 둘레길"),
            ("4", "담양 메타세쿼이아길"),
            ("5", "통영 동피랑 벽화마을길"),
        ],
    },
    # ── Asia series (kept from original seed) ──────
    {
        "slug": "kyoto-walks",
        "title": "교토 산책 시리즈",
        "title_en": "Kyoto Walking Series",
        "subtitle": "천년 고도 교토의 사찰과 골목을 걷는 시리즈",
        "description": (
            "일본 교토의 대표 산책 코스 5개를 묶은 시리즈입니다. "
            "철학의 길에서 시작해 기온의 등불 골목, 후시미이나리의 "
            "붉은 도리이, 아라시야마의 대나무숲, 히가시야마의 돌계단 "
            "골목까지 -- 천 년 고도를 걸으며 교토의 사계절을 느낄 수 "
            "있습니다."
        ),
        "region": "Kyoto, Japan",
        "emoji": "🏯",
        "sort_order": 200,
        "featured": False,
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
            "전망 하이킹까지 -- 타이베이를 발로 느끼는 가장 좋은 "
            "방법입니다."
        ),
        "region": "Taipei, Taiwan",
        "emoji": "🏮",
        "sort_order": 210,
        "featured": False,
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
            "님만해민의 카페 문화까지 -- 태국의 밤을 걸으며 현지 감각을 "
            "경험할 수 있습니다."
        ),
        "region": "Bangkok & Chiang Mai, Thailand",
        "emoji": "🌙",
        "sort_order": 220,
        "featured": False,
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
        linked_trails = 0

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

            # Rebuild memberships -- simpler than diffing
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
                linked_trails += 1

        self.stdout.write(self.style.SUCCESS(
            f"Trail series seed: created={created}, updated={updated}, "
            f"linked_trails={linked_trails}, skipped_trails={skipped_trails}"
        ))
