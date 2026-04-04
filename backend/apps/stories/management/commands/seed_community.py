import random
from datetime import date, timedelta

from django.core.management.base import BaseCommand

from apps.accounts.models import CustomUser
from apps.stories.models import StoryComment, WalkStory
from apps.trails.models import Trail


# 20명의 유저 프로필
USERS = [
    ("seongsu_cafe", "성수카페러", "성수동 카페 50곳 돌파한 카페 중독자", "30s", "foodie"),
    ("jeju_hiker", "제주바람", "제주 올레길 마스터를 꿈꾸는 직장인", "30s", "explorer"),
    ("photo_jimin", "사진찍는지민", "걸으면서 사진 찍는 게 최고의 힐링", "20s", "photographer"),
    ("busan_wave", "부산파도", "해안길이라면 어디든 달려갑니다", "20s", "explorer"),
    ("jeonju_taste", "전주미식가", "전주에서 먹고 걷고 또 먹는 삶", "40s", "foodie"),
    ("quiet_walk", "조용한산책", "혼자 걷는 시간이 가장 좋아요", "30s", "silent"),
    ("couple_hike", "커플워커", "주말마다 함께 걷는 커플입니다", "20s", "talker"),
    ("seoul_alley", "서울골목탐험", "서울의 숨은 골목을 찾아다닙니다", "30s", "explorer"),
    ("nature_love", "자연사랑", "숲길, 둘레길, 자연 속 걷기를 좋아해요", "40s", "silent"),
    ("gangneung_coffee", "강릉커피산책", "안목해변 커피거리 단골입니다", "20s", "foodie"),
    ("gyeongju_history", "경주역사산책", "천년 고도를 걷는 역사 덕후", "30s", "explorer"),
    ("travel_writer", "여행글쓰는사람", "걷기 여행을 글로 기록합니다", "30s", "talker"),
    ("weekend_walker", "주말워커", "주말엔 무조건 걷습니다", "20s", "explorer"),
    ("foodie_walk", "먹으면서걷기", "맛집 탐방이 곧 도보여행", "30s", "foodie"),
    ("sunset_chaser", "노을추적자", "석양이 예쁜 길만 골라 걸어요", "20s", "photographer"),
    ("haneul_mom", "하늘맘", "아이와 함께 걷기 좋은 길 찾아요", "40s", "talker"),
    ("solo_traveler", "혼여행가", "혼자서도 충분히 행복한 걷기", "30s", "silent"),
    ("tokyo_walker", "도쿄걷는사람", "일본 골목 산책을 좋아합니다", "20s", "explorer"),
    ("spring_bloom", "봄꽃산책", "꽃 피는 길이면 어디든 좋아요", "30s", "photographer"),
    ("midnight_walk", "야간산책러", "밤에 걷는 도시가 제일 예뻐요", "20s", "explorer"),
    # International users
    ("tokyo_yuki", "東京ゆき", "東京の散歩が大好きです", "20s", "photographer"),
    ("kyoto_sakura", "京都さくら", "京都の路地裏を歩くのが趣味", "30s", "explorer"),
    ("nyc_walker", "NYCWalker", "Walking NYC one block at a time", "30s", "explorer"),
    ("london_steps", "LondonSteps", "Exploring London on foot", "20s", "photographer"),
    ("paris_flaneur", "ParisFlaneur", "Flâner dans les rues de Paris", "40s", "silent"),
    ("barcelona_walk", "BarcelonaWalk", "Caminando por Barcelona", "30s", "foodie"),
    ("taipei_walk", "台北散步", "台北巷弄探索者", "20s", "foodie"),
    ("bangkok_roam", "BangkokRoam", "Roaming Bangkok streets", "20s", "foodie"),
]

