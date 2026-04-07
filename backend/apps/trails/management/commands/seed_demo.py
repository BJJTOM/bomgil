"""
Seed realistic demo data: 100 users, trails with paths/spots, community posts, activities, reviews.
Usage: python manage.py seed_demo
To remove: python manage.py seed_demo --flush
"""
import io
import random
import struct
import zlib
from datetime import timedelta
from decimal import Decimal

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import CustomUser
from apps.activities.models import ActivityTrack
from apps.community.models import (
    Challenge,
    ChallengeParticipant,
    Group,
    GroupMember,
    Post,
    PostBookmark,
    PostComment,
    PostImage,
    PostLike,
)
from apps.reviews.models import Review
from apps.spots.models import Spot, SpotImage
from apps.trails.models import Tag, Trail, TrailLike

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_png(r, g, b, w=100, h=100):
    """Generate a minimal valid PNG in memory (no PIL needed)."""
    def _chunk(ctype, data):
        c = ctype + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    raw = b""
    for _y in range(h):
        raw += b"\x00"  # filter none
        for _x in range(w):
            raw += bytes([r, g, b])
    idat = zlib.compress(raw, 1)
    png = b"\x89PNG\r\n\x1a\n"
    png += _chunk(b"IHDR", ihdr)
    png += _chunk(b"IDAT", idat)
    png += _chunk(b"IEND", b"")
    return png


def _random_color():
    return (random.randint(60, 220), random.randint(60, 220), random.randint(60, 220))


def _cover_file(name="cover.png"):
    c = _random_color()
    return ContentFile(_make_png(*c), name=name)


# ---------------------------------------------------------------------------
# Data pools
# ---------------------------------------------------------------------------

KOREAN_LASTNAMES = "김이박최정강조윤장임한오서신권황안송류홍전고문양손배백허유남심노하곽성차주"
KOREAN_FIRSTNAMES = [
    "민준","서준","도윤","예준","시우","하준","주원","지호","지후","준서",
    "서연","서윤","지우","서현","하은","하윤","민서","지유","윤서","채원",
    "수빈","지민","예은","소율","다은","예린","수아","시은","하린","지안",
]

WALKING_STYLES = ["explorer","foodie","photographer","talker","silent"]
AGE_RANGES = ["20s","30s","40s","50s_plus"]
BIOS = [
    "걷는 걸 좋아하는 직장인입니다","주말마다 새로운 길을 찾아 떠납니다",
    "느리게 걷기를 즐깁니다","카페 투어를 겸한 산책을 좋아해요",
    "사진 찍으며 걷는 게 취미입니다","자연 속을 걷는 게 힐링이에요",
    "반려견과 함께 산책합니다","러닝도 하고 걷기도 합니다",
    "매일 만보 걷기 도전 중!","서울 골목 탐방이 취미입니다",
]
ONE_LINERS = [
    "한 걸음씩, 천천히","오늘도 걸어볼까요","길 위에서 만나요",
    "걸으면 보이는 것들","발걸음이 곧 여행","산책은 최고의 명상",
]

