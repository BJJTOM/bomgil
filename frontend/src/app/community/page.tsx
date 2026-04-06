"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { CommunityPost, CommunityGroup, Challenge } from "@/types";

const TABS = ["피드", "모임", "챌린지"];

const CATEGORIES = [
  { key: "", label: "전체" },
  { key: "free", label: "자유" },
  { key: "qna", label: "질문" },
  { key: "recommend", label: "추천" },
  { key: "review", label: "후기" },
  { key: "meetup", label: "번개" },
  { key: "tip", label: "꿀팁" },
];

const GROUP_CATS = [
  { key: "", label: "전체" },
  { key: "hiking", label: "등산" },
  { key: "walking", label: "산책" },
  { key: "running", label: "러닝" },
  { key: "trail", label: "트레일" },
  { key: "photo", label: "사진" },
  { key: "social", label: "친목" },
];

const STATUS_COLORS: Record<string, string> = {
  upcoming: "bg-blue-50 text-blue-700",
  active: "bg-green-50 text-green-700",
  ended: "bg-gray-100 text-gray-500",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

// ── 피드 (게시판) ──
function FeedTab() {
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");

  const { data: posts = [], isLoading } = useQuery<CommunityPost[]>({
    queryKey: ["community-posts", category, search],
    queryFn: async () => {
      let params = "?";
      if (category) params += `category=${category}&`;
      if (search) params += `q=${encodeURIComponent(search)}&`;
      const { data } = await api.get(`/community/posts/${params}`);
      return data.results ?? data;
    },
  });

  const handleLike = useCallback(async (postId: number) => {
    if (!isAuthenticated) { router.push("/auth/login"); return; }
    qc.setQueryData(["community-posts", category, search], (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map((p: any) =>
        p.id === postId ? { ...p, is_liked: !p.is_liked, like_count: p.is_liked ? p.like_count - 1 : p.like_count + 1 } : p
      );
    });
    api.post(`/community/posts/${postId}/like/`).catch(() => qc.invalidateQueries({ queryKey: ["community-posts"] }));
  }, [isAuthenticated, category, search]);

  return (
    <div>
      {/* Search */}
      <div className="px-5 pt-3 pb-1">
        <div className="flex items-center bg-[#F7F8FA] rounded-xl px-3 h-10">
          <span className="text-xs font-bold text-[#B0B8C1] mr-2">Q</span>
          <input
            className="flex-1 bg-transparent text-sm outline-none text-[#191F28] placeholder-[#B0B8C1]"
            placeholder="게시글 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-[#B0B8C1] text-sm p-1">✕</button>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 px-5 py-2 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              category === c.key
                ? "bg-[#2D4A2E] text-white"
                : "bg-[#F7F8FA] text-[#8B95A1] hover:bg-[#F0F0F0]"
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Posts */}
      {isLoading ? (
        <div className="flex justify-center py-20"><span className="text-sm text-[#B0B8C1]">로딩 중...</span></div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <p className="text-base font-semibold text-[#191F28] mb-1">{search ? `'${search}' 검색 결과가 없어요` : "아직 게시글이 없어요"}</p>
          <p className="text-sm text-[#B0B8C1]">{search ? "다른 키워드로 검색해보세요" : "첫 번째 글을 작성해보세요"}</p>
        </div>
      ) : (
        <div className="divide-y divide-[#F2F4F6]">
          {posts.map((post) => (
            <div key={post.id} className="flex px-5 py-4 gap-3 hover:bg-[#FAFAFA] transition-colors cursor-pointer"
              onClick={() => router.push(`/community/post/${post.id}`)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[11px] font-semibold text-[#2D4A2E] bg-[#F0F7F0] px-2 py-0.5 rounded">{post.category_display}</span>
                  {post.is_pinned && <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">고정</span>}
                </div>
                <p className="text-[15px] font-semibold text-[#191F28] leading-snug line-clamp-2 mb-2">{post.title}</p>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-4 h-4 rounded-full bg-[#F7F8FA] overflow-hidden shrink-0">
                    {post.author_image && <Image src={post.author_image} alt="" width={16} height={16} className="w-4 h-4 rounded-full object-cover" />}
                  </div>
                  <span className="text-xs text-[#8B95A1]">{post.author_nickname}</span>
                  <span className="text-xs text-[#B0B8C1]">{timeAgo(post.created_at)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={(e) => { e.stopPropagation(); handleLike(post.id); }}
                    className={`flex items-center gap-1 text-xs ${post.is_liked ? "text-red-500" : "text-[#B0B8C1]"}`}>
                    <span className="text-[15px]">{post.is_liked ? "♥" : "♡"}</span> {post.like_count}
                  </button>
                  <span className="flex items-center gap-1 text-xs text-[#B0B8C1]">
                    <span className="text-[15px]">○</span> {post.comment_count}
                  </span>
                  <span className="text-xs text-[#B0B8C1]">조회 {post.view_count}</span>
                </div>
              </div>
              {post.thumbnail && (
                <div className="w-[72px] h-[72px] rounded-lg bg-[#F7F8FA] overflow-hidden shrink-0">
                  <Image src={post.thumbnail} alt="" width={72} height={72} className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 모임 ──
function GroupsTab() {
  const router = useRouter();
  const [category, setCategory] = useState("");

  const { data: groups = [], isLoading } = useQuery<CommunityGroup[]>({
    queryKey: ["community-groups", category],
    queryFn: async () => {
      const params = category ? `?category=${category}` : "";
      const { data } = await api.get(`/community/groups/${params}`);
      return data.results ?? data;
    },
  });

  return (
    <div>
      <div className="flex gap-2 px-5 py-3 overflow-x-auto scrollbar-hide">
        {GROUP_CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              category === c.key ? "bg-[#2D4A2E] text-white" : "bg-[#F7F8FA] text-[#8B95A1]"
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><span className="text-sm text-[#B0B8C1]">로딩 중...</span></div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center py-20">
          <p className="text-base font-semibold text-[#191F28] mb-1">아직 모임이 없어요</p>
          <p className="text-sm text-[#B0B8C1]">첫 번째 모임을 만들어보세요</p>
        </div>
      ) : (
        <div className="divide-y divide-[#F2F4F6]">
          {groups.map((g) => (
            <Link key={g.id} href={`/community/groups/${g.id}`}
              className="flex items-center px-5 py-4 gap-3.5 hover:bg-[#FAFAFA] transition-colors">
              <div className="w-[52px] h-[52px] rounded-2xl bg-[#F7F8FA] flex items-center justify-center text-2xl shrink-0">{g.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[15px] font-semibold text-[#191F28] truncate">{g.name}</span>
                  {!g.is_public && <span className="text-xs">🔒</span>}
                </div>
                <p className="text-[13px] text-[#8B95A1] line-clamp-1 mb-1">{g.description}</p>
                <div className="flex items-center gap-2 text-[11px] text-[#B0B8C1]">
                  <span>{g.member_count}{g.max_members > 0 ? `/${g.max_members}` : ""}명</span>
                  {g.region && <span>{g.region}</span>}
                  <span>{g.category_display}</span>
                </div>
              </div>
              {g.is_member ? (
                <span className="text-xs font-semibold text-[#2D4A2E] bg-[#F0F7F0] px-3 py-1.5 rounded-lg shrink-0">참여중</span>
              ) : (
                <span className="text-xs font-semibold text-white bg-[#2D4A2E] px-3 py-1.5 rounded-lg shrink-0">참여</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 챌린지 ──
function ChallengesTab() {
  const router = useRouter();

  const { data: challenges = [], isLoading } = useQuery<Challenge[]>({
    queryKey: ["community-challenges"],
    queryFn: async () => {
      const { data } = await api.get("/community/challenges/");
      return data.results ?? data;
    },
  });

  return (
    <div className="p-5 space-y-3">
      {isLoading ? (
        <div className="flex justify-center py-20"><span className="text-sm text-[#B0B8C1]">로딩 중...</span></div>
      ) : challenges.length === 0 ? (
        <div className="flex flex-col items-center py-20">
          <p className="text-base font-semibold text-[#191F28] mb-1">아직 챌린지가 없어요</p>
          <p className="text-sm text-[#B0B8C1]">곧 새로운 챌린지가 시작됩니다</p>
        </div>
      ) : (
        challenges.map((ch) => {
          const daysLeft = Math.ceil((new Date(ch.end_date).getTime() - Date.now()) / 86400000);
          return (
            <Link key={ch.id} href={`/community/challenges/${ch.id}`}
              className="block bg-white rounded-2xl p-5 border border-[#F2F4F6] hover:border-[#E5E8EB] transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-[14px] bg-[#F7F8FA] flex items-center justify-center text-[22px]">{ch.emoji}</div>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[ch.status] || ""}`}>{ch.status_display}</span>
              </div>
              <h3 className="text-[17px] font-bold text-[#191F28] mb-1 tracking-tight">{ch.title}</h3>
              <p className="text-[13px] text-[#8B95A1] line-clamp-2 mb-4">{ch.description}</p>
              <div className="mb-3">
                <div className="h-2 bg-[#F2F4F6] rounded-full overflow-hidden">
                  <div className="h-full bg-[#2D4A2E] rounded-full transition-all" style={{ width: `${Math.min(ch.my_progress, 100)}%` }} />
                </div>
                <div className="flex justify-between mt-1.5 text-xs text-[#B0B8C1]">
                  <span>목표 {ch.goal_value}{ch.goal_unit}</span>
                  {ch.is_joined && <span className="text-[#2D4A2E] font-semibold">{ch.my_progress}%</span>}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-3 text-xs text-[#B0B8C1]">
                  <span>{ch.participant_count}명 참여</span>
                  {ch.status === "active" && daysLeft > 0 && <span>{daysLeft}일 남음</span>}
                </div>
                {ch.is_joined ? (
                  <span className="text-xs font-semibold text-[#2D4A2E] bg-[#F0F7F0] px-3 py-1 rounded-lg">참여중 ✓</span>
                ) : ch.status === "active" ? (
                  <span className="text-xs font-semibold text-white bg-[#2D4A2E] px-3 py-1 rounded-lg">참여하기</span>
                ) : null}
              </div>
            </Link>
          );
        })
      )}
    </div>
  );
}

// ── Main Page ──
export default function CommunityPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState(0);

  const fabHref = activeTab === 0 ? "/community/post/new" : activeTab === 1 ? "/community/groups/new" : null;

  return (
    <div className="md:pt-[60px] min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 md:top-[60px] z-30 bg-white/95 backdrop-blur-xl border-b border-[#F2F4F6]">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <h1 className="text-[22px] font-bold tracking-tight text-[#191F28]">커뮤니티</h1>
          <Link href="/notifications" className="w-8 h-8 rounded-full bg-[#F7F8FA] flex items-center justify-center text-xs font-bold text-[#8B95A1]">N</Link>
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-5 flex gap-6">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`pb-3 text-[15px] font-medium relative transition-colors ${
                activeTab === i ? "text-[#191F28] font-bold" : "text-[#B0B8C1]"
              }`}>
              {tab}
              {activeTab === i && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#191F28] rounded-full" />}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto">
        {activeTab === 0 && <FeedTab />}
        {activeTab === 1 && <GroupsTab />}
        {activeTab === 2 && <ChallengesTab />}
      </main>

      {/* FAB */}
      {fabHref && (
        <button
          onClick={() => {
            if (!isAuthenticated) { router.push("/auth/login"); return; }
            router.push(fabHref);
          }}
          className="fixed bottom-24 right-5 md:bottom-8 md:right-8 w-13 h-13 rounded-full bg-[#2D4A2E] text-white text-2xl font-light flex items-center justify-center shadow-lg hover:bg-[#1a3a1b] transition-colors z-40"
          style={{ width: 52, height: 52 }}>
          +
        </button>
      )}
    </div>
  );
}
