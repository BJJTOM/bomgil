"use client";

/**
 * 로그인/가입 기능 "준비 중" 안내.
 *
 * 배경: 베타 테스트 공유 단계에서 개인정보 수집·관리 체계가 갖춰지기 전까지
 * 계정 생성·로그인을 임시로 막는다. 코스 탐색 같은 읽기 전용 기능은 그대로
 * 사용 가능.
 *
 * 보호된 기능(코스 등록, 리뷰 작성 등)의 개별 가드(\"로그인이 필요합니다\")는
 * 기존 그대로 유지하고, 이 화면은 가드를 눌렀을 때 도달하는 `/auth/*` 에서만
 * 보이게 한다.
 */
import Link from "next/link";

export default function AuthComingSoonNotice() {
  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-3xl mb-5">
          🔒
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-3">
          로그인 · 가입 준비 중이에요
        </h1>
        <p className="text-[15px] leading-relaxed text-text-secondary mb-8">
          더 안전하게 서비스를 제공하기 위해 계정 기능을 준비하고 있어요.
          <br />
          지금은 <span className="font-semibold text-text-primary">로그인 없이도 코스·지역·랭킹</span>을 둘러보실 수 있습니다.
        </p>

        <div className="grid gap-3">
          <Link
            href="/"
            className="block w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary-600 transition-colors"
          >
            홈으로 둘러보기
          </Link>
          <Link
            href="/explore"
            className="block w-full py-3 rounded-xl border border-gray-200 text-text-primary font-semibold hover:bg-gray-50 transition-colors"
          >
            코스 탐색하기
          </Link>
        </div>

        <p className="text-xs text-text-tertiary mt-8 leading-relaxed">
          정식 오픈 시 이메일/휴대폰 인증 등을 안내드릴 예정입니다.
          <br />
          기다려 주셔서 감사해요 🙏
        </p>
      </div>
    </div>
  );
}
