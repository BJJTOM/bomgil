"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { CommunityPost, CommunityGroup, Challenge } from "@/types";

const TABS = [
  { key: "feed", label: "피드" },
  { key: "group", label: "모임" },
  { key: "challenge", label: "챌린지" },
];

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

const STATUS_MAP: Record<string, { bg: string; text: string }> = {
  upcoming: { bg: "bg-blue-50", text: "text-blue-600" },
  active: { bg: "bg-emerald-50", text: "text-emerald-600" },
  ended: { bg: "bg-gray-50", text: "text-gray-400" },
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

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-lg ${className || ""}`} />;
}

/* ────────────────────────────────────── */
/* 피드 탭                                */
/* ────────────────────────────────────── */
function FeedTab() {
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");

  const { data: posts = [], isLoading } = useQuery<CommunityPost[]>({
    queryKey: ["community-posts", category, search],
    queryFn: async () => {
      let p = "?";
      if (category) p += `category=${category}&`;
      if (search) p += `q=${encodeURIComponent(search)}&`;
      const { data } = await api.get(`/community/posts/${p}`);
      return data.results ?? data;
    },
  });

  const handleLike = useCallback(
    async (e: React.MouseEvent, postId: number) => {
      e.stopPropagation();
      if (!isAuthenticated) { router.push("/auth/login"); return; }
      qc.setQueryData(["community-posts", category, search], (old: any) =>
        Array.isArray(old)
          ? old.map((p: any) =>
              p.id === postId ? { ...p, is_liked: !p.is_liked, like_count: p.is_liked ? p.like_count - 1 : p.like_count + 1 } : p,
            )
          : old,
      );
      api.post(`/community/posts/${postId}/like/`).catch(() => qc.invalidateQueries({ queryKey: ["community-posts"] }));
    },
    [isAuthenticated, category, search],
  );

  return (
    <>
      {/* Search */}
      <div className="px-4 sm:px-5 pt-3">
        <div className="flex items-center bg-gray-50 rounded-xl px-3.5 h-11 transition-colors focus-within:bg-gray-100 focus-within:ring-1 focus-within:ring-gray-200">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="flex-1 bg-transparent text-sm outline-none text-gray-900 placeholder-gray-400 ml-2.5"
            placeholder="게시글 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600 p-1 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 px-4 sm:px-5 py-3 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`shrink-0 px-4 py-[7px] rounded-full text-[13px] font-medium border transition-all ${
              category === c.key
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {isLoading ? (
        <div className="px-4 sm:px-5 space-y-4 py-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="w-[72px] h-[72px] rounded-xl shrink-0" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center py-24 px-6">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
          </div>
          <p className="text-[15px] font-semibold text-gray-900 mb-1">{search ? `'${search}' 검색 결과가 없어요` : "아직 게시글이 없어요"}</p>
          <p className="text-[13px] text-gray-400">{search ? "다른 키워드로 검색해보세요" : "첫 번째 글을 작성해보세요"}</p>
        </div>
      ) : (
        <div>
          {posts.map((post, i) => (
            <div
              key={post.id}
              onClick={() => router.push(`/community/post/${post.id}`)}
              className="flex px-4 sm:px-5 py-4 gap-3.5 cursor-pointer hover:bg-gray-50/60 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                {/* Badge row */}
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="inline-flex text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-[2px] rounded-md">{post.category_display}</span>
                  {post.is_pinned && <span className="inline-flex text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-[2px] rounded-md">PIN</span>}
                </div>

                {/* Title */}
                <h3 className="text-[15px] font-semibold text-gray-900 leading-snug line-clamp-2 mb-2.5">{post.title}</h3>

                {/* Author + time */}
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-5 h-5 rounded-full bg-gray-100 overflow-hidden shrink-0 ring-1 ring-gray-100">
                    {post.author_image ? (
                      <Image src={post.author_image} alt="" width={20} height={20} className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <span className="w-5 h-5 flex items-center justify-center text-[9px] text-gray-400 font-medium">U</span>
                    )}
                  </div>
                  <span className="text-[12px] text-gray-500">{post.author_nickname}</span>
                  <span className="text-[11px] text-gray-300">·</span>
                  <span className="text-[12px] text-gray-400">{timeAgo(post.created_at)}</span>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3.5">
                  <button
                    onClick={(e) => handleLike(e, post.id)}
                    className={`flex items-center gap-1 text-[12px] transition-colors ${post.is_liked ? "text-red-500" : "text-gray-400 hover:text-red-400"}`}
                  >
                    <span className="text-[14px] leading-none">{post.is_liked ? "♥" : "♡"}</span>
                    <span>{post.like_count}</span>
                  </button>
                  <span className="flex items-center gap-1 text-[12px] text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    {post.comment_count}
                  </span>
                  <span className="text-[12px] text-gray-300">조회 {post.view_count}</span>
                </div>
              </div>

              {/* Thumbnail */}
              {post.thumbnail && (
                <div className="w-[74px] h-[74px] rounded-xl bg-gray-100 overflow-hidden shrink-0 ring-1 ring-black/5">
                  <Image src={post.thumbnail} alt="" width={74} height={74} className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ────────────────────────────────────── */
/* 모임 탭                                */
/* ────────────────────────────────────── */
function GroupsTab() {
  const router = useRouter();
  const [category, setCategory] = useState("");

  const { data: groups = [], isLoading } = useQuery<CommunityGroup[]>({
    queryKey: ["community-groups", category],
    queryFn: async () => {
      const p = category ? `?category=${category}` : "";
      const { data } = await api.get(`/community/groups/${p}`);
      return data.results ?? data;
    },
  });

  return (
    <>
      {/* Category filter */}
      <div className="flex gap-2 px-4 sm:px-5 py-3 overflow-x-auto scrollbar-hide">
        {GROUP_CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`shrink-0 px-4 py-[7px] rounded-full text-[13px] font-medium border transition-all ${
              category === c.key
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="px-4 sm:px-5 space-y-3 py-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3.5">
              <Skeleton className="w-[52px] h-[52px] rounded-2xl shrink-0" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-1/3" /></div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center py-24">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4 text-2xl">👥</div>
          <p className="text-[15px] font-semibold text-gray-900 mb-1">아직 모임이 없어요</p>
          <p className="text-[13px] text-gray-400">첫 번째 모임을 만들어보세요</p>
        </div>
      ) : (
        <div>
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/community/groups/${g.id}`}
              className="flex items-center px-4 sm:px-5 py-4 gap-3.5 hover:bg-gray-50/60 transition-colors border-b border-gray-100"
            >
              <div className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-[24px] shrink-0 ring-1 ring-black/5">
                {g.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[15px] font-semibold text-gray-900 truncate">{g.name}</span>
                  {!g.is_public && <span className="text-[11px]">🔒</span>}
                </div>
                <p className="text-[13px] text-gray-500 line-clamp-1 mb-1.5">{g.description}</p>
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  <span>{g.member_count}{g.max_members > 0 ? `/${g.max_members}` : ""}명</span>
                  {g.region && <><span>·</span><span>{g.region}</span></>}
                  <span>·</span>
                  <span>{g.category_display}</span>
                </div>
              </div>
              <span
                className={`text-[12px] font-semibold px-3.5 py-[6px] rounded-lg shrink-0 transition-colors ${
                  g.is_member ? "text-emerald-700 bg-emerald-50" : "text-white bg-gray-900 hover:bg-gray-800"
                }`}
              >
                {g.is_member ? "참여중" : "참여"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

/* ────────────────────────────────────── */
/* 챌린지 탭                              */
/* ────────────────────────────────────── */
function ChallengesTab() {
  const { data: challenges = [], isLoading } = useQuery<Challenge[]>({
    queryKey: ["community-challenges"],
    queryFn: async () => {
      const { data } = await api.get("/community/challenges/");
      return data.results ?? data;
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-5 space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 space-y-3">
            <div className="flex justify-between"><Skeleton className="w-11 h-11 rounded-[14px]" /><Skeleton className="w-16 h-6 rounded-full" /></div>
            <Skeleton className="h-5 w-2/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (challenges.length === 0) {
    return (
      <div className="flex flex-col items-center py-24">
        <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4 text-2xl">🏆</div>
        <p className="text-[15px] font-semibold text-gray-900 mb-1">아직 챌린지가 없어요</p>
        <p className="text-[13px] text-gray-400">곧 새로운 챌린지가 시작됩니다</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 space-y-3">
      {challenges.map((ch) => {
        const daysLeft = Math.ceil((new Date(ch.end_date).getTime() - Date.now()) / 86400000);
        const st = STATUS_MAP[ch.status] || STATUS_MAP.active;
        return (
          <Link
            key={ch.id}
            href={`/community/challenges/${ch.id}`}
            className="block bg-white rounded-2xl p-5 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
          >
            {/* Top */}
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-[24px] ring-1 ring-black/5">
                {ch.emoji}
              </div>
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>{ch.status_display}</span>
            </div>

            {/* Title */}
            <h3 className="text-[16px] font-bold text-gray-900 tracking-tight mb-1">{ch.title}</h3>
            <p className="text-[13px] text-gray-500 line-clamp-2 mb-4 leading-relaxed">{ch.description}</p>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="h-[6px] bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(ch.my_progress, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-[12px]">
                <span className="text-gray-400">목표 {ch.goal_value}{ch.goal_unit}</span>
                {ch.is_joined && <span className="text-emerald-600 font-semibold">{ch.my_progress}%</span>}
              </div>
            </div>

            {/* Bottom */}
            <div className="flex items-center justify-between">
              <div className="flex gap-3 text-[12px] text-gray-400">
                <span>{ch.participant_count}명 참여</span>
                {ch.status === "active" && daysLeft > 0 && <span className="text-amber-500 font-medium">{daysLeft}일 남음</span>}
              </div>
              {ch.is_joined ? (
                <span className="text-[12px] font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg">참여중 ✓</span>
              ) : ch.status === "active" ? (
                <span className="text-[12px] font-semibold text-white bg-gray-900 px-3.5 py-1 rounded-lg">참여하기</span>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────── */
/* Main Page                              */
/* ────────────────────────────────────── */
export default function CommunityPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState(0);

  const fabHref = activeTab === 0 ? "/community/post/new" : activeTab === 1 ? "/community/groups/new" : null;

  return (
    <div className="md:pt-[60px] min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 md:top-[60px] z-30 bg-white/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto">
          {/* Title row */}
          <div className="px-4 sm:px-5 pt-4 pb-2 flex items-center justify-between">
            <h1 className="text-[22px] font-bold tracking-tight text-gray-900">커뮤니티</h1>
            <Link
              href="/notifications"
              className="w-9 h-9 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <svg className="w-[18px] h-[18px] text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </Link>
          </div>

          {/* Tabs */}
          <div className="px-4 sm:px-5 flex border-b border-gray-100">
            {TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(i)}
                className={`relative pb-3 mr-6 text-[15px] transition-colors ${
                  activeTab === i ? "text-gray-900 font-bold" : "text-gray-400 font-medium hover:text-gray-600"
                }`}
              >
                {tab.label}
                {activeTab === i && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto pb-24">
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
          className="fixed bottom-24 right-5 md:bottom-8 md:right-8 w-[52px] h-[52px] rounded-full bg-gray-900 hover:bg-gray-800 text-white shadow-xl shadow-gray-900/20 flex items-center justify-center transition-all hover:scale-105 z-40"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );
}
