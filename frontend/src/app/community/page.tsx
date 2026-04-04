"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useChatRooms } from "@/hooks/useCompanions";
import type { WalkStory, Trail, StoryComment } from "@/types";

const MOOD_MAP: Record<string, { emoji: string; label: string; bg: string }> = {
  happy: { emoji: "😊", label: "즐거웠어요", bg: "bg-yellow-50 text-yellow-700" },
  peaceful: { emoji: "☮️", label: "평화로웠어요", bg: "bg-blue-50 text-blue-700" },
  exciting: { emoji: "🤩", label: "신났어요", bg: "bg-orange-50 text-orange-700" },
  touching: { emoji: "🥹", label: "감동이었어요", bg: "bg-pink-50 text-pink-700" },
  funny: { emoji: "😄", label: "웃겼어요", bg: "bg-green-50 text-green-700" },
};

export default function CommunityPage() {
  const { isAuthenticated } = useAuthStore();
  const { data: chatRooms } = useChatRooms();
  const qc = useQueryClient();

  const { data: stories = [], isLoading } = useQuery<WalkStory[]>({
    queryKey: ["community-feed"],
    queryFn: async () => {
      const { data } = await api.get("/stories/");
      return data.results ?? data;
    },
  });

  const { data: trails = [] } = useQuery<Trail[]>({
    queryKey: ["community-new-trails"],
    queryFn: async () => {
      const { data } = await api.get("/trails/");
      return (data.results ?? data).slice(0, 6);
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (id: number) => (await api.post(`/stories/${id}/like/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-feed"] }),
  });

  const unreadChats = Array.isArray(chatRooms) ? chatRooms.filter((r: any) => r.unread_count > 0).length : 0;

  return (
    <div className="md:pt-[60px] min-h-screen bg-warm">
      {/* Sticky Header */}
      <header className="sticky top-0 md:top-[60px] z-30 bg-surface/95 backdrop-blur-xl border-b border-border-light">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-bold tracking-tight">커뮤니티</h1>
            <span className="text-[11px] bg-accent-light text-primary px-2 py-0.5 rounded-pill font-semibold">GLOBAL</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/chat"
              className="relative p-2.5 rounded-[12px] bg-bg-secondary hover:bg-border-light transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#191F28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              {unreadChats > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadChats}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Pull-to-refresh style loading indicator */}
      {isLoading && (
        <div className="flex justify-center py-3 bg-primary/5">
          <div className="flex items-center gap-2 text-primary text-[13px] font-medium animate-slide-up">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93" />
            </svg>
            새로운 이야기를 불러오는 중...
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {/* New Trails — Story-like circles */}
        {trails.length > 0 && (
          <div className="bg-surface px-5 py-4 border-b border-border-light">
            <div className="flex gap-4 overflow-x-auto scrollbar-hide">
              {/* Create story CTA */}
              {isAuthenticated && (
                <Link href="/trails/new" className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div className="w-[60px] h-[60px] rounded-full border-2 border-dashed border-primary/40 flex items-center justify-center bg-primary-50">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2D4A2E" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-medium text-primary">내 코스</span>
                </Link>
              )}
              {trails.map((trail: Trail) => (
                <Link key={trail.id} href={`/trails/${trail.id}`} className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-accent to-primary-200 p-[2.5px]">
                    <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center">
                      {trail.cover_image ? (
                        <Image src={trail.cover_image} alt="" width={56} height={56} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">🥾</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-text-secondary font-medium max-w-[60px] truncate text-center">
                    {trail.region}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Feed */}
        {isLoading ? (
          <div className="py-20 text-center text-text-tertiary">
            <div className="flex gap-1.5 justify-center mb-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            불러오는 중...
          </div>
        ) : stories.length === 0 ? (
          <div className="py-20 text-center bg-surface">
            <p className="text-4xl mb-3">📝</p>
            <p className="text-[16px] font-semibold text-text-primary mb-1.5">첫 번째 이야기를 남겨보세요</p>
            <p className="text-[13px] text-text-tertiary mb-6">도보여행 후기를 공유하고 다른 여행자들과 소통해요</p>
          </div>
        ) : (
          <div>
            {stories.map((story, index) => (
              <FeedPost
                key={story.id}
                story={story}
                onLike={() => likeMutation.mutate(story.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button for new story */}
      {isAuthenticated && (
        <Link
          href="/stories/new"
          className="md:hidden fixed bottom-24 right-5 z-40 w-14 h-14 bg-primary text-white rounded-full shadow-float flex items-center justify-center active:scale-90 transition-transform"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="sr-only">새 글 작성</span>
        </Link>
      )}
    </div>
  );
}

function FeedPost({ story, onLike }: { story: WalkStory; onLike: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translatedText, setTranslatedText] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const { isAuthenticated } = useAuthStore();
  const qc = useQueryClient();
  const mood = MOOD_MAP[story.mood];
  const isLong = story.content.length > 180;
  const comments = (story as any).comments || [];

  const handleTranslate = async () => {
    if (translatedText) {
      setShowTranslation(!showTranslation);
      return;
    }
    try {
      const { data } = await api.post("/stories/translate/", {
        text: story.content,
        target: "en",
      });
      setTranslatedText(data.translated);
      setShowTranslation(true);
    } catch {
      setTranslatedText("Translation unavailable");
      setShowTranslation(true);
    }
  };

  const postComment = useMutation({
    mutationFn: async (content: string) =>
      (await api.post(`/stories/${story.id}/comments/create/`, { content })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-feed"] });
      setCommentInput("");
    },
  });

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    return new Date(dateStr).toLocaleDateString("ko");
  };

  return (
    <article className="bg-surface border-b border-border-light">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-2.5">
        <Link href={`/profile/${story.author.nickname}`}>
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-accent to-primary-300 p-[2px]">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
              {story.author.profile_image ? (
                <Image src={story.author.profile_image} alt="" width={40} height={40} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg">👤</span>
              )}
            </div>
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Link href={`/profile/${story.author.nickname}`} className="text-[14px] font-bold hover:underline">
              {story.author.nickname}
            </Link>
            {(story.author as any).is_verified && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#2D4A2E"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            )}
          </div>
          <Link href={`/trails/${story.trail_id}`} className="text-[12px] text-text-tertiary hover:text-primary transition-colors">
            {story.trail_region} · {story.trail_title}
          </Link>
        </div>
        <span className="text-[11px] text-text-tertiary">{timeAgo(story.created_at)}</span>
      </div>

      {/* Content */}
      <div className="px-5 pb-3">
        {/* Mood tag */}
        {mood && (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-[11px] font-semibold mb-2.5 ${mood.bg}`}>
            {mood.emoji} {mood.label}
          </span>
        )}

        {story.title && (
          <h3 className="text-[16px] font-bold leading-snug mb-1.5">{story.title}</h3>
        )}

        <p className="text-[14px] leading-[1.75] text-text-primary whitespace-pre-line">
          {isLong && !expanded ? (
            <>
              {story.content.slice(0, 180)}
              <button onClick={() => setExpanded(true)} className="text-text-tertiary font-medium">
                ... 더보기
              </button>
            </>
          ) : (
            story.content
          )}
        </p>
      </div>

      {/* Translate button */}
      <div className="px-5 pb-2">
        <button
          onClick={handleTranslate}
          className="text-[12px] text-text-tertiary hover:text-primary font-medium transition-colors flex items-center gap-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/>
            <path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/>
          </svg>
          {showTranslation ? "원문 보기" : "번역하기"}
        </button>
        {showTranslation && translatedText && (
          <div className="mt-2 p-3 bg-blue-50/50 rounded-input text-[13px] text-text-secondary leading-relaxed border border-blue-100">
            <p className="text-[10px] text-blue-400 font-medium mb-1">🌐 AI 번역</p>
            {translatedText}
          </div>
        )}
      </div>

      {/* Engagement stats */}
      {(story.like_count > 0 || story.comment_count > 0) && (
        <div className="flex items-center gap-3 px-5 pb-2 text-[12px] text-text-tertiary">
          {story.like_count > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-4 h-4 bg-danger rounded-full flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white" stroke="none">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
              </span>
              {story.like_count}명
            </span>
          )}
          {story.comment_count > 0 && (
            <button onClick={() => setShowComments(!showComments)} className="hover:underline">
              댓글 {story.comment_count}개
            </button>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center border-t border-border-light mx-5">
        <button
          onClick={onLike}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-medium transition-all active:scale-95 ${
            story.is_liked ? "text-danger" : "text-text-secondary"
          }`}
        >
          {story.is_liked ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF4B4B" stroke="none">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          )}
          좋아요
        </button>
        <div className="w-px h-5 bg-border-light" />
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-medium text-text-secondary active:scale-95"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          댓글
        </button>
        <div className="w-px h-5 bg-border-light" />
        <button className="flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-medium text-text-secondary active:scale-95">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          공유
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="bg-[#F7F8FA] border-t border-border-light">
          {/* Comment list */}
          <div className="px-5 py-3 space-y-3 max-h-[300px] overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-[13px] text-text-tertiary text-center py-3">아직 댓글이 없어요</p>
            ) : (
              comments.map((comment: StoryComment) => (
                <div key={comment.id} className="flex gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
                    {comment.author.profile_image ? (
                      <Image src={comment.author.profile_image} alt="" width={32} height={32} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[11px]">👤</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-white rounded-[14px] px-3.5 py-2.5">
                      <span className="text-[12px] font-bold">{comment.author.nickname}</span>
                      <p className="text-[13px] leading-relaxed mt-0.5">{comment.content}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1 ml-1 text-[11px] text-text-tertiary">
                      <span>{timeAgo(comment.created_at)}</span>
                      {comment.like_count > 0 && <span>좋아요 {comment.like_count}</span>}
                      <button className="font-medium hover:text-text-secondary">좋아요</button>
                      <button className="font-medium hover:text-text-secondary">답글</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Comment input */}
          {isAuthenticated && (
            <div className="flex items-center gap-2 px-5 py-3 border-t border-border-light bg-surface">
              <div className="w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center flex-shrink-0 text-[11px]">👤</div>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && commentInput.trim()) {
                      postComment.mutate(commentInput);
                    }
                  }}
                  placeholder="댓글을 입력하세요..."
                  className="w-full px-4 py-2.5 bg-bg-secondary rounded-pill text-[13px] placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <button
                onClick={() => commentInput.trim() && postComment.mutate(commentInput)}
                disabled={!commentInput.trim() || postComment.isPending}
                className="text-primary font-semibold text-[13px] disabled:text-text-tertiary px-2"
              >
                게시
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
