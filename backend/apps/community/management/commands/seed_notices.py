from django.core.management.base import BaseCommand
from apps.community.models import Notice


class Command(BaseCommand):
    help = "Seed default notices"

    def handle(self, *args, **options):
        if Notice.objects.exists():
            self.stdout.write("Notices already exist, skipping.")
            return

        notices = [
            {
                "title": "베타 서비스 이용 안내 (필독)",
                "content": (
                    "안녕하세요, 모루(Moru)입니다.\n\n"
                    "현재 모루는 베타(Beta) 테스트 단계로 운영되고 있습니다.\n"
                    "베타 기간 중 아래 사항을 반드시 확인해주세요.\n\n"
                    "[베타 서비스 안내]\n\n"
                    "1. 데이터 초기화 가능성\n"
                    "- 베타 기간 중 서비스 개선을 위해 서버 데이터가 초기화될 수 있습니다.\n"
                    "- 가입하신 계정, 작성한 게시글, 등록한 코스, 활동 기록 등이 사전 고지 후 삭제될 수 있습니다.\n"
                    "- 중요한 걷기 기록은 별도로 백업해주시기 바랍니다.\n\n"
                    "2. 약관 및 정책 변경\n"
                    "- 서비스 이용약관과 개인정보처리방침은 베타 기간 중 수시로 변경될 수 있습니다.\n"
                    "- 변경 시 공지사항을 통해 안내드립니다.\n\n"
                    "3. 서비스 불안정\n"
                    "- 기능 추가 및 버그 수정이 수시로 이루어지고 있어 일시적으로 서비스가 불안정할 수 있습니다.\n"
                    "- 오류 발생 시 앱을 재시작하거나 업데이트를 확인해주세요.\n\n"
                    "4. 피드백 환영\n"
                    "- 버그 제보, 기능 제안, 개선 의견은 커뮤니티 게시판 또는 support@moruwalk.com으로 보내주세요.\n"
                    "- 베타 기간 중 소중한 피드백을 주신 분들께 정식 출시 시 감사 혜택을 드릴 예정입니다.\n\n"
                    "베타 테스트에 참여해주셔서 감사합니다.\n"
                    "함께 더 좋은 서비스를 만들어가겠습니다."
                ),
                "is_pinned": True,
            },
            {
                "title": "앱 권한 안내",
                "content": (
                    "모루 앱은 서비스 제공을 위해 다음 권한을 요청합니다.\n\n"
                    "[필수 권한]\n"
                    "- 위치 (GPS): 걷기 기록, 주변 코스 검색\n"
                    "- 인터넷: 서비스 이용\n\n"
                    "[선택 권한]\n"
                    "- 카메라: 걷기 중 사진 촬영\n"
                    "- 사진/미디어: 이미지 첨부\n"
                    "- 신체 활동: 걸음수 측정\n"
                    "- 백그라운드 위치: 걷기 중 앱 전환 시 기록 유지\n"
                    "- Health Connect: 워치 데이터 연동\n"
                    "- 알림: 푸시 알림 수신\n\n"
                    "선택 권한을 거부해도 해당 기능 외 서비스 이용에는 제한이 없습니다.\n\n"
                    "설정 > 앱 > 모루 > 권한에서 언제든 변경 가능합니다."
                ),
                "is_pinned": False,
            },
            {
                "title": "커뮤니티 이용 가이드",
                "content": (
                    "모루 커뮤니티를 이용해주셔서 감사합니다.\n\n"
                    "게시판 카테고리:\n"
                    "- 자유: 일상 산책 이야기\n"
                    "- 질문: 코스, 장비 등 질문\n"
                    "- 추천: 좋았던 코스 추천\n"
                    "- 후기: 코스 방문 후기\n"
                    "- 번개: 같이 걷기 모임\n"
                    "- 꿀팁: 산책 노하우 공유\n\n"
                    "커뮤니티 규칙:\n"
                    "- 다른 이용자를 존중해주세요\n"
                    "- 허위 정보를 게시하지 마세요\n"
                    "- 광고/스팸은 삭제될 수 있습니다\n"
                    "- 부적절한 게시물은 신고해주세요"
                ),
                "is_pinned": False,
            },
        ]

        for n in notices:
            Notice.objects.create(**n)
            self.stdout.write(f"  Created: {n['title']}")

        self.stdout.write(self.style.SUCCESS("Notices seeded!"))