# Real Korean trail data with actual coordinates
TRAILS_DATA = [
    {
        "title": "북촌 한옥마을 산책",
        "description": "전통 한옥과 현대가 어우러진 북촌의 골목길을 걸어보세요. 가회동부터 삼청동까지 아기자기한 갤러리와 카페가 곳곳에 숨어있습니다.",
        "region": "서울 종로구", "country": "KR", "difficulty": "easy",
        "distance_km": "2.80", "estimated_minutes": 50, "elevation_gain": 45,
        "start_lat": "37.579617", "start_lng": "126.985024",
        "end_lat": "37.582604", "end_lng": "126.981890",
        "best_season": "spring", "trail_type": "cultural",
        "path": [[126.985024,37.579617],[126.984532,37.580125],[126.983841,37.580834],[126.983150,37.581343],[126.982458,37.581852],[126.981890,37.582604]],
        "spots": [
            {"name":"안국역 1번 출구","type":"start","desc":"북촌 탐방의 시작점","lat":"37.579617","lng":"126.985024"},
            {"name":"북촌 8경","type":"photo","desc":"한옥 지붕과 남산타워가 한눈에","lat":"37.581200","lng":"126.983500","tip":"오전 일찍 가면 사람이 적어요"},
            {"name":"삼청동 카페거리","type":"cafe","desc":"예쁜 카페가 즐비한 거리","lat":"37.582000","lng":"126.982200","menu":"수제 음료, 디저트"},
        ],
        "tags": ["서울","한옥","골목","데이트"],
    },
    {
        "title": "경의선숲길 전구간",
        "description": "폐선 부지를 따라 조성된 도심 속 녹색 산책로. 연남동부터 효창공원까지 이어지는 6.3km 코스입니다.",
        "region": "서울 마포구", "country": "KR", "difficulty": "easy",
        "distance_km": "6.30", "estimated_minutes": 90, "elevation_gain": 15,
        "start_lat": "37.562401", "start_lng": "126.924810",
        "end_lat": "37.545892", "end_lng": "126.960483",
        "best_season": "all", "trail_type": "urban",
        "path": [[126.924810,37.562401],[126.928500,37.560200],[126.933100,37.558100],[126.938200,37.555800],[126.943500,37.553100],[126.949200,37.550500],[126.954800,37.548200],[126.960483,37.545892]],
        "spots": [
            {"name":"연남동 입구","type":"start","desc":"카페거리와 연결","lat":"37.562401","lng":"126.924810"},
            {"name":"연트럴파크","type":"rest","desc":"잔디밭에서 휴식","lat":"37.560200","lng":"126.928500"},
            {"name":"와우교 카페","type":"cafe","desc":"옥상 뷰가 좋은 카페","lat":"37.555800","lng":"126.938200","menu":"아메리카노, 크로플"},
            {"name":"대흥역 벽화","type":"photo","desc":"알록달록한 벽화 거리","lat":"37.550500","lng":"126.949200"},
        ],
        "tags": ["서울","산책","폐선","공원"],
    },
    {
        "title": "남산 둘레길 코스",
        "description": "남산타워를 중심으로 한 바퀴 도는 둘레길. 도심 속에서 숲과 전망을 동시에 즐길 수 있는 대표 산책 코스입니다.",
        "region": "서울 중구", "country": "KR", "difficulty": "moderate",
        "distance_km": "7.50", "estimated_minutes": 120, "elevation_gain": 210,
        "start_lat": "37.551169", "start_lng": "126.988227",
        "end_lat": "37.551169", "end_lng": "126.988227",
        "best_season": "autumn", "trail_type": "nature",
        "path": [[126.988227,37.551169],[126.987000,37.552800],[126.984500,37.554100],[126.981200,37.553800],[126.979500,37.552000],[126.980800,37.549500],[126.983500,37.548200],[126.986200,37.549800],[126.988227,37.551169]],
        "spots": [
            {"name":"남산 소월길 입구","type":"start","desc":"벚꽃 시즌에 특히 아름다운 시작점","lat":"37.551169","lng":"126.988227"},
            {"name":"N서울타워 전망대","type":"view","desc":"서울 전경이 한눈에","lat":"37.551080","lng":"126.988460","tip":"야경이 특히 아름답습니다"},
            {"name":"잠금장 포토존","type":"photo","desc":"사랑의 자물쇠가 가득한 포토존","lat":"37.552800","lng":"126.987000"},
            {"name":"남산 돈까스 거리","type":"restaurant","desc":"유명한 왕돈까스","lat":"37.554100","lng":"126.984500","menu":"왕돈까스, 우동"},
        ],
        "tags": ["서울","남산","둘레길","야경"],
    },
    {
        "title": "해운대 문탠로드",
        "description": "달맞이 고개를 따라 바다를 바라보며 걷는 부산의 인기 산책 코스. 문탠로드는 '달을 맞이하는 길'이라는 뜻입니다.",
        "region": "부산 해운대구", "country": "KR", "difficulty": "moderate",
        "distance_km": "4.80", "estimated_minutes": 80, "elevation_gain": 120,
        "start_lat": "35.162171", "start_lng": "129.175413",
        "end_lat": "35.156234", "end_lng": "129.190827",
        "best_season": "spring", "trail_type": "coastal",
        "path": [[129.175413,35.162171],[129.178200,35.161500],[129.181000,35.160200],[129.183800,35.159100],[129.186500,35.158000],[129.190827,35.156234]],
        "spots": [
            {"name":"해운대 해변","type":"start","desc":"넓은 백사장","lat":"35.162171","lng":"129.175413"},
            {"name":"달맞이 언덕","type":"view","desc":"바다와 일출을 동시에","lat":"35.160200","lng":"126.181000","tip":"새벽 일출 명소"},
            {"name":"청사포 다릿돌 전망대","type":"photo","desc":"SNS 인기 스팟","lat":"35.158000","lng":"129.186500"},
        ],
        "tags": ["부산","해변","바다","일출"],
    },
    {
        "title": "제주 올레길 7코스",
        "description": "서귀포 외돌개에서 월평까지 이어지는 해안 절경 코스. 주상절리와 에메랄드빛 바다가 함께하는 제주 대표 올레길입니다.",
        "region": "제주 서귀포시", "country": "KR", "difficulty": "moderate",
        "distance_km": "15.10", "estimated_minutes": 300, "elevation_gain": 180,
        "start_lat": "33.237460", "start_lng": "126.555432",
        "end_lat": "33.252310", "end_lng": "126.510238",
        "best_season": "autumn", "trail_type": "coastal",
        "path": [[126.555432,33.237460],[126.548000,33.239200],[126.540000,33.241500],[126.532000,33.244000],[126.524000,33.247000],[126.518000,33.249500],[126.510238,33.252310]],
        "spots": [
            {"name":"외돌개","type":"start","desc":"화산암 기둥이 인상적","lat":"33.237460","lng":"126.555432"},
            {"name":"주상절리대","type":"view","desc":"자연이 만든 예술","lat":"33.241500","lng":"126.540000","tip":"파도 칠 때가 장관"},
            {"name":"중문 해수욕장","type":"rest","desc":"에메랄드빛 해변","lat":"33.247000","lng":"126.524000"},
            {"name":"감귤 농장 카페","type":"cafe","desc":"직접 딴 감귤로 만든 주스","lat":"33.249500","lng":"126.518000","menu":"감귤주스, 한라봉 아이스크림"},
        ],
        "tags": ["제주","올레길","바다","절경"],
    },
    {
        "title": "전주 한옥마을 골목투어",
        "description": "전주 한옥마을의 구석구석 숨은 골목길을 탐방하는 코스. 맛집과 전통 문화가 공존하는 특별한 산책입니다.",
        "region": "전북 전주시", "country": "KR", "difficulty": "easy",
        "distance_km": "3.20", "estimated_minutes": 60, "elevation_gain": 20,
        "start_lat": "35.814045", "start_lng": "127.152667",
        "end_lat": "35.817230", "end_lng": "127.149843",
        "best_season": "spring", "trail_type": "cultural",
        "path": [[127.152667,35.814045],[127.152000,35.815000],[127.151200,35.815800],[127.150500,35.816500],[127.149843,35.817230]],
        "spots": [
            {"name":"경기전","type":"start","desc":"조선 태조 어진 봉안","lat":"35.814045","lng":"127.152667"},
            {"name":"PNB 풍년제과","type":"restaurant","desc":"전주 초코파이 원조","lat":"35.815000","lng":"127.152000","menu":"초코파이, 수제빵"},
            {"name":"전동성당","type":"photo","desc":"로마네스크 양식의 아름다운 성당","lat":"35.816500","lng":"127.150500"},
        ],
        "tags": ["전주","한옥마을","맛집","전통"],
    },
    {
        "title": "속초 해파랑길 42코스",
        "description": "속초 해변을 따라 걷는 해파랑길. 동해의 시원한 바다바람과 함께하는 트레킹 코스입니다.",
        "region": "강원 속초시", "country": "KR", "difficulty": "easy",
        "distance_km": "5.50", "estimated_minutes": 90, "elevation_gain": 30,
        "start_lat": "38.190526", "start_lng": "128.592834",
        "end_lat": "38.207318", "end_lng": "128.596217",
        "best_season": "summer", "trail_type": "coastal",
        "path": [[128.592834,38.190526],[128.593500,38.193000],[128.594200,38.196000],[128.595000,38.199000],[128.595500,38.202000],[128.596217,38.207318]],
        "spots": [
            {"name":"속초 해수욕장","type":"start","desc":"깨끗한 백사장","lat":"38.190526","lng":"128.592834"},
            {"name":"영금정 일출공원","type":"view","desc":"동해 일출 명소","lat":"38.196000","lng":"128.594200","tip":"여름 새벽 4시 30분 일출"},
            {"name":"속초 중앙시장","type":"restaurant","desc":"닭강정과 순대의 성지","lat":"38.202000","lng":"128.595500","menu":"만석닭강정, 아바이순대"},
        ],
        "tags": ["속초","바다","해파랑길","맛집"],
    },
    {
        "title": "여수 밤바다 해안로",
        "description": "여수의 아름다운 해안을 따라 걷는 야경 산책 코스. 밤에 특히 아름다운 여수 바다를 만끽할 수 있습니다.",
        "region": "전남 여수시", "country": "KR", "difficulty": "easy",
        "distance_km": "4.00", "estimated_minutes": 70, "elevation_gain": 25,
        "start_lat": "34.739740", "start_lng": "127.736580",
        "end_lat": "34.746530", "end_lng": "127.742320",
        "best_season": "summer", "trail_type": "coastal",
        "path": [[127.736580,34.739740],[127.737800,34.741200],[127.739000,34.742500],[127.740500,34.744000],[127.742320,34.746530]],
        "spots": [
            {"name":"여수 해상케이블카","type":"start","desc":"바다 위를 나는 기분","lat":"34.739740","lng":"127.736580"},
            {"name":"돌산대교 야경","type":"photo","desc":"여수의 상징적 야경","lat":"34.742500","lng":"127.739000","tip":"해질녘부터 가면 노을+야경"},
            {"name":"서대회센터","type":"restaurant","desc":"신선한 회를 맛볼 수 있는 곳","lat":"34.744000","lng":"127.740500","menu":"광어회, 전복죽"},
        ],
        "tags": ["여수","야경","바다","해안"],
    },
    {
        "title": "인왕산 성곽길",
        "description": "서울 도심에서 만나는 성곽 트레킹. 인왕산 정상에서 바라보는 경복궁과 북한산의 파노라마가 압권입니다.",
        "region": "서울 종로구", "country": "KR", "difficulty": "hard",
        "distance_km": "5.80", "estimated_minutes": 150, "elevation_gain": 320,
        "start_lat": "37.577250", "start_lng": "126.968580",
        "end_lat": "37.584120", "end_lng": "126.959340",
        "best_season": "autumn", "trail_type": "nature",
        "path": [[126.968580,37.577250],[126.967000,37.578500],[126.965000,37.580000],[126.963000,37.581500],[126.961000,37.583000],[126.959340,37.584120]],
        "spots": [
            {"name":"사직공원 입구","type":"start","desc":"인왕산 등산 시작점","lat":"37.577250","lng":"126.968580"},
            {"name":"인왕산 정상","type":"view","desc":"서울 시내 360도 파노라마","lat":"37.581500","lng":"126.963000","tip":"맑은 날 북한산까지 보여요"},
            {"name":"청운동 윤동주 문학관","type":"temple","desc":"시인 윤동주의 자취","lat":"37.583000","lng":"126.961000"},
        ],
        "tags": ["서울","등산","성곽","전망"],
    },
    {
        "title": "양재천 힐링 산책",
        "description": "양재천을 따라 이어지는 평탄한 산책로. 벚꽃 시즌에는 핑크빛 터널이 장관이며, 평소에도 시민들의 휴식처입니다.",
        "region": "서울 강남구", "country": "KR", "difficulty": "easy",
        "distance_km": "5.00", "estimated_minutes": 70, "elevation_gain": 5,
        "start_lat": "37.474580", "start_lng": "127.043280",
        "end_lat": "37.470120", "end_lng": "127.076540",
        "best_season": "spring", "trail_type": "urban",
        "path": [[127.043280,37.474580],[127.049000,37.473500],[127.055000,37.472800],[127.061000,37.472000],[127.067000,37.471200],[127.076540,37.470120]],
        "spots": [
            {"name":"양재시민의숲","type":"start","desc":"넓은 녹지 공간","lat":"37.474580","lng":"127.043280"},
            {"name":"벚꽃 터널","type":"photo","desc":"봄에만 볼 수 있는 장관","lat":"37.472800","lng":"127.055000","tip":"3월 말~4월 초 만개"},
            {"name":"탄천 합류점","type":"rest","desc":"넓은 잔디밭에서 휴식","lat":"37.471200","lng":"127.067000"},
        ],
        "tags": ["서울","벚꽃","산책","힐링"],
    },
    {
        "title": "감천문화마을 골목여행",
        "description": "부산의 마추픽추라 불리는 감천문화마을. 형형색색의 집들이 계단식으로 늘어선 독특한 풍경이 매력적인 코스입니다.",
        "region": "부산 사하구", "country": "KR", "difficulty": "moderate",
        "distance_km": "2.50", "estimated_minutes": 60, "elevation_gain": 85,
        "start_lat": "35.097380", "start_lng": "129.010520",
        "end_lat": "35.094210", "end_lng": "129.013840",
        "best_season": "all", "trail_type": "cultural",
        "path": [[129.010520,35.097380],[129.011200,35.096800],[129.012000,35.096000],[129.012800,35.095200],[129.013840,35.094210]],
        "spots": [
            {"name":"마을 안내소","type":"start","desc":"지도와 스탬프 투어 시작","lat":"35.097380","lng":"129.010520"},
            {"name":"어린왕자와 사막여우","type":"photo","desc":"감천마을 대표 포토존","lat":"35.096000","lng":"129.012000"},
            {"name":"감내어울터","type":"cafe","desc":"마을 주민이 운영하는 카페","lat":"35.094210","lng":"129.013840","menu":"감천라떼, 수제쿠키"},
        ],
        "tags": ["부산","감천","마을","포토"],
    },
    {
        "title": "강릉 경포호 둘레길",
        "description": "경포호수를 한 바퀴 도는 평화로운 산책길. 호수에 비치는 산과 하늘이 그림 같은 풍경을 만들어냅니다.",
        "region": "강원 강릉시", "country": "KR", "difficulty": "easy",
        "distance_km": "4.30", "estimated_minutes": 60, "elevation_gain": 10,
        "start_lat": "37.796450", "start_lng": "128.896320",
        "end_lat": "37.796450", "end_lng": "128.896320",
        "best_season": "spring", "trail_type": "nature",
        "path": [[128.896320,37.796450],[128.899000,37.798000],[128.902000,37.799000],[128.904000,37.797500],[128.903000,37.795000],[128.900000,37.794000],[128.897000,37.795000],[128.896320,37.796450]],
        "spots": [
            {"name":"경포대","type":"start","desc":"관동팔경 중 하나","lat":"37.796450","lng":"128.896320"},
            {"name":"허균·허난설헌 생가","type":"temple","desc":"조선시대 문인의 생가","lat":"37.799000","lng":"128.902000"},
            {"name":"순두부마을","type":"restaurant","desc":"강릉 초당순두부","lat":"37.794000","lng":"128.900000","menu":"초당순두부, 두부젤라또"},
        ],
        "tags": ["강릉","호수","둘레길","순두부"],
    },
]