# 리얼한 스토리 데이터
STORIES = [
    {
        "trail_title": "서울 성수~뚝섬 한강길",
        "title": "성수동 카페거리에서 한강까지, 완벽한 토요일",
        "content": "토요일 오전 11시, 성수역에서 내려서 걷기 시작했다.\n\n대림창고 카페에서 아메리카노 한 잔 들고 뚝섬유원지까지. 한강 둔치에 앉아서 바람 맞으니까 일주일 피로가 싹 풀리는 기분.\n\n성수동은 갈 때마다 새로운 카페가 생기는 게 신기하다. 오늘 발견한 소금빵 맛집은 진짜 미쳤음. 다음엔 서울숲까지 코스 연장해봐야지.",
        "mood": "happy",
        "likes": 47,
    },
    {
        "trail_title": "부산 해운대~청사포 해안길",
        "title": "청사포에서 만난 일출, 인생 뷰였다",
        "content": "새벽 5시에 일어나서 해운대에서 청사포까지 걸었다. 미쳤다고 생각했는데 일출 보는 순간 올길 잘했다 싶었음.\n\n달맞이길 카페거리는 아직 문 열기 전이라 고요하니 좋았고, 청사포 다릿돌 전망대에서 보는 바다는 진짜 영화 같았다.\n\n돌아오는 길에 횟집 골목에서 회 한 접시. 이게 부산이지.",
        "mood": "touching",
        "likes": 82,
    },
    {
        "trail_title": "전주 한옥마을~남부시장 문화탐방",
        "content": "전주 한옥마을은 몇 번을 와도 좋다.\n\n이번엔 관광객 많은 메인 거리 말고 뒷골목 위주로 걸어봤는데, 조용한 한옥 사이로 고양이도 만나고 숨은 공방도 발견하고.\n\n비빔밥은 패스하고 남부시장 야시장에서 이것저것 집어먹기. 막걸리 한 잔에 녹두전이 최고였다.\n\n전주는 밤에 걸어야 진짜 예쁘다는 걸 오늘 알았음.",
        "mood": "happy",
        "likes": 63,
    },
    {
        "trail_title": "제주 올레길 7코스",
        "content": "제주 올레길 7코스 완주!\n\n외돌개에서 시작해서 월평 해변까지 15km. 솔직히 중간에 포기할 뻔했는데 주상절리 보는 순간 힘이 났다.\n\n해녀의 집에서 전복죽 먹을 때 행복 지수 최고치 달성. 제주 올레길은 정말 한 코스 한 코스가 작품이다.\n\n다리는 아프지만 마음은 가벼운 하루.",
        "mood": "exciting",
        "likes": 91,
    },
    {
        "trail_title": "서울 북촌한옥마을 골목 산책",
        "title": "비 오는 날 북촌이 더 예쁜 이유",
        "content": "비 오는 날 북촌은 다른 세계다.\n\n한옥 기와에 떨어지는 빗소리, 젖은 돌담길, 인파 없는 골목. 우산 하나 들고 느릿느릿 걸었다.\n\n삼청동 수제비집은 비 오는 날 웨이팅이 길어지니까 일찍 가는 게 좋음. 따뜻한 국물이 빗속 산책의 완벽한 마무리.",
        "mood": "peaceful",
        "likes": 55,
    },
    {
        "trail_title": "강릉 경포호~안목해변 카페길",
        "title": "경포호 벚꽃은 지고, 카페길은 남았다",
        "content": "벚꽃 시즌 끝물에 강릉 갔는데 오히려 좋았다. 사람 적고 꽃잎 날리고.\n\n경포호 둘레를 한 바퀴 돌고 안목해변까지 걸었다. 커피거리에서 핸드드립 한 잔 마시면서 바다 보니까 '아 이래서 강릉 강릉 하는구나' 싶었음.\n\n다음엔 주문진까지 연장해서 걸어봐야지.",
        "mood": "peaceful",
        "likes": 38,
    },
    {
        "trail_title": "하동 지리산 둘레길 1~3구간",
        "title": "2박 3일 지리산 둘레길, 인생이 달라졌다",
        "content": "2박 3일 동안 42km를 걸었다.\n\nDay 1: 하동 화개장터에서 시작. 섬진강 따라 걷는데 벚꽃이 미쳤다. 민박집 할머니가 해주신 된장찌개가 미슐랭급.\n\nDay 2: 산골 마을 사이를 걷는 구간. 논두렁길에서 만난 할아버지가 감 하나 주셨다. 이런 게 걷기여행이지.\n\nDay 3: 마지막 구간은 힘들었지만 완주의 감동이. 눈물 날 뻔.\n\n인생에 한 번은 꼭 걸어봐야 할 길이다.",
        "mood": "touching",
        "likes": 124,
    },
    {
        "trail_title": "도쿄 야나카 골목 산책",
        "title": "도쿄에서 가장 따뜻한 동네, 야나카",
        "content": "야나카는 도쿄의 숨은 보석 같은 동네다.\n\n닛포리역에서 내려서 야나카 묘지 벚꽃길을 지나 긴자 상점가까지. 멘치카츠 하나 들고 골목골목 구경하는 재미가 쏠쏠.\n\n석양 계단(夕焼けだんだん)에서 해 질 녘에 앉아있으면 시간이 멈춘 것 같다. 고양이도 옆에 와서 앉더라.\n\n도쿄 여행 간다면 시부야 말고 야나카 가세요.",
        "mood": "peaceful",
        "likes": 76,
    },
    {
        "trail_title": "서울 성수~뚝섬 한강길",
        "title": "야간 한강 산책의 매력에 빠지다",
        "content": "밤 9시, 뚝섬유원지에서 성수 방향으로 걸었다.\n\n한강 야경이 이렇게 예쁜 줄 몰랐음. 조명 반사되는 수면, 멀리 보이는 잠실 불빛, 달리는 자전거 소리.\n\n편의점에서 맥주 하나 사서 벤치에 앉으니 이게 천국이구나. 혼자 걷는 밤 한강, 강추합니다.",
        "mood": "peaceful",
        "likes": 69,
    },
    {
        "trail_title": "전주 한옥마을~남부시장 문화탐방",
        "title": "전주 3번째인데 매번 새롭다",
        "content": "이번엔 전동성당에서 시작해서 한옥마을 뒷골목 → PNB 풍년제과 → 남부시장 코스로.\n\n풍년제과 초코파이는 줄 서서 먹을 가치 있음. 남부시장 야시장은 금요일 저녁이 최고. 사람 구경하는 재미가 있다.\n\n아이와 함께 가도 좋은 코스. 평지라서 유모차도 OK.",
        "mood": "happy",
        "likes": 41,
    },
    {
        "trail_title": "부산 해운대~청사포 해안길",
        "content": "부산 출장 겸 반차 내고 해운대~청사포 걸었다.\n\n달맞이길 오르막이 좀 있지만 카페거리 도착하면 보상받는 느낌. 테라스에서 바다 보면서 라떼 한 잔.\n\n청사포 횟집은 점심 특선이 가성비 미쳤음. 광어회 + 매운탕 세트 2만원.\n\n서울 사는 사람으로서 부산 부럽다...",
        "mood": "happy",
        "likes": 53,
    },
    {
        "trail_title": "서울 북촌한옥마을 골목 산책",
        "title": "외국인 친구와 함께 걸은 북촌",
        "content": "일본에서 온 친구 데리고 북촌 코스 걸었다.\n\n한옥의 아름다움에 감탄하더니 사진을 200장은 찍은 듯. 삼청동 쑥라떼도 맛있다고 엄지척.\n\n서울에 살면서도 잘 안 가던 곳인데, 외국인 친구 덕분에 재발견한 느낌. 가끔은 내가 사는 도시를 여행자 눈으로 봐야 한다.",
        "mood": "happy",
        "likes": 45,
    },
    # International stories
    {
        "trail_title": "도쿄 야나카 골목 산책",
        "author_hint": "tokyo_yuki",
        "title": "谷中で見つけた小さな幸せ",
        "content": "야나카(谷中)는 도쿄에서 가장 따뜻한 동네라고 했는데, 정말 그랬다.\n\n닛포리역에서 내리자마자 묘지 옆 벚꽃길이 펼쳐졌다. 긴자 상점가에서 멘치카츠를 하나 사 들고, 好きな路地를 하나하나 걸었다.\n\n석양 계단(夕焼けだんだん)에서 노을을 보며 생각했다. 걷는다는 건 결국 '작은 행복'을 모으는 일이라고.\n\n猫もいて、最高の散歩でした。",
        "mood": "peaceful",
        "likes": 67,
    },
    {
        "trail_title": "서울 성수~뚝섬 한강길",
        "author_hint": "nyc_walker",
        "title": "Seoul's Hidden Gem: Seongsu to Ttukseom",
        "content": "As a New Yorker, I thought I knew urban walks. Then I discovered the Seongsu-to-Ttukseom route.\n\nStarting at Seongsu Station, you walk through a neighbourhood that feels like Brooklyn met Harajuku — converted warehouses turned into cafes, indie boutiques, and art spaces everywhere.\n\nBut the real surprise is reaching the Han River. The waterfront path is immaculate, with views that rival the Hudson River Greenway. Grabbed a beer from a convenience store, sat on a bench, and watched the sunset paint the river gold.\n\nSeoul's walking infrastructure is honestly world-class. Add this to your list.",
        "mood": "exciting",
        "likes": 89,
    },
    {
        "trail_title": "전주 한옥마을~남부시장 문화탐방",
        "author_hint": "london_steps",
        "title": "Jeonju: Korea's Most Delicious Walk",
        "content": "I've walked through markets in London, Istanbul, and Marrakech, but Jeonju's Nambu Night Market is something else entirely.\n\nThe hanok village is stunning — traditional Korean houses with curved rooftops lining quiet alleyways. Skip the main tourist drag and wander the back lanes where you'll find hidden workshops and sleepy cats.\n\nThen comes the food. Oh, the food. Bindaetteok (mung bean pancakes) sizzling on a griddle, makgeolli poured from a kettle, and something called choco pie from PNB bakery that puts our McVitie's to shame.\n\nJeonju is proof that the best walks are measured in bites, not miles.",
        "mood": "happy",
        "likes": 73,
    },
    {
        "trail_title": "부산 해운대~청사포 해안길",
        "author_hint": "taipei_walk",
        "title": "釜山海岸散步，美得像電影",
        "content": "부산 해운대에서 청사포까지 걸었는데, 정말 영화 속 한 장면 같았다.\n\n달맞이길을 올라가면 카페거리가 나오고, 테라스에서 내려다보는 바다가 너무 아름다웠다. 台北的海岸也很美，但釜山的海有一種不同的藍。\n\n청사포 다릿돌 전망대에서 바라본 풍경은 말로 표현할 수 없을 정도. 돌아오는 길에 먹은 회는 신선하고 가격도 착했다.\n\n強烈推薦這條路線！꼭 한 번 걸어보세요.",
        "mood": "touching",
        "likes": 58,
    },
    {
        "trail_title": "제주 올레길 7코스",
        "author_hint": "paris_flaneur",
        "title": "Jeju Olle: A Walk That Changes You",
        "content": "There is a particular kind of walk that rearranges something inside you. The Jeju Olle Trail Route 7 is that walk.\n\nYou begin at Oedolgae Rock — a solitary column of basalt standing defiantly against the sea. The metaphor is almost too perfect: standing alone, shaped by time and water, yet unbroken.\n\nFifteen kilometres later, after coastal cliffs, tangerine orchards, and the columnar joints that look like a cathedral designed by the earth itself, you arrive at Wolpyeong Beach with aching legs and a quiet mind.\n\nI stopped at a haenyeo restaurant for jeonbokjuk — abalone porridge made by the diving women of Jeju. Simple food, profound in its honesty.\n\nWalking changes nothing about the world. It changes everything about how you see it.",
        "mood": "touching",
        "likes": 95,
    },
]

