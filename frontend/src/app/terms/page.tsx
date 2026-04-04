"use client";
export default function TermsPage() {
  return (
    <div className="md:pt-[60px] min-h-screen bg-warm pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-14 md:pt-6">
        <h1 className="text-[22px] font-bold mb-6">서비스 이용약관</h1>
        <div className="card p-6 space-y-4 text-[14px] text-text-secondary leading-relaxed">
          <h2 className="text-[16px] font-bold text-text-primary">제1조 (목적)</h2>
          <p>이 약관은 Roami(이하 "서비스")가 제공하는 도보여행 코스 공유 및 동행 매칭 서비스의 이용과 관련하여 서비스와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>
          <h2 className="text-[16px] font-bold text-text-primary">제2조 (정의)</h2>
          <p>1. "서비스"란 Roami가 제공하는 도보여행 코스 정보, 커뮤니티, GPS 기록, 동행 매칭 등 일체의 서비스를 의미합니다.</p>
          <p>2. "이용자"란 이 약관에 따라 서비스를 이용하는 회원 및 비회원을 말합니다.</p>
          <h2 className="text-[16px] font-bold text-text-primary">제3조 (약관의 효력)</h2>
          <p>이 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.</p>
          <h2 className="text-[16px] font-bold text-text-primary">제4조 (서비스의 제공)</h2>
          <p>서비스는 도보여행 코스 탐색, 등록, 공유, GPS 기록, 커뮤니티, 동행 매칭 기능을 제공하며, 서비스 내용은 수시로 변경될 수 있습니다.</p>
          <h2 className="text-[16px] font-bold text-text-primary">제5조 (개인정보)</h2>
          <p>서비스는 관련 법령에 따라 이용자의 개인정보를 보호하기 위해 노력합니다. 개인정보 처리에 관한 사항은 개인정보처리방침에 따릅니다.</p>
        </div>
      </div>
    </div>
  );
}
