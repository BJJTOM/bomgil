"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { Challenge } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  upcoming: "bg-blue-50 text-blue-700",
  active: "bg-green-50 text-green-700",
  ended: "bg-gray-100 text-gray-500",
};

export default function ChallengeDetailPage() {
  const { id } = useParams();
  const challengeId = Number(id);
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  const { data: challenge, isLoading } = useQuery<Challenge>({
    queryKey: ["challenge-detail", challengeId],
    queryFn: async () => (await api.get(`/community/challenges/${challengeId}/`)).data,
    enabled: !!challengeId,
  });

  const handleJoin = async () => {
    if (!isAuthenticated) { router.push("/auth/login"); return; }
    try {
      await api.post(`/community/challenges/${challengeId}/join/`);
      qc.invalidateQueries({ queryKey: ["challenge-detail", challengeId] });
      qc.invalidateQueries({ queryKey: ["community-challenges"] });
    } catch (e: any) {
      alert(e?.response?.data?.error || "참여에 실패했습니다.");
    }
  };

  if (isLoading || !challenge) {
    return (
      <div className="md:pt-[60px] min-h-screen bg-[#F7F8FA]">
        <div className="max-w-2xl mx-auto px-5 py-4">
          <button onClick={() => router.back()} className="text-lg">←</button>
          <div className="flex justify-center py-20"><span className="text-sm text-[#B0B8C1]">로딩 중...</span></div>
        </div>
      </div>
    );
  }

  const daysLeft = Math.ceil((new Date(challenge.end_date).getTime() - Date.now()) / 86400000);

  return (
    <div className="md:pt-[60px] min-h-screen bg-[#F7F8FA]">
      {/* Header */}
      <header className="sticky top-0 md:top-[60px] z-30 bg-white border-b border-[#F2F4F6]">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-[#F7F8FA] flex items-center justify-center text-lg">←</button>
          <span className="text-[16px] font-semibold text-[#191F28]">챌린지</span>
          <div className="w-8" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto py-4 px-4 space-y-4">
        {/* Hero card */}
        <div className="bg-white rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-[18px] bg-[#F7F8FA] flex items-center justify-center text-[28px]">{challenge.emoji}</div>
            <span className={`text-[12px] font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[challenge.status] || ""}`}>{challenge.status_display}</span>
          </div>
          <h1 className="text-[22px] font-bold text-[#191F28] tracking-tight mb-2">{challenge.title}</h1>
          <p className="text-[14px] text-[#8B95A1] leading-relaxed mb-4">{challenge.description}</p>

          {/* Date */}
          <div className="flex items-center justify-between mb-5 text-[13px] text-[#8B95A1]">
            <span>{challenge.start_date} ~ {challenge.end_date}</span>
            {challenge.status === "active" && daysLeft > 0 && <span className="font-semibold text-orange-600">{daysLeft}일 남음</span>}
          </div>

          {/* Progress */}
          <div className="mb-5">
            <div className="flex justify-between mb-2 text-[13px]">
              <span className="text-[#B0B8C1]">목표</span>
              <span className="font-semibold text-[#191F28]">{challenge.goal_value} {challenge.goal_unit}</span>
            </div>
            <div className="h-2.5 bg-[#F2F4F6] rounded-full overflow-hidden">
              <div className="h-full bg-[#2D4A2E] rounded-full transition-all" style={{ width: `${Math.min(challenge.my_progress, 100)}%` }} />
            </div>
            {challenge.is_joined && <p className="text-right text-[12px] font-semibold text-[#2D4A2E] mt-1.5">{challenge.my_progress}% 달성</p>}
          </div>

          {/* Stats */}
          <div className="flex items-center bg-[#F7F8FA] rounded-[14px] py-3.5">
            <div className="flex-1 text-center">
              <p className="text-[16px] font-bold text-[#191F28]">{challenge.participant_count}</p>
              <p className="text-[11px] text-[#B0B8C1]">참여자</p>
            </div>
            <div className="w-px h-5 bg-[#E5E8EB]" />
            <div className="flex-1 text-center">
              <p className="text-[16px] font-bold text-[#191F28]">{challenge.type_display}</p>
              <p className="text-[11px] text-[#B0B8C1]">유형</p>
            </div>
            <div className="w-px h-5 bg-[#E5E8EB]" />
            <div className="flex-1 text-center">
              <p className="text-[16px] font-bold text-[#191F28]">{challenge.goal_value}</p>
              <p className="text-[11px] text-[#B0B8C1]">{challenge.goal_unit}</p>
            </div>
          </div>
        </div>

        {/* Join button */}
        {challenge.status === "active" && !challenge.is_joined && (
          <button onClick={handleJoin} className="w-full py-4 rounded-xl bg-[#2D4A2E] text-white font-semibold text-[16px]">챌린지 참여하기</button>
        )}
        {challenge.is_joined && (
          <div className="w-full py-3.5 rounded-xl bg-[#F0F7F0] text-center text-[14px] font-semibold text-[#2D4A2E]">✓ 참여 중인 챌린지입니다</div>
        )}

        {/* Leaderboard */}
        <div className="bg-white rounded-2xl p-5">
          <h2 className="text-[17px] font-bold text-[#191F28] mb-4">리더보드</h2>
          {challenge.leaderboard && challenge.leaderboard.length > 0 ? (
            <div className="divide-y divide-[#F2F4F6]">
              {challenge.leaderboard.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 py-3">
                  <span className="w-7 text-center text-[14px] font-bold text-[#191F28]">
                    {i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}
                  </span>
                  <div className="w-9 h-9 rounded-full bg-[#F7F8FA] overflow-hidden shrink-0">
                    {p.profile_image ? <Image src={p.profile_image} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover" /> :
                      <span className="w-9 h-9 flex items-center justify-center text-sm text-[#B0B8C1]">U</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#191F28]">{p.nickname}</p>
                    <p className="text-[12px] text-[#B0B8C1]">{p.current_value} {challenge.goal_unit}</p>
                  </div>
                  <div className="text-right w-16">
                    <div className="w-12 h-1 bg-[#F2F4F6] rounded-full overflow-hidden mb-1 ml-auto">
                      <div className="h-full bg-[#2D4A2E] rounded-full" style={{ width: `${Math.min(p.progress, 100)}%` }} />
                    </div>
                    <span className="text-[11px] font-semibold text-[#8B95A1]">{p.progress}%</span>
                  </div>
                  {p.completed && <span className="text-xs font-bold text-green-600">✓</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-[#B0B8C1] py-6">아직 참여자가 없어요</p>
          )}
        </div>
      </main>
    </div>
  );
}
