import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.accounts.models import CustomUser
from apps.reviews.models import Review
from apps.spots.models import Spot
from apps.trails.models import Tag, Trail, TrailLike


# ──────────────────────────────────────────────
# TAGS
# ──────────────────────────────────────────────
TAGS_DATA = [
    ("도심산책", "City Walk", "街歩き"),
    ("해안길", "Coastal Trail", "海岸道"),
    ("맛집투어", "Food Tour", "グルメツアー"),
    ("역사탐방", "Historical", "歴史探訪"),
    ("자연", "Nature", "自然"),
    ("야경", "Night View", "夜景"),
    ("사진명소", "Photo Spot", "写真スポット"),
    ("커피", "Coffee", "コーヒー"),
    ("시장", "Market", "市場"),
    ("사찰", "Temple", "寺院"),
    ("해변", "Beach", "ビーチ"),
    ("공원", "Park", "公園"),
]


# ──────────────────────────────────────────────
# USERS
# ──────────────────────────────────────────────
USERS_DATA = [
    ("seoul_walker", "서울산책러", "ko", "서울 골목골목을 걷는 게 취미입니다."),
    ("busan_namu", "부산바다산책", "ko", "해운대에서 광안리까지, 부산 해안길 전문."),
    ("jeju_olle", "제주올레러", "ko", "제주 올레길 완주를 목표로 걷고 있어요."),
    ("jeonju_foodie", "전주먹방러", "ko", "전주 한옥마을 맛집은 제가 다 압니다."),
    ("tokyo_saku", "도쿄산책", "ja", "東京の下町散歩が好きです。"),
    ("kyoto_aruki", "교토워커", "ja", "京都の哲学の道が一番好きな散歩道。"),
    ("taipei_walk", "타이베이워커", "ko", "대만 여행 전문 블로거입니다."),
    ("london_adventures", "런던탐험가", "en", "London walking tour guide for 5 years."),
    ("paris_flaneur", "파리산책자", "ko", "파리 골목을 걷는 플라뇌르."),
    ("bcn_caminar", "바르셀로나워커", "ko", "바르셀로나 고딕지구에서 살고 있어요."),
    ("nyc_pacer", "뉴요커산책", "en", "NYC walking tours are my passion."),
    ("bkk_explorer", "방콕탐험가", "ko", "방콕 차이나타운 야시장의 모든 것."),
]


