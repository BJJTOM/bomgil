"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

const CATEGORIES = [
  { key: "hiking", label: "등산" },
  { key: "walking", label: "산책" },
  { key: "running", label: "러닝" },
  { key: "trail", label: "트레일" },
  { key: "photo", label: "사진" },
  { key: "social", label: "친목" },
];

const EMOJIS = ["🥾", "🏔", "🌿", "🌊", "🌸", "🏃", "📸", "☀️", "🍂", "🎒", "⛺", "🦅"];

export default function GroupNewPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("walking");
  const [emoji, setEmoji] = useState("🥾");
  const [region, setRegion] = useState("");
  const [maxMembers, setMaxMembers] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/auth/login");
  }, [isAuthenticated]);

  const canSubmit = name.trim().length >= 2 && description.trim().length >= 5;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/community/groups/create/", {
        name: name.trim(), description: description.trim(), category, emoji,
        region: region.trim(), max_members: maxMembers ? parseInt(maxMembers, 10) : 50, is_public: true,
      });
      qc.invalidateQueries({ queryKey: ["community-groups"] });
      router.push(`/community/groups/${data.id || ""}`);
    } catch {
      alert("모임 생성에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="md:pt-[60px] min-h-screen bg-white">
      <header className="sticky top-0 md:top-[60px] z-30 bg-white border-b border-[#F2F4F6]">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="text-[15px] text-[#8B95A1]">취소</button>
          <span className="text-[16px] font-semibold text-[#191F28]">모임 만들기</span>
          <button onClick={handleSubmit} disabled={!canSubmit || submitting}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold ${canSubmit ? "bg-[#2D4A2E] text-white" : "bg-[#F2F4F6] text-[#B0B8C1]"}`}>
            {submitting ? "..." : "만들기"}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-5 space-y-6">
        {/* Emoji */}
        <div>
          <label className="text-[13px] font-semibold text-[#8B95A1] block mb-2">모임 아이콘</label>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => setEmoji(e)}
                className={`w-12 h-12 rounded-[14px] text-[22px] flex items-center justify-center ${
                  emoji === e ? "bg-[#F0F7F0] ring-2 ring-[#2D4A2E]" : "bg-[#F7F8FA]"
                }`}>{e}</button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-[13px] font-semibold text-[#8B95A1] block mb-2">모임 이름</label>
          <input className="w-full bg-[#F7F8FA] rounded-xl px-4 py-3 text-[15px] outline-none text-[#191F28] placeholder-[#B0B8C1]"
            placeholder="모임 이름을 입력하세요" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
        </div>

        {/* Description */}
        <div>
          <label className="text-[13px] font-semibold text-[#8B95A1] block mb-2">소개</label>
          <textarea className="w-full bg-[#F7F8FA] rounded-xl px-4 py-3 text-[15px] outline-none text-[#191F28] placeholder-[#B0B8C1] min-h-[80px] resize-none"
            placeholder="모임에 대해 소개해주세요" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </div>

        {/* Category */}
        <div>
          <label className="text-[13px] font-semibold text-[#8B95A1] block mb-2">카테고리</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button key={c.key} onClick={() => setCategory(c.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  category === c.key ? "bg-[#2D4A2E] text-white" : "bg-[#F7F8FA] text-[#8B95A1]"
                }`}>{c.label}</button>
            ))}
          </div>
        </div>

        {/* Region */}
        <div>
          <label className="text-[13px] font-semibold text-[#8B95A1] block mb-2">지역 (선택)</label>
          <input className="w-full bg-[#F7F8FA] rounded-xl px-4 py-3 text-[15px] outline-none text-[#191F28] placeholder-[#B0B8C1]"
            placeholder="예: 서울, 부산" value={region} onChange={(e) => setRegion(e.target.value)} maxLength={50} />
        </div>

        {/* Max members */}
        <div>
          <label className="text-[13px] font-semibold text-[#8B95A1] block mb-2">정원 (선택)</label>
          <input className="w-full bg-[#F7F8FA] rounded-xl px-4 py-3 text-[15px] outline-none text-[#191F28] placeholder-[#B0B8C1]"
            placeholder="최대 인원 (기본 50명)" value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)} type="number" />
        </div>
      </main>
    </div>
  );
}
