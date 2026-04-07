"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STEPS = [
  { emoji: "🚶", title: "걸으면 보이는 것들", desc: "전 세계 걷기 코스를 탐색하고\n나만의 경로를 기록하세요" },
  { emoji: "📍", title: "스팟을 발견하세요", desc: "맛집, 카페, 포토스팟 등\n경로 위의 숨은 명소를 공유하세요" },
  { emoji: "👥", title: "함께 걸어요", desc: "동행을 찾고 커뮤니티에서\n걷기 이야기를 나눠보세요" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const isLast = step === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      {/* Skip */}
      <button onClick={() => router.push("/")} className="absolute top-12 right-5 text-[13px] text-gray-400 hover:text-gray-600">건너뛰기</button>

      {/* Content */}
      <div className="text-center max-w-[300px]">
        <div className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-8">
          <span className="text-[48px]">{STEPS[step].emoji}</span>
        </div>
        <h1 className="text-[24px] font-bold text-gray-900 mb-3 tracking-tight">{STEPS[step].title}</h1>
        <p className="text-[15px] text-gray-500 leading-relaxed whitespace-pre-line">{STEPS[step].desc}</p>
      </div>

      {/* Dots */}
      <div className="flex gap-2 mt-10 mb-8">
        {STEPS.map((_, i) => (
          <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? "bg-gray-900 w-5" : "bg-gray-200"}`} />
        ))}
      </div>

      {/* Button */}
      {isLast ? (
        <div className="w-full max-w-[300px] space-y-3">
          <Link href="/auth/register" className="block w-full py-3.5 bg-gray-900 text-white rounded-2xl text-[15px] font-semibold text-center">시작하기</Link>
          <Link href="/auth/login" className="block w-full py-3 text-gray-500 text-[14px] font-medium text-center">이미 계정이 있어요</Link>
        </div>
      ) : (
        <button onClick={() => setStep(step + 1)} className="w-full max-w-[300px] py-3.5 bg-gray-900 text-white rounded-2xl text-[15px] font-semibold">다음</button>
      )}
    </div>
  );
}