# ──────────────────────────────────────────────
# 12 REAL TRAILS
# ──────────────────────────────────────────────
TRAILS_DATA = [
    {
        # 0: 북촌한옥마을 골목길
        "title": "북촌한옥마을 골목길",
        "title_en": "Bukchon Hanok Village Alley Walk",
        "title_ja": "北村韓屋マウル路地散歩",
        "thumbnail_url": "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&h=600&fit=crop",
        "description": "조선시대 한옥이 밀집한 서울의 대표 도보코스. 600년 역사가 살아있는 골목을 걸으며 전통과 현대가 공존하는 풍경을 감상할 수 있다.",
        "description_en": "Seoul's iconic walking trail through dense Joseon-era hanok houses. Walk through 600 years of living history where tradition and modernity coexist.",
        "description_ja": "朝鮮時代の韓屋が密集したソウルの代表的な徒歩コース。600年の歴史が息づく路地を歩き、伝統と現代が共存する風景を楽しめます。",
        "region": "서울",
        "country": "KR",
        "distance_km": Decimal("2.0"),
        "estimated_minutes": 60,
        "difficulty": "easy",
        "elevation_gain": 40,
        "start_lat": Decimal("37.582600"),
        "start_lng": Decimal("126.983100"),
        "end_lat": Decimal("37.579600"),
        "end_lng": Decimal("126.985000"),
        "best_season": "spring",
        "trail_type": "cultural",
        "walking_surface": "paved",
        "transport_access": "3호선 안국역 2번 출구 도보 5분",
        "cover_image_url": "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800",
        "tag_names": ["도심산책", "역사탐방", "사진명소"],
        "path_data": {
            "type": "LineString",
            "coordinates": [
                [126.9831, 37.5826], [126.9835, 37.5824], [126.9838, 37.5821],
                [126.9840, 37.5818], [126.9842, 37.5815], [126.9843, 37.5812],
                [126.9845, 37.5810], [126.9846, 37.5808], [126.9847, 37.5805],
                [126.9848, 37.5802], [126.9849, 37.5800], [126.9850, 37.5798],
                [126.9850, 37.5796],
            ],
        },
    },
    {
        # 1: 해운대 해변 산책로
        "title": "해운대 해변 산책로",
        "title_en": "Haeundae Coastal Walk",
        "title_ja": "海雲台海辺散歩道",
        "thumbnail_url": "https://images.unsplash.com/photo-1590559899731-a382839e5549?w=800&h=600&fit=crop",
        "description": "해운대 해변에서 청사포까지 이어지는 해안 산책로. 파도소리를 들으며 부산의 아름다운 해안선을 걸을 수 있다.",
        "description_en": "A coastal promenade from Haeundae Beach to Cheongsapo. Walk along Busan's beautiful coastline listening to the waves.",
        "description_ja": "海雲台ビーチから青沙浦まで続く海岸散歩道。波の音を聞きながら釜山の美しい海岸線を歩けます。",
        "region": "부산",
        "country": "KR",
        "distance_km": Decimal("4.5"),
        "estimated_minutes": 90,
        "difficulty": "easy",
        "elevation_gain": 80,
        "start_lat": Decimal("35.158700"),
        "start_lng": Decimal("129.160400"),
        "end_lat": Decimal("35.155100"),
        "end_lng": Decimal("129.173700"),
        "best_season": "fall",
        "trail_type": "coastal",
        "walking_surface": "paved",
        "transport_access": "2호선 해운대역 5번 출구 도보 10분",
        "cover_image_url": "https://images.unsplash.com/photo-1590559899731-a382839e5549?w=800",
        "tag_names": ["해안길", "해변", "사진명소", "커피"],
        "path_data": {
            "type": "LineString",
            "coordinates": [
                [129.1604, 35.1587], [129.1615, 35.1585], [129.1628, 35.1583],
                [129.1640, 35.1580], [129.1652, 35.1578], [129.1663, 35.1575],
                [129.1674, 35.1572], [129.1685, 35.1569], [129.1695, 35.1566],
                [129.1705, 35.1563], [129.1715, 35.1560], [129.1725, 35.1557],
                [129.1737, 35.1551],
            ],
        },
    },
    {
        # 2: 제주 올레길 7코스
        "thumbnail_url": "https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=800&h=600&fit=crop",
        "title": "제주 올레길 7코스",
        "title_en": "Jeju Olle Trail Route 7",
        "title_ja": "済州オルレ道7コース",
        "description": "제주 올레길 중 가장 인기 있는 코스. 외돌개에서 월평까지 해안절벽과 오름을 지나는 환상적인 트레일.",
        "description_en": "The most popular Jeju Olle route. A fantastic trail from Oedolgae to Wolpyeong passing coastal cliffs and volcanic hills.",
        "description_ja": "済州オルレ道で最も人気のあるコース。外突介から月坪まで海岸の断崖と오름を通る幻想的なトレイル。",
        "region": "제주",
        "country": "KR",
        "distance_km": Decimal("15.8"),
        "estimated_minutes": 300,
        "difficulty": "moderate",
        "elevation_gain": 150,
        "start_lat": Decimal("33.247000"),
        "start_lng": Decimal("126.256200"),
        "end_lat": Decimal("33.252100"),
        "end_lng": Decimal("126.328700"),
        "best_season": "all",
        "trail_type": "coastal",
        "is_multi_day": False,
        "walking_surface": "mixed",
        "transport_access": "서귀포 버스터미널에서 외돌개 방면 버스 20분",
        "cover_image_url": "https://images.unsplash.com/photo-1596594375536-ade872693c64?w=800",
        "tag_names": ["해안길", "자연", "사진명소"],
        "path_data": {
            "type": "LineString",
            "coordinates": [
                [126.2562, 33.2470], [126.2610, 33.2475], [126.2660, 33.2480],
                [126.2710, 33.2485], [126.2760, 33.2488], [126.2810, 33.2490],
                [126.2860, 33.2493], [126.2910, 33.2496], [126.2960, 33.2500],
                [126.3010, 33.2504], [126.3060, 33.2508], [126.3110, 33.2512],
                [126.3160, 33.2516], [126.3210, 33.2519], [126.3287, 33.2521],
            ],
        },
    },
    {
        # 3: 전주한옥마을 맛집 탐방
        "title": "전주한옥마을 맛집 탐방",
        "thumbnail_url": "https://images.unsplash.com/photo-1601823984263-b87b59798b70?w=800&h=600&fit=crop",
        "title_en": "Jeonju Hanok Village Food Walk",
        "title_ja": "全州韓屋村グルメ散歩",
        "description": "전주한옥마을에서 남부시장까지 이어지는 먹거리 투어 코스. 비빔밥, 초코파이, 막걸리 등 전주의 맛을 걸으며 즐길 수 있다.",
        "description_en": "A food tour from Jeonju Hanok Village to Nambu Market. Walk and taste Jeonju's best — bibimbap, choco pie, makgeolli and more.",
        "description_ja": "全州韓屋村から南部市場まで続くグルメツアーコース。ビビンバ、チョコパイ、マッコリなど全州の味を歩きながら楽しめます。",
        "region": "전북",
        "country": "KR",
        "distance_km": Decimal("2.5"),
        "estimated_minutes": 90,
        "difficulty": "easy",
        "elevation_gain": 15,
        "start_lat": Decimal("35.815900"),
        "start_lng": Decimal("127.153000"),
        "end_lat": Decimal("35.813500"),
        "end_lng": Decimal("127.149500"),
        "best_season": "all",
        "trail_type": "cultural",
        "walking_surface": "paved",
        "transport_access": "전주역에서 버스 12번 한옥마을 하차, 약 15분",
        "cover_image_url": "https://images.unsplash.com/photo-1623677706614-068858e29068?w=800",
        "tag_names": ["맛집투어", "역사탐방", "시장"],
        "path_data": {
            "type": "LineString",
            "coordinates": [
                [127.1530, 35.8159], [127.1528, 35.8157], [127.1525, 35.8155],
                [127.1522, 35.8153], [127.1519, 35.8151], [127.1516, 35.8149],
                [127.1513, 35.8147], [127.1510, 35.8145], [127.1507, 35.8143],
                [127.1504, 35.8141], [127.1500, 35.8139], [127.1497, 35.8137],
                [127.1495, 35.8135],
            ],
        },
    },
    {
        # 4: 도쿄 야나카 산책
        "title": "도쿄 야나카 산책",
        "thumbnail_url": "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800&h=600&fit=crop",
        "title_en": "Tokyo Yanaka Old Town Walk",
        "title_ja": "東京谷中散歩",
        "description": "도쿄에서 가장 잘 보존된 옛 거리. 야나카 긴자 상점가의 석양, 사찰 골목, 고양이 마을로 유명하다.",
        "description_en": "Tokyo's best-preserved old neighborhood. Famous for Yanaka Ginza shopping street sunsets, temple alleys, and cat sightings.",
        "description_ja": "東京で最もよく保存された古い街並み。谷中銀座商店街の夕日、寺院の路地、猫の町として有名です。",
        "region": "Tokyo",
        "country": "JP",
        "distance_km": Decimal("3.0"),
        "estimated_minutes": 90,
        "difficulty": "easy",
        "elevation_gain": 20,
        "start_lat": Decimal("35.726700"),
        "start_lng": Decimal("139.767700"),
        "end_lat": Decimal("35.719400"),
        "end_lng": Decimal("139.772700"),
        "best_season": "fall",
        "trail_type": "urban",
        "walking_surface": "paved",
        "transport_access": "JR 닛포리역(Nippori) 남쪽 출구 바로 앞",
        "cover_image_url": "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800",
        "tag_names": ["도심산책", "사찰", "맛집투어"],
        "path_data": {
            "type": "LineString",
            "coordinates": [
                [139.7677, 35.7267], [139.7680, 35.7260], [139.7683, 35.7253],
                [139.7686, 35.7247], [139.7690, 35.7240], [139.7695, 35.7234],
                [139.7700, 35.7228], [139.7705, 35.7222], [139.7710, 35.7216],
                [139.7715, 35.7210], [139.7720, 35.7204], [139.7724, 35.7198],
                [139.7727, 35.7194],
            ],
        },
    },
    {
        # 5: 교토 철학의 길
        "title": "교토 철학의 길",
        "thumbnail_url": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&h=600&fit=crop",
        "title_en": "Kyoto Philosopher's Path",
        "title_ja": "京都哲学の道",
        "description": "은각사에서 난젠지까지 이어지는 벚나무 수로길. 교토를 대표하는 산책로로 사계절 아름답다.",
        "description_en": "A cherry tree-lined canal path from Ginkaku-ji to Nanzen-ji. Kyoto's most iconic walking trail, beautiful in all seasons.",
        "description_ja": "銀閣寺から南禅寺まで続く桜並木の疏水沿いの道。京都を代表する散歩道で四季折々美しい。",
        "region": "Kyoto",
        "country": "JP",
        "distance_km": Decimal("2.0"),
        "estimated_minutes": 45,
        "difficulty": "easy",
        "elevation_gain": 10,
        "start_lat": Decimal("35.027200"),
        "start_lng": Decimal("135.794300"),
        "end_lat": Decimal("35.015200"),
        "end_lng": Decimal("135.794100"),
        "best_season": "spring",
        "trail_type": "cultural",
        "walking_surface": "paved",
        "transport_access": "시버스 5번 은각사미치(Ginkakuji-michi) 하차 도보 5분",
        "cover_image_url": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800",
        "tag_names": ["사찰", "자연", "사진명소"],
        "path_data": {
            "type": "LineString",
            "coordinates": [
                [135.7943, 35.0272], [135.7943, 35.0262], [135.7943, 35.0252],
                [135.7942, 35.0242], [135.7942, 35.0232], [135.7942, 35.0222],
                [135.7942, 35.0212], [135.7941, 35.0202], [135.7941, 35.0192],
                [135.7941, 35.0182], [135.7941, 35.0172], [135.7941, 35.0162],
                [135.7941, 35.0152],
            ],
        },
    },
    {
        # 6: 지우펀 올드 스트릿
        "title": "지우펀 올드 스트릿",
        "thumbnail_url": "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800&h=600&fit=crop",
        "title_en": "Jiufen Old Street Walk",
        "title_ja": "九份老街散歩",
        "description": "센과 치히로의 행방불명의 모티브가 된 곳. 가파른 계단길을 따라 홍등과 전통 찻집이 이어진다.",
        "description_en": "The inspiration for Spirited Away. Red lanterns and traditional teahouses line the steep stairway streets.",
        "description_ja": "千と千尋の神隠しのモチーフとなった場所。急な階段道に沿って赤い提灯と伝統的な茶館が続きます。",
        "region": "Taipei",
        "country": "TW",
        "distance_km": Decimal("1.5"),
        "estimated_minutes": 60,
        "difficulty": "moderate",
        "elevation_gain": 90,
        "start_lat": Decimal("25.109400"),
        "start_lng": Decimal("121.844500"),
        "end_lat": Decimal("25.107800"),
        "end_lng": Decimal("121.841900"),
        "best_season": "fall",
        "trail_type": "cultural",
        "walking_surface": "paved",
        "transport_access": "타이베이역에서 버스 1062번 지우펀 올드 스트리트 하차, 약 90분",
        "cover_image_url": "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800",
        "tag_names": ["역사탐방", "야경", "맛집투어"],
        "path_data": {
            "type": "LineString",
            "coordinates": [
                [121.8445, 25.1094], [121.8443, 25.1092], [121.8441, 25.1090],
                [121.8439, 25.1088], [121.8437, 25.1087], [121.8435, 25.1085],
                [121.8433, 25.1083], [121.8431, 25.1082], [121.8428, 25.1081],
                [121.8425, 25.1080], [121.8422, 25.1079], [121.8419, 25.1078],
            ],
        },
    },
    {
        # 7: 런던 사우스뱅크 워크
        "title": "런던 사우스뱅크 워크",
        "thumbnail_url": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&h=600&fit=crop",
        "title_en": "London South Bank Walk",
        "title_ja": "ロンドン サウスバンク散歩",
        "description": "템즈강 남쪽을 따라 걷는 런던 최고의 도심 코스. 빅벤, 런던아이, 테이트모던, 타워브릿지까지.",
        "description_en": "London's best urban walk along the south bank of the Thames. From Big Ben and London Eye to Tate Modern and Tower Bridge.",
        "description_ja": "テムズ川の南岸を歩くロンドン最高の都心コース。ビッグベン、ロンドンアイ、テートモダン、タワーブリッジまで。",
        "region": "London",
        "country": "GB",
        "distance_km": Decimal("5.0"),
        "estimated_minutes": 90,
        "difficulty": "easy",
        "elevation_gain": 10,
        "start_lat": Decimal("51.501400"),
        "start_lng": Decimal("-0.119200"),
        "end_lat": Decimal("51.506500"),
        "end_lng": Decimal("-0.076300"),
        "best_season": "spring",
        "trail_type": "urban",
        "walking_surface": "paved",
        "transport_access": "튜브 Jubilee/District Line Westminster역 하차",
        "cover_image_url": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800",
        "tag_names": ["도심산책", "사진명소", "공원"],
        "path_data": {
            "type": "LineString",
            "coordinates": [
                [-0.1192, 51.5014], [-0.1160, 51.5020], [-0.1130, 51.5045],
                [-0.1115, 51.5060], [-0.1070, 51.5070], [-0.1040, 51.5065],
                [-0.1010, 51.5063], [-0.0980, 51.5060], [-0.0950, 51.5058],
                [-0.0910, 51.5057], [-0.0870, 51.5060], [-0.0830, 51.5062],
                [-0.0800, 51.5064], [-0.0763, 51.5065],
            ],
        },
    },
    {
        # 8: 파리 몽마르뜨 언덕 산책
        "title": "파리 몽마르뜨 언덕 산책",
        "thumbnail_url": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=600&fit=crop",
        "title_en": "Paris Montmartre Walk",
        "title_ja": "パリ モンマルトル散歩",
        "description": "사크레쾨르 대성당에서 시작하는 파리 예술가 마을 산책. 화가들의 광장, 포도밭, 아멜리에 카페까지.",
        "description_en": "A walk through Paris' artist village starting from Sacré-Cœur. Place du Tertre painters, vineyards, and Café des Deux Moulins from Amélie.",
        "description_ja": "サクレ・クール大聖堂から始まるパリの芸術家村散歩。画家たちの広場、ブドウ畑、アメリのカフェまで。",
        "region": "Paris",
        "country": "FR",
        "distance_km": Decimal("3.0"),
        "estimated_minutes": 90,
        "difficulty": "moderate",
        "elevation_gain": 60,
        "start_lat": Decimal("48.886700"),
        "start_lng": Decimal("2.343100"),
        "end_lat": Decimal("48.884500"),
        "end_lng": Decimal("2.332400"),
        "best_season": "spring",
        "trail_type": "cultural",
        "walking_surface": "paved",
        "transport_access": "메트로 2호선 Anvers역 하차 도보 10분",
        "cover_image_url": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800",
        "tag_names": ["도심산책", "역사탐방", "커피", "사진명소"],
        "path_data": {
            "type": "LineString",
            "coordinates": [
                [2.3431, 48.8867], [2.3425, 48.8866], [2.3418, 48.8865],
                [2.3410, 48.8864], [2.3402, 48.8862], [2.3395, 48.8860],
                [2.3387, 48.8858], [2.3378, 48.8856], [2.3370, 48.8854],
                [2.3360, 48.8852], [2.3348, 48.8849], [2.3336, 48.8847],
                [2.3324, 48.8845],
            ],
        },
    },
    {
        # 9: 바르셀로나 고딕 지구
        "title": "바르셀로나 고딕 지구",
        "thumbnail_url": "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&h=600&fit=crop",
        "title_en": "Barcelona Gothic Quarter Walk",
        "title_ja": "バルセロナ ゴシック地区散歩",
        "description": "바르셀로나 대성당에서 시작해 중세 골목을 지나 바르셀로네타 해변까지. 가우디의 흔적과 타파스 바가 곳곳에.",
        "description_en": "From Barcelona Cathedral through medieval alleys to Barceloneta Beach. Traces of Gaudí and tapas bars around every corner.",
        "description_ja": "バルセロナ大聖堂から中世の路地を抜けバルセロネータ海辺まで。ガウディの足跡とタパスバーが至る所に。",
        "region": "Barcelona",
        "country": "ES",
        "distance_km": Decimal("3.0"),
        "estimated_minutes": 75,
        "difficulty": "easy",
        "elevation_gain": 15,
        "start_lat": Decimal("41.382500"),
        "start_lng": Decimal("2.176900"),
        "end_lat": Decimal("41.379600"),
        "end_lng": Decimal("2.182200"),
        "best_season": "spring",
        "trail_type": "cultural",
        "walking_surface": "paved",
        "transport_access": "메트로 L4 Jaume I역 하차 도보 2분",
        "cover_image_url": "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800",
        "tag_names": ["역사탐방", "맛집투어", "해변"],
        "path_data": {
            "type": "LineString",
            "coordinates": [
                [2.1769, 41.3825], [2.1772, 41.3823], [2.1775, 41.3820],
                [2.1778, 41.3817], [2.1781, 41.3814], [2.1784, 41.3811],
                [2.1788, 41.3808], [2.1792, 41.3806], [2.1796, 41.3804],
                [2.1800, 41.3802], [2.1806, 41.3800], [2.1814, 41.3798],
                [2.1822, 41.3796],
            ],
        },
    },
    {
        # 10: 뉴욕 하이라인
        "title": "뉴욕 하이라인",
        "thumbnail_url": "https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&h=600&fit=crop",
        "title_en": "NYC High Line Walk",
        "title_ja": "ニューヨーク ハイライン散歩",
        "description": "폐선 위에 만든 공중 정원. 맨해튼 서쪽 하늘 아래 현대 미술과 도시 풍경을 동시에 즐길 수 있다.",
        "description_en": "An elevated park built on abandoned rail tracks. Enjoy contemporary art and city views under Manhattan's western sky.",
        "description_ja": "廃線の上に作られた空中庭園。マンハッタン西側の空の下、現代美術と都市の風景を同時に楽しめます。",
        "region": "New York",
        "country": "US",
        "distance_km": Decimal("2.3"),
        "estimated_minutes": 45,
        "difficulty": "easy",
        "elevation_gain": 5,
        "start_lat": Decimal("40.748000"),
        "start_lng": Decimal("-74.004800"),
        "end_lat": Decimal("40.756400"),
        "end_lng": Decimal("-73.999800"),
        "best_season": "spring",
        "trail_type": "urban",
        "walking_surface": "paved",
        "transport_access": "지하철 A/C/E 14th St역 또는 L트레인 8th Ave역 하차 도보 5분",
        "cover_image_url": "https://images.unsplash.com/photo-1500916434205-0c77489c6cf7?w=800",
        "tag_names": ["도심산책", "공원", "사진명소"],
        "path_data": {
            "type": "LineString",
            "coordinates": [
                [-74.0048, 40.7480], [-74.0046, 40.7486], [-74.0044, 40.7492],
                [-74.0042, 40.7498], [-74.0040, 40.7505], [-74.0037, 40.7512],
                [-74.0034, 40.7519], [-74.0030, 40.7526], [-74.0026, 40.7533],
                [-74.0022, 40.7540], [-74.0016, 40.7548], [-74.0008, 40.7556],
                [-73.9998, 40.7564],
            ],
        },
    },
    {
        # 11: 방콕 차이나타운 야오와랏
        "title": "방콕 차이나타운 야오와랏",
        "thumbnail_url": "https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=800&h=600&fit=crop",
        "title_en": "Bangkok Yaowarat Walk",
        "title_ja": "バンコク チャイナタウン ヤワラート散歩",
        "description": "방콕에서 가장 활기찬 야시장 거리. 200년 역사의 차이나타운에서 길거리 음식을 즐기며 걷는 코스.",
        "description_en": "Bangkok's most vibrant night market street. Walk through 200 years of Chinatown history while enjoying incredible street food.",
        "description_ja": "バンコクで最も活気ある夜市通り。200年の歴史を持つチャイナタウンで屋台グルメを楽しみながら歩くコース。",
        "region": "Bangkok",
        "country": "TH",
        "distance_km": Decimal("2.0"),
        "estimated_minutes": 75,
        "difficulty": "easy",
        "elevation_gain": 0,
        "start_lat": Decimal("13.741000"),
        "start_lng": Decimal("100.513300"),
        "end_lat": Decimal("13.738500"),
        "end_lng": Decimal("100.508500"),
        "best_season": "winter",
        "trail_type": "urban",
        "walking_surface": "paved",
        "transport_access": "MRT 왓 망콘역(Wat Mangkon) 1번 출구 도보 1분",
        "cover_image_url": "https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=800",
        "tag_names": ["맛집투어", "야경", "시장"],
        "path_data": {
            "type": "LineString",
            "coordinates": [
                [100.5133, 13.7410], [100.5130, 13.7408], [100.5127, 13.7406],
                [100.5123, 13.7404], [100.5119, 13.7402], [100.5115, 13.7400],
                [100.5111, 13.7398], [100.5107, 13.7396], [100.5103, 13.7393],
                [100.5098, 13.7390], [100.5093, 13.7388], [100.5088, 13.7386],
                [100.5085, 13.7385],
            ],
        },
    },
]


