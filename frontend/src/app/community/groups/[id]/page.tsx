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
          <div className="flex justify-center py-20"><span className="text-sm text-gray-400">로딩 중...</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="md:pt-[60px] min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 md:top-[60px] z-30 bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-lg">←</button>
          <span className="text-[16px] font-semibold text-gray-900 truncate max-w-[200px]">{group.name}</span>
          <div className="w-8" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {/* Hero */}
        <div className="bg-white text-center py-8 px-5">
          <div className="w-[72px] h-[72px] rounded-3xl bg-gray-50 flex items-center justify-center text-4xl mx-auto mb-4">{group.emoji}</div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight mb-2">{group.name}</h1>
          <p className="text-[14px] text-gray-500 leading-relaxed mb-5">{group.description}</p>

          {/* Stats */}
          <div className="flex items-center bg-gray-50 rounded-2xl py-4 px-5 mb-5">
            <div className="flex-1 text-center">
              <p className="text-[16px] font-bold text-gray-900">{group.member_count}</p>
              <p className="text-[11px] text-gray-400">멤버</p>
            </div>
            <div className="w-px h-6 bg-gray-200" />
            <div className="flex-1 text-center">
              <p className="text-[16px] font-bold text-gray-900">{group.category_display}</p>
              <p className="text-[11px] text-gray-400">카테고리</p>
            </div>
            <div className="w-px h-6 bg-gray-200" />
            <div className="flex-1 text-center">
              <p className="text-[16px] font-bold text-gray-900">{group.region || "전국"}</p>
              <p className="text-[11px] text-gray-400">지역</p>
            </div>
          </div>

          {/* Action */}
          {group.is_member ? (
            <div className="flex gap-2.5">
              <button onClick={() => router.push(`/community/groups/${groupId}/chat`)} className="flex-1 py-3.5 rounded-xl bg-gray-900 text-white font-semibold">채팅방</button>
              <button onClick={handleLeave} className="px-5 py-3.5 rounded-xl bg-gray-50 text-gray-500 font-semibold">나가기</button>
            </div>
          ) : (
            <button onClick={handleJoin} className="w-full py-3.5 rounded-xl bg-gray-900 text-white font-semibold">모임 참여하기</button>
          )}
        </div>

        {/* Members */}
        <div className="bg-white mt-2 px-5 py-5">
          <h2 className="text-[16px] font-bold text-gray-900 mb-4">멤버 {group.member_count}</h2>
          <div className="flex flex-wrap gap-4">
            {group.members?.map((m) => (
              <Link key={m.id} href={`/profile/${m.nickname}`} className="flex flex-col items-center w-16">
                <div className="w-12 h-12 rounded-full bg-gray-50 overflow-hidden mb-1.5">
                  {m.profile_image ? <Image src={m.profile_image} alt="" width={48} height={48} className="w-12 h-12 rounded-full object-cover" /> :
                    <span className="w-12 h-12 flex items-center justify-center text-base text-gray-400">U</span>}
                </div>
                <span className="text-[12px] text-gray-900 text-center truncate w-full">{m.nickname}</span>
                {m.role === "owner" && <span className="text-[9px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded mt-0.5">방장</span>}
                {m.role === "admin" && <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-0.5">관리자</span>}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
