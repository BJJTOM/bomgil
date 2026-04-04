import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.accounts.models import CustomUser
from apps.reviews.models import Review
from apps.spots.models import Spot
from apps.trails.models import Tag, Trail, TrailLike


TAGS_DATA = [
    ("벚꽃길", "Cherry Blossom", "桜並木"),
    ("해안길", "Coastal Trail", "海岸道"),
    ("숲길", "Forest Path", "森の道"),
    ("야경", "Night View", "夜景"),
    ("맛집투어", "Food Tour", "グルメツアー"),
    ("역사탐방", "Historical", "歴史探訪"),
    ("사진명소", "Photo Spot", "写真スポット"),
    ("힐링", "Healing", "ヒーリング"),
    ("가족", "Family", "ファミリー"),
    ("데이트", "Date Course", "デートコース"),
    ("카페거리", "Cafe Street", "カフェ通り"),
    ("도심산책", "City Walk", "街歩き"),
    ("전통마을", "Traditional Village", "伝統村"),
    ("둘레길", "Dulle-gil", "トゥルレギル"),
]

TRAILS_DATA = [
    {
        # 0: 성수~뚝섬
        "title": "서울 성수~뚝섬 한강길",
        "title_en": "Seoul Seongsu–Ttukseom Hangang Trail",
        "title_ja": "ソウル聖水〜トゥクソム漢江道",
        "description": "성수동 카페 골목에서 출발해 서울숲을 거쳐 뚝섬 한강공원까지 이어지는 도심 산책 코스. 트렌디한 카페와 맛집이 즐비합니다.",
        "description_en": "An urban walking trail from Seongsu cafe alley through Seoul Forest to Ttukseom Hangang Park. Lined with trendy cafes and restaurants.",
        "description_ja": "聖水洞カフェ通りからソウルの森を経てトゥクソム漢江公園まで続く都心散歩コース。トレンディなカフェやグルメが並びます。",
        "region": "서울",
        "country": "KR",
        "distance_km": Decimal("3.5"),
        "estimated_minutes": 70,
        "difficulty": "easy",
        "elevation_gain": 10,
        "start_lat": Decimal("37.544600"),
        "start_lng": Decimal("127.055900"),
        "end_lat": Decimal("37.531500"),
        "end_lng": Decimal("127.066500"),
        "best_season": "all",
        "trail_type": "urban",
        "walking_surface": "paved",
        "transport_access": "2호선 성수역 3번 출구 도보 3분",
    },
    {
        # 1: 해운대~청사포
        "title": "부산 해운대~청사포 해안길",
        "title_en": "Busan Haeundae–Cheongsapo Coastal Trail",
        "title_ja": "釜山海雲台〜青沙浦海岸道",
        "description": "해운대 해수욕장에서 달맞이 고개를 넘어 청사포 항구까지 이어지는 해안 산책로. 탁 트인 바다 뷰와 감성 카페를 함께 즐길 수 있습니다.",
        "description_en": "A coastal walk from Haeundae Beach over Dalmaji Hill to Cheongsapo Port. Enjoy wide ocean views and atmospheric cafes.",
        "description_ja": "海雲台海水浴場から月見峠を越えて青沙浦港まで続く海岸散歩道。開けた海の眺めと感性カフェを一緒に楽しめます。",
        "region": "부산",
        "country": "KR",
        "distance_km": Decimal("6.0"),
        "estimated_minutes": 120,
        "difficulty": "easy",
        "elevation_gain": 80,
        "start_lat": Decimal("35.158698"),
        "start_lng": Decimal("129.160384"),
        "end_lat": Decimal("35.163500"),
        "end_lng": Decimal("129.193000"),
        "best_season": "fall",
        "trail_type": "coastal",
        "walking_surface": "paved",
        "transport_access": "2호선 해운대역 5번 출구 도보 10분",
    },
    {
        # 2: 전주 한옥마을~남부시장
        "title": "전주 한옥마을~남부시장 문화탐방",
        "title_en": "Jeonju Hanok Village–Nambu Market Cultural Walk",
        "title_ja": "全州韓屋村〜南部市場文化探訪",
        "description": "전주 한옥마을의 전통 골목을 돌아보고 남부시장 야시장까지 이어지는 문화 산책 코스. 비빔밥, 초코파이 등 전주 대표 먹거리를 맛볼 수 있습니다.",
        "description_en": "A cultural walk through Jeonju Hanok Village's traditional alleys to Nambu Market night market. Taste local specialties like bibimbap and choco pie.",
        "description_ja": "全州韓屋村の伝統的な路地を回り南部市場夜市まで続く文化散歩コース。ビビンバやチョコパイなど全州名物を味わえます。",
        "region": "전북",
        "country": "KR",
        "distance_km": Decimal("4.0"),
        "estimated_minutes": 100,
        "difficulty": "easy",
        "elevation_gain": 15,
        "start_lat": Decimal("35.815000"),
        "start_lng": Decimal("127.153000"),
        "end_lat": Decimal("35.810500"),
        "end_lng": Decimal("127.148000"),
        "best_season": "all",
        "trail_type": "cultural",
        "walking_surface": "paved",
        "transport_access": "전주역에서 버스 12번 한옥마을 하차, 약 15분",
    },
    {
        # 3: 제주 올레길 7코스
        "title": "제주 올레길 7코스",
        "title_en": "Jeju Olle Trail Route 7",
        "title_ja": "済州オルレ道7コース",
        "description": "서귀포 외돌개에서 월평 앞바다까지 이어지는 해안 절경 코스. 주상절리와 에메랄드빛 바다를 동시에 즐길 수 있습니다.",
        "description_en": "A stunning coastal trail from Oedolgae to Wolpyeong Beach in Seogwipo. Enjoy columnar joints and emerald waters.",
        "description_ja": "西帰浦の外突介から月坪前海まで続く海岸絶景コース。柱状節理とエメラルド色の海を同時に楽しめます。",
        "region": "제주",
        "country": "KR",
        "distance_km": Decimal("15.0"),
        "estimated_minutes": 300,
        "difficulty": "moderate",
        "elevation_gain": 120,
        "start_lat": Decimal("33.244890"),
        "start_lng": Decimal("126.511780"),
        "end_lat": Decimal("33.250000"),
        "end_lng": Decimal("126.490000"),
        "best_season": "all",
        "trail_type": "coastal",
        "walking_surface": "mixed",
        "transport_access": "서귀포 버스터미널에서 외돌개 방면 버스 20분",
    },
    {
        # 4: 하동 지리산 둘레길 1~3구간
        "title": "하동 지리산 둘레길 1~3구간",
        "title_en": "Hadong Jirisan Dulle-gil Sections 1–3",
        "title_ja": "河東智異山トゥルレギル1〜3区間",
        "description": "지리산 자락을 따라 마을과 마을을 잇는 2박 3일 도보 여행 코스. 하동 차밭, 악양 들판, 섬진강 풍경을 품은 느린 여행길입니다.",
        "description_en": "A 2-night, 3-day walking journey along the foothills of Jirisan, connecting villages. Enjoy Hadong tea fields, Agyang plains, and Seomjin River scenery.",
        "description_ja": "智異山の麓に沿って村と村をつなぐ2泊3日の徒歩旅行コース。河東の茶畑、岳陽の平野、蟾津江の風景を抱くスローな旅路です。",
        "region": "경남",
        "country": "KR",
        "distance_km": Decimal("42.0"),
        "estimated_minutes": 1440,
        "difficulty": "moderate",
        "elevation_gain": 600,
        "start_lat": Decimal("35.136000"),
        "start_lng": Decimal("127.751000"),
        "end_lat": Decimal("35.180000"),
        "end_lng": Decimal("127.690000"),
        "best_season": "spring",
        "trail_type": "nature",
        "is_multi_day": True,
        "total_days": 3,
        "walking_surface": "unpaved",
        "transport_access": "하동 버스터미널에서 화개장터 방면 버스 30분",
    },
    {
        # 5: 서울 북촌한옥마을
        "title": "서울 북촌한옥마을 골목 산책",
        "title_en": "Seoul Bukchon Hanok Village Alley Walk",
        "title_ja": "ソウル北村韓屋マウル路地散歩",
        "description": "서울 종로구 북촌한옥마을의 아름다운 골목길을 걸으며 전통 한옥의 매력을 느껴보세요. 경복궁에서 출발해 북촌 8경을 지나 삼청동까지 이어지는 코스입니다.",
        "description_en": "Walk through the beautiful alleys of Bukchon Hanok Village in Seoul. Starting from Gyeongbokgung Palace, pass through the 8 scenic views of Bukchon to Samcheong-dong.",
        "description_ja": "ソウル鍾路区の北村韓屋マウルの美しい路地を歩きながら、伝統的な韓屋の魅力を感じてください。",
        "region": "서울",
        "country": "KR",
        "distance_km": Decimal("3.2"),
        "estimated_minutes": 90,
        "difficulty": "easy",
        "elevation_gain": 50,
        "start_lat": Decimal("37.579617"),
        "start_lng": Decimal("126.977041"),
        "end_lat": Decimal("37.580000"),
        "end_lng": Decimal("126.982000"),
        "best_season": "spring",
        "trail_type": "cultural",
        "walking_surface": "paved",
        "transport_access": "3호선 안국역 1번 출구 도보 5분",
    },
    {
        # 6: 강릉 경포호~안목해변
        "title": "강릉 경포호~안목해변 카페길",
        "title_en": "Gangneung Gyeongpo Lake–Anmok Beach Cafe Trail",
        "title_ja": "江陵鏡浦湖〜安木海辺カフェ道",
        "description": "경포호수 둘레를 돌아 안목해변 카페거리까지 이어지는 산책 코스. 호수, 바다, 커피를 모두 즐길 수 있는 강릉 대표 도보 코스입니다.",
        "description_en": "A walking trail from Gyeongpo Lake to Anmok Beach cafe street. Enjoy the lake, the sea, and great coffee on Gangneung's signature walk.",
        "description_ja": "鏡浦湖を回り安木海辺カフェ通りまで続く散歩コース。湖、海、コーヒーをすべて楽しめる江陵代表の徒歩コースです。",
        "region": "강원",
        "country": "KR",
        "distance_km": Decimal("5.0"),
        "estimated_minutes": 90,
        "difficulty": "easy",
        "elevation_gain": 10,
        "start_lat": Decimal("37.794000"),
        "start_lng": Decimal("128.896000"),
        "end_lat": Decimal("37.773000"),
        "end_lng": Decimal("128.946000"),
        "best_season": "spring",
        "trail_type": "coastal",
        "walking_surface": "paved",
        "transport_access": "강릉역에서 202번 버스 경포해변 하차, 약 30분",
    },
    {
        # 7: 도쿄 야나카
        "title": "도쿄 야나카 골목 산책",
        "title_en": "Tokyo Yanaka Alley Walk",
        "title_ja": "東京谷中散歩",
        "description": "도쿄의 옛 정취가 남아있는 야나카 지역을 산책하는 코스. 야나카 긴자 상점가에서 로컬 간식을 즐기며 걸어보세요.",
        "description_en": "Stroll through Yanaka, a nostalgic area of Tokyo. Enjoy local snacks at Yanaka Ginza shopping street.",
        "description_ja": "東京の古い趣が残る谷中地域を散歩するコース。谷中銀座商店街でローカルグルメを楽しみながら歩いてみてください。",
        "region": "Tokyo",
        "country": "JP",
        "distance_km": Decimal("3.5"),
        "estimated_minutes": 80,
        "difficulty": "easy",
        "elevation_gain": 20,
        "start_lat": Decimal("35.725000"),
        "start_lng": Decimal("139.770000"),
        "end_lat": Decimal("35.728000"),
        "end_lng": Decimal("139.773000"),
        "best_season": "fall",
        "trail_type": "urban",
        "walking_surface": "paved",
        "transport_access": "JR 닛포리역 남쪽 출구 바로 앞",
    },
    {
        # 8: 지우펀 올드 스트리트
        "title": "지우펀 올드 스트리트 산책",
        "title_en": "Jiufen Old Street Walk",
        "title_ja": "九份老街散歩",
        "description": "타이베이 근교 지우펀의 좁은 골목과 계단길을 따라 걷는 산책 코스. 전통 찻집과 타로볼, 홍등이 어우러진 옛 광산 마을의 정취를 느낄 수 있습니다.",
        "description_en": "Walk through the narrow alleys and stairways of Jiufen, a former gold mining town near Taipei. Enjoy traditional teahouses, taro balls, and iconic red lanterns.",
        "description_ja": "台北近郊の九份の狭い路地と階段道を歩く散歩コース。伝統茶館や芋圓、赤い提灯が調和する旧鉱山村の風情を感じられます。",
        "region": "Taipei",
        "country": "TW",
        "distance_km": Decimal("2.5"),
        "estimated_minutes": 90,
        "difficulty": "easy",
        "elevation_gain": 80,
        "start_lat": Decimal("25.109400"),
        "start_lng": Decimal("121.844700"),
        "end_lat": Decimal("25.107200"),
        "end_lng": Decimal("121.843500"),
        "best_season": "fall",
        "trail_type": "cultural",
        "walking_surface": "paved",
        "transport_access": "타이베이역에서 버스 1062번 지우펀 올드 스트리트 하차, 약 90분",
    },
    {
        # 9: 방콕 차이나타운
        "title": "방콕 차이나타운 워킹 투어",
        "title_en": "Bangkok Chinatown Walking Tour",
        "title_ja": "バンコクチャイナタウンウォーキングツアー",
        "description": "방콕에서 가장 활기찬 야오와랏 로드를 중심으로 한 차이나타운 도보 코스. 길거리 음식, 전통 시장, 화려한 사원이 어우러진 오감 만족 산책입니다.",
        "description_en": "A walking tour through Bangkok's vibrant Chinatown centered on Yaowarat Road. Experience street food, traditional markets, and ornate temples.",
        "description_ja": "バンコクで最も活気あるヤワラート通りを中心としたチャイナタウン徒歩コース。屋台グルメ、伝統市場、華やかな寺院が調和する五感満足の散歩です。",
        "region": "Bangkok",
        "country": "TH",
        "distance_km": Decimal("3.0"),
        "estimated_minutes": 90,
        "difficulty": "easy",
        "elevation_gain": 5,
        "start_lat": Decimal("13.740100"),
        "start_lng": Decimal("100.510300"),
        "end_lat": Decimal("13.737800"),
        "end_lng": Decimal("100.513500"),
        "best_season": "winter",
        "trail_type": "urban",
        "walking_surface": "paved",
        "transport_access": "MRT 왓 망콘역(Wat Mangkon) 1번 출구 도보 1분",
    },
    {
        # 10: NYC 하이라인 & 첼시
        "title": "뉴욕 하이라인 & 첼시 산책",
        "title_en": "NYC High Line & Chelsea Walk",
        "title_ja": "ニューヨーク ハイライン＆チェルシー散歩",
        "description": "맨해튼 미트패킹 디스트릭트에서 시작해 하이라인 공원을 걸으며 허드슨 야드까지 이어지는 도심 산책 코스. 공중 정원, 스트리트 아트, 첼시 마켓을 함께 즐길 수 있습니다.",
        "description_en": "An urban walk starting from the Meatpacking District along the High Line elevated park to Hudson Yards. Enjoy aerial gardens, street art, and Chelsea Market.",
        "description_ja": "マンハッタンのミートパッキング地区からハイライン空中公園を歩きハドソンヤードまで続く都心散歩コース。空中庭園、ストリートアート、チェルシーマーケットを一緒に楽しめます。",
        "region": "New York",
        "country": "US",
        "distance_km": Decimal("4.0"),
        "estimated_minutes": 90,
        "difficulty": "easy",
        "elevation_gain": 15,
        "start_lat": Decimal("40.739800"),
        "start_lng": Decimal("-74.008400"),
        "end_lat": Decimal("40.754400"),
        "end_lng": Decimal("-74.001300"),
        "best_season": "spring",
        "trail_type": "urban",
        "walking_surface": "paved",
        "transport_access": "지하철 A/C/E 14th St역 또는 L트레인 8th Ave역 하차 도보 5분",
    },
    {
        # 11: 런던 템즈 패스
        "title": "런던 템즈 패스 산책",
        "title_en": "London Thames Path Walk",
        "title_ja": "ロンドン テムズパス散歩",
        "description": "사우스뱅크를 따라 타워브릿지에서 웨스트민스터까지 이어지는 템즈강변 산책 코스. 런던아이, 테이트 모던, 셰익스피어 글로브 극장 등 런던의 랜드마크를 한 번에 만날 수 있습니다.",
        "description_en": "A riverside walk along the South Bank from Tower Bridge to Westminster. Pass iconic landmarks including the London Eye, Tate Modern, and Shakespeare's Globe.",
        "description_ja": "サウスバンクに沿ってタワーブリッジからウェストミンスターまで続くテムズ川沿い散歩コース。ロンドンアイ、テートモダン、シェイクスピアグローブ座などロンドンのランドマークを一度に楽しめます。",
        "region": "London",
        "country": "GB",
        "distance_km": Decimal("5.5"),
        "estimated_minutes": 110,
        "difficulty": "easy",
        "elevation_gain": 10,
        "start_lat": Decimal("51.505500"),
        "start_lng": Decimal("-0.075400"),
        "end_lat": Decimal("51.501000"),
        "end_lng": Decimal("-0.124600"),
        "best_season": "spring",
        "trail_type": "urban",
        "walking_surface": "paved",
        "transport_access": "튜브 District/Circle Line Tower Hill역 하차 도보 5분",
    },
    {
        # 12: 파리 르 마레
        "title": "파리 르 마레 워킹 투어",
        "title_en": "Paris Le Marais Walking Tour",
        "title_ja": "パリ ル・マレ ウォーキングツアー",
        "description": "파리 3-4구의 역사적인 르 마레 지구를 걷는 문화 산책 코스. 중세 골목, 보주 광장, 빈티지 부티크, 유대인 거리의 팔라펠 맛집까지 파리의 다양한 매력을 느낄 수 있습니다.",
        "description_en": "A cultural walk through the historic Le Marais district in Paris' 3rd and 4th arrondissements. Explore medieval alleys, Place des Vosges, vintage boutiques, and famous falafel on Rue des Rosiers.",
        "description_ja": "パリ3-4区の歴史的なル・マレ地区を歩く文化散歩コース。中世の路地、ヴォージュ広場、ヴィンテージブティック、ユダヤ人街のファラフェル名店までパリの多様な魅力を感じられます。",
        "region": "Paris",
        "country": "FR",
        "distance_km": Decimal("3.5"),
        "estimated_minutes": 90,
        "difficulty": "easy",
        "elevation_gain": 10,
        "start_lat": Decimal("48.857400"),
        "start_lng": Decimal("2.362200"),
        "end_lat": Decimal("48.853600"),
        "end_lng": Decimal("2.354100"),
        "best_season": "spring",
        "trail_type": "cultural",
        "walking_surface": "paved",
        "transport_access": "메트로 1호선 Saint-Paul역 하차 도보 1분",
    },
    {
        # 13: 바르셀로나 고딕 지구
        "title": "바르셀로나 고딕 지구 산책",
        "title_en": "Barcelona Gothic Quarter Walk",
        "title_ja": "バルセロナ ゴシック地区散歩",
        "description": "바르셀로나 구시가지 고딕 지구의 중세 골목을 누비는 산책 코스. 대성당, 왕의 광장, 레이알 광장 등 2000년 역사가 숨 쉬는 골목길에서 타파스와 상그리아를 즐겨보세요.",
        "description_en": "A walk through the medieval alleys of Barcelona's Gothic Quarter. Explore the Cathedral, Plaça del Rei, Plaça Reial, and enjoy tapas and sangria in streets steeped in 2000 years of history.",
        "description_ja": "バルセロナ旧市街ゴシック地区の中世の路地を巡る散歩コース。大聖堂、王の広場、レイアール広場など2000年の歴史が息づく路地でタパスとサングリアを楽しんでください。",
        "region": "Barcelona",
        "country": "ES",
        "distance_km": Decimal("3.0"),
        "estimated_minutes": 80,
        "difficulty": "easy",
        "elevation_gain": 15,
        "start_lat": Decimal("41.384100"),
        "start_lng": Decimal("2.176400"),
        "end_lat": Decimal("41.380300"),
        "end_lng": Decimal("2.175100"),
        "best_season": "spring",
        "trail_type": "cultural",
        "walking_surface": "paved",
        "transport_access": "메트로 L4 Jaume I역 하차 도보 1분",
    },
]