# ──────────────────────────────────────────────
# SPOTS FOR EACH TRAIL (real places, real coords)
# ──────────────────────────────────────────────
SPOTS_DATA = {
    # 0: 북촌한옥마을 골목길
    0: [
        {
            "name": "북촌 8경 제1경",
            "name_en": "Bukchon View No.1 (Changdeok Palace)",
            "name_ja": "北村8景 第1景",
            "spot_type": "start",
            "lat": Decimal("37.582600"),
            "lng": Decimal("126.983100"),
            "order": 0,
            "distance_from_start_km": Decimal("0.0"),
            "description": "출발점. 창덕궁 전경이 내려다보이는 북촌의 첫 번째 뷰포인트.",
            "tip": "오전 10시 이전에 방문하면 한적하게 골목을 즐길 수 있어요.",
            "is_must_visit": True,
        },
        {
            "name": "가회동 31번지 한옥골목",
            "name_en": "Gahoe-dong 31 Hanok Alley",
            "name_ja": "嘉会洞31番地 韓屋路地",
            "spot_type": "photo",
            "lat": Decimal("37.581800"),
            "lng": Decimal("126.984200"),
            "order": 1,
            "distance_from_start_km": Decimal("0.5"),
            "description": "북촌에서 가장 포토제닉한 한옥 골목. 기와지붕이 겹겹이 이어지는 전형적인 북촌 풍경.",
            "tip": "주민 거주지역이므로 조용히 관람해주세요. 촬영 시 삼각대 사용 금지.",
            "is_must_visit": True,
        },
        {
            "name": "북촌 전통공예 체험관",
            "name_en": "Bukchon Traditional Craft Center",
            "name_ja": "北村伝統工芸体験館",
            "spot_type": "gallery",
            "lat": Decimal("37.581200"),
            "lng": Decimal("126.983800"),
            "order": 2,
            "distance_from_start_km": Decimal("0.8"),
            "description": "한지, 매듭, 자수 등 전통공예 체험이 가능한 공방.",
            "opening_hours": "10:00~18:00",
            "closed_days": "월요일",
            "price_range": "체험 10,000~25,000원",
        },
        {
            "name": "삼청동 카페거리",
            "name_en": "Samcheong-dong Cafe Street",
            "name_ja": "三清洞カフェ通り",
            "spot_type": "cafe",
            "lat": Decimal("37.580200"),
            "lng": Decimal("126.984600"),
            "order": 3,
            "distance_from_start_km": Decimal("1.5"),
            "description": "갤러리와 카페가 어우러진 삼청동의 핫플. 아기자기한 골목이 매력적.",
            "menu_highlight": "수제 쿠키, 핸드드립 커피",
            "price_range": "5,000~8,000원",
            "rating": Decimal("4.3"),
            "opening_hours": "10:00~22:00",
            "is_must_visit": True,
        },
        {
            "name": "삼청공원 입구",
            "name_en": "Samcheong Park Entrance",
            "name_ja": "三清公園入口",
            "spot_type": "end",
            "lat": Decimal("37.579600"),
            "lng": Decimal("126.985000"),
            "order": 4,
            "distance_from_start_km": Decimal("2.0"),
            "description": "도착점. 삼청공원에서 북악산 방면 산책을 이어갈 수도 있다.",
        },
    ],
    # 1: 해운대 해변 산책로
    1: [
        {
            "name": "해운대해수욕장",
            "name_en": "Haeundae Beach",
            "name_ja": "海雲台海水浴場",
            "spot_type": "start",
            "lat": Decimal("35.158700"),
            "lng": Decimal("129.160400"),
            "order": 0,
            "distance_from_start_km": Decimal("0.0"),
            "description": "출발점. 대한민국 대표 해수욕장. 넓은 백사장에서 산책 시작.",
            "is_must_visit": True,
        },
        {
            "name": "달맞이길",
            "name_en": "Dalmaji Hill Road",
            "name_ja": "月見峠道",
            "spot_type": "view",
            "lat": Decimal("35.157200"),
            "lng": Decimal("129.166000"),
            "order": 1,
            "distance_from_start_km": Decimal("1.5"),
            "description": "벚꽃과 바다가 어우러지는 달맞이 고개. 양쪽으로 갤러리와 카페가 이어진다.",
            "tip": "봄 벚꽃 시즌과 보름달 뜰 때가 최고 뷰.",
            "is_must_visit": True,
        },
        {
            "name": "문텐로드",
            "name_en": "Moontan Road",
            "name_ja": "ムーンタンロード",
            "spot_type": "photo",
            "lat": Decimal("35.156000"),
            "lng": Decimal("129.169000"),
            "order": 2,
            "distance_from_start_km": Decimal("2.5"),
            "description": "해운대와 송정을 잇는 해안 데크 산책로. 탁 트인 수평선이 일품.",
            "is_must_visit": True,
        },
        {
            "name": "해녀촌 해산물",
            "name_en": "Haenyeo Village Seafood",
            "name_ja": "海女村海鮮",
            "spot_type": "restaurant",
            "lat": Decimal("35.155500"),
            "lng": Decimal("129.171500"),
            "order": 3,
            "distance_from_start_km": Decimal("3.5"),
            "description": "해녀가 직접 잡은 해산물을 맛볼 수 있는 곳.",
            "menu_highlight": "전복죽, 성게미역국, 해삼",
            "price_range": "15,000~30,000원",
            "rating": Decimal("4.5"),
            "opening_hours": "09:00~20:00",
        },
        {
            "name": "청사포",
            "name_en": "Cheongsapo Port",
            "name_ja": "青沙浦",
            "spot_type": "end",
            "lat": Decimal("35.155100"),
            "lng": Decimal("129.173700"),
            "order": 4,
            "distance_from_start_km": Decimal("4.5"),
            "description": "도착점. 빨간등대와 다릿돌 전망대가 있는 작은 어촌 마을.",
            "tip": "청사포 다릿돌 전망대(스카이워크)는 무료이며 일몰 시간대 추천.",
        },
    ],
    # 2: 제주 올레길 7코스
    2: [
        {
            "name": "외돌개",
            "name_en": "Oedolgae Rock",
            "name_ja": "外突介",
            "spot_type": "start",
            "lat": Decimal("33.247000"),
            "lng": Decimal("126.256200"),
            "order": 0,
            "distance_from_start_km": Decimal("0.0"),
            "description": "출발점. 높이 20m의 기암괴석이 바다에 우뚝 서 있는 명소.",
            "is_must_visit": True,
        },
        {
            "name": "법환포구",
            "name_en": "Beopwan Port",
            "name_ja": "法還浦口",
            "spot_type": "view",
            "lat": Decimal("33.248500"),
            "lng": Decimal("126.272000"),
            "order": 1,
            "distance_from_start_km": Decimal("3.0"),
            "description": "작은 어촌 포구. 제주 해녀 문화를 엿볼 수 있는 곳.",
        },
        {
            "name": "주상절리대",
            "name_en": "Jusangjeolli Columnar Joints",
            "name_ja": "柱状節理帯",
            "spot_type": "photo",
            "lat": Decimal("33.249200"),
            "lng": Decimal("126.285000"),
            "order": 2,
            "distance_from_start_km": Decimal("6.0"),
            "description": "용암이 바다를 만나 만들어진 천연기념물. 거대한 석주가 해안을 따라 이어진다.",
            "tip": "입장료 2,000원. 일몰 시 붉게 물드는 주상절리가 장관.",
            "is_must_visit": True,
        },
        {
            "name": "올레 쉼터 (중문)",
            "name_en": "Olle Rest Stop (Jungmun)",
            "name_ja": "オルレ休憩所（中文）",
            "spot_type": "rest",
            "lat": Decimal("33.250000"),
            "lng": Decimal("126.305000"),
            "order": 3,
            "distance_from_start_km": Decimal("10.0"),
            "description": "중문 해안가 올레길 쉼터. 간식과 음료 판매.",
            "price_range": "2,000~5,000원",
            "opening_hours": "09:00~17:00",
        },
        {
            "name": "월평 해안",
            "name_en": "Wolpyeong Coast",
            "name_ja": "月坪海岸",
            "spot_type": "end",
            "lat": Decimal("33.252100"),
            "lng": Decimal("126.328700"),
            "order": 4,
            "distance_from_start_km": Decimal("15.8"),
            "description": "도착점. 에메랄드빛 바다와 검은 현무암이 대비되는 해안.",
        },
    ],
    # 3: 전주한옥마을 맛집 탐방
    3: [
        {
            "name": "경기전",
            "name_en": "Gyeonggijeon Shrine",
            "name_ja": "慶基殿",
            "spot_type": "start",
            "lat": Decimal("35.815900"),
            "lng": Decimal("127.153000"),
            "order": 0,
            "distance_from_start_km": Decimal("0.0"),
            "description": "출발점. 태조 이성계의 어진을 모신 조선시대 건축물. 대나무숲이 아름답다.",
            "opening_hours": "09:00~18:00 (동절기 ~17:00)",
            "price_range": "입장료 3,000원",
            "is_must_visit": True,
        },
        {
            "name": "한옥마을 비빔밥 골목",
            "name_en": "Bibimbap Alley",
            "name_ja": "ビビンバ横丁",
            "spot_type": "restaurant",
            "lat": Decimal("35.815200"),
            "lng": Decimal("127.152200"),
            "order": 1,
            "distance_from_start_km": Decimal("0.5"),
            "description": "전주비빔밥의 원조 맛집들이 모여있는 골목. 가족회관, 한국집 등이 유명.",
            "menu_highlight": "전주비빔밥, 콩나물국밥, 모주",
            "price_range": "9,000~14,000원",
            "rating": Decimal("4.5"),
            "opening_hours": "10:30~20:30",
            "is_must_visit": True,
        },
        {
            "name": "한옥마을 카페거리",
            "name_en": "Hanok Village Cafe Street",
            "name_ja": "韓屋村カフェ通り",
            "spot_type": "cafe",
            "lat": Decimal("35.814500"),
            "lng": Decimal("127.151500"),
            "order": 2,
            "distance_from_start_km": Decimal("1.2"),
            "description": "한옥을 개조한 카페와 디저트 가게가 늘어선 거리. PNB 초코파이가 명물.",
            "menu_highlight": "PNB 수제 초코파이, 전주 막걸리 아이스크림",
            "price_range": "3,000~7,000원",
            "rating": Decimal("4.3"),
            "opening_hours": "10:00~21:00",
            "is_must_visit": True,
        },
        {
            "name": "오목대",
            "name_en": "Omokdae Pavilion",
            "name_ja": "梧木台",
            "spot_type": "view",
            "lat": Decimal("35.814000"),
            "lng": Decimal("127.150500"),
            "order": 3,
            "distance_from_start_km": Decimal("1.8"),
            "description": "한옥마을 전경을 한눈에 내려다보는 전망대. 해질녘 노을이 특히 아름답다.",
            "tip": "계단이 가파르니 편한 신발 추천.",
        },
        {
            "name": "남부시장",
            "name_en": "Nambu Market",
            "name_ja": "南部市場",
            "spot_type": "end",
            "lat": Decimal("35.813500"),
            "lng": Decimal("127.149500"),
            "order": 4,
            "distance_from_start_km": Decimal("2.5"),
            "description": "도착점. 금/토 야시장에서 꼬치, 떡갈비, 전주 막걸리를 즐길 수 있다.",
            "menu_highlight": "꼬치, 떡갈비, 전주 막걸리",
            "price_range": "3,000~8,000원",
            "opening_hours": "상설시장 09:00~19:00 / 야시장 금~토 18:00~24:00",
            "tip": "야시장은 금·토만 운영. 요일 확인 필수!",
            "is_must_visit": True,
        },
    ],
    # 4: 도쿄 야나카 산책
    4: [
        {
            "name": "닛포리역 석양 계단",
            "name_en": "Nippori Station Sunset Stairs",
            "name_ja": "日暮里駅 夕やけだんだん",
            "spot_type": "start",
            "lat": Decimal("35.726700"),
            "lng": Decimal("139.767700"),
            "order": 0,
            "distance_from_start_km": Decimal("0.0"),
            "description": "출발점. '유야케단단(夕やけだんだん)' 석양 계단. 야나카 긴자로 내려가는 유명한 포토스팟.",
            "tip": "해질녘에 방문하면 계단 아래로 석양이 내려앉는 명장면을 볼 수 있어요.",
            "is_must_visit": True,
        },
        {
            "name": "야나카 긴자 상점가",
            "name_en": "Yanaka Ginza Shopping Street",
            "name_ja": "谷中銀座商店街",
            "spot_type": "market",
            "lat": Decimal("35.725000"),
            "lng": Decimal("139.768500"),
            "order": 1,
            "distance_from_start_km": Decimal("0.5"),
            "description": "60여 개 점포가 모인 레트로 상점가. 멘치카츠, 고로케, 야키센베이 등 간식이 풍부.",
            "menu_highlight": "멘치카츠, 고양이 꼬리 도넛, 야키센베이",
            "price_range": "100~500엔",
            "rating": Decimal("4.4"),
            "opening_hours": "10:00~19:00",
            "is_must_visit": True,
        },
        {
            "name": "텐노지(天王寺)",
            "name_en": "Tennoji Temple",
            "name_ja": "天王寺",
            "spot_type": "temple",
            "lat": Decimal("35.723500"),
            "lng": Decimal("139.769500"),
            "order": 2,
            "distance_from_start_km": Decimal("1.2"),
            "description": "야나카 묘지 옆 천년 고찰. 거대한 대불상(석가여래좌상)이 있다.",
            "opening_hours": "09:00~16:30",
        },
        {
            "name": "카야바 커피(カヤバ珈琲)",
            "name_en": "Kayaba Coffee",
            "name_ja": "カヤバ珈琲",
            "spot_type": "cafe",
            "lat": Decimal("35.721200"),
            "lng": Decimal("139.770800"),
            "order": 3,
            "distance_from_start_km": Decimal("2.0"),
            "description": "1938년에 문을 연 레트로 카페. 2009년 리노베이션을 거쳐 재오픈. 타마고 샌드위치가 명물.",
            "menu_highlight": "타마고 샌드, 러시안 커피",
            "price_range": "500~1,000엔",
            "rating": Decimal("4.3"),
            "opening_hours": "08:00~18:00 (주말 ~21:00)",
            "closed_days": "화요일",
            "is_must_visit": True,
        },
        {
            "name": "우에노공원 입구",
            "name_en": "Ueno Park Entrance",
            "name_ja": "上野公園入口",
            "spot_type": "end",
            "lat": Decimal("35.719400"),
            "lng": Decimal("139.772700"),
            "order": 4,
            "distance_from_start_km": Decimal("3.0"),
            "description": "도착점. 우에노공원으로 이어져 국립박물관, 동물원 등 추가 관광이 가능.",
        },
    ],
    # 5: 교토 철학의 길
    5: [
        {
            "name": "은각사(긴카쿠지)",
            "name_en": "Ginkaku-ji (Silver Pavilion)",
            "name_ja": "銀閣寺",
            "spot_type": "start",
            "lat": Decimal("35.027200"),
            "lng": Decimal("135.794300"),
            "order": 0,
            "distance_from_start_km": Decimal("0.0"),
            "description": "출발점. 정식 명칭은 지쇼지(慈照寺). 은모래 정원(긴샤단)이 유명.",
            "opening_hours": "08:30~17:00 (동절기 09:00~16:30)",
            "price_range": "입장료 500엔",
            "is_must_visit": True,
        },
        {
            "name": "호넨인(法然院)",
            "name_en": "Honen-in Temple",
            "name_ja": "法然院",
            "spot_type": "temple",
            "lat": Decimal("35.024500"),
            "lng": Decimal("135.794200"),
            "order": 1,
            "distance_from_start_km": Decimal("0.5"),
            "description": "이끼 낀 산문(山門)이 아름다운 작은 사찰. 관광객이 적어 고요하게 산책 가능.",
            "opening_hours": "06:00~16:00",
            "tip": "무료 입장. 사진 촬영에 최적.",
            "is_must_visit": True,
        },
        {
            "name": "요지야 카페 (よーじやカフェ)",
            "name_en": "Yojiya Cafe Philosopher's Path",
            "name_ja": "よーじやカフェ 哲学の道店",
            "spot_type": "cafe",
            "lat": Decimal("35.021500"),
            "lng": Decimal("135.794200"),
            "order": 2,
            "distance_from_start_km": Decimal("1.0"),
            "description": "교토 화장품 브랜드 요지야가 운영하는 카페. 라떼 위 요지야 얼굴 아트가 시그니처.",
            "menu_highlight": "요지야 카푸치노, 말차 파르페",
            "price_range": "600~1,200엔",
            "rating": Decimal("4.2"),
            "opening_hours": "10:00~17:00",
            "closed_days": "수요일",
        },
        {
            "name": "에이칸도(永観堂)",
            "name_en": "Eikan-do Temple",
            "name_ja": "永観堂",
            "spot_type": "temple",
            "lat": Decimal("35.018000"),
            "lng": Decimal("135.794100"),
            "order": 3,
            "distance_from_start_km": Decimal("1.5"),
            "description": "교토 최고의 단풍 명소. 가을에는 3,000그루의 단풍이 불타듯 물든다.",
            "opening_hours": "09:00~17:00",
            "price_range": "입장료 600엔 (가을 라이트업 시 1,000엔)",
            "is_must_visit": True,
        },
        {
            "name": "난젠지(南禅寺)",
            "name_en": "Nanzen-ji Temple",
            "name_ja": "南禅寺",
            "spot_type": "end",
            "lat": Decimal("35.015200"),
            "lng": Decimal("135.794100"),
            "order": 4,
            "distance_from_start_km": Decimal("2.0"),
            "description": "도착점. 거대한 산문(三門)과 레트로한 수로각(水路閣)이 포토스팟.",
            "tip": "산문 위에 올라가면 교토 시내 전경을 볼 수 있어요 (별도 600엔).",
            "is_must_visit": True,
        },
    ],
    # 6: 지우펀 올드 스트릿
    6: [
        {
            "name": "지우펀 올드 스트릿 입구",
            "name_en": "Jiufen Old Street Entrance",
            "name_ja": "九份老街入口",
            "spot_type": "start",
            "lat": Decimal("25.109400"),
            "lng": Decimal("121.844500"),
            "order": 0,
            "distance_from_start_km": Decimal("0.0"),
            "description": "출발점. 버스 정류장에서 올드 스트리트 아치로 진입.",
        },
        {
            "name": "아메이찻집 (阿妹茶樓)",
            "name_en": "A-Mei Tea House",
            "name_ja": "阿妹茶楼",
            "spot_type": "cafe",
            "lat": Decimal("25.109000"),
            "lng": Decimal("121.843800"),
            "order": 1,
            "distance_from_start_km": Decimal("0.3"),
            "description": "센과 치히로의 행방불명 모티브가 된 것으로 알려진 찻집. 홍등 아래 야경이 아름답다.",
            "menu_highlight": "우롱차 세트, 전통 차과자",
            "price_range": "300~500 TWD",
            "rating": Decimal("4.2"),
            "opening_hours": "08:30~21:00",
            "is_must_visit": True,
        },
        {
            "name": "라이아거(賴阿婆芋圓)",
            "name_en": "Lai A-Po Taro Balls",
            "name_ja": "賴阿婆芋圓",
            "spot_type": "restaurant",
            "lat": Decimal("25.108500"),
            "lng": Decimal("121.843200"),
            "order": 2,
            "distance_from_start_km": Decimal("0.7"),
            "description": "지우펀 원조 타로볼 맛집. 바다 전망 테라스에서 먹는 타로볼이 일품.",
            "menu_highlight": "종합 타로볼 (팥, 녹두, 타로)",
            "price_range": "45~55 TWD",
            "rating": Decimal("4.4"),
            "opening_hours": "09:00~20:00",
            "is_must_visit": True,
        },
        {
            "name": "수치루 계단 (竪崎路)",
            "name_en": "Shuqi Road Stairway",
            "name_ja": "竪崎路階段",
            "spot_type": "photo",
            "lat": Decimal("25.108200"),
            "lng": Decimal("121.842500"),
            "order": 3,
            "distance_from_start_km": Decimal("1.0"),
            "description": "홍등이 양쪽으로 늘어선 가파른 계단길. 지우펀 대표 포토스팟.",
            "tip": "해 진 후 홍등에 불이 들어오면 가장 분위기 있어요.",
            "is_must_visit": True,
        },
        {
            "name": "지우펀 전망대",
            "name_en": "Jiufen Viewpoint",
            "name_ja": "九份展望台",
            "spot_type": "end",
            "lat": Decimal("25.107800"),
            "lng": Decimal("121.841900"),
            "order": 4,
            "distance_from_start_km": Decimal("1.5"),
            "description": "도착점. 동중국해가 내려다보이는 전망대. 맑은 날 기룽항까지 보인다.",
        },
    ],
    # 7: 런던 사우스뱅크 워크
    7: [
        {
            "name": "웨스트민스터 브릿지",
            "name_en": "Westminster Bridge",
            "name_ja": "ウェストミンスター橋",
            "spot_type": "start",
            "lat": Decimal("51.501400"),
            "lng": Decimal("-0.119200"),
            "order": 0,
            "distance_from_start_km": Decimal("0.0"),
            "description": "출발점. 빅벤(엘리자베스 타워)이 바로 옆에 보이는 다리에서 출발.",
            "is_must_visit": True,
        },
        {
            "name": "런던아이",
            "name_en": "London Eye",
            "name_ja": "ロンドン・アイ",
            "spot_type": "photo",
            "lat": Decimal("51.503300"),
            "lng": Decimal("-0.119500"),
            "order": 1,
            "distance_from_start_km": Decimal("0.5"),
            "description": "높이 135m 대관람차. 탑승하지 않아도 외부에서 사진 찍기 좋은 포인트.",
            "price_range": "탑승 £30~36",
            "opening_hours": "10:00~18:00 (시즌별 상이)",
            "is_must_visit": True,
        },
        {
            "name": "테이트 모던",
            "name_en": "Tate Modern",
            "name_ja": "テート・モダン",
            "spot_type": "gallery",
            "lat": Decimal("51.507600"),
            "lng": Decimal("-0.099300"),
            "order": 2,
            "distance_from_start_km": Decimal("2.0"),
            "description": "화력발전소를 개조한 현대미술관. 무료 입장. 최상층 전망대에서 세인트폴 대성당이 보인다.",
            "opening_hours": "10:00~18:00 (금~토 ~22:00)",
            "price_range": "무료 (특별전 별도)",
            "is_must_visit": True,
        },
        {
            "name": "버러 마켓",
            "name_en": "Borough Market",
            "name_ja": "バラ・マーケット",
            "spot_type": "market",
            "lat": Decimal("51.505500"),
            "lng": Decimal("-0.091000"),
            "order": 3,
            "distance_from_start_km": Decimal("3.5"),
            "description": "1,000년 역사의 런던 대표 먹거리 시장. 치즈, 빵, 올리브오일 등 세계 각국 식재료.",
            "menu_highlight": "라클렛 치즈 샌드위치, 스카치 에그, 파에야",
            "price_range": "£5~15",
            "rating": Decimal("4.6"),
            "opening_hours": "수~토 10:00~17:00",
            "is_must_visit": True,
        },
        {
            "name": "타워 브릿지",
            "name_en": "Tower Bridge",
            "name_ja": "タワーブリッジ",
            "spot_type": "end",
            "lat": Decimal("51.506500"),
            "lng": Decimal("-0.076300"),
            "order": 4,
            "distance_from_start_km": Decimal("5.0"),
            "description": "도착점. 1894년 완공된 런던의 상징. 다리 위를 걸으며 템즈강 전경을 감상할 수 있다.",
            "tip": "상부 유리 통로(Glass Walkway)에서 42m 아래 강을 내려다볼 수 있어요.",
            "is_must_visit": True,
        },
    ],
    # 8: 파리 몽마르뜨 언덕 산책
    8: [
        {
            "name": "사크레쾨르 대성당",
            "name_en": "Sacré-Cœur Basilica",
            "name_ja": "サクレ・クール寺院",
            "spot_type": "start",
            "lat": Decimal("48.886700"),
            "lng": Decimal("2.343100"),
            "order": 0,
            "distance_from_start_km": Decimal("0.0"),
            "description": "출발점. 파리 최고 높은 언덕 위 하얀 성당. 계단 아래로 파리 시내 전경이 펼쳐진다.",
            "opening_hours": "06:00~22:30",
            "price_range": "무료 (돔 전망대 €7)",
            "is_must_visit": True,
        },
        {
            "name": "테르트르 광장",
            "name_en": "Place du Tertre",
            "name_ja": "テルトル広場",
            "spot_type": "photo",
            "lat": Decimal("48.886300"),
            "lng": Decimal("2.340800"),
            "order": 1,
            "distance_from_start_km": Decimal("0.5"),
            "description": "화가들이 그림을 그리고 파는 예술가 광장. 초상화 그려주는 화가들이 많다.",
            "tip": "초상화는 가격을 먼저 확인하세요. 보통 €20~50.",
            "is_must_visit": True,
        },
        {
            "name": "몽마르뜨 포도밭",
            "name_en": "Montmartre Vineyard",
            "name_ja": "モンマルトルのブドウ畑",
            "spot_type": "view",
            "lat": Decimal("48.887000"),
            "lng": Decimal("2.339500"),
            "order": 2,
            "distance_from_start_km": Decimal("1.0"),
            "description": "파리 시내 유일한 포도밭. 매년 10월 포도 수확제가 열린다.",
        },
        {
            "name": "카페 데 두 물랭 (아멜리에 카페)",
            "name_en": "Café des Deux Moulins (Amélie café)",
            "name_ja": "カフェ・デ・ドゥ・ムーラン",
            "spot_type": "cafe",
            "lat": Decimal("48.885200"),
            "lng": Decimal("2.333800"),
            "order": 3,
            "distance_from_start_km": Decimal("2.0"),
            "description": "영화 아멜리에(2001) 촬영지. 크렘 브륄레가 시그니처 메뉴.",
            "menu_highlight": "크렘 브륄레, 에스프레소",
            "price_range": "€4~12",
            "rating": Decimal("4.1"),
            "opening_hours": "07:00~02:00",
            "is_must_visit": True,
        },
        {
            "name": "물랭 루즈 앞",
            "name_en": "Moulin Rouge area",
            "name_ja": "ムーラン・ルージュ前",
            "spot_type": "end",
            "lat": Decimal("48.884500"),
            "lng": Decimal("2.332400"),
            "order": 4,
            "distance_from_start_km": Decimal("3.0"),
            "description": "도착점. 1889년 개장한 세계적인 캬바레. 빨간 풍차가 랜드마크.",
            "tip": "외관 사진은 자유지만, 공연 관람은 사전 예약 필수 (€90~).",
        },
    ],
    # 9: 바르셀로나 고딕 지구
    9: [
        {
            "name": "바르셀로나 대성당",
            "name_en": "Barcelona Cathedral",
            "name_ja": "バルセロナ大聖堂",
            "spot_type": "start",
            "lat": Decimal("41.382500"),
            "lng": Decimal("2.176900"),
            "order": 0,
            "distance_from_start_km": Decimal("0.0"),
            "description": "출발점. 13세기 고딕 양식 대성당. 안뜰에 13마리의 거위가 산다.",
            "opening_hours": "08:30~19:30",
            "price_range": "기부금 €9",
            "is_must_visit": True,
        },
        {
            "name": "왕의 광장 (Plaça del Rei)",
            "name_en": "Plaça del Rei (King's Square)",
            "name_ja": "王の広場",
            "spot_type": "photo",
            "lat": Decimal("41.382100"),
            "lng": Decimal("2.177500"),
            "order": 1,
            "distance_from_start_km": Decimal("0.5"),
            "description": "콜럼버스가 이사벨 여왕을 알현한 중세 광장. 바르셀로나 역사박물관이 있다.",
        },
        {
            "name": "엘스 콰트레 가츠 (Els Quatre Gats)",
            "name_en": "Els Quatre Gats",
            "name_ja": "エルス・クアトラ・ガッツ",
            "spot_type": "restaurant",
            "lat": Decimal("41.382000"),
            "lng": Decimal("2.175000"),
            "order": 2,
            "distance_from_start_km": Decimal("1.0"),
            "description": "1897년 오픈. 젊은 피카소가 첫 전시를 열었던 레스토랑 겸 카페.",
            "menu_highlight": "카탈루냐 크레마, 타파스 모둠",
            "price_range": "€15~30",
            "rating": Decimal("4.1"),
            "opening_hours": "09:00~24:00",
            "is_must_visit": True,
        },
        {
            "name": "레이알 광장 (Plaça Reial)",
            "name_en": "Plaça Reial",
            "name_ja": "レイアール広場",
            "spot_type": "view",
            "lat": Decimal("41.380200"),
            "lng": Decimal("2.175500"),
            "order": 3,
            "distance_from_start_km": Decimal("2.0"),
            "description": "야자수에 둘러싸인 아름다운 광장. 가우디가 디자인한 가로등이 있다.",
            "tip": "야간에 특히 분위기 좋지만 소매치기 주의.",
        },
        {
            "name": "바르셀로네타 해변",
            "name_en": "Barceloneta Beach",
            "name_ja": "バルセロネータ海辺",
            "spot_type": "end",
            "lat": Decimal("41.379600"),
            "lng": Decimal("2.182200"),
            "order": 4,
            "distance_from_start_km": Decimal("3.0"),
            "description": "도착점. 고딕 지구에서 10분이면 도착하는 도심 속 해변. 해산물 레스토랑이 즐비.",
            "tip": "해변가 La Mar Salada에서 해산물 파에야 추천.",
        },
    ],
    # 10: 뉴욕 하이라인
    10: [
        {
            "name": "하이라인 남쪽 입구 (갠즈부르트 스트리트)",
            "name_en": "High Line South Entrance (Gansevoort St)",
            "name_ja": "ハイライン南入口（ガンズヴォート通り）",
            "spot_type": "start",
            "lat": Decimal("40.748000"),
            "lng": Decimal("-74.004800"),
            "order": 0,
            "distance_from_start_km": Decimal("0.0"),
            "description": "출발점. 미트패킹 디스트릭트의 하이라인 남단 엘리베이터/계단 입구.",
            "opening_hours": "07:00~22:00 (시즌별 상이)",
            "price_range": "무료",
            "is_must_visit": True,
        },
        {
            "name": "첼시 마켓",
            "name_en": "Chelsea Market",
            "name_ja": "チェルシーマーケット",
            "spot_type": "market",
            "lat": Decimal("40.742300"),
            "lng": Decimal("-74.006100"),
            "order": 1,
            "distance_from_start_km": Decimal("0.5"),
            "description": "오레오 쿠키 공장을 개조한 실내 푸드마켓. 하이라인에서 도보 2분.",
            "menu_highlight": "랍스터 롤, 타코, 아티산 빵",
            "price_range": "$12~25",
            "rating": Decimal("4.4"),
            "opening_hours": "07:00~21:00",
            "is_must_visit": True,
        },
        {
            "name": "10번가 스퀘어 전망대",
            "name_en": "10th Avenue Square Overlook",
            "name_ja": "10番街スクエア展望台",
            "spot_type": "view",
            "lat": Decimal("40.750500"),
            "lng": Decimal("-74.003800"),
            "order": 2,
            "distance_from_start_km": Decimal("1.2"),
            "description": "하이라인에서 아래 거리를 내려다보는 계단식 전망대. 일명 '도시의 극장'.",
            "tip": "일몰 시 허드슨강 방향 뷰가 환상적.",
        },
        {
            "name": "하이라인 야생화 정원",
            "name_en": "High Line Wildflower Field",
            "name_ja": "ハイライン野花の庭",
            "spot_type": "photo",
            "lat": Decimal("40.753000"),
            "lng": Decimal("-74.002500"),
            "order": 3,
            "distance_from_start_km": Decimal("1.8"),
            "description": "폐선로 위에 자란 야생화를 재현한 구간. 계절마다 다른 꽃이 핀다.",
        },
        {
            "name": "하이라인 북쪽 끝 (34가)",
            "name_en": "High Line North End (34th St)",
            "name_ja": "ハイライン北端（34丁目）",
            "spot_type": "end",
            "lat": Decimal("40.756400"),
            "lng": Decimal("-73.999800"),
            "order": 4,
            "distance_from_start_km": Decimal("2.3"),
            "description": "도착점. 허드슨 야드와 연결. The Vessel 조형물이 바로 옆에 있다.",
        },
    ],
    # 11: 방콕 차이나타운 야오와랏
    11: [
        {
            "name": "왓 망콘 까말라왓",
            "name_en": "Wat Mangkon Kamalawat",
            "name_ja": "ワットマンコン・カマラワート",
            "spot_type": "start",
            "lat": Decimal("13.741000"),
            "lng": Decimal("100.513300"),
            "order": 0,
            "distance_from_start_km": Decimal("0.0"),
            "description": "출발점. 방콕 차이나타운에서 가장 큰 중국 사원. MRT역 바로 앞.",
            "opening_hours": "06:00~18:00",
            "is_must_visit": True,
        },
        {
            "name": "야오와랏 로드 네온사인",
            "name_en": "Yaowarat Road Neon Signs",
            "name_ja": "ヤワラート通りのネオン",
            "spot_type": "photo",
            "lat": Decimal("13.740200"),
            "lng": Decimal("100.512000"),
            "order": 1,
            "distance_from_start_km": Decimal("0.5"),
            "description": "야오와랏 로드의 황금빛 네온사인. 야경 사진 명소로 유명.",
            "tip": "해 진 후 19시 이후가 가장 포토제닉한 시간대.",
            "is_must_visit": True,
        },
        {
            "name": "T&K 해산물",
            "name_en": "T&K Seafood",
            "name_ja": "T&Kシーフード",
            "spot_type": "restaurant",
            "lat": Decimal("13.739800"),
            "lng": Decimal("100.510800"),
            "order": 2,
            "distance_from_start_km": Decimal("1.0"),
            "description": "차이나타운에서 가장 유명한 해산물 길거리 식당. 초록색 셔츠가 트레이드마크.",
            "menu_highlight": "새우 볶음 (Goong Ob Woon Sen), 오이스터 오믈렛",
            "price_range": "150~300 THB",
            "rating": Decimal("4.3"),
            "opening_hours": "16:00~02:00",
            "is_must_visit": True,
        },
        {
            "name": "솜분 쩻나캇 노점",
            "name_en": "Street Food Stalls (Soi Texas)",
            "name_ja": "ストリートフード屋台（ソイテキサス）",
            "spot_type": "restaurant",
            "lat": Decimal("13.739200"),
            "lng": Decimal("100.509500"),
            "order": 3,
            "distance_from_start_km": Decimal("1.5"),
            "description": "소이 텍사스로 불리는 골목의 노점 밀집 구역. 꿀토스트, 망고밥, 족발국수 등.",
            "menu_highlight": "바미무대엥 (게살국수), 꿀토스트",
            "price_range": "40~100 THB",
            "rating": Decimal("4.2"),
            "opening_hours": "18:00~01:00",
        },
        {
            "name": "왓 뜨라이밋 (황금불상사원)",
            "name_en": "Wat Traimit (Golden Buddha Temple)",
            "name_ja": "ワットトライミット（黄金仏寺院）",
            "spot_type": "end",
            "lat": Decimal("13.738500"),
            "lng": Decimal("100.508500"),
            "order": 4,
            "distance_from_start_km": Decimal("2.0"),
            "description": "도착점. 세계 최대 순금 불상(5.5톤)이 있는 사원.",
            "opening_hours": "08:00~17:00",
            "price_range": "입장료 40 THB",
            "is_must_visit": True,
        },
    ],
}


