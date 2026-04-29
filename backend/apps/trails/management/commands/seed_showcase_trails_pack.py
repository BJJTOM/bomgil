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
    # Empty → TrailCard renders the gradient + region emoji fallback.
    "cover_image_url": "",
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
    "cover_image_url": "",
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
# 남산 둘레길 (~7.5 km) — 남산공원 외곽 순환로
# ──────────────────────────────────────────────────────────────────────
NAMSAN_ANCHORS = [
    (37.55115, 126.99055, 95.0,  "남산 케이블카 하부 정류장"),
    (37.55175, 126.99230, 110.0, "백범광장 입구"),
    (37.55175, 126.99410, 130.0, "백범광장"),
    (37.55050, 126.99580, 145.0, "안중근 의사 기념관 갈림길"),
    (37.54970, 126.99720, 165.0, "남산도서관 위 둘레길"),
    (37.54895, 127.00010, 195.0, "남측 둘레길 진입"),
    (37.54810, 127.00280, 230.0, "남산타워 남측 전망"),
    (37.54900, 127.00510, 245.0, "팔각정 갈림길"),
    (37.55070, 127.00610, 235.0, "북측 둘레길 (성벽 옆)"),
    (37.55300, 127.00540, 215.0, "북측 산책로"),
    (37.55480, 127.00370, 195.0, "한옥마을 갈림길"),
    (37.55570, 127.00210, 175.0, "남산골 한옥마을 입구"),
    (37.55620, 127.00010, 155.0, "예장공원 위"),
    (37.55540, 126.99770, 130.0, "남산북측 우회로"),
    (37.55400, 126.99520, 110.0, "남대문 북측"),
    (37.55290, 126.99290, 100.0, "후암로 진입"),
    (37.55180, 126.99130, 96.0,  "케이블카 정류장 복귀"),
    (37.55115, 126.99055, 95.0,  "출발점 복귀"),
]
NAMSAN_META = {
    "title": "남산 둘레길 한바퀴",
    "title_en": "Namsan Park Loop",
    "title_ja": "南山 周回散策路",
    "description": (
        "케이블카 하부 정류장에서 출발해 남산 외곽 둘레길을 시계방향으로 한 바퀴 "
        "도는 7.5km 코스. 백범광장·남산타워 남측 전망·팔각정·한옥마을 입구를 거쳐 "
        "출발점으로 복귀합니다. 포장된 산책로 + 완만한 경사로 운동화면 충분하고, "
        "벚꽃철과 단풍철의 사진 포인트가 가장 많은 서울 대표 코스 중 하나."
    ),
    "description_en": (
        "A 7.5 km loop on the perimeter trail of Namsan Park, hitting Baekbeom "
        "Plaza, the south-side N Tower lookout, the Octagonal Pavilion fork "
        "and the Namsangol Hanok Village entrance before returning."
    ),
    "description_ja": (
        "ケーブルカー乗り場から南山公園の外周路を一周する7.5kmコース。"
        "白凡広場・タワー南側展望・八角亭・南山韓屋村入口を経て戻ります。"
    ),
    "region": "서울 중구",
    "country": "KR",
    "trail_type": "urban",
    "difficulty": "moderate",
    "walking_surface": "paved",
    "best_season": "spring",
    "estimated_minutes": 110,
    "transport_access": (
        "지하철 4호선 명동역 3번 출구 도보 10분 / 회현역 1번 출구 도보 7분 · "
        "남산케이블카 정류장에서 시작"
    ),
    "cover_image_url": "",
    "elevation_gain_hint": 180,
}
NAMSAN_SEGMENTS = [
    (0, 4,   "케이블카 정류장",  "남산도서관 갈림길",  "백범광장 워밍업 + 완만한 오르막"),
    (4, 8,   "남산도서관 갈림길","팔각정 갈림길",      "남측 둘레길 + 타워 전망"),
    (8, 12,  "팔각정 갈림길",    "한옥마을 입구",      "북측 산책로 — 가장 그늘 많은 구간"),
    (12, 17, "한옥마을 입구",    "출발 복귀",          "남대문 북측 → 출발점"),
]
NAMSAN_SPOTS = [
    ("start", "케이블카 하부 정류장", 0.00, 0,
        "지하철 명동역에서 도보로. 케이블카 매표소 옆 안내지도가 출발점.", ""),
    ("view", "백범광장", 0.35, 2,
        "남산 진입로의 첫 전망 — 도심을 한눈에 내려다 볼 수 있음.", ""),
    ("view", "남산타워 남측 전망", 2.30, 6,
        "남산타워를 가장 가까이서 올려다 볼 수 있는 지점. 사진 포인트.", ""),
    ("rest", "팔각정 갈림길", 3.10, 7,
        "벤치 + 식수대 + 화장실. 중간 휴식점.", ""),
    ("photo", "북측 둘레길 성벽", 4.15, 9,
        "조선시대 한양도성 성벽이 그대로 남은 구간. 단풍철 인기.", ""),
    ("cafe", "한옥마을 입구 카페", 5.45, 11,
        "한옥마을 정문 근처 다양한 카페 — 한국 전통차도 가능.", ""),
    ("end", "출발점 복귀", 7.50, 17,
        "수고하셨어요. 케이블카 정류장으로 복귀.", ""),
]
NAMSAN_STAMPS = [
    ("🗼", "남산타워 남측",     6, "도심에서 가장 가까운 N 타워 뷰"),
    ("🏯", "한옥도성 성벽",     9, "조선시대 성벽 위 산책"),
    ("🌳", "한옥마을 입구",     11, "전통 한옥 + 차 문화"),
]
NAMSAN_TAGS = ["남산", "둘레길", "도심", "단풍", "벚꽃", "외국인추천"]