POST_TEMPLATES = [
    {"cat":"free","title":"오늘 산책 너무 좋았어요","content":"날씨가 좋아서 {trail} 다녀왔는데 정말 힐링이었어요. 바람도 시원하고 사람도 적당해서 완벽한 산책이었습니다."},
    {"cat":"recommend","title":"{trail} 강력 추천합니다!","content":"지난 주말에 다녀왔는데 진짜 너무 좋았어요. 경치도 좋고 길도 잘 정비되어 있어서 초보자도 편하게 걸을 수 있습니다. 꼭 가보세요!"},
    {"cat":"review","title":"{trail} 후기","content":"총 {km}km 걸었는데 체감상 더 짧게 느껴졌어요. 중간중간 쉴 곳도 많고, 카페도 있어서 지루하지 않았습니다. 다음에 또 갈 예정!"},
    {"cat":"tip","title":"산책할 때 이것만은 챙기세요","content":"1. 물병 (500ml 이상)\n2. 편한 운동화\n3. 자외선 차단제\n4. 가벼운 간식\n5. 보조배터리\n\n이것만 있으면 산책이 10배 즐거워져요!"},
    {"cat":"qna","title":"이번 주말 산책 코스 추천해주세요","content":"서울 근교에서 2~3시간 정도 걸을 수 있는 코스 추천 부탁드립니다. 난이도는 쉬움~보통이면 좋겠어요!"},
    {"cat":"meetup","title":"이번 토요일 {trail} 같이 걸으실 분!","content":"이번 토요일 오전 10시에 {trail}에서 산책 모임 합니다! 편하게 오셔서 같이 걸어요. 참가비 없고, 산책 후 점심도 같이해요."},
    {"cat":"free","title":"산책 인증합니다","content":"오늘 {km}km 걸었어요! 목표 달성! 매일 꾸준히 걷다 보니 체력이 많이 좋아진 것 같습니다."},
    {"cat":"review","title":"{trail} 솔직 후기 (별점 ★★★★☆)","content":"전체적으로 좋았지만 몇 가지 아쉬운 점도 있었어요. 경치는 정말 최고인데, 화장실이 좀 부족했어요. 그래도 재방문 의사 있습니다!"},
    {"cat":"tip","title":"비 오는 날 산책 꿀팁","content":"비 오는 날에도 산책을 즐길 수 있어요!\n\n1. 방수 재킷 필수\n2. 미끄럼 방지 신발\n3. 우산보다는 비옷 추천\n4. 카메라 방수 케이스\n\n비 온 후의 풍경이 더 아름답답니다."},
    {"cat":"recommend","title":"강아지랑 산책하기 좋은 곳","content":"{trail} 반려견 동반 가능하고 넓어서 강아지들이 좋아해요. 물그릇도 곳곳에 있고, 잔디밭도 넓어서 뛰어놀기 좋습니다."},
]