# 다양한 댓글
COMMENTS_POOL = [
    "와 이 코스 저도 가봤는데 진짜 좋죠!",
    "사진이 너무 예뻐요 ㅠㅠ 저도 가고 싶다",
    "맛집 정보 감사합니다! 메모해뒀어요",
    "혼자 가도 괜찮을까요?",
    "주차는 어디에 하셨어요?",
    "날씨 좋은 날 가야겠다",
    "우와 여기 진짜 예쁘네요",
    "저 다음 주에 갈 건데 꿀팁 감사해요!",
    "같이 가실 분 없나요? ㅎㅎ",
    "비 오는 날도 좋다니 의외네요",
    "전 봄에 갔었는데 벚꽃이 장관이었어요",
    "커피 맛집 추천 더 해주세요!",
    "아이랑 가기 좋을까요?",
    "교통편이 어떻게 되나요?",
    "저도 여기 다녀왔어요! 공감 100%",
    "글 잘 쓰시네요. 읽으면서 같이 걷는 기분",
    "야간 산책 저도 좋아해요. 감성 충전됨",
    "2박 3일 코스 진짜 도전해보고 싶어요",
    "할머니 된장찌개 부분에서 눈물 날 뻔 ㅋㅋ",
    "제주 올레길 7코스는 진짜 인생 코스임",
    "도쿄 야나카 정보 감사합니다! 다음 여행 때 꼭",
    "석양 계단 사진 있으면 공유해주세요~",
    "남부시장 야시장 금요일이 최고라는 거 동의!",
    "PNB 초코파이 줄 서도 먹을 가치 있음 ㅋㅋ",
    "혼자 걷는 게 이렇게 좋은 줄 몰랐어요",
    "글 읽고 바로 주말 계획 세웠습니다",
    "해녀의 집 전복죽 저도 먹어봤는데 대박",
    "저도 다음에 꼭 가볼게요! 북마크 완료",
    "밤 한강 산책 최고죠. 공감합니다",
    "편의점 맥주 + 한강 = 천국 공식",
    # International comments
    "This is amazing! Adding to my Korea trip list 🇰🇷",
    "日本からです。韓国の散歩道も素敵ですね！",
    "I walked this trail last month. Absolutely beautiful!",
    "한국어 잘 못하지만 사진 보고 감동했어요",
    "Added to my bucket list! How long is the flight from Tokyo?",
    "完全同意！這條路線太美了",
    "Which season is best for this trail?",
    "Can someone translate this? It looks incredible",
    "Walking trails in Korea are so well maintained 👏",
    "계절마다 다른 매력이 있는 코스네요",
]


