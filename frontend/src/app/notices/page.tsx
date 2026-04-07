"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/stores/language";

const NOTICES = [
  {
    id: 1,
    date: "2026-04-08",
    title: "커뮤니티 기능 오픈",
    content: "게시판, 모임, 챌린지 기능이 새로 추가되었습니다. 커뮤니티 탭에서 확인해보세요!",
    badge: "NEW",
  },
  {
    id: 2,
    date: "2026-04-07",
    title: "걷기 기록 기능 업데이트",
    content: "걷기 중 사진 촬영과 스팟 마킹이 가능해졌습니다. GPS 정확도도 개선되었습니다.",
    badge: "UPDATE",
  },
  {
    id: 3,
    date: "2026-04-01",
    title: "Moru 서비스 오픈",
    content: "걸으면 보이는 것들, Moru가 정식 오픈했습니다. 전 세계 걷기 코스를 탐색하고 기록해보세요.",
    badge: "",
  },
];

export default function NoticesPage() {
  const router = useRouter();
  const { language } = useT();
  const ko = language === "ko";

  return (
    <div className="md:pt-[60px] min-h-screen bg-white">
      <header className="sticky top-0 md:top-[60px] z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-lg">←</button>
          <span className="text-[16px] font-semibold text-gray-900">{ko ? "공지사항" : "Notices"}</span>
          <div className="w-8" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {NOTICES.map((notice, i) => (
          <div key={notice.id} className="px-5 py-5 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              {notice.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  notice.badge === "NEW" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                }`}>
                  {notice.badge}
                </span>
              )}
              <span className="text-[12px] text-gray-400">{notice.date}</span>
            </div>
            <h2 className="text-[15px] font-semibold text-gray-900 mb-1.5">{notice.title}</h2>
            <p className="text-[14px] text-gray-500 leading-relaxed">{notice.content}</p>
          </div>
        ))}
      </main>
    </div>
  );
}