SPOTS_DATA = {
    0: [  # 성수~뚝섬 한강길
        {
            "name": "성수역 카페골목 입구",
            "name_en": "Seongsu Station Cafe Alley",
            "name_ja": "聖水駅カフェ通り入口",
            "spot_type": "start",
            "order": 0,
            "distance_from_start_km": Decimal("0.0"),
            "description": "출발점. 2호선 성수역 3번 출구에서 바로 시작.",
            "tip": "주말에는 카페 대기가 길 수 있으니 평일 오전 추천.",
        },
        {
            "name": "대림창고",
            "name_en": "Daelim Warehouse",
            "name_ja": "テリム倉庫",
            "spot_type": "cafe",
            "order": 1,
            "distance_from_start_km": Decimal("0.4"),
            "description": "성수동을 대표하는 창고 리노베이션 복합문화공간 겸 카페.",
            "menu_highlight": "드립 커피, 크루아상",
            "price_range": "5,000~9,000원",
            "rating": Decimal("4.4"),
            "opening_hours": "11:00~21:00",
            "closed_days": "월요일",
            "is_must_visit": True,
        },
        {
            "name": "서울숲 정문",
            "name_en": "Seoul Forest Main Gate",
            "name_ja": "ソウルの森正門",
            "spot_type": "photo",
            "order": 2,
            "distance_from_start_km": Decimal("1.3"),
            "description": "서울숲 진입 구간. 사슴방사장과 숲 산책로가 있습니다.",
            "tip": "사슴 먹이 주기 체험은 오전 중에 가능해요.",
            "is_must_visit": True,
        },
        {
            "name": "성수 떡볶이 타운",
            "name_en": "Seongsu Tteokbokki Town",
            "name_ja": "聖水トッポッキタウン",
            "spot_type": "restaurant",
            "order": 3,
            "distance_from_start_km": Decimal("1.0"),
            "description": "성수동에서 유명한 즉석 떡볶이 골목.",
            "menu_highlight": "즉석떡볶이, 순대, 튀김",
            "price_range": "6,000~10,000원",
            "rating": Decimal("4.1"),
            "opening_hours": "11:30~21:00",
            "closed_days": "일요일",
        },
        {
            "name": "뚝섬 한강공원",
            "name_en": "Ttukseom Hangang Park",
            "name_ja": "トゥクソム漢江公園",
            "spot_type": "end",
            "order": 4,
            "distance_from_start_km": Decimal("3.5"),
            "description": "도착점. 한강 뷰를 즐기며 치맥을 할 수 있는 대표 한강공원.",
            "tip": "자전거 대여소가 있어 추가 라이딩도 가능합니다.",
        },
    ],
    1: [  # 해운대~청사포
        {
            "name": "해운대 해수욕장",
            "name_en": "Haeundae Beach",
            "name_ja": "海雲台海水浴場",
            "spot_type": "start",
            "order": 0,
            "distance_from_start_km": Decimal("0.0"),
            "description": "출발점. 해운대 백사장에서 달맞이길 방면으로 출발.",
        },
        {
            "name": "달맞이길 카페거리",
            "name_en": "Dalmaji Hill Cafe Street",
            "name_ja": "月見峠カフェ通り",
            "spot_type": "cafe",
            "order": 1,
            "distance_from_start_km": Decimal("2.0"),
            "description": "달맞이 고개를 따라 늘어선 감성 카페 거리. 바다 뷰 카페가 많습니다.",
            "menu_highlight": "오션뷰 라떼, 수제 케이크",
            "price_range": "6,000~12,000원",
            "rating": Decimal("4.3"),
            "opening_hours": "10:00~22:00",
            "is_must_visit": True,
        },
        {
            "name": "해월정",
            "name_en": "Haewoljeong Pavilion",
            "name_ja": "海月亭",
            "spot_type": "view",
            "order": 2,
            "distance_from_start_km": Decimal("3.5"),
            "description": "달맞이길 중간에 위치한 전망 정자. 탁 트인 바다를 감상할 수 있습니다.",
        },
        {
            "name": "청사포 다릿돌 전망대",
            "name_en": "Cheongsapo Skywalk",
            "name_ja": "青沙浦スカイウォーク",
            "spot_type": "photo",
            "order": 3,
            "distance_from_start_km": Decimal("5.0"),
            "description": "바다 위로 돌출된 유리 전망대. 부산 해안 사진 명소.",
            "tip": "주말에는 대기 줄이 길어요. 오전 일찍 가세요.",
            "is_must_visit": True,
        },
        {
            "name": "청사포 횟집 골목",
            "name_en": "Cheongsapo Sashimi Alley",
            "name_ja": "青沙浦刺身横丁",
            "spot_type": "restaurant",
            "order": 4,
            "distance_from_start_km": Decimal("5.5"),
            "description": "청사포 항구 근처 싱싱한 횟집 골목.",
            "menu_highlight": "모둠회, 매운탕",
            "price_range": "25,000~40,000원",
            "rating": Decimal("4.4"),
            "opening_hours": "10:00~21:00",
        },
        {
            "name": "청사포 항구",
            "name_en": "Cheongsapo Port",
            "name_ja": "青沙浦港",
            "spot_type": "end",
            "order": 5,
            "distance_from_start_km": Decimal("6.0"),
            "description": "도착점. 빨간 등대와 흰 등대가 있는 작은 어항.",
        },
    ],
    2: [  # 전주 한옥마을~남부시장
        {
            "name": "전주 한옥마을 입구",
            "name_en": "Jeonju Hanok Village Entrance",
            "name_ja": "全州韓屋村入口",
            "spot_type": "start",
            "order": 0,
            "distance_from_start_km": Decimal("0.0"),
            "description": "출발점. 태조로 입구에서 시작합니다.",
        },
        {
            "name": "전동성당",
            "name_en": "Jeondong Cathedral",
            "name_ja": "殿洞聖堂",
            "spot_type": "photo",
            "order": 1,
            "distance_from_start_km": Decimal("0.5"),
            "description": "한국 최초의 순교지에 세워진 로마네스크 양식 성당. 한옥마을 대표 포토스팟.",
            "is_must_visit": True,
        },
        {
            "name": "한옥마을 비빔밥 골목",
            "name_en": "Hanok Village Bibimbap Alley",
            "name_ja": "韓屋村ビビンバ横丁",
            "spot_type": "restaurant",
            "order": 2,
            "distance_from_start_km": Decimal("1.2"),
            "description": "전주 비빔밥의 원조 맛집들이 모여 있는 골목.",
            "menu_highlight": "전주비빔밥, 콩나물국밥",
            "price_range": "9,000~14,000원",
            "rating": Decimal("4.5"),
            "opening_hours": "10:30~20:30",
            "closed_days": "명절 당일",
            "is_must_visit": True,
        },
        {
            "name": "PNB 풍년제과",
            "name_en": "PNB Bakery",
            "name_ja": "PNBベーカリー",
            "spot_type": "cafe",
            "order": 3,
            "distance_from_start_km": Decimal("1.8"),
            "description": "전주 명물 초코파이 원조 빵집. 60년 전통.",
            "menu_highlight": "수제 초코파이, 야채빵",
            "price_range": "2,000~5,000원",
            "rating": Decimal("4.3"),
            "opening_hours": "08:00~22:00",
            "is_must_visit": True,
        },
        {
            "name": "오목대",
            "name_en": "Omokdae Pavilion",
            "name_ja": "梧木台",
            "spot_type": "view",
            "order": 4,
            "distance_from_start_km": Decimal("2.5"),
            "description": "한옥마을 전경을 한눈에 내려다볼 수 있는 전망대.",
            "tip": "해 질 무렵에 오면 지붕 위로 노을이 아름답습니다.",
        },
        {
            "name": "남부시장 야시장",
            "name_en": "Nambu Market Night Market",
            "name_ja": "南部市場夜市",
            "spot_type": "end",
            "order": 5,
            "distance_from_start_km": Decimal("4.0"),
            "description": "도착점. 금요일~토요일 저녁에는 야시장이 열립니다.",
            "menu_highlight": "꼬치, 떡갈비, 전주 막걸리",
            "price_range": "3,000~8,000원",
            "opening_hours": "금~토 18:00~24:00 (야시장), 상설시장 09:00~19:00",
            "tip": "야시장은 금·토만 운영하니 요일을 확인하세요.",
        },
    ],
    4: [  # 하동 지리산 둘레길 1~3구간 (multi-day)
        # --- Day 1 ---
        {
            "name": "화개장터",
            "name_en": "Hwagae Market",
            "name_ja": "花開市場",
            "spot_type": "start",
            "order": 0,
            "distance_from_start_km": Decimal("0.0"),
            "description": "1일차 출발점. 섬진강변의 전통 오일장. 재첩국으로 아침을 시작하세요.",
            "menu_highlight": "재첩국, 다슬기탕",
            "price_range": "7,000~10,000원",
            "opening_hours": "07:00~18:00",
            "day_number": 1,
            "is_must_visit": True,
        },
        {
            "name": "쌍계사",
            "name_en": "Ssanggyesa Temple",
            "name_ja": "双渓寺",
            "spot_type": "photo",
            "order": 1,
            "distance_from_start_km": Decimal("4.0"),
            "description": "천년 고찰 쌍계사. 봄에는 벚꽃이 만개합니다.",
            "day_number": 1,
            "is_must_visit": True,
        },
        {
            "name": "의신마을 민박",
            "name_en": "Uisin Village Homestay",
            "name_ja": "義信村民宿",
            "spot_type": "rest",
            "order": 2,
            "distance_from_start_km": Decimal("14.0"),
            "description": "1일차 숙박지. 마을 주민이 운영하는 소박한 민박.",
            "tip": "사전 예약 필수. 저녁 식사도 제공됩니다 (별도 요금).",
            "price_range": "40,000~50,000원 (1박)",
            "day_number": 1,
        },
        # --- Day 2 ---
        {
            "name": "의신마을 출발",
            "name_en": "Uisin Village Departure",
            "name_ja": "義信村出発",
            "spot_type": "start",
            "order": 3,
            "distance_from_start_km": Decimal("14.0"),
            "description": "2일차 출발. 마을 앞 둘레길 표지판을 따라 걸으세요.",
            "day_number": 2,
        },
        {
            "name": "하동 야생차 문화센터",
            "name_en": "Hadong Wild Tea Culture Center",
            "name_ja": "河東野生茶文化センター",
            "spot_type": "view",
            "order": 4,
            "distance_from_start_km": Decimal("22.0"),
            "description": "차밭이 펼쳐진 언덕 위 전망 포인트. 녹차 체험도 가능합니다.",
            "opening_hours": "09:00~18:00",
            "closed_days": "월요일",
            "day_number": 2,
            "is_must_visit": True,
        },
        {
            "name": "목통마을 게스트하우스",
            "name_en": "Moktong Village Guesthouse",
            "name_ja": "木通村ゲストハウス",
            "spot_type": "rest",
            "order": 5,
            "distance_from_start_km": Decimal("28.0"),
            "description": "2일차 숙박지. 지리산 둘레길 전용 게스트하우스.",
            "tip": "세탁 서비스 가능. 짐 포워딩(짐배송) 서비스 이용 추천.",
            "price_range": "35,000~45,000원 (1박)",
            "day_number": 2,
        },
        # --- Day 3 ---
        {
            "name": "목통마을 출발",
            "name_en": "Moktong Village Departure",
            "name_ja": "木通村出発",
            "spot_type": "start",
            "order": 6,
            "distance_from_start_km": Decimal("28.0"),
            "description": "3일차 출발. 악양 들판 방면으로 내려갑니다.",
            "day_number": 3,
        },
        {
            "name": "악양 들판",
            "name_en": "Agyang Plains",
            "name_ja": "岳陽平野",
            "spot_type": "view",
            "order": 7,
            "distance_from_start_km": Decimal("35.0"),
            "description": "소설 '토지'의 배경이 된 너른 들판. 섬진강과 지리산이 함께 보입니다.",
            "day_number": 3,
            "is_must_visit": True,
        },
        {
            "name": "최참판댁",
            "name_en": "Choi Champandaek",
            "name_ja": "崔参判宅",
            "spot_type": "photo",
            "order": 8,
            "distance_from_start_km": Decimal("38.0"),
            "description": "박경리 소설 '토지' 촬영지. 전통 한옥을 둘러볼 수 있습니다.",
            "opening_hours": "09:00~18:00",
            "day_number": 3,
        },
        {
            "name": "하동 평사리 들판",
            "name_en": "Hadong Pyeongsari Field",
            "name_ja": "河東坪沙里平野",
            "spot_type": "end",
            "order": 9,
            "distance_from_start_km": Decimal("42.0"),
            "description": "3일차 도착점. 하동읍으로 향하는 버스 이용 가능.",
            "day_number": 3,
        },
    ],
}