# ──────────────────────────────────────────────
# REVIEWS (trail-specific, realistic)
# ──────────────────────────────────────────────
REVIEWS_DATA = {
    0: [  # 북촌
        (5, "골목 하나하나가 사진 맛집이에요. 아침 일찍 가면 관광객 없이 한옥 풍경을 독차지할 수 있어요."),
        (4, "분위기 좋은데 경사가 있어서 편한 신발 필수. 삼청동 카페에서 쉬어가는 게 포인트."),
        (5, "외국인 친구 데려가기 딱 좋은 코스. 한국의 아름다움을 제대로 느낄 수 있었어요."),
        (4, "주말은 사람이 너무 많아요. 평일 오전이 best!"),
    ],
    1: [  # 해운대
        (5, "달맞이길에서 본 바다가 진짜 환상이었어요. 문텐로드 데크길도 걷기 너무 좋았습니다."),
        (4, "청사포 다릿돌 전망대 일몰이 미쳤어요. 근데 주말에는 줄이 꽤 길더라고요."),
        (5, "해운대에서 청사포까지 해안 따라 걸으니까 머리가 맑아지는 느낌. 강력 추천합니다."),
        (4, "해녀촌에서 먹은 전복죽이 대박이었어요. 산책 후 보상으로 딱!"),
    ],
    2: [  # 제주 올레길 7코스
        (5, "주상절리 일몰은 정말 장관이에요. 제주 올레길 중 최고라고 감히 말할 수 있어요."),
        (4, "15km라 체력 필요. 하지만 해안 풍경이 워낙 아름다워서 힘든 줄 몰랐어요."),
        (4, "외돌개부터 시작하면 뒤로 갈수록 사람이 줄어서 조용히 걸을 수 있어요."),
        (5, "에메랄드빛 바다와 검은 현무암의 대비가 정말 제주스러워요."),
    ],
    3: [  # 전주
        (5, "비빔밥 먹고 초코파이 먹고 막걸리 마시고... 걷는 게 아니라 먹방 투어 ㅋㅋ"),
        (4, "경기전 대나무숲이 예상 외로 너무 좋았어요. 한복 입고 사진 찍는 분들 많더라고요."),
        (5, "남부시장 야시장은 꼭 금요일이나 토요일에 가세요! 분위기 미쳐요."),
        (4, "PNB 초코파이는 전주 오면 반드시 먹어야 할 맛! 포장도 가능해요."),
    ],
    4: [  # 야나카
        (5, "야나카 긴자에서 먹은 멘치카츠가 아직도 생각나요. 석양 계단도 정말 감성적."),
        (4, "고양이를 여기저기서 만나니까 산책 자체가 힐링. 카야바 커피 타마고 샌드 추천!"),
        (5, "도쿄에서 가장 좋아하는 산책 코스. 시부야랑은 완전 다른 도쿄를 볼 수 있어요."),
    ],
    5: [  # 교토 철학의 길
        (5, "벚꽃 시즌에 가면 현실이 아닌 것 같아요. 수로 위에 떨어진 꽃잎이 흘러가는 게 장관."),
        (4, "에이칸도 단풍도 꼭 보세요. 철학의 길 끝에 있어서 마무리로 딱입니다."),
        (5, "호넨인은 숨겨진 보석 같은 곳. 관광객이 적어서 고요하게 교토를 느낄 수 있어요."),
        (4, "2km밖에 안 되지만 양쪽으로 볼 게 많아서 2시간은 잡아야 해요."),
    ],
    6: [  # 지우펀
        (5, "해 지고 홍등에 불 들어오면 진짜 센과 치히로 세계에 온 느낌이에요!"),
        (4, "계단이 많아서 체력이 좀 필요해요. 그래도 타로볼 먹으면 에너지 충전 완료."),
        (4, "주말은 사람이 너무 많으니 평일 저녁을 추천합니다. 야경이 진짜 예뻐요."),
    ],
    7: [  # 런던 사우스뱅크
        (5, "버러 마켓에서 라클렛 샌드위치 먹고 템즈강 보면서 걸으니 최고였어요."),
        (4, "테이트 모던 무료 전시가 질 높아서 놀랐어요. 사우스뱅크 걸으면서 꼭 들러보세요."),
        (5, "빅벤에서 타워브릿지까지 런던 랜드마크 올인원 코스. 첫 런던 여행자에게 강추."),
        (4, "날씨만 좋으면 런던 최고의 산책 코스. 비오는 날은 패스 ㅋㅋ"),
    ],
    8: [  # 몽마르뜨
        (5, "사크레쾨르에서 내려다본 파리 전경이 잊을 수 없어요. 테르트르 광장 화가들도 좋았고."),
        (4, "아멜리에 카페에서 크렘 브륄레 먹으며 영화 속 장면을 떠올렸어요. 감동."),
        (4, "경사가 좀 있어서 체력 필요하지만, 이 동네만의 예술적 분위기가 파리 어디보다 매력적이에요."),
        (5, "물랭 루즈 앞에서 야경 사진 찍고 마무리. 완벽한 파리 산책 코스!"),
    ],
    9: [  # 바르셀로나
        (5, "고딕 지구 골목이 중세 영화 세트장 같아요. 곳곳에 숨은 광장들이 계속 나타나서 신기했어요."),
        (4, "엘스 콰트레 가츠에서 피카소가 앉았던 자리에서 커피를 마시다니. 감격."),
        (5, "대성당에서 바르셀로네타 해변까지 30분이면 골목 구경하며 도착. 타파스 바도 많아요."),
        (4, "소매치기 주의보! 그거만 조심하면 정말 매력적인 산책 코스입니다."),
    ],
    10: [  # 하이라인
        (5, "폐선로 위 공중 정원이라니, 발상 자체가 미쳤어요. 첼시 마켓 랍스터 롤도 꼭 드세요."),
        (4, "짧은 코스인데 중간중간 앉아서 쉴 수 있는 벤치가 많아서 좋았어요."),
        (5, "10번가 전망대에서 일몰 보는 것 강추! 맨해튼 하늘이 핑크색으로 물들어요."),
    ],
    11: [  # 방콕 야오와랏
        (5, "T&K 해산물 새우 볶음은 인생 먹거리! 야오와랏 네온 야경도 환상적이었어요."),
        (4, "더워서 힘들지만 먹거리가 워낙 맛있으니까 참을 수 있어요 ㅋㅋ 해 진 후 추천."),
        (5, "방콕 여행 1순위 추천. 길거리 음식만으로 배가 터져요. 가성비 최고."),
        (4, "왓 뜨라이밋 황금불상은 꼭 보세요. 5.5톤 순금이라니 실물로 보면 압도당해요."),
    ],
}


