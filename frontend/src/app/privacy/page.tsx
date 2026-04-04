"use client";
export default function PrivacyPage() {
  return (
    <div className="md:pt-[60px] min-h-screen bg-warm pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-14 md:pt-6">
        <h1 className="text-[22px] font-bold mb-6">개인정보처리방침</h1>
        <div className="card p-6 space-y-4 text-[14px] text-text-secondary leading-relaxed">
          <h2 className="text-[16px] font-bold text-text-primary">1. 수집하는 개인정보</h2>
          <p>서비스는 회원가입 시 이메일, 닉네임, 비밀번호를 수집하며, 서비스 이용 과정에서 GPS 위치 정보, 걸음 수, 프로필 사진 등을 수집할 수 있습니다.</p>
          <h2 className="text-[16px] font-bold text-text-primary">2. 개인정보의 이용 목적</h2>
          <p>수집된 정보는 서비스 제공, 도보 기록 저장, 커뮤니티 운영, 동행 매칭 등의 목적으로만 사용됩니다.</p>
          <h2 className="text-[16px] font-bold text-text-primary">3. 개인정보의 보관 기간</h2>
          <p>회원 탈퇴 시 개인정보는 즉시 파기됩니다. 다만, 법령에 의거 보관이 필요한 경우 해당 기간 동안 보관합니다.</p>
          <h2 className="text-[16px] font-bold text-text-primary">4. 개인정보의 제3자 제공</h2>
          <p>서비스는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.</p>
          <h2 className="text-[16px] font-bold text-text-primary">5. 문의</h2>
          <p>개인정보 관련 문의: support@roami.app</p>
        </div>
      </div>
    </div>
  );
}
