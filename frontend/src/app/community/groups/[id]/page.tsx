"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { CommunityGroup } from "@/types";

export default function GroupDetailPage() {
  const { id } = useParams();
  const groupId = Number(id);
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  const { data: group, isLoading } = useQuery<CommunityGroup>({
    queryKey: ["group-detail", groupId],
    queryFn: async () => (await api.get(`/community/groups/${groupId}/`)).data,
    enabled: !!groupId,
  });

  const handleJoin = async () => {
    if (!isAuthenticated) { router.push("/auth/login"); return; }
    try {
      await api.post(`/community/groups/${groupId}/join/`);
      qc.invalidateQueries({ queryKey: ["group-detail", groupId] });
      qc.invalidateQueries({ queryKey: ["community-groups"] });
    } catch (e: any) {
      alert(e?.response?.data?.error || "참여에 실패했습니다.");
    }
  };

  const handleLeave = async () => {
    if (!confirm("모임에서 나가시겠어요?")) return;
    await api.post(`/community/groups/${groupId}/leave/`);
    qc.invalidateQueries({ queryKey: ["group-detail", groupId] });
    qc.invalidateQueries({ queryKey: ["community-groups"] });
  };

  if (isLoading || !group) {
    return (
      <div className="md:pt-[60px] min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-5 py-4">
          <button onClick={() => router.back()} className="text-lg">←</button>
          <div className="flex justify-center py-20"><span className="text-sm text-[#B0B8C1]">로딩 중...</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="md:pt-[60px] min-h-screen bg-[#F7F8FA]">
      {/* Header */}
      <header className="sticky top-0 md:top-[60px] z-30 bg-white border-b border-[#F2F4F6]">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-[#F7F8FA] flex items-center justify-center text-lg">←</button>
          <span className="text-[16px] font-semibold text-[#191F28] truncate max-w-[200px]">{group.name}</span>
          <div className="w-8" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {/* Hero */}
        <div className="bg-white text-center py-8 px-5">
          <div className="w-[72px] h-[72px] rounded-3xl bg-[#F7F8FA] flex items-center justify-center text-4xl mx-auto mb-4">{group.emoji}</div>
          <h1 className="text-[22px] font-bold text-[#191F28] tracking-tight mb-2">{group.name}</h1>
          <p className="text-[14px] text-[#8B95A1] leading-relaxed mb-5">{group.description}</p>

          {/* Stats */}
          <div className="flex items-center bg-[#F7F8FA] rounded-2xl py-4 px-5 mb-5">
            <div className="flex-1 text-center">
              <p className="text-[16px] font-bold text-[#191F28]">{group.member_count}</p>
              <p className="text-[11px] text-[#B0B8C1]">멤버</p>
            </div>
            <div className="w-px h-6 bg-[#E5E8EB]" />
            <div className="flex-1 text-center">
              <p className="text-[16px] font-bold text-[#191F28]">{group.category_display}</p>
              <p className="text-[11px] text-[#B0B8C1]">카테고리</p>
            </div>
            <div className="w-px h-6 bg-[#E5E8EB]" />
            <div className="flex-1 text-center">
              <p className="text-[16px] font-bold text-[#191F28]">{group.region || "전국"}</p>
              <p className="text-[11px] text-[#B0B8C1]">지역</p>
            </div>
          </div>

          {/* Action */}
          {group.is_member ? (
            <div className="flex gap-2.5">
              <button className="flex-1 py-3.5 rounded-xl bg-[#2D4A2E] text-white font-semibold">채팅방</button>
              <button onClick={handleLeave} className="px-5 py-3.5 rounded-xl bg-[#F7F8FA] text-[#8B95A1] font-semibold">나가기</button>
            </div>
          ) : (
            <button onClick={handleJoin} className="w-full py-3.5 rounded-xl bg-[#2D4A2E] text-white font-semibold">모임 참여하기</button>
          )}
        </div>

        {/* Members */}
        <div className="bg-white mt-2 px-5 py-5">
          <h2 className="text-[16px] font-bold text-[#191F28] mb-4">멤버 {group.member_count}</h2>
          <div className="flex flex-wrap gap-4">
            {group.members?.map((m) => (
              <Link key={m.id} href={`/profile/${m.nickname}`} className="flex flex-col items-center w-16">
                <div className="w-12 h-12 rounded-full bg-[#F7F8FA] overflow-hidden mb-1.5">
                  {m.profile_image ? <Image src={m.profile_image} alt="" width={48} height={48} className="w-12 h-12 rounded-full object-cover" /> :
                    <span className="w-12 h-12 flex items-center justify-center text-base text-[#B0B8C1]">U</span>}
                </div>
                <span className="text-[12px] text-[#191F28] text-center truncate w-full">{m.nickname}</span>
                {m.role === "owner" && <span className="text-[9px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded mt-0.5">방장</span>}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