class Command(BaseCommand):
    help = "Seed the database with real walking trail data for the Roami platform"

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush", action="store_true", help="Delete existing seed data first"
        )

    def handle(self, *args, **options):
        if options["flush"]:
            self.stdout.write("Flushing existing data...")
            Review.objects.all().delete()
            Spot.objects.all().delete()
            TrailLike.objects.all().delete()
            Trail.objects.all().delete()
            Tag.objects.all().delete()
            CustomUser.objects.filter(is_superuser=False).delete()

        self.stdout.write("Creating users...")
        users = self._create_users()

        self.stdout.write("Creating tags...")
        tags = self._create_tags()

        self.stdout.write("Creating trails...")
        trails = self._create_trails(users, tags)

        self.stdout.write("Creating spots...")
        self._create_spots(trails, users)

        self.stdout.write("Creating reviews...")
        self._create_reviews(trails, users)

        self.stdout.write("Creating likes...")
        self._create_likes(trails, users)

        self.stdout.write(self.style.SUCCESS("Seed data created successfully!"))
        self.stdout.write(f"  - {len(users)} users")
        self.stdout.write(f"  - {len(tags)} tags")
        self.stdout.write(f"  - {len(trails)} trails")
        self.stdout.write(f"  - {Spot.objects.count()} spots")
        self.stdout.write(f"  - {Review.objects.count()} reviews")
        self.stdout.write(f"  - {TrailLike.objects.count()} likes")

    # ──────────────────────────────────────────
    # Users
    # ──────────────────────────────────────────
    def _create_users(self):
        users = []
        for username, nickname, lang, bio in USERS_DATA:
            user, created = CustomUser.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@example.com",
                    "nickname": nickname,
                    "bio": bio,
                    "preferred_language": lang,
                },
            )
            if created:
                user.set_password("testpass123!")
                user.save()
            users.append(user)

        # Mark some users as guides
        for idx in [2, 5, 7, 10]:  # jeju_olle, kyoto_aruki, london_adventures, nyc_pacer
            if idx < len(users):
                users[idx].is_guide = True
                users[idx].save(update_fields=["is_guide"])

        return users

    # ──────────────────────────────────────────
    # Tags
    # ──────────────────────────────────────────
    def _create_tags(self):
        tags = {}
        for name, name_en, name_ja in TAGS_DATA:
            tag, _ = Tag.objects.get_or_create(
                name=name, defaults={"name_en": name_en, "name_ja": name_ja}
            )
            tags[name] = tag
        return tags

    # ──────────────────────────────────────────
    # Trails
    # ──────────────────────────────────────────
    def _create_trails(self, users, tags):
        trails = []
        for i, data in enumerate(TRAILS_DATA):
            trail_fields = {
                k: v
                for k, v in data.items()
                if k not in ("title", "cover_image_url", "tag_names")
            }
            trail, created = Trail.objects.get_or_create(
                title=data["title"],
                defaults={
                    "author": users[i % len(users)],
                    "status": "approved",
                    **trail_fields,
                },
            )
            if created:
                # Assign tags by name
                tag_names = data.get("tag_names", [])
                tag_objs = [tags[n] for n in tag_names if n in tags]
                trail.tags.set(tag_objs)
                # Realistic engagement numbers
                trail.view_count = random.randint(120, 3500)
                trail.like_count = random.randint(15, 280)
                trail.save(update_fields=["like_count", "view_count"])
            trails.append(trail)
        return trails

    # ──────────────────────────────────────────
    # Spots
    # ──────────────────────────────────────────
    def _create_spots(self, trails, users):
        for trail_idx, spots in SPOTS_DATA.items():
            if trail_idx >= len(trails):
                continue
            trail = trails[trail_idx]
            for spot_data in spots:
                Spot.objects.get_or_create(
                    trail=trail,
                    name=spot_data["name"],
                    defaults={
                        "author": trail.author,
                        "name_en": spot_data.get("name_en", ""),
                        "name_ja": spot_data.get("name_ja", ""),
                        "spot_type": spot_data["spot_type"],
                        "lat": spot_data["lat"],
                        "lng": spot_data["lng"],
                        "order": spot_data["order"],
                        "distance_from_start_km": spot_data.get(
                            "distance_from_start_km", Decimal("0")
                        ),
                        "description": spot_data.get("description", ""),
                        "menu_highlight": spot_data.get("menu_highlight", ""),
                        "price_range": spot_data.get("price_range", ""),
                        "rating": spot_data.get("rating"),
                        "tip": spot_data.get("tip", ""),
                        "opening_hours": spot_data.get("opening_hours", ""),
                        "closed_days": spot_data.get("closed_days", ""),
                        "is_must_visit": spot_data.get("is_must_visit", False),
                        "day_number": spot_data.get("day_number", 1),
                        "status": "approved",
                    },
                )

    # ──────────────────────────────────────────
    # Reviews
    # ──────────────────────────────────────────
    def _create_reviews(self, trails, users):
        for trail_idx, reviews in REVIEWS_DATA.items():
            if trail_idx >= len(trails):
                continue
            trail = trails[trail_idx]
            available_users = list(users)
            random.shuffle(available_users)

            for j, (rating, content) in enumerate(reviews):
                author = available_users[j % len(available_users)]
                if Review.objects.filter(trail=trail, author=author).exists():
                    continue
                days_ago = random.randint(5, 120)
                Review.objects.create(
                    trail=trail,
                    author=author,
                    rating=rating,
                    content=content,
                    visited_date=date.today() - timedelta(days=days_ago),
                    helpful_count=random.randint(0, 35),
                    status="approved",
                )

    # ──────────────────────────────────────────
    # Likes
    # ──────────────────────────────────────────
    def _create_likes(self, trails, users):
        for trail in trails:
            num_likers = random.randint(2, min(8, len(users)))
            likers = random.sample(users, num_likers)
            for user in likers:
                TrailLike.objects.get_or_create(user=user, trail=trail)