COMMENT_TEMPLATES = [
    "저도 다녀왔는데 정말 좋았어요!","다음에 꼭 가봐야겠네요","사진 너무 예뻐요 ㅎㅎ",
    "좋은 정보 감사합니다","저도 추천합니다!","오 여기 진짜 좋죠",
    "주차는 편한가요?","소요 시간이 어느 정도 걸리나요?","반려동물 출입 가능한가요?",
    "날씨 좋은 날 가면 최고예요","야경도 예쁠 것 같아요","혼자 가도 괜찮을까요?",
    "다음에 같이 가요!","인스타 감성 가득하네요","운동화 신고 가야 하나요?",
]


class Command(BaseCommand):
    help = "Seed realistic demo data (100 users, trails, community posts, etc.)"

    def add_arguments(self, parser):
        parser.add_argument("--flush", action="store_true", help="Remove all demo data (users with @demo.moru)")

    def handle(self, *args, **options):
        if options["flush"]:
            self._flush()
            return
        self._seed()

    # ------------------------------------------------------------------
    def _flush(self):
        cnt = CustomUser.objects.filter(email__endswith="@demo.moru").delete()[0]
        self.stdout.write(self.style.SUCCESS(f"Deleted {cnt} demo objects (cascaded)."))

    # ------------------------------------------------------------------
    def _seed(self):
        self.stdout.write("Creating users...")
        users = self._create_users(100)

        self.stdout.write("Creating tags...")
        tags = self._create_tags()

        self.stdout.write("Creating trails...")
        trails = self._create_trails(users, tags)

        self.stdout.write("Creating trail likes...")
        self._create_trail_likes(users, trails)

        self.stdout.write("Creating community posts...")
        posts = self._create_posts(users, trails)

        self.stdout.write("Creating comments...")
        self._create_comments(users, posts)

        self.stdout.write("Creating post likes & bookmarks...")
        self._create_post_interactions(users, posts)

        self.stdout.write("Creating activities...")
        self._create_activities(users, trails)

        self.stdout.write("Creating reviews...")
        self._create_reviews(users, trails)

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully!"))

    # ------------------------------------------------------------------
    def _create_users(self, count):
        users = []
        existing = CustomUser.objects.filter(email__endswith="@demo.moru").count()
        for i in range(existing, existing + count):
            last = random.choice(KOREAN_LASTNAMES)
            first = random.choice(KOREAN_FIRSTNAMES)
            nick = f"{last}{first}{random.randint(1,99)}"
            email = f"demo{i}@demo.moru"
            try:
                u = CustomUser.objects.create_user(
                    username=f"demo_{i}",
                    email=email,
                    password="demo1234!",
                    nickname=nick,
                    bio=random.choice(BIOS),
                    one_liner=random.choice(ONE_LINERS),
                    walking_style=random.choice(WALKING_STYLES),
                    age_range=random.choice(AGE_RANGES),
                    total_walks=random.randint(5, 200),
                    is_verified=random.random() > 0.7,
                )
                users.append(u)
            except Exception:
                pass
        self.stdout.write(f"  Created {len(users)} users")
        return users or list(CustomUser.objects.filter(email__endswith="@demo.moru")[:count])

    # ------------------------------------------------------------------
    def _create_tags(self):
        tag_names = [
            "서울","부산","제주","강원","전주","경주","여수","속초",
            "한옥","바다","산","둘레길","골목","야경","벚꽃","단풍",
            "맛집","카페","데이트","힐링","포토","가족","반려견","등산",
            "올레길","해안","공원","역사","문화","자연",
        ]
        tags = []
        for name in tag_names:
            t, _ = Tag.objects.get_or_create(name=name)
            tags.append(t)
        return tags

    # ------------------------------------------------------------------
    def _create_trails(self, users, tags):
        trails = []
        for td in TRAILS_DATA:
            author = random.choice(users)
            trail = Trail.objects.create(
                author=author,
                title=td["title"],
                description=td["description"],
                region=td["region"],
                country=td["country"],
                difficulty=td["difficulty"],
                distance_km=Decimal(td["distance_km"]),
                estimated_minutes=td["estimated_minutes"],
                elevation_gain=td.get("elevation_gain"),
                start_lat=Decimal(td["start_lat"]),
                start_lng=Decimal(td["start_lng"]),
                end_lat=Decimal(td["end_lat"]),
                end_lng=Decimal(td["end_lng"]),
                path_data={"type": "LineString", "coordinates": td["path"]},
                best_season=td.get("best_season", "all"),
                trail_type=td.get("trail_type", "mixed"),
                status="approved",
                view_count=random.randint(50, 2000),
                like_count=0,  # will be updated by likes
            )
            # Cover image
            trail.cover_image.save(f"cover_{trail.id}.png", _cover_file(), save=True)

            # Tags
            tag_objs = [t for t in tags if t.name in td.get("tags", [])]
            if tag_objs:
                trail.tags.set(tag_objs)

            # Spots
            for idx, sp in enumerate(td.get("spots", [])):
                spot = Spot.objects.create(
                    trail=trail,
                    author=author,
                    name=sp["name"],
                    spot_type=sp.get("type", "photo"),
                    lat=Decimal(sp["lat"]),
                    lng=Decimal(sp["lng"]),
                    order=idx,
                    description=sp.get("desc", ""),
                    menu_highlight=sp.get("menu", ""),
                    tip=sp.get("tip", ""),
                    status="approved",
                )
                # Spot image
                SpotImage.objects.create(
                    spot=spot,
                    image=ContentFile(_make_png(*_random_color()), name=f"spot_{spot.id}.png"),
                    order=0,
                )

            trails.append(trail)
            self.stdout.write(f"  Trail: {trail.title} ({len(td.get('spots',[]))} spots)")

        return trails

    # ------------------------------------------------------------------
    def _create_trail_likes(self, users, trails):
        count = 0
        for trail in trails:
            likers = random.sample(users, min(len(users), random.randint(10, 60)))
            for user in likers:
                TrailLike.objects.get_or_create(user=user, trail=trail)
                count += 1
            trail.like_count = len(likers)
            trail.save(update_fields=["like_count"])
        self.stdout.write(f"  Created {count} trail likes")

    # ------------------------------------------------------------------
    def _create_posts(self, users, trails):
        posts = []
        for _ in range(40):
            tpl = random.choice(POST_TEMPLATES)
            trail = random.choice(trails)
            author = random.choice(users)
            title = tpl["title"].replace("{trail}", trail.title)
            content = tpl["content"].replace("{trail}", trail.title).replace("{km}", str(trail.distance_km))

            days_ago = random.randint(0, 30)
            post = Post.objects.create(
                author=author,
                category=tpl["cat"],
                title=title,
                content=content,
                trail=trail if random.random() > 0.3 else None,
                view_count=random.randint(10, 500),
            )
            Post.objects.filter(pk=post.pk).update(
                created_at=timezone.now() - timedelta(days=days_ago, hours=random.randint(0, 23))
            )

            # Some posts have images
            if random.random() > 0.4:
                for img_i in range(random.randint(1, 3)):
                    PostImage.objects.create(
                        post=post,
                        image=ContentFile(_make_png(*_random_color()), name=f"post_{post.id}_{img_i}.png"),
                        order=img_i,
                    )

            posts.append(post)
        self.stdout.write(f"  Created {len(posts)} posts")
        return posts

    # ------------------------------------------------------------------
    def _create_comments(self, users, posts):
        count = 0
        for post in posts:
            num_comments = random.randint(0, 8)
            for _ in range(num_comments):
                PostComment.objects.create(
                    post=post,
                    author=random.choice(users),
                    content=random.choice(COMMENT_TEMPLATES),
                )
                count += 1
            post.comment_count = num_comments
            post.save(update_fields=["comment_count"])
        self.stdout.write(f"  Created {count} comments")

    # ------------------------------------------------------------------
    def _create_post_interactions(self, users, posts):
        likes = 0
        bookmarks = 0
        for post in posts:
            # Likes
            num_likes = random.randint(0, 30)
            likers = random.sample(users, min(len(users), num_likes))
            for user in likers:
                PostLike.objects.get_or_create(user=user, post=post)
                likes += 1
            post.like_count = len(likers)

            # Bookmarks
            num_bm = random.randint(0, 10)
            bookmarkers = random.sample(users, min(len(users), num_bm))
            for user in bookmarkers:
                PostBookmark.objects.get_or_create(user=user, post=post)
                bookmarks += 1
            post.bookmark_count = len(bookmarkers)
            post.save(update_fields=["like_count", "bookmark_count"])

        self.stdout.write(f"  Created {likes} post likes, {bookmarks} bookmarks")

    # ------------------------------------------------------------------
    def _create_activities(self, users, trails):
        count = 0
        for _ in range(80):
            user = random.choice(users)
            trail = random.choice(trails)
            days_ago = random.randint(0, 60)
            started = timezone.now() - timedelta(days=days_ago, hours=random.randint(6, 18))
            dur = int(trail.estimated_minutes * random.uniform(0.8, 1.3))
            dist = float(trail.distance_km) * random.uniform(0.9, 1.1)

            ActivityTrack.objects.create(
                user=user,
                trail=trail,
                title=f"{trail.title} 걷기",
                source="phone_gps",
                started_at=started,
                finished_at=started + timedelta(minutes=dur),
                distance_km=Decimal(str(round(dist, 2))),
                duration_minutes=dur,
                total_steps=int(dist * random.randint(1300, 1600)),
                calories_burned=int(dist * random.randint(65, 85)),
                elevation_gain_m=trail.elevation_gain or 0,
                track_points=trail.path_data.get("coordinates", []),
                is_public=True,
            )
            count += 1
        self.stdout.write(f"  Created {count} activities")

    # ------------------------------------------------------------------
    def _create_reviews(self, users, trails):
        count = 0
        review_contents = [
            "정말 좋은 코스였어요! 경치도 좋고 길도 잘 정비되어 있습니다.",
            "주말에 가족과 함께 다녀왔는데 아이들도 좋아했어요.",
            "사진 찍기 좋은 곳이 많아요. 인스타 맛집!",
            "첫 번째 방문이었는데 기대 이상이었습니다. 다음에 또 올게요.",
            "봄에 벚꽃 필 때 가면 환상적일 것 같아요.",
            "약간 힘들었지만 정상에서 보는 경치가 보상해줬어요.",
            "카페도 좋고 중간에 쉴 곳이 많아서 편했습니다.",
            "비 온 다음날 가서 공기가 정말 좋았어요.",
        ]
        for trail in trails:
            num = random.randint(2, 8)
            reviewers = random.sample(users, min(len(users), num))
            for user in reviewers:
                days_ago = random.randint(1, 45)
                Review.objects.create(
                    trail=trail,
                    author=user,
                    rating=random.randint(3, 5),
                    content=random.choice(review_contents),
                    visited_date=(timezone.now() - timedelta(days=days_ago)).date(),
                    status="approved",
                    helpful_count=random.randint(0, 15),
                )
                count += 1
        self.stdout.write(f"  Created {count} reviews")