class Command(BaseCommand):
    help = "Seed community data: users, stories, comments (MAU 100 scale)"

    def handle(self, *args, **options):
        self.stdout.write("Creating community users...")
        users = self._create_users()
        trails = list(Trail.objects.filter(status="approved"))

        self.stdout.write("Creating stories...")
        stories = self._create_stories(users, trails)

        self.stdout.write("Creating comments...")
        self._create_comments(stories, users)

        self.stdout.write(self.style.SUCCESS(
            f"Community data created: {len(users)} users, {len(stories)} stories, "
            f"{StoryComment.objects.count()} comments"
        ))

    # Map international usernames to their preferred language
    LANGUAGE_MAP = {
        "tokyo_yuki": "ja",
        "kyoto_sakura": "ja",
        "nyc_walker": "en",
        "london_steps": "en",
        "paris_flaneur": "en",
        "barcelona_walk": "en",
        "taipei_walk": "zh",
        "bangkok_roam": "en",
    }

    def _create_users(self):
        users = []
        for username, nickname, bio, age_range, style in USERS:
            lang = self.LANGUAGE_MAP.get(username, "ko")
            user, created = CustomUser.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@example.com",
                    "nickname": nickname,
                    "bio": bio,
                    "age_range": age_range,
                    "walking_style": style,
                    "one_liner": bio[:50],
                    "preferred_language": lang,
                    "total_walks": random.randint(3, 30),
                    "companion_count": random.randint(0, 15),
                },
            )
            if created:
                user.set_password("testpass123!")
                user.save()
            users.append(user)
        return users

    def _create_stories(self, users, trails):
        stories = []
        trail_map = {t.title: t for t in trails}
        user_map = {u.username: u for u in users}

        for i, sd in enumerate(STORIES):
            trail = trail_map.get(sd["trail_title"])
            if not trail:
                continue

            hint = sd.get("author_hint")
            author = user_map.get(hint, users[i % len(users)])
            days_ago = random.randint(1, 30)

            story, created = WalkStory.objects.get_or_create(
                author=author,
                trail=trail,
                content=sd["content"],
                defaults={
                    "title": sd.get("title", ""),
                    "mood": sd["mood"],
                    "like_count": sd["likes"],
                    "is_public": True,
                },
            )
            if created and not story.title:
                story.title = f"{(date.today() - timedelta(days=days_ago)).strftime('%m월 %d일')}, {trail.title}을 걸었다"
                story.save(update_fields=["title"])

            stories.append(story)
        return stories

    def _create_comments(self, stories, users):
        for story in stories:
            if StoryComment.objects.filter(story=story).exists():
                continue
            num_comments = random.randint(3, 12)
            commenters = random.sample(users, min(num_comments, len(users)))
            for user in commenters:
                if user == story.author:
                    continue
                StoryComment.objects.create(
                    story=story,
                    author=user,
                    content=random.choice(COMMENTS_POOL),
                    like_count=random.randint(0, 15),
                )
            story.comment_count = story.comments.count()
            story.save(update_fields=["comment_count"])
