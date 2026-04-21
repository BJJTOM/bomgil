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
    # --- 20 ADDITIONAL OFFICIAL TRAILS ---
    {
        "title": "서울숲 산책로",
        "title_en": "Seoul Forest Walk",
        "description": "뚝섬 일대에 조성된 도심 속 생태공원 산책로. 사슴방사장과 가족마당, 한강 연결 보행교까지 약 3km를 평지로 이어 걸을 수 있다.",
        "region": "서울 성동구",
        "distance_km": Decimal("3.0"),
        "estimated_minutes": 50,
        "difficulty": "easy",
        "elevation_gain": 10,
        "start_lat": Decimal("37.544500"),
        "start_lng": Decimal("127.037500"),
        "end_lat": Decimal("37.546500"),
        "end_lng": Decimal("127.041500"),
        "trail_type": "urban",
        "best_season": "spring",
        "walking_surface": "paved",
        "transport_access": "지하철 수인분당선 서울숲역 3번 출구",
    },
    {
        "title": "올림픽공원 둘레길",
        "title_en": "Olympic Park Loop",
        "description": "몽촌토성과 88잔디마당, 나홀로나무를 품은 약 4.8km 순환 산책로. 언덕이 완만해 러너와 산책객이 공존하며 사계절 풍경이 고루 좋다.",
        "region": "서울 송파구",
        "distance_km": Decimal("4.8"),
        "estimated_minutes": 70,
        "difficulty": "easy",
        "elevation_gain": 40,
        "start_lat": Decimal("37.520500"),
        "start_lng": Decimal("127.121500"),
        "end_lat": Decimal("37.520500"),
        "end_lng": Decimal("127.121500"),
        "trail_type": "urban",
        "best_season": "all",
        "walking_surface": "paved",
        "transport_access": "지하철 5호선 올림픽공원역 3번 출구",
    },
    {
        "title": "서울로 7017",
        "title_en": "Seoullo 7017 Skygarden",
        "description": "옛 서울역 고가도로를 보행길로 재생한 약 1km의 공중 산책로. 서울역과 회현 일대를 잇고 수백 종의 식물이 구간별로 배치되어 있다.",
        "region": "서울 중구",
        "distance_km": Decimal("1.0"),
        "estimated_minutes": 20,
        "difficulty": "easy",
        "elevation_gain": 15,
        "start_lat": Decimal("37.555800"),
        "start_lng": Decimal("126.971500"),
        "end_lat": Decimal("37.558500"),
        "end_lng": Decimal("126.978000"),
        "trail_type": "urban",
        "best_season": "all",
        "walking_surface": "paved",
        "transport_access": "지하철 1·4호선 서울역 2번 출구",
    },
    {
        "title": "광교호수공원 산책로",
        "title_en": "Gwanggyo Lake Park Walk",
        "description": "원천·신대 두 저수지를 연결한 수변 공원의 대표 둘레길. 데크와 포장길이 번갈아 이어져 약 7km 구간을 무리 없이 걸을 수 있다.",
        "region": "경기 수원시",
        "distance_km": Decimal("7.0"),
        "estimated_minutes": 100,
        "difficulty": "easy",
        "elevation_gain": 20,
        "start_lat": Decimal("37.281500"),
        "start_lng": Decimal("127.059500"),
        "end_lat": Decimal("37.287500"),
        "end_lng": Decimal("127.066500"),
        "trail_type": "nature",
        "best_season": "all",
        "walking_surface": "mixed",
        "transport_access": "지하철 신분당선 광교중앙역 2번 출구",
    },
    {
        "title": "팔당물안개공원 산책로",
        "title_en": "Paldang Water Mist Park Walk",
        "description": "팔당호 남단에 자리한 수변 공원 일대의 평지 산책 코스. 이른 아침 물안개와 자전거길 풍경이 어우러져 사진 스폿으로도 유명하다.",
        "region": "경기 남양주시",
        "distance_km": Decimal("3.5"),
        "estimated_minutes": 55,
        "difficulty": "easy",
        "elevation_gain": 5,
        "start_lat": Decimal("37.534500"),
        "start_lng": Decimal("127.246500"),
        "end_lat": Decimal("37.536500"),
        "end_lng": Decimal("127.252500"),
        "trail_type": "nature",
        "best_season": "spring",
        "walking_surface": "mixed",
        "transport_access": "경의중앙선 팔당역에서 도보 15분",
    },
    {
        "title": "월미도 문화의거리",
        "title_en": "Wolmido Culture Street",
        "description": "인천항을 바라보며 걷는 약 2km의 해안 거리. 놀이공원과 카페, 선착장이 이어져 야경 산책 코스로 인기가 높다.",
        "region": "인천 중구",
        "distance_km": Decimal("2.0"),
        "estimated_minutes": 35,
        "difficulty": "easy",
        "elevation_gain": 0,
        "start_lat": Decimal("37.475500"),
        "start_lng": Decimal("126.596500"),
        "end_lat": Decimal("37.478500"),
        "end_lng": Decimal("126.598500"),
        "trail_type": "coastal",
        "best_season": "all",
        "walking_surface": "paved",
        "transport_access": "인천역에서 시내버스 2·23·45번",
    },
    {
        "title": "춘천 의암호 스카이워크 산책로",
        "title_en": "Chuncheon Uiam Lake Skywalk Walk",
        "description": "소양강 처녀상과 의암호 스카이워크를 잇는 약 2.5km의 호반 산책 코스. 물안개와 석양이 겹치는 저녁 시간 풍경이 특히 좋다.",
        "region": "강원 춘천시",
        "distance_km": Decimal("2.5"),
        "estimated_minutes": 40,
        "difficulty": "easy",
        "elevation_gain": 5,
        "start_lat": Decimal("37.878500"),
        "start_lng": Decimal("127.723500"),
        "end_lat": Decimal("37.881500"),
        "end_lng": Decimal("127.728500"),
        "trail_type": "nature",
        "best_season": "fall",
        "walking_surface": "paved",
        "transport_access": "ITX 춘천역에서 시내버스",
    },
    {
        "title": "속초 외옹치 바다향기로",
        "title_en": "Sokcho Oeongchi Sea Scent Trail",
        "description": "속초해수욕장 남쪽 외옹치항에서 시작해 바다를 따라 이어지는 약 1.7km의 해안 데크길. 속초등대 방향으로 연결되어 파도 소리를 가까이 들을 수 있다.",
        "region": "강원 속초시",
        "distance_km": Decimal("1.7"),
        "estimated_minutes": 30,
        "difficulty": "easy",
        "elevation_gain": 10,
        "start_lat": Decimal("38.196500"),
        "start_lng": Decimal("128.600500"),
        "end_lat": Decimal("38.203500"),
        "end_lng": Decimal("128.602500"),
        "trail_type": "coastal",
        "best_season": "summer",
        "walking_surface": "mixed",
        "transport_access": "속초고속버스터미널에서 시내버스",
    },
    {
        "title": "강릉 경포호 둘레길",
        "title_en": "Gangneung Gyeongpo Lake Loop",
        "description": "경포호를 한 바퀴 도는 약 4.3km의 호수 순환 코스. 벚꽃과 연꽃, 철새가 시기별로 바뀌어 언제 찾아도 지루하지 않다.",
        "region": "강원 강릉시",
        "distance_km": Decimal("4.3"),
        "estimated_minutes": 65,
        "difficulty": "easy",
        "elevation_gain": 10,
        "start_lat": Decimal("37.795500"),
        "start_lng": Decimal("128.906500"),
        "end_lat": Decimal("37.795500"),
        "end_lng": Decimal("128.906500"),
        "trail_type": "nature",
        "best_season": "spring",
        "walking_surface": "paved",
        "transport_access": "강릉역에서 202번 시내버스",
    },
    {
        "title": "계족산 황톳길",
        "title_en": "Gyejoksan Red Clay Trail",
        "description": "대전 장동산림욕장을 감싸고 이어지는 약 14.5km의 맨발 황톳길. 숲 그늘과 완만한 임도가 교차해 맨발 걷기 명소로 널리 알려져 있다.",
        "region": "대전 대덕구",
        "distance_km": Decimal("14.5"),
        "estimated_minutes": 240,
        "difficulty": "moderate",
        "elevation_gain": 250,
        "start_lat": Decimal("36.399500"),
        "start_lng": Decimal("127.458500"),
        "end_lat": Decimal("36.399500"),
        "end_lng": Decimal("127.458500"),
        "trail_type": "nature",
        "best_season": "summer",
        "walking_surface": "unpaved",
        "transport_access": "대전 지하철 1호선 신탄진역에서 74번 버스",
    },
    {
        "title": "대청호 오백리길 1구간",
        "title_en": "Daecheongho 500-ri Trail Course 1",
        "description": "대청호 남쪽 호반을 따라 걷는 첫 구간으로 약 9km의 흙길과 포장길이 섞인 코스. 호수를 내려다보는 전망 지점이 여러 번 등장한다.",
        "region": "충북 청주시",
        "distance_km": Decimal("9.0"),
        "estimated_minutes": 160,
        "difficulty": "moderate",
        "elevation_gain": 180,
        "start_lat": Decimal("36.479500"),
        "start_lng": Decimal("127.483500"),
        "end_lat": Decimal("36.455500"),
        "end_lng": Decimal("127.500500"),
        "trail_type": "nature",
        "best_season": "fall",
        "walking_surface": "mixed",
        "transport_access": "청주 시내버스 문의면 방면",
    },
    {
        "title": "안동 하회마을 둘레길",
        "title_en": "Andong Hahoe Village Walk",
        "description": "낙동강이 마을을 휘감아 도는 하회마을 외곽을 따라 걷는 약 2.5km의 평지 탐방 코스. 기와와 초가가 이어진 마을길과 강변 솔숲을 함께 본다.",
        "region": "경북 안동시",
        "distance_km": Decimal("2.5"),
        "estimated_minutes": 45,
        "difficulty": "easy",
        "elevation_gain": 10,
        "start_lat": Decimal("36.539500"),
        "start_lng": Decimal("128.517500"),
        "end_lat": Decimal("36.540500"),
        "end_lng": Decimal("128.521500"),
        "trail_type": "village",
        "best_season": "fall",
        "walking_surface": "unpaved",
        "transport_access": "안동역에서 246번 시내버스",
    },
    {
        "title": "호미곶 해맞이광장 해안길",
        "title_en": "Homigot Sunrise Square Coastal Walk",
        "description": "호미곶 상생의 손 조형물을 중심으로 한 약 2km의 해안 산책 코스. 동해 일출 명소답게 새벽과 아침의 분위기가 특별하다.",
        "region": "경북 포항시",
        "distance_km": Decimal("2.0"),
        "estimated_minutes": 35,
        "difficulty": "easy",
        "elevation_gain": 5,
        "start_lat": Decimal("36.076500"),
        "start_lng": Decimal("129.566500"),
        "end_lat": Decimal("36.080500"),
        "end_lng": Decimal("129.569500"),
        "trail_type": "coastal",
        "best_season": "winter",
        "walking_surface": "paved",
        "transport_access": "포항 시외버스터미널에서 200번 버스",
    },
    {
        "title": "통영 동피랑 벽화마을길",
        "title_en": "Tongyeong Dongpirang Mural Village Walk",
        "description": "강구안 위쪽 언덕에 자리한 벽화마을을 오르내리는 약 1.5km의 골목 산책. 골목 끝 전망대에서 통영항 전경을 한눈에 담을 수 있다.",
        "region": "경남 통영시",
        "distance_km": Decimal("1.5"),
        "estimated_minutes": 35,
        "difficulty": "moderate",
        "elevation_gain": 60,
        "start_lat": Decimal("34.844500"),
        "start_lng": Decimal("128.425500"),
        "end_lat": Decimal("34.846500"),
        "end_lng": Decimal("128.427500"),
        "trail_type": "village",
        "best_season": "all",
        "walking_surface": "paved",
        "transport_access": "통영종합버스터미널에서 101·141번 버스",
    },
    {
        "title": "담양 메타세쿼이아길",
        "title_en": "Damyang Metasequoia Road",
        "description": "메타세쿼이아 가로수가 도열한 약 2.4km 직선 산책로. 가로수길 양옆 보행 데크를 따라 천천히 왕복하기 좋다.",
        "region": "전남 담양군",
        "distance_km": Decimal("2.4"),
        "estimated_minutes": 40,
        "difficulty": "easy",
        "elevation_gain": 0,
        "start_lat": Decimal("35.333500"),
        "start_lng": Decimal("126.997500"),
        "end_lat": Decimal("35.346500"),
        "end_lng": Decimal("126.998500"),
        "trail_type": "nature",
        "best_season": "fall",
        "walking_surface": "paved",
        "transport_access": "담양공용버스터미널에서 도보 20분",
    },
    {
        "title": "여수 해양공원 해안 산책로",
        "title_en": "Yeosu Marine Park Coastal Walk",
        "description": "이순신광장에서 여수해양공원을 지나 하멜등대 방향으로 이어지는 약 2km의 야경 산책 코스. 저녁에는 돌산대교 조명이 바다에 비친다.",
        "region": "전남 여수시",
        "distance_km": Decimal("2.0"),
        "estimated_minutes": 35,
        "difficulty": "easy",
        "elevation_gain": 5,
        "start_lat": Decimal("34.740500"),
        "start_lng": Decimal("127.743500"),
        "end_lat": Decimal("34.737500"),
        "end_lng": Decimal("127.750500"),
        "trail_type": "coastal",
        "best_season": "summer",
        "walking_surface": "paved",
        "transport_access": "여수엑스포역에서 시내버스 2번",
    },
    {
        "title": "제주올레 10코스 (화순 → 모슬포)",
        "title_en": "Jeju Olle Route 10",
        "description": "화순금모래해변에서 시작해 산방산과 송악산을 지나 모슬포 하모체육공원까지 이어지는 약 15.6km 코스. 해안과 오름이 번갈아 나타난다.",
        "region": "제주 서귀포시",
        "distance_km": Decimal("15.6"),
        "estimated_minutes": 330,
        "difficulty": "moderate",
        "elevation_gain": 260,
        "start_lat": Decimal("33.236500"),
        "start_lng": Decimal("126.316500"),
        "end_lat": Decimal("33.213500"),
        "end_lng": Decimal("126.252500"),
        "trail_type": "coastal",
        "best_season": "spring",
        "walking_surface": "mixed",
        "transport_access": "서귀포버스터미널에서 202번 간선버스",
    },
    {
        "title": "제주올레 8코스 (월평 → 대평)",
        "title_en": "Jeju Olle Route 8",
        "description": "월평 아왜낭목에서 대평포구까지 약 19.6km를 걷는 해안 중심 코스. 주상절리대와 중문, 예래마을을 차례로 지나며 풍경 변화가 크다.",
        "region": "제주 서귀포시",
        "distance_km": Decimal("19.6"),
        "estimated_minutes": 390,
        "difficulty": "moderate",
        "elevation_gain": 280,
        "start_lat": Decimal("33.234500"),
        "start_lng": Decimal("126.428500"),
        "end_lat": Decimal("33.235500"),
        "end_lng": Decimal("126.368500"),
        "trail_type": "coastal",
        "best_season": "spring",
        "walking_surface": "mixed",
        "transport_access": "서귀포버스터미널에서 202번 간선버스",
    },
    {
        "title": "제주올레 21코스 (하도 → 종달)",
        "title_en": "Jeju Olle Route 21",
        "description": "하도해수욕장에서 종달바당까지 약 11.3km를 걷는 올레의 마지막 코스. 해녀박물관과 지미봉을 지나 제주도 동쪽 끝 해안을 차분히 따라간다.",
        "region": "제주 제주시",
        "distance_km": Decimal("11.3"),
        "estimated_minutes": 240,
        "difficulty": "moderate",
        "elevation_gain": 150,
        "start_lat": Decimal("33.515500"),
        "start_lng": Decimal("126.900500"),
        "end_lat": Decimal("33.494500"),
        "end_lng": Decimal("126.918500"),
        "trail_type": "coastal",
        "best_season": "fall",
        "walking_surface": "mixed",
        "transport_access": "제주시외버스터미널에서 201번 간선버스",
    },
    {
        "title": "태종대 순환산책로",
        "title_en": "Taejongdae Loop Walk",
        "description": "부산 영도 남단의 해안 절벽을 따라 도는 약 4.3km의 순환 산책로. 전망대와 등대, 영도 바닷길이 이어지며 완만한 오르내림이 있다.",
        "region": "부산 영도구",
        "distance_km": Decimal("4.3"),
        "estimated_minutes": 75,
        "difficulty": "easy",
        "elevation_gain": 90,
        "start_lat": Decimal("35.053500"),
        "start_lng": Decimal("129.086500"),
        "end_lat": Decimal("35.053500"),
        "end_lng": Decimal("129.086500"),
        "trail_type": "coastal",
        "best_season": "all",
        "walking_surface": "paved",
        "transport_access": "부산 지하철 1호선 남포역에서 8·30·88번 버스",
    },
    # --- ASIA TRAILS: KYOTO, JAPAN ---
    {
        "title": "철학의 길",
        "title_en": "Philosopher's Path",
        "description": (
            "은각사에서 난젠지까지 이어지는 약 2km의 수로변 산책로. "
            "벚꽃 시즌에는 양쪽 가로수가 수로 위로 꽃잎 터널을 만들어 "
            "교토에서 가장 인기 있는 산책 코스로 꼽힌다."
        ),
        "description_en": (
            "A serene 2km canal-side path connecting Ginkaku-ji to Nanzen-ji. "
            "Cherry blossoms form a tunnel over the waterway in spring, making it "
            "one of Kyoto's most beloved walking routes."
        ),
        "region": "Kyoto, Japan",
        "country": "JP",
        "distance_km": Decimal("2.0"),
        "estimated_minutes": 40,
        "difficulty": "easy",
        "elevation_gain": 20,
        "start_lat": Decimal("35.027300"),
        "start_lng": Decimal("135.797800"),
        "end_lat": Decimal("35.015200"),
        "end_lng": Decimal("135.793400"),
        "trail_type": "cultural",
        "best_season": "spring",
        "walking_surface": "paved",
        "transport_access": "시내버스 5번·17번 은각사 정류장 하차",
    },
    {
        "title": "기온 거리 산책",
        "title_en": "Gion District Walk",
        "description": (
            "교토의 전통 게이샤 거리인 기온을 중심으로 야사카 신사, "
            "하나미코지 골목, 시라카와 수로를 따라 걷는 약 3km 코스. "
            "저녁 무렵 등불이 켜지면 교토의 옛 정취가 가장 짙어진다."
        ),
        "description_en": (
            "A 3km cultural walk through Kyoto's iconic Gion geisha district, "
            "passing Yasaka Shrine, Hanamikoji alley, and the lantern-lit "
            "Shirakawa canal — best experienced at dusk."
        ),
        "region": "Kyoto, Japan",
        "country": "JP",
        "distance_km": Decimal("3.0"),
        "estimated_minutes": 60,
        "difficulty": "easy",
        "elevation_gain": 10,
        "start_lat": Decimal("35.003600"),
        "start_lng": Decimal("135.778700"),
        "end_lat": Decimal("35.006900"),
        "end_lng": Decimal("135.774200"),
        "trail_type": "cultural",
        "best_season": "all",
        "walking_surface": "paved",
        "transport_access": "게이한 기온시조역 하차 도보 3분",
    },
    {
        "title": "후시미이나리 등산로",
        "title_en": "Fushimi Inari Trail",
        "description": (
            "천 개의 붉은 도리이가 이어지는 후시미이나리 대사의 이나리산 "
            "등산로. 산 정상(233m)까지 왕복 약 4km이며 중간중간 교토 "
            "시가지를 내려다보는 전망 포인트가 있다."
        ),
        "description_en": (
            "A 4km round-trip hike through thousands of vermillion torii gates "
            "at Fushimi Inari Taisha, climbing to the 233m summit of Mount Inari "
            "with panoramic views of Kyoto along the way."
        ),
        "region": "Kyoto, Japan",
        "country": "JP",
        "distance_km": Decimal("4.0"),
        "estimated_minutes": 90,
        "difficulty": "moderate",
        "elevation_gain": 233,
        "start_lat": Decimal("34.967100"),
        "start_lng": Decimal("135.772700"),
        "end_lat": Decimal("34.967100"),
        "end_lng": Decimal("135.772700"),
        "trail_type": "nature",
        "best_season": "all",
        "walking_surface": "mixed",
        "transport_access": "JR 나라선 이나리역 하차 바로 앞",
    },
    {
        "title": "아라시야마 대나무숲 코스",
        "title_en": "Arashiyama Bamboo Grove Walk",
        "description": (
            "도게츠교에서 출발해 대나무숲 구간을 지나 오코치산소 정원과 "
            "노노미야 신사까지 이어지는 약 5km 코스. 대나무 사이로 스며드는 "
            "빛과 바람 소리가 교토에서만 느낄 수 있는 감각을 선사한다."
        ),
        "description_en": (
            "A 5km walk starting from Togetsukyo Bridge through the towering "
            "bamboo groves, passing Okochi Sanso garden and Nonomiya Shrine — "
            "sunlight filtering through bamboo creates an otherworldly atmosphere."
        ),
        "region": "Kyoto, Japan",
        "country": "JP",
        "distance_km": Decimal("5.0"),
        "estimated_minutes": 100,
        "difficulty": "easy",
        "elevation_gain": 40,
        "start_lat": Decimal("35.009500"),
        "start_lng": Decimal("135.677800"),
        "end_lat": Decimal("35.017800"),
        "end_lng": Decimal("135.672100"),
        "trail_type": "nature",
        "best_season": "all",
        "walking_surface": "mixed",
        "transport_access": "JR 사가아라시야마역 하차 도보 10분",
    },
    {
        "title": "히가시야마 산책",
        "title_en": "Higashiyama Walk",
        "description": (
            "기요미즈데라에서 출발해 산넨자카·니넨자카 돌계단 골목을 "
            "따라 야사카 탑과 고다이지까지 내려오는 약 3.5km 코스. "
            "전통 목조 건물과 도자기 가게가 즐비한 교토의 대표 구시가지 구간이다."
        ),
        "description_en": (
            "A 3.5km walk from Kiyomizu-dera down the charming stone-paved "
            "lanes of Sannenzaka and Ninenzaka, past Yasaka Pagoda to Kodai-ji — "
            "the heart of Kyoto's historic Higashiyama district."
        ),
        "region": "Kyoto, Japan",
        "country": "JP",
        "distance_km": Decimal("3.5"),
        "estimated_minutes": 70,
        "difficulty": "easy",
        "elevation_gain": 50,
        "start_lat": Decimal("34.994800"),
        "start_lng": Decimal("135.785000"),
        "end_lat": Decimal("35.000200"),
        "end_lng": Decimal("135.780800"),
        "trail_type": "cultural",
        "best_season": "fall",
        "walking_surface": "paved",
        "transport_access": "시내버스 206번 기요미즈미치 정류장 하차",
    },
    # --- ASIA TRAILS: TAIPEI, TAIWAN ---
    {
        "title": "지우펀 올드 스트리트",
        "title_en": "Jiufen Old Street",
        "description": (
            "옛 금광 마을 지우펀의 좁은 돌계단과 홍등 골목을 따라 걷는 약 3km 코스. "
            "산비탈에 자리한 찻집과 먹거리 노점이 이어지고 골목 끝에서 바다 전망이 "
            "열린다. 비 오는 날의 운무 낀 풍경이 특히 유명하다."
        ),
        "description_en": (
            "A 3km walk through the narrow stone steps and red-lantern alleys "
            "of Jiufen, a former gold-mining village. Hilltop teahouses and "
            "street food stalls line the way, ending with sweeping ocean views."
        ),
        "region": "Taipei, Taiwan",
        "country": "TW",
        "distance_km": Decimal("3.0"),
        "estimated_minutes": 75,
        "difficulty": "moderate",
        "elevation_gain": 120,
        "start_lat": Decimal("25.109400"),
        "start_lng": Decimal("121.844700"),
        "end_lat": Decimal("25.107600"),
        "end_lng": Decimal("121.843200"),
        "trail_type": "cultural",
        "best_season": "fall",
        "walking_surface": "paved",
        "transport_access": "타이베이역에서 버스 1062번 지우펀 라오지에 하차",
    },
    {
        "title": "디화제 역사거리",
        "title_en": "Dihua Street Heritage Walk",
        "description": (
            "다다오청 구시가의 바로크풍 건물과 한약방, 직물 상점이 늘어선 "
            "약 2.5km의 역사 거리 산책. 타이베이에서 가장 오래된 상업 지구로 "
            "리노베이션된 카페와 공방이 새로운 활기를 더한다."
        ),
        "description_en": (
            "A 2.5km heritage walk through Dadaocheng's Baroque-style shophouses, "
            "traditional herbal medicine shops, and renovated cafes on Dihua Street — "
            "Taipei's oldest commercial district reinvented."
        ),
        "region": "Taipei, Taiwan",
        "country": "TW",
        "distance_km": Decimal("2.5"),
        "estimated_minutes": 50,
        "difficulty": "easy",
        "elevation_gain": 5,
        "start_lat": Decimal("25.055700"),
        "start_lng": Decimal("121.510100"),
        "end_lat": Decimal("25.062200"),
        "end_lng": Decimal("121.509600"),
        "trail_type": "cultural",
        "best_season": "all",
        "walking_surface": "paved",
        "transport_access": "MRT 다치아오터우역 하차 도보 5분",
    },
    {
        "title": "단수이 해안 산책",
        "title_en": "Tamsui Waterfront Walk",
        "description": (
            "단수이 MRT역에서 어인부두까지 이어지는 약 4km의 강변 산책로. "
            "석양 무렵 단수이강 위로 물드는 노을이 타이베이 근교 최고의 "
            "일몰 풍경으로 꼽히며 길가 노점의 아게이와 텐푸라가 유명하다."
        ),
        "description_en": (
            "A 4km riverside promenade from Tamsui MRT to Fisherman's Wharf, "
            "famous for its stunning sunsets over the Tamsui River and beloved "
            "street snacks like agei and tempura along the way."
        ),
        "region": "Taipei, Taiwan",
        "country": "TW",
        "distance_km": Decimal("4.0"),
        "estimated_minutes": 70,
        "difficulty": "easy",
        "elevation_gain": 5,
        "start_lat": Decimal("25.169700"),
        "start_lng": Decimal("121.439800"),
        "end_lat": Decimal("25.183400"),
        "end_lng": Decimal("121.415600"),
        "trail_type": "urban",
        "best_season": "all",
        "walking_surface": "paved",
        "transport_access": "MRT 단수이역 하차 바로 앞",
    },
    {
        "title": "시먼딩 → 용캉제 야간 산책",
        "title_en": "Ximending to Yongkang Night Walk",
        "description": (
            "타이베이의 번화가 시먼딩에서 출발해 중정기념당을 지나 "
            "용캉제 먹거리 골목까지 이어지는 약 3km의 야간 도심 산책. "
            "네온 간판과 망고빙수 노점, 길거리 공연이 어우러진다."
        ),
        "description_en": (
            "A 3km night stroll from the neon-lit Ximending district, past "
            "Chiang Kai-shek Memorial Hall, to the foodie haven of Yongkang Street — "
            "mango shaved ice and street performers included."
        ),
        "region": "Taipei, Taiwan",
        "country": "TW",
        "distance_km": Decimal("3.0"),
        "estimated_minutes": 60,
        "difficulty": "easy",
        "elevation_gain": 0,
        "start_lat": Decimal("25.042200"),
        "start_lng": Decimal("121.508100"),
        "end_lat": Decimal("25.033100"),
        "end_lng": Decimal("121.529200"),
        "trail_type": "urban",
        "best_season": "all",
        "walking_surface": "paved",
        "transport_access": "MRT 시먼역 6번 출구",
    },
    {
        "title": "샹산 하이킹",
        "title_en": "Xiangshan / Elephant Mountain Hike",
        "description": (
            "타이베이 101을 가장 가까이에서 내려다볼 수 있는 약 2km의 "
            "도심 하이킹 코스. 계단 구간이 가파르지만 20분이면 전망대에 "
            "도착하며 야경 시간대에 특히 인기가 높다."
        ),
        "description_en": (
            "A short but steep 2km urban hike offering the closest panoramic "
            "view of Taipei 101. Just 20 minutes to the viewpoint, it's "
            "especially popular for golden hour and night skyline shots."
        ),
        "region": "Taipei, Taiwan",
        "country": "TW",
        "distance_km": Decimal("2.0"),
        "estimated_minutes": 45,
        "difficulty": "moderate",
        "elevation_gain": 140,
        "start_lat": Decimal("25.027100"),
        "start_lng": Decimal("121.570900"),
        "end_lat": Decimal("25.025500"),
        "end_lng": Decimal("121.572600"),
        "trail_type": "nature",
        "best_season": "all",
        "walking_surface": "mixed",
        "transport_access": "MRT 샹산역 2번 출구 도보 5분",
    },
    # --- ASIA TRAILS: BANGKOK & CHIANG MAI, THAILAND ---
    {
        "title": "카오산 로드 → 왕궁 산책",
        "title_en": "Khaosan Road to Grand Palace Walk",
        "description": (
            "배낭여행자의 성지 카오산 로드에서 출발해 프라 아팃 거리를 지나 "
            "방콕 왕궁과 왓 프라깨우까지 걷는 약 3km 코스. 노점과 사원, "
            "차오프라야강 풍경이 짧은 거리 안에 모두 담겨 있다."
        ),
        "description_en": (
            "A 3km walk from the legendary Khaosan Road backpacker strip, "
            "along Phra Athit Road to the Grand Palace and Wat Phra Kaew — "
            "street food, temples, and river views all in one route."
        ),
        "region": "Bangkok & Chiang Mai, Thailand",
        "country": "TH",
        "distance_km": Decimal("3.0"),
        "estimated_minutes": 60,
        "difficulty": "easy",
        "elevation_gain": 0,
        "start_lat": Decimal("13.758900"),
        "start_lng": Decimal("100.497600"),
        "end_lat": Decimal("13.751000"),
        "end_lng": Decimal("100.491400"),
        "trail_type": "cultural",
        "best_season": "winter",
        "walking_surface": "paved",
        "transport_access": "차오프라야 익스프레스 보트 프라 아팃 선착장",
    },
    {
        "title": "차이나타운 야워랏 야간 산책",
        "title_en": "Yaowarat Chinatown Night Walk",
        "description": (
            "방콕 차이나타운의 중심 야워랏 로드를 따라 걷는 약 2.5km의 "
            "야간 산책. 네온 간판 아래 해산물 노점과 딤섬 가게가 쏟아지고 "
            "골목마다 금은방과 한약방이 이어지는 감각적인 코스다."
        ),
        "description_en": (
            "A 2.5km night walk along Yaowarat Road in Bangkok's Chinatown. "
            "Neon signs illuminate seafood stalls and dim sum shops while "
            "gold traders and herbal pharmacies fill every side alley."
        ),
        "region": "Bangkok & Chiang Mai, Thailand",
        "country": "TH",
        "distance_km": Decimal("2.5"),
        "estimated_minutes": 50,
        "difficulty": "easy",
        "elevation_gain": 0,
        "start_lat": Decimal("13.740800"),
        "start_lng": Decimal("100.510200"),
        "end_lat": Decimal("13.738600"),
        "end_lng": Decimal("100.497800"),
        "trail_type": "urban",
        "best_season": "winter",
        "walking_surface": "paved",
        "transport_access": "MRT 왓 망콘역 1번 출구",
    },
    {
        "title": "치앙마이 올드시티 사원 순례",
        "title_en": "Chiang Mai Old City Temple Walk",
        "description": (
            "치앙마이 구시가지의 해자 안쪽을 따라 왓 체디루앙, 왓 프라싱, "
            "왓 치앙만 등 주요 사원 5곳을 잇는 약 4km 코스. 란나 양식의 "
            "불탑과 골목길 카페가 번갈아 나타나 산책 리듬이 좋다."
        ),
        "description_en": (
            "A 4km temple-hopping walk inside Chiang Mai's moat, linking "
            "Wat Chedi Luang, Wat Phra Singh, and Wat Chiang Man among others — "
            "Lanna-style stupas and hidden cafes at every turn."
        ),
        "region": "Bangkok & Chiang Mai, Thailand",
        "country": "TH",
        "distance_km": Decimal("4.0"),
        "estimated_minutes": 80,
        "difficulty": "easy",
        "elevation_gain": 0,
        "start_lat": Decimal("18.787600"),
        "start_lng": Decimal("98.986100"),
        "end_lat": Decimal("18.793700"),
        "end_lng": Decimal("98.981800"),
        "trail_type": "cultural",
        "best_season": "winter",
        "walking_surface": "paved",
        "transport_access": "치앙마이 공항에서 쏭태우 15분",
    },
    {
        "title": "치앙마이 선데이 마켓 코스",
        "title_en": "Chiang Mai Sunday Walking Street Market",
        "description": (
            "일요일 저녁 타패 게이트에서 왓 프라싱까지 약 2km에 걸쳐 열리는 "
            "선데이 마켓을 따라 걷는 코스. 수공예품, 길거리 음식, 라이브 음악이 "
            "이어지며 치앙마이의 야간 문화를 가장 가까이 체험할 수 있다."
        ),
        "description_en": (
            "A 2km stroll through Chiang Mai's famous Sunday Walking Street, "
            "running from Tha Phae Gate to Wat Phra Singh — packed with "
            "handicrafts, street food, and live music every Sunday evening."
        ),
        "region": "Bangkok & Chiang Mai, Thailand",
        "country": "TH",
        "distance_km": Decimal("2.0"),
        "estimated_minutes": 50,
        "difficulty": "easy",
        "elevation_gain": 0,
        "start_lat": Decimal("18.787000"),
        "start_lng": Decimal("98.993500"),
        "end_lat": Decimal("18.788800"),
        "end_lng": Decimal("98.981400"),
        "trail_type": "urban",
        "best_season": "winter",
        "walking_surface": "paved",
        "transport_access": "타패 게이트 앞 쏭태우 하차",
    },
    {
        "title": "님만해민 카페거리 산책",
        "title_en": "Nimman Cafe Street Walk",
        "description": (
            "치앙마이 대학 인근 님만해민 거리의 카페와 부티크 숍을 따라 "
            "걷는 약 3km 코스. 소이(골목)마다 개성 있는 카페가 숨어 있어 "
            "오후 산책과 커피 한 잔을 함께 즐기기 좋다."
        ),
        "description_en": (
            "A 3km cafe-hopping walk along Nimmanhaemin Road near Chiang Mai "
            "University. Each soi (alley) hides unique cafes and boutiques — "
            "perfect for a leisurely afternoon stroll with coffee."
        ),
        "region": "Bangkok & Chiang Mai, Thailand",
        "country": "TH",
        "distance_km": Decimal("3.0"),
        "estimated_minutes": 60,
        "difficulty": "easy",
        "elevation_gain": 0,
        "start_lat": Decimal("18.796800"),
        "start_lng": Decimal("98.967200"),
        "end_lat": Decimal("18.800200"),
        "end_lng": Decimal("98.968900"),
        "trail_type": "urban",
        "best_season": "winter",
        "walking_surface": "paved",
        "transport_access": "치앙마이 공항에서 쏭태우 10분 / MAYA 몰 앞",
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
        # nickname is unique on CustomUser, so we look up by nickname
        # first and fall back to creating with a matching username
        # (AbstractUser requires username).
        system_user = User.objects.filter(nickname="moru_official").first()
        if not system_user:
            system_user = User.objects.create(
                username="moru_official",
                nickname="moru_official",
                email="official@moruwalk.com",
                is_active=False,  # not a login-capable account
            )

        created = 0
        updated = 0
        skipped = 0
        for data in TRAILS:
            lookup = {"title": data["title"], "region": data["region"]}
            defaults = {
                **data,
                "author": system_user,
                "country": data.get("country", "KR"),
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
