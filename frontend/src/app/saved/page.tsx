"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { useT } from "@/stores/language";
import api from "@/lib/api";
import type { Trail, CommunityPost } from "@/types";

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

export default function SavedPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { language } = useT();
  const ko = language === "ko";
  const [tab, setTab] = useState<"trails" | "posts">("trails");

  const { data: likedTrails = [], isLoading: loadingTrails } = useQuery<Trail[]>({
    queryKey: ["my-liked-trails"],
    queryFn: async () => {
      const { data } = await api.get("/auth/me/likes/");
      return data.results ?? data;
    },
    enabled: isAuthenticated,
  });

  const { data: bookmarkedPosts = [], isLoading: loadingPosts } = useQuery<CommunityPost[]>({
    queryKey: ["my-bookmarked-posts"],
    queryFn: async () => {
      const { data } = await api.get("/community/posts/bookmarks/");
      return data.results ?? data;
    },
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <div className="md:pt-[60px] flex flex-col items-center justify-center min-h-screen px-6">
        <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </div>
        <p className="text-[15px] font-semibold text-gray-900 mb-1">{ko ? "로그인이 필요합니다" : "Login required"}</p>
        <p className="text-[13px] text-gray-400 mb-5">{ko ? "저장한 목록을 보려면 로그인해주세요" : "Please login to view saved items"}</p>
        <Link href="/auth/login" className="px-6 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-full">
          {ko ? "로그인하기" : "Login"}
        </Link>
      </div>
    );
  }

  return (
    <div className="md:pt-[60px] min-h-screen bg-white">
      <header className="sticky top-0 md:top-[60px] z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-2xl mx-auto">
          <div className="px-5 pt-4 pb-2">
            <h1 className="text-[22px] font-bold tracking-tight text-gray-900">{ko ? "저장 목록" : "Saved"}</h1>
          </div>
          <div className="px-5 flex gap-6 border-b border-gray-100">
            <button
              onClick={() => setTab("trails")}
              className={`relative pb-3 text-[15px] ${tab === "trails" ? "text-gray-900 font-bold" : "text-gray-400 font-medium"}`}>
              {ko ? "좋아요 코스" : "Liked Trails"}
              {tab === "trails" && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 rounded-full" />}
            </button>
            <button
              onClick={() => setTab("posts")}
              className={`relative pb-3 text-[15px] ${tab === "posts" ? "text-gray-900 font-bold" : "text-gray-400 font-medium"}`}>
              {ko ? "북마크 게시글" : "Bookmarked Posts"}
              {tab === "posts" && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 rounded-full" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto pb-24">
        {tab === "trails" && (
          <>
            {loadingTrails ? (
              <div className="flex justify-center py-20"><span className="text-sm text-gray-400">로딩 중...</span></div>
            ) : likedTrails.length === 0 ? (
              <div className="flex flex-col items-center py-24">
                <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-4 text-2xl">♡</div>
                <p className="text-[15px] font-semibold text-gray-900 mb-1">{ko ? "좋아요한 코스가 없어요" : "No liked trails"}</p>
                <p className="text-[13px] text-gray-400 mb-5">{ko ? "마음에 드는 코스에 좋아요를 눌러보세요" : "Like trails you enjoy"}</p>
                <Link href="/explore" className="px-5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-full">
                  {ko ? "코스 탐색" : "Explore"}
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {likedTrails.map((trail) => (
                  <Link key={trail.id} href={`/trails/${trail.id}`}
                    className="flex px-5 py-4 gap-3.5 hover:bg-gray-50/60 transition-colors">
                    <div className="w-[80px] h-[60px] rounded-xl bg-gray-100 overflow-hidden shrink-0 ring-1 ring-black/5">
                      {trail.cover_image && <Image src={trail.cover_image} alt="" width={80} height={60} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-semibold text-gray-900 line-clamp-1 mb-1">{trail.title}</h3>
                      <p className="text-[12px] text-gray-500 mb-1.5">{trail.region} · {trail.distance_km}km</p>
                      <div className="flex items-center gap-3 text-[11px] text-gray-400">
                        <span>♥ {trail.like_count}</span>
                        <span>👁 {trail.view_count}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "posts" && (
          <>
            {loadingPosts ? (
              <div className="flex justify-center py-20"><span className="text-sm text-gray-400">로딩 중...</span></div>
            ) : bookmarkedPosts.length === 0 ? (
              <div className="flex flex-col items-center py-24">
                <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-4 text-2xl">☆</div>
                <p className="text-[15px] font-semibold text-gray-900 mb-1">{ko ? "북마크한 게시글이 없어요" : "No bookmarked posts"}</p>
                <p className="text-[13px] text-gray-400 mb-5">{ko ? "유용한 게시글을 북마크해보세요" : "Bookmark useful posts"}</p>
                <Link href="/community" className="px-5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-full">
                  {ko ? "커뮤니티" : "Community"}
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {bookmarkedPosts.map((post) => (
                  <Link key={post.id} href={`/community/post/${post.id}`}
                    className="flex px-5 py-4 gap-3.5 hover:bg-gray-50/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-[2px] rounded-md">{post.category_display}</span>
                      </div>
                      <h3 className="text-[15px] font-semibold text-gray-900 line-clamp-1 mb-1.5">{post.title}</h3>
                      <div className="flex items-center gap-2 text-[12px] text-gray-400">
                        <span>{post.author_nickname}</span>
                        <span>·</span>
                        <span>{timeAgo(post.created_at)}</span>
                        <span>·</span>
                        <span>♡ {post.like_count}</span>
                        <span>○ {post.comment_count}</span>
                      </div>
                    </div>
                    {post.thumbnail && (
                      <div className="w-[60px] h-[60px] rounded-lg bg-gray-100 overflow-hidden shrink-0 ring-1 ring-black/5">
                        <Image src={post.thumbnail} alt="" width={60} height={60} className="w-full h-full object-cover" />
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