# ──────────────────────────────────────────────────────────────────────
# 여의도 한강공원 ~5 km loop
# ──────────────────────────────────────────────────────────────────────
YEOUIDO_ANCHORS = [
    (37.52680, 126.93450, 6.0, "여의나루역 2번 출구"),
    (37.52615, 126.93620, 5.5, "여의도 한강공원 진입"),
    (37.52480, 126.93810, 5.0, "마포대교 남단 (생명의다리)"),
    (37.52320, 126.93995, 4.8, "여의도 수영장"),
    (37.52210, 126.93980, 4.7, "물빛광장 입구"),
    (37.52120, 126.93760, 4.6, "물빛광장 중앙"),
    (37.52150, 126.93530, 4.6, "여의도 자전거 빌리는 곳"),
    (37.52280, 126.93380, 4.7, "원효대교 남단"),
    (37.52440, 126.93260, 4.9, "샛강 합류"),
    (37.52580, 126.93290, 5.2, "한강공원 서측 (벚꽃길)"),
    (37.52680, 126.93450, 6.0, "여의나루역 복귀"),
]
YEOUIDO_META = {
    "title": "여의도 한강공원 둘레",
    "title_en": "Yeouido Han River Park Loop",
    "title_ja": "汝矣島 漢江公園 周回",
    "description": (
        "여의나루역에서 출발해 마포대교·여의도 수영장·물빛광장·원효대교를 거쳐 "
        "한강공원 서측 벚꽃길로 복귀하는 5km 평지 코스. 봄 벚꽃·여름 야경·가을 "
        "낙조까지 사계절 인기. 자전거 대여소가 곳곳에 있어 걷기 + 자전거 혼합도 가능."
    ),
    "description_en": (
        "A 5 km flat loop through Yeouido Han River Park covering Mapo Bridge, "
        "the swimming pool, Mulbit Plaza, Wonhyo Bridge and the western "
        "cherry-blossom path."
    ),
    "description_ja": (
        "汝矣ナル駅を出発し麻浦大橋・水泳場・水光広場・元暁大橋を経由する5km平坦コース。"
    ),
    "region": "서울 영등포구",
    "country": "KR",
    "trail_type": "river",
    "difficulty": "easy",
    "walking_surface": "paved",
    "best_season": "spring",
    "estimated_minutes": 75,
    "transport_access": "지하철 5호선 여의나루역 2번 출구 도보 0분",
    "cover_image_url": "",
    "elevation_gain_hint": 5,
}
YEOUIDO_SEGMENTS = [
    (0, 4,   "여의나루역",       "수영장",        "마포대교 → 수영장"),
    (4, 7,   "수영장",          "원효대교",      "물빛광장 + 자전거 거리"),
    (7, 10,  "원효대교",        "여의나루역 복귀","서측 벚꽃길 복귀"),
]
YEOUIDO_SPOTS = [
    ("start", "여의나루역 2번 출구", 0.00, 0,
        "지하철 5호선 여의나루역에서 한강공원으로 직접 연결.", ""),
    ("photo", "마포대교 생명의다리", 0.55, 2,
        "한강 마포대교 남단 — 야간 조명이 감성 포인트.", ""),
    ("photo", "물빛광장", 1.85, 5,
        "여름엔 분수, 가을엔 단풍 — 일몰 시 추천.", ""),
    ("rest", "자전거 대여소", 2.55, 6,
        "자전거 대여 가능 + 음수대 + 화장실.", ""),
    ("view", "원효대교 남단", 3.10, 7,
        "한강 서측 노을이 가장 잘 보이는 지점.", ""),
    ("end", "여의나루역 복귀", 5.00, 10,
        "수고하셨어요. 지하철로 복귀.", ""),
]
YEOUIDO_STAMPS = [
    ("🌸", "마포대교 야경",     2, "생명의다리 LED + 한강 야경"),
    ("⛲", "물빛광장",          5, "여름 분수 / 가을 단풍"),
    ("🌅", "원효대교 노을",     7, "한강 서측 일몰 명소"),
]
YEOUIDO_TAGS = ["한강", "여의도", "벚꽃", "야경", "평지", "리버사이드"]


