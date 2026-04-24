// 베타 테스트 공유 기간 동안 로그인 진입을 차단하고 "준비 중" 안내만 노출.
// 로그인 로직은 제거하지 않고 git 이력에 보존되어 있으므로 언제든 복구 가능.
import AuthComingSoonNotice from "@/components/AuthComingSoonNotice";

export default function LoginPage() {
  return <AuthComingSoonNotice />;
}
