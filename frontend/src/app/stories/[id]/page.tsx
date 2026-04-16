"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import type { WalkStory, StoryComment } from "@/types";

const MOOD_MAP: Record<string, { emoji: string; label: string; bg: string; text: string }> = {
  happy: { emoji: "😊", label: "행복해요", bg: "#FFFBEB", text: "#B45309" },
  peaceful: { emoji: "☮️", label: "평화로워요", bg: "#EFF6FF", text: "#1D4ED8" },
  exciting: { emoji: "🤩", label: "신나요", bg: "#FFF7ED", text: "#C2410C" },
  touching: { emoji: "🥹", label: "감동이에요", bg: "#FDF2F8", text: "#BE185D" },
  funny: { emoji: "😄", label: "재밌어요", bg: "#F0FDF4", text: "#15803D" },
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

export default function StoryDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const storyId = id as string;

  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: number; nickname: string } | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const { data: story, isLoading } = useQuery<WalkStory>({
    queryKey: ["story", storyId],
    queryFn: async () => (await api.get(`/stories/${storyId}/`)).data,
    enabled: !!storyId,
  });

  const { data: comments = [] } = useQuery<StoryComment[]>({
    queryKey: ["story-comments", storyId],
    queryFn: async () => {
      const { data } = await api.get(`/stories/${storyId}/comments/`);
      return data.results ?? data;
    },
    enabled: !!storyId,
  });

  const handleLike = () => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    if (!story) return;
    qc.setQueryData<WalkStory>(["story", storyId], (old) => {
      if (!old) return old;
      return {
        ...old,
        is_liked: !old.is_liked,
        like_count: old.is_liked ? Math.max(0, old.like_count - 1) : old.like_count + 1,
      };
    });
    api.post(`/stories/${storyId}/like/`).catch(() => {
      qc.invalidateQueries({ queryKey: ["story", storyId] });
    });
  };

  const handleShare = async () => {
    if (!story) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: story.title || "Moru 스토리",
          text: story.content.slice(0, 100),
          url: window.location.href,
        });
      } catch {}
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert("링크가 복사되었습니다");
      } catch {}
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || submitting) return;
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/stories/${storyId}/comments/create/`, {
        content: commentText.trim(),
        parent: replyingTo?.id,
      });
      setCommentText("");
      setReplyingTo(null);
      qc.invalidateQueries({ queryKey: ["story-comments", storyId] });
      qc.setQueryData<WalkStory>(["story", storyId], (old) =>
        old ? { ...old, comment_count: old.comment_count + 1 } : old,
      );
    } catch {
      alert("댓글 작성에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !story) {
    return (
      <div className="md:pt-[60px] min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-5 py-20 text-center text-text-tertiary">
          {isLoading ? "불러오는 중..." : "스토리를 찾을 수 없습니다"}
        </div>
      </div>
    );
  }

  const mood = MOOD_MAP[story.mood];
  const photos = story.photos || [];

  return (
    <div className="md:pt-[60px] min-h-screen bg-white pb-32">
      {/* Header */}
      <header className="sticky top-0 md:top-[60px] z-30 bg-white/95 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-primary)" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-[16px] font-bold flex-1">스토리</h1>
          <button onClick={handleShare} className="p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-primary)" strokeWidth="2">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 pt-5">
        {/* Author */}
        <div className="flex items-center gap-3 mb-4">
          <Link
            href={`/profile/${story.author.nickname}`}
            className="w-11 h-11 rounded-full bg-accent/30 flex items-center justify-center overflow-hidden flex-shrink-0"
          >
            {story.author.profile_image ? (
              <Image
                src={story.author.profile_image}
                alt=""
                width={44}
                height={44}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[18px]">👤</span>
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/profile/${story.author.nickname}`} className="text-[14px] font-semibold text-gray-900">
              {story.author.nickname}
            </Link>
            {story.companions_tagged.length > 0 && (
              <span className="text-[12px] text-gray-500"> + {story.companions_tagged.length}명</span>
            )}
            <p className="text-[12px] text-gray-400">
              {story.trail_id ? (
                <Link href={`/trails/${story.trail_id}`} className="hover:text-primary">
                  {story.trail_region} · {story.trail_title}
                </Link>
              ) : null}
              {story.trail_id ? " · " : ""}
              {timeAgo(story.created_at)}
            </p>
          </div>
        </div>

        {/* Mood */}
        {mood && (
          <span
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-medium mb-3"
            style={{ background: mood.bg, color: mood.text }}
          >
            {mood.emoji} {mood.label}
          </span>
        )}

        {/* Title */}
        {story.title && (
          <h2 className="text-[20px] font-bold text-gray-900 mb-2 leading-tight">{story.title}</h2>
        )}

        {/* Content */}
        <p className="text-[15px] leading-relaxed text-gray-800 whitespace-pre-line mb-5">{story.content}</p>

        {/* Photos */}
        {photos.length > 0 && (
          <div className="-mx-5 mb-5">
            <div className="flex overflow-x-auto scrollbar-hide gap-2 px-5">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setLightboxIndex(i);
                    setLightboxOpen(true);
                  }}
                  className="relative w-[280px] h-[280px] flex-shrink-0 rounded-2xl overflow-hidden bg-gray-100 active:opacity-80 transition-opacity"
                >
                  <Image src={p.image} alt={p.caption || ""} fill className="object-cover" sizes="280px" />
                  {p.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-left">
                      <p className="text-white text-[12px]">{p.caption}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <PhotoLightbox
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          images={photos.map((p) => ({ src: p.image, caption: p.caption }))}
        />

        {/* Actions */}
        <div className="flex items-center gap-5 py-3 border-y border-gray-100">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-[14px] font-medium transition-colors ${
              story.is_liked ? "text-red-500" : "text-gray-600 hover:text-red-400"
            }`}
          >
            <span className="text-[18px]">{story.is_liked ? "❤️" : "🤍"}</span>
            좋아요 {story.like_count > 0 && story.like_count}
          </button>
          <div className="flex items-center gap-1.5 text-[14px] font-medium text-gray-600">
            <span className="text-[18px]">💬</span>
            댓글 {story.comment_count > 0 && story.comment_count}
          </div>
        </div>

        {/* Comments */}
        <div className="mt-5">
          <h3 className="text-[14px] font-bold text-gray-900 mb-4">
            댓글 {story.comment_count > 0 ? story.comment_count : 0}개
          </h3>
          {comments.length === 0 ? (
            <p className="text-center py-10 text-[13px] text-gray-400">
              아직 댓글이 없어요. 첫 댓글을 남겨보세요!
            </p>
          ) : (
            <div className="space-y-5">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <Link
                    href={`/profile/${c.author.nickname}`}
                    className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0"
                  >
                    {c.author.profile_image ? (
                      <Image src={c.author.profile_image} alt="" width={36} height={36} className="object-cover" />
                    ) : (
                      <span className="text-[14px]">👤</span>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-semibold text-gray-900">{c.author.nickname}</span>
                      <span className="text-[11px] text-gray-400">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-[14px] text-gray-800 mt-0.5 leading-snug">{c.content}</p>
                    <button
                      onClick={() => setReplyingTo({ id: c.id, nickname: c.author.nickname })}
                      className="text-[12px] text-gray-500 mt-1 hover:text-primary font-medium"
                    >
                      답글
                    </button>
                    {c.replies && c.replies.length > 0 && (
                      <div className="mt-3 pl-3 border-l-2 border-gray-100 space-y-3">
                        {c.replies.map((r) => (
                          <div key={r.id} className="flex gap-2.5">
                            <Link
                              href={`/profile/${r.author.nickname}`}
                              className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0"
                            >
                              {r.author.profile_image ? (
                                <Image src={r.author.profile_image} alt="" width={28} height={28} className="object-cover" />
                              ) : (
                                <span className="text-[11px]">👤</span>
                              )}
                            </Link>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <span className="text-[12px] font-semibold text-gray-900">{r.author.nickname}</span>
                                <span className="text-[10px] text-gray-400">{timeAgo(r.created_at)}</span>
                              </div>
                              <p className="text-[13px] text-gray-800 mt-0.5 leading-snug">{r.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Comment Input — sticky bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 md:left-1/2 md:-translate-x-1/2 md:max-w-2xl pb-[max(env(safe-area-inset-bottom),0px)]">
        {replyingTo && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[12px] text-gray-600">
              <span className="text-primary font-semibold">@{replyingTo.nickname}</span>에게 답글 작성 중
            </span>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-[12px] text-gray-500 hover:text-gray-700 font-medium"
            >
              취소
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 p-3">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={replyingTo ? `@${replyingTo.nickname}에게 답글` : "댓글을 입력하세요..."}
            rows={1}
            maxLength={1000}
            className="flex-1 resize-none bg-gray-50 rounded-2xl px-4 py-2.5 text-[14px] focus:outline-none focus:bg-gray-100 max-h-24"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmitComment();
              }
            }}
          />
          <button
            onClick={handleSubmitComment}
            disabled={!commentText.trim() || submitting}
            className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
