"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

interface FollowUser {
  id: number;
  nickname: string;
  profile_image: string | null;
  one_liner?: string;
  is_following?: boolean;
}

export default function FollowersPage() {
  const { nickname } = useParams();
  const router = useRouter();
  const { user: me, isAuthenticated } = useAuthStore();
  const [tab, setTab] = useState<"followers" | "following">("followers");

  const { data: followers = [] } = useQuery<FollowUser[]>({
    queryKey: ["followers", nickname],
    queryFn: async () => { const { data } = await api.get(`/auth/users/${nickname}/followers/`); return data.results ?? data; },
    enabled: tab === "followers",
  });

  const { data: following = [] } = useQuery<FollowUser[]>({
    queryKey: ["following", nickname],
    queryFn: async () => { const { data } = await api.get(`/auth/users/${nickname}/following/`); return data.results ?? data; },
    enabled: tab === "following",
  });

  const list = tab === "followers" ? followers : following;

  const handleFollow = async (targetNickname: string) => {
    if (!isAuthenticated) { router.push("/auth/login"); return; }
    await api.post(`/auth/users/${targetNickname}/follow/`);
  };

  return (
    <div className="md:pt-[60px] min-h-screen bg-white">
      <header className="sticky top-0 md:top-[60px] z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-lg">←</button>
          <span className="text-[16px] font-semibold text-gray-900">{nickname}</span>
          <div className="w-8" />
        </div>
        <div className="max-w-2xl mx-auto px-5 flex gap-6">
          <button onClick={() => setTab("followers")} className={`relative pb-3 text-[15px] ${tab === "followers" ? "text-gray-900 font-bold" : "text-gray-400"}`}>
            팔로워
            {tab === "followers" && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 rounded-full" />}
          </button>
          <button onClick={() => setTab("following")} className={`relative pb-3 text-[15px] ${tab === "following" ? "text-gray-900 font-bold" : "text-gray-400"}`}>
            팔로잉
            {tab === "following" && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 rounded-full" />}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {list.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-gray-400">{tab === "followers" ? "아직 팔로워가 없어요" : "아직 팔로잉이 없어요"}</p>
          </div>
        ) : (
          list.map((u) => (
            <div key={u.id} className="flex items-center px-5 py-3 gap-3 border-b border-gray-50">
              <Link href={`/profile/${u.nickname}`} className="w-11 h-11 rounded-full bg-gray-100 overflow-hidden shrink-0">
                {u.profile_image ? <Image src={u.profile_image} alt="" width={44} height={44} className="w-11 h-11 rounded-full object-cover" /> :
                  <span className="w-11 h-11 flex items-center justify-center text-base text-gray-400">U</span>}
              </Link>
              <Link href={`/profile/${u.nickname}`} className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-gray-900">{u.nickname}</p>
                {u.one_liner && <p className="text-[12px] text-gray-400 truncate">{u.one_liner}</p>}
              </Link>
              {me?.nickname !== u.nickname && (
                <button onClick={() => handleFollow(u.nickname)}
                  className={`text-[12px] font-semibold px-4 py-1.5 rounded-lg ${u.is_following ? "bg-gray-100 text-gray-500" : "bg-gray-900 text-white"}`}>
                  {u.is_following ? "팔로잉" : "팔로우"}
                </button>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}