REVIEW_CONTENTS = [
    "정말 아름다운 코스였어요! 다음에 또 가고 싶습니다.",
    "주말에 가족과 함께 다녀왔는데 아이들도 좋아했어요.",
    "맛집 추천이 정말 도움됐습니다. 감사해요!",
    "경치가 환상적이에요. 사진 찍기 좋은 곳이 많아요.",
    "초보자도 무리 없이 걸을 수 있는 코스입니다.",
    "가을에 단풍이 정말 예쁠 것 같아요. 봄에 갔는데도 좋았습니다.",
    "표지판이 잘 되어 있어서 길 잃을 걱정 없었어요.",
    "중간에 쉴 수 있는 곳이 많아서 좋았어요.",
]


class Command(BaseCommand):
    help = "Seed the database with sample data for development"

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

    def _create_users(self):
        users = []
        user_data = [
            ("walker_kim", "산책왕김씨", "걷기 좋아하는 직장인입니다."),
            ("trail_master", "코스마스터", "전국 도보 여행 전문 가이드."),
            ("foodie_park", "맛집탐험가박씨", "걸으면서 맛집 찾는 게 취미!"),
            ("photo_lee", "사진가이씨", "걷는 길에서 만나는 풍경을 담습니다."),
            ("jeju_lover", "제주사랑", "제주도를 사랑하는 여행자."),
        ]
        for username, nickname, bio in user_data:
            user, created = CustomUser.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@example.com",
                    "nickname": nickname,
                    "bio": bio,
                    "preferred_language": "ko",
                },
            )
            if created:
                user.set_password("testpass123!")
                user.save()
            users.append(user)

        # 가이드 계정
        if users[1]:
            users[1].is_guide = True
            users[1].save(update_fields=["is_guide"])

        return users

    def _create_tags(self):
        tags = []
        for name, name_en, name_ja in TAGS_DATA:
            tag, _ = Tag.objects.get_or_create(
                name=name, defaults={"name_en": name_en, "name_ja": name_ja}
            )
            tags.append(tag)
        return tags

    def _create_trails(self, users, tags):
        trails = []
        for i, data in enumerate(TRAILS_DATA):
            trail, created = Trail.objects.get_or_create(
                title=data["title"],
                defaults={
                    "author": users[i % len(users)],
                    "status": "approved",
                    "path_data": {"type": "LineString", "coordinates": []},
                    **{k: v for k, v in data.items() if k != "title"},
                },
            )
            if created:
                # 각 코스에 2~4개 태그 랜덤 부여
                trail.tags.set(random.sample(tags, min(random.randint(2, 4), len(tags))))
                trail.like_count = random.randint(5, 150)
                trail.view_count = random.randint(50, 2000)
                trail.save(update_fields=["like_count", "view_count"])
            trails.append(trail)
        return trails

    def _create_spots(self, trails, users):
        for trail_idx, spots in SPOTS_DATA.items():
            if trail_idx >= len(trails):
                continue
            trail = trails[trail_idx]
            for spot_data in spots:
                # 좌표는 trail의 start/end 사이를 보간
                ratio = spot_data["order"] / max(len(spots) - 1, 1)
                lat = trail.start_lat + (trail.end_lat - trail.start_lat) * Decimal(str(ratio))
                lng = trail.start_lng + (trail.end_lng - trail.start_lng) * Decimal(str(ratio))

                Spot.objects.get_or_create(
                    trail=trail,
                    name=spot_data["name"],
                    defaults={
                        "author": trail.author,
                        "name_en": spot_data.get("name_en", ""),
                        "name_ja": spot_data.get("name_ja", ""),
                        "spot_type": spot_data["spot_type"],
                        "lat": lat,
                        "lng": lng,
                        "order": spot_data["order"],
                        "distance_from_start_km": spot_data.get("distance_from_start_km", Decimal("0")),
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

    def _create_reviews(self, trails, users):
        for trail in trails:
            num_reviews = random.randint(2, 5)
            reviewers = random.sample(users, min(num_reviews, len(users)))
            for user in reviewers:
                if Review.objects.filter(trail=trail, author=user).exists():
                    continue
                days_ago = random.randint(1, 90)
                Review.objects.create(
                    trail=trail,
                    author=user,
                    rating=random.randint(3, 5),
                    content=random.choice(REVIEW_CONTENTS),
                    visited_date=date.today() - timedelta(days=days_ago),
                    helpful_count=random.randint(0, 20),
                    status="approved",
                )

    def _create_likes(self, trails, users):
        for trail in trails:
            likers = random.sample(users, random.randint(1, len(users)))
            for user in likers:
                TrailLike.objects.get_or_create(user=user, trail=trail)