# ──────────────────────────────────────────────────────────────────────
# 청계천 산책 ~4.5 km — 청계광장 → 살곶이다리
# ──────────────────────────────────────────────────────────────────────
CHEONGGYE_ANCHORS = [
    (37.56945, 126.97810, 18.0, "청계광장 (정조 도원공원)"),
    (37.56995, 126.98050, 17.0, "광교"),
    (37.57030, 126.98300, 16.5, "삼일교"),
    (37.57030, 126.98610, 16.0, "수표교"),
    (37.56990, 126.98920, 15.5, "관수교"),
    (37.56930, 126.99230, 15.0, "세운교"),
    (37.56900, 126.99520, 14.5, "배오개다리"),
    (37.56930, 126.99830, 14.0, "오간수교"),
    (37.56995, 127.00130, 13.5, "마전교"),
    (37.57080, 127.00440, 13.0, "버들다리"),
    (37.57180, 127.00750, 12.5, "황학교"),
    (37.57300, 127.01060, 12.0, "비우당교"),
    (37.57440, 127.01370, 11.5, "두물다리"),
    (37.57580, 127.01680, 11.0, "고산자교"),
    (37.57730, 127.01970, 10.5, "살곶이다리 진입"),
]
CHEONGGYE_META = {
    "title": "청계천 산책 — 광장 → 살곶이",
    "title_en": "Cheonggyecheon Stream Walk",
    "title_ja": "清渓川 散策コース",
    "description": (
        "청계광장에서 살곶이다리까지 청계천을 따라 동쪽으로 걷는 4.5km 평지 코스. "
        "복원된 도시하천 + 다리 14개 + 야간 조명이 어우러진 서울 도심 산책의 정석. "
        "전 구간 평지 + 그늘이 많아 한여름에도 무난합니다."
    ),
    "description_en": (
        "A 4.5 km eastbound walk along Cheonggyecheon stream from Cheonggye "
        "Plaza to Salgoji Bridge. Fully paved, ample shade, lit at night."
    ),
    "description_ja": (
        "清渓広場からサルゴジ橋まで清渓川を東へ歩く4.5kmの平坦コース。"
    ),
    "region": "서울 종로구·동대문구",
    "country": "KR",
    "trail_type": "river",
    "difficulty": "easy",
    "walking_surface": "paved",
    "best_season": "all",
    "estimated_minutes": 70,
    "transport_access": (
        "출발: 지하철 5호선 광화문역 5번 출구 도보 5분 · "
        "도착: 지하철 분당선 응봉역 도보 10분"
    ),
    "cover_image_url": "",
    "elevation_gain_hint": 0,
}
CHEONGGYE_SEGMENTS = [
    (0, 5,  "청계광장", "관수교",      "도심 다리 5개 통과"),
    (5, 9,  "관수교",   "마전교",      "동대문 시장 옆 구간"),
    (9, 14, "마전교",   "살곶이다리",  "동대문구 진입 + 도착"),
]
CHEONGGYE_SPOTS = [
    ("start", "청계광장", 0.00, 0,
        "광화문역 5번 출구 도보 5분. 도원공원 분수 옆이 출발점.", ""),
    ("photo", "광교", 0.20, 1,
        "청계천 첫 다리 — 야간 LED 조명이 인기.", ""),
    ("photo", "수표교", 0.85, 3,
        "조선시대 수표를 본떠 복원한 다리.", ""),
    ("view", "오간수교", 1.95, 7,
        "동대문 성곽이 보이는 뷰 포인트.", ""),
    ("rest", "버들다리", 2.85, 9,
        "그늘 + 벤치 + 화장실 — 중간 휴식.", ""),
    ("photo", "두물다리", 3.50, 12,
        "청계천 + 중랑천 합류 직전 — 일몰 시 노을 인기.", ""),
    ("end", "살곶이다리", 4.50, 14,
        "수고하셨어요. 분당선 응봉역에서 복귀 가능.", ""),
]
CHEONGGYE_STAMPS = [
    ("💧", "광교",       1, "청계천 첫 다리 / LED 조명"),
    ("🏯", "수표교",     3, "조선시대 수표 복원"),
    ("🌉", "두물다리",   12, "청계천 + 중랑천 합류 뷰"),
]
CHEONGGYE_TAGS = ["청계천", "도심", "야경", "평지", "다리", "리버사이드"]


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
        dict(
            key="namsan",
            anchors=NAMSAN_ANCHORS,
            meta=NAMSAN_META,
            segments=NAMSAN_SEGMENTS,
            spots=NAMSAN_SPOTS,
            stamps=NAMSAN_STAMPS,
            tags=NAMSAN_TAGS,
        ),
        dict(
            key="yeouido",
            anchors=YEOUIDO_ANCHORS,
            meta=YEOUIDO_META,
            segments=YEOUIDO_SEGMENTS,
            spots=YEOUIDO_SPOTS,
            stamps=YEOUIDO_STAMPS,
            tags=YEOUIDO_TAGS,
        ),
        dict(
            key="cheonggye",
            anchors=CHEONGGYE_ANCHORS,
            meta=CHEONGGYE_META,
            segments=CHEONGGYE_SEGMENTS,
            spots=CHEONGGYE_SPOTS,
            stamps=CHEONGGYE_STAMPS,
            tags=CHEONGGYE_TAGS,
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
