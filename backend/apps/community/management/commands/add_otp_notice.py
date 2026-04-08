from django.core.management.base import BaseCommand
from apps.community.models import Notice


class Command(BaseCommand):
    help = "Add OTP test mode notice"

    def handle(self, *args, **options):
        title = "전화번호 인증 안내 (베타 기간)"
        if Notice.objects.filter(title=title).exists():
            self.stdout.write("Notice already exists.")
            return

        Notice.objects.create(
            title=title,
            content=(
                "안녕하세요, 모루 베타 테스터 여러분!\n\n"
                "현재 모루는 베타 테스트 단계로 운영되고 있어 SMS 인증 시스템이 다음과 같이 동작합니다.\n\n"
                "📱 [전화번호 인증 방식]\n"
                "1. 회원가입 화면에서 전화번호를 입력합니다.\n"
                "2. '인증번호' 버튼을 누르면 6자리 코드가 화면에 직접 표시됩니다.\n"
                "3. SMS로 발송되지 않고, 알림창에 바로 보여집니다.\n"
                "4. 자동으로 입력칸에 채워지므로 '확인'만 누르면 됩니다.\n\n"
                "⚠️ [중요 안내]\n"
                "- 베타 기간 한정으로 실제 SMS 발송 비용을 절감하기 위한 임시 방식입니다.\n"
                "- 정식 출시 시에는 SMS로 전송됩니다.\n"
                "- 모든 인증 기록은 안전하게 저장 및 관리됩니다.\n\n"
                "💡 [개인정보 보호]\n"
                "- 입력하신 전화번호는 본인 확인 용도로만 사용됩니다.\n"
                "- 제3자에게 제공되지 않습니다.\n"
                "- 회원 탈퇴 시 즉시 삭제됩니다.\n\n"
                "베타 테스트에 참여해주셔서 감사합니다!\n"
                "버그 제보나 의견은 support@moruwalk.com 으로 보내주세요."
            ),
            is_pinned=True,
        )
        self.stdout.write(self.style.SUCCESS("OTP notice created!"))
