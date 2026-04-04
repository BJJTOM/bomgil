"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useT } from "@/stores/language";
import type { WalkStory, StoryComment } from "@/types";

const MOOD_MAP: Record<string, { emoji: string; label: string }> = {
  happy: { emoji: "😊", label: "즐거웠어요" },
  peaceful: { emoji: "☮️", label: "평화로웠어요" },
  exciting: { emoji: "🤩", label: "신났어요" },
  touching: { emoji: "🥹", label: "감동이었어요" },
  funny: { emoji: "😄", label: "웃겼어요" },
};

export default function StoryDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { t, language } = useT();
  const qc = useQueryClient();
  const [commentInput, setCommentInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: number; nickname: string } | null>(null);

  const { data: story, isLoading } = useQuery<WalkStory>({
    queryKey: ["story", id],
    queryFn: async () => (await api.get(`/stories/${id}/`)).data,
  });

  const { data: comments = [] } = useQuery<StoryComment[]>({
    queryKey: ["story-comments", id],
    queryFn: async () => {
      const { data } = await api.get(`/stories/${id}/comments/`);
      return data.results ?? data;
    },
  });

  const likeMutation = useMutation({
    mutationFn: async () => (await api.post(`/stories/${id}/like/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["story", id] }),
  });

  const postComment = useMutation({
    mutationFn: async ({ content, parent }: { content: string; parent?: number }) =>
      (await api.post(`/stories/${id}/comments/create/`, { content, parent })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["story-comments", id] });
      qc.invalidateQueries({ queryKey: ["story", id] });
      setCommentInput("");
      setReplyingTo(null);
    },
  });

  const likeComment = useMutation({
    mutationFn: async (commentId: number) => (await api.post(`/stories/comments/${commentId}/like/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["story-comments", id] }),
  });

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}${language === "ko" ? "분 전" : "m"}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}${language === "ko" ? "시간 전" : "h"}`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}${language === "ko" ? "일 전" : "d"}`;
    return new Date(dateStr).toLocaleDateString(language);
  };

  if (isLoading || !story) {
    return (
      <div className="min-h-screen bg-warm pt-14 flex items-center justify-center">
        <div className="animate-pulse text-text-tertiary">{t("common.loading")}</div>
      </div>
    );
  }

  const mood = MOOD_MAP[story.mood];

  return (
    <div className="min-h-screen bg-warm pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-border-light">
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#191F28" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <h1 className="text-[16px] font-bold">{language === "ko" ? "게시글" : "Post"}</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Post content */}
        <div className="bg-white px-5 py-5 border-b border-border-light">
          {/* Author */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-accent/30 flex items-center justify-center overflow-hidden">
              {story.author.profile_image ? (
                <img src={story.author.profile_image} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg">👤</span>
              )}
            </div>
            <div>
              <p className="text-[14px] font-bold">{story.author.nickname}</p>
              <p className="text-[12px] text-text-tertiary">{timeAgo(story.created_at)}</p>
            </div>
          </div>

          {/* Mood */}
          {mood && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-[11px] font-semibold mb-3 bg-primary-50 text-primary">
              {mood.emoji} {mood.label}
            </span>
          )}

          {/* Title & Content */}
          {story.title && <h2 className="text-[18px] font-bold mb-2">{story.title}</h2>}
          <p className="text-[15px] leading-[1.8] text-text-primary whitespace-pre-line">{story.content}</p>

          {/* Trail link */}
          {story.trail_title && (
            <Link href={`/trails/${story.trail_id}`} className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary rounded-pill text-[12px] text-text-secondary">
              📍 {story.trail_region} · {story.trail_title}
            </Link>
          )}

          {/* Engagement */}
          <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border-light">
            <button
              onClick={() => {
                if (!isAuthenticated) { router.push("/auth/login"); return; }
                likeMutation.mutate();
              }}
              className={`flex items-center gap-1.5 text-[14px] font-medium ${story.is_liked ? "text-danger" : "text-text-secondary"}`}
            >
              {story.is_liked ? "❤️" : "🤍"} {story.like_count}
            </button>
            <span className="text-[14px] text-text-secondary">💬 {story.comment_count || 0}</span>
          </div>
        </div>

        {/* Comments section */}
        <div className="bg-white mt-2">
          <div className="px-5 py-3 border-b border-border-light">
            <h3 className="text-[14px] font-bold">{t("community.comment")} {comments.length > 0 ? comments.length : ""}</h3>
          </div>

          {/* Comment list */}
          <div className="divide-y divide-border-light">
            {comments.length === 0 ? (
              <div className="py-10 text-center text-text-tertiary text-[13px]">
                {language === "ko" ? "아직 댓글이 없어요" : "No comments yet"}
              </div>
            ) : (
              comments.map((comment: StoryComment) => (
                <div key={comment.id} className="px-5 py-4">
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {comment.author.profile_image ? (
                        <img src={comment.author.profile_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[11px]">👤</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold">{comment.author.nickname}</span>
                        <span className="text-[11px] text-text-tertiary">{timeAgo(comment.created_at)}</span>
                      </div>
                      <p className="text-[14px] mt-1 leading-relaxed">{comment.content}</p>
                      <div className="flex items-center gap-4 mt-2 text-[12px] text-text-tertiary">
                        <button
                          onClick={() => {
                            if (!isAuthenticated) { router.push("/auth/login"); return; }
                            likeComment.mutate(comment.id);
                          }}
                          className={comment.is_liked ? "text-danger font-medium" : ""}
                        >
                          {t("community.like")} {comment.like_count > 0 ? comment.like_count : ""}
                        </button>
                        <button onClick={() => {
                          if (!isAuthenticated) { router.push("/auth/login"); return; }
                          setReplyingTo(replyingTo?.id === comment.id ? null : { id: comment.id, nickname: comment.author.nickname });
                        }}>
                          {t("community.reply")}
                        </button>
                      </div>

                      {/* Replies */}
                      {comment.replies?.length > 0 && (
                        <div className="mt-3 space-y-3 pl-2 border-l-2 border-border-light">
                          {comment.replies.map((reply: StoryComment) => (
                            <div key={reply.id} className="flex gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 text-[10px]">👤</div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[12px] font-bold">{reply.author.nickname}</span>
                                  <span className="text-[10px] text-text-tertiary">{timeAgo(reply.created_at)}</span>
                                </div>
                                <p className="text-[13px] mt-0.5">{reply.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply input */}
                      {replyingTo?.id === comment.id && (
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            type="text"
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && commentInput.trim()) {
                                postComment.mutate({ content: commentInput, parent: comment.id });
                              }
                            }}
                            placeholder={`@${comment.author.nickname}`}
                            className="flex-1 px-3 py-2 bg-bg-secondary rounded-pill text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10"
                            autoFocus
                          />
                          <button
                            onClick={() => commentInput.trim() && postComment.mutate({ content: commentInput, parent: comment.id })}
                            className="text-primary font-semibold text-[13px]"
                          >
                            {t("community.writePost")}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom comment input */}
      {isAuthenticated ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border-light safe-bottom">
          <div className="max-w-2xl mx-auto flex items-center gap-2 px-5 py-3">
            <input
              type="text"
              value={replyingTo ? "" : commentInput}
              onChange={(e) => { if (!replyingTo) setCommentInput(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && commentInput.trim() && !replyingTo) {
                  postComment.mutate({ content: commentInput });
                }
              }}
              placeholder={language === "ko" ? "댓글을 입력하세요..." : "Write a comment..."}
              className="flex-1 px-4 py-2.5 bg-bg-secondary rounded-pill text-[13px] placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/10"
            />
            <button
              onClick={() => commentInput.trim() && !replyingTo && postComment.mutate({ content: commentInput })}
              disabled={!commentInput.trim() || !!replyingTo}
              className="text-primary font-semibold text-[13px] disabled:text-text-tertiary px-2"
            >
              {t("community.writePost")}
            </button>
          </div>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border-light safe-bottom">
          <Link href="/auth/login" className="max-w-2xl mx-auto flex items-center justify-center gap-2 px-5 py-4">
            <p className="text-[13px] text-text-tertiary">{language === "ko" ? "로그인하고 댓글을 남겨보세요" : "Login to comment"}</p>
            <span className="text-primary font-semibold text-[13px]">{t("common.login")}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
