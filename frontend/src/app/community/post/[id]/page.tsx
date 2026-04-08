"use client";

import { useState, useRef, useCallback } from "react";
import { Icon } from "@/components/Icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import type { CommunityPost, PostComment } from "@/types";

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

const REPORT_REASONS = [
  { key: "spam", label: "스팸/광고" },
  { key: "abuse", label: "욕설/비하" },
  { key: "sexual", label: "성적 콘텐츠" },
  { key: "harassment", label: "괴롭힘" },
  { key: "misinformation", label: "허위정보" },
  { key: "other", label: "기타" },
];

function CommentItem({ comment, postId, onReply }: { comment: PostComment; postId: number; onReply: (id: number, name: string) => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const isMine = user?.id === comment.author;

  const handleLike = async () => {
    if (!isAuthenticated) { router.push("/auth/login"); return; }
    await api.post(`/community/posts/comments/${comment.id}/like/`);
    qc.invalidateQueries({ queryKey: ["post-detail", postId] });
  };

  const handleDelete = async () => {
    if (!confirm("댓글을 삭제하시겠어요?")) return;
    await api.delete(`/community/posts/comments/${comment.id}/delete/`);
    qc.invalidateQueries({ queryKey: ["post-detail", postId] });
  };

  if (comment.is_deleted) return <p className="text-sm text-gray-400 italic py-3 px-5">삭제된 댓글입니다.</p>;

  return (
    <div>
      <div className="flex gap-2.5 px-5 py-3">
        <Link href={`/profile/${comment.author_nickname}`} className="w-8 h-8 rounded-full bg-gray-50 overflow-hidden shrink-0">
          {comment.author_image ? <Image src={comment.author_image} alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover" /> :
            <span className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">U</span>}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[13px] font-semibold text-gray-900">{comment.author_nickname}</span>
            <span className="text-[11px] text-gray-400">{timeAgo(comment.created_at)}</span>
            <div className="ml-auto relative">
              <button onClick={() => setShowMenu(!showMenu)} className="text-xs text-gray-400 px-1">···</button>
              {showMenu && (
                <div className="absolute right-0 top-6 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 min-w-[120px]">
                  {isMine && <button onClick={handleDelete} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-50">삭제</button>}
                  {!isMine && <button onClick={() => { setShowMenu(false); alert("신고가 접수되었습니다."); }} className="w-full text-left px-4 py-2 text-sm text-gray-900 hover:bg-gray-50">신고</button>}
                </div>
              )}
            </div>
          </div>
          <p className="text-[14px] text-gray-900 leading-relaxed mb-1.5">{comment.content}</p>
          <div className="flex items-center gap-3">
            <button onClick={handleLike} className={`text-xs ${comment.is_liked ? "text-red-500" : "text-gray-400"}`}>
              {comment.is_liked ? "♥" : "♡"} {comment.like_count > 0 ? comment.like_count : ""}
            </button>
            <button onClick={() => onReply(comment.id, comment.author_nickname)} className="text-xs text-gray-500">답글</button>
          </div>
        </div>
      </div>
      {/* Replies */}
      {comment.replies?.map((reply) => (
        <div key={reply.id} className="flex gap-2 px-5 pl-14 py-2">
          <span className="text-gray-400 text-xs mt-1">┗</span>
          <Link href={`/profile/${reply.author_nickname}`} className="w-6 h-6 rounded-full bg-gray-50 overflow-hidden shrink-0">
            {reply.author_image ? <Image src={reply.author_image} alt="" width={24} height={24} className="w-6 h-6 rounded-full object-cover" /> :
              <span className="w-6 h-6 flex items-center justify-center text-[10px] text-gray-400">U</span>}
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[12px] font-semibold text-gray-900">{reply.author_nickname}</span>
              <span className="text-[10px] text-gray-400">{timeAgo(reply.created_at)}</span>
            </div>
            <p className="text-[13px] text-gray-900 leading-relaxed">{reply.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PostDetailPage() {
  const { id } = useParams();
  const postId = Number(id);
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();

  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: post, isLoading } = useQuery<CommunityPost>({
    queryKey: ["post-detail", postId],
    queryFn: async () => (await api.get(`/community/posts/${postId}/`)).data,
    enabled: !!postId,
  });

  const isMine = post && user?.id === post.author;

  const handleLike = useCallback(async () => {
    if (!isAuthenticated) { router.push("/auth/login"); return; }
    qc.setQueryData(["post-detail", postId], (old: any) => {
      if (!old) return old;
      return { ...old, is_liked: !old.is_liked, like_count: old.is_liked ? old.like_count - 1 : old.like_count + 1 };
    });
    api.post(`/community/posts/${postId}/like/`).catch(() => qc.invalidateQueries({ queryKey: ["post-detail", postId] }));
  }, [isAuthenticated, postId]);

  const handleBookmark = useCallback(async () => {
    if (!isAuthenticated) { router.push("/auth/login"); return; }
    qc.setQueryData(["post-detail", postId], (old: any) => old ? { ...old, is_bookmarked: !old.is_bookmarked } : old);
    api.post(`/community/posts/${postId}/bookmark/`).catch(() => qc.invalidateQueries({ queryKey: ["post-detail", postId] }));
  }, [isAuthenticated, postId]);

  const handleDelete = async () => {
    if (!confirm("게시글을 삭제하시겠어요?")) return;
    await api.delete(`/community/posts/${postId}/delete/`);
    router.push("/community");
  };

  const handleReport = async () => {
    if (!reportReason) return;
    await api.post("/community/report/", { target_type: "post", target_id: postId, reason: reportReason, detail: "" });
    setShowReport(false);
    setReportReason("");
    alert("신고가 접수되었습니다.");
  };

  const handleBlock = async () => {
    if (!post) return;
    if (!isAuthenticated) { router.push("/auth/login"); return; }
    if (!confirm(`${post.author_nickname}님을 차단하시겠어요?\n차단한 사용자의 게시글과 댓글이 더 이상 보이지 않습니다.`)) return;
    try {
      await api.post("/community/block/", { user_id: post.author });
      alert("사용자를 차단했습니다.");
      router.push("/community");
    } catch (e: any) {
      alert(e?.response?.data?.detail || "차단에 실패했습니다.");
    }
  };

  const handleSubmitComment = async () => {
    if (!comment.trim() || !isAuthenticated || submitting) return;
    setSubmitting(true);
    try {
      if (replyTo) {
        await api.post(`/community/posts/comments/${replyTo.id}/reply/`, { content: comment.trim() });
      } else {
        await api.post(`/community/posts/${postId}/comments/create/`, { content: comment.trim() });
      }
      setComment("");
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ["post-detail", postId] });
    } catch {}
    setSubmitting(false);
  };

  if (isLoading || !post) {
    return (
      <div className="md:pt-[60px] min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-5 py-4">
          <button onClick={() => router.back()} className="text-lg text-gray-900">←</button>
          <div className="flex justify-center py-20"><span className="text-sm text-gray-400">로딩 중...</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="md:pt-[60px] min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 md:top-[60px] z-30 bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-lg">←</button>
          <span className="text-[16px] font-semibold text-gray-900">게시글</span>
          <div className="flex items-center gap-1.5">
            <button onClick={handleBookmark}><Icon.Bookmark size={20} className={post.is_bookmarked ? "text-yellow-500" : "text-gray-400"} fill={post.is_bookmarked ? "currentColor" : "none"} /></button>
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-sm font-bold text-gray-500">···</button>
              {showMenu && (
                <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 min-w-[140px]">
                  {isMine && <button onClick={() => { setShowMenu(false); router.push(`/community/post/new?edit=${postId}`); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50">수정하기</button>}
                  {isMine && <button onClick={() => { setShowMenu(false); handleDelete(); }} className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-gray-50">삭제하기</button>}
                  {!isMine && <button onClick={() => { setShowMenu(false); setShowReport(true); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50">신고하기</button>}
                  {!isMine && <button onClick={() => { setShowMenu(false); handleBlock(); }} className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-gray-50">사용자 차단</button>}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto pb-24">
        {/* Category + Title */}
        <div className="px-5 pt-4 pb-2">
          <span className="text-[12px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded">{post.category_display}</span>
        </div>
        <h1 className="px-5 text-xl font-bold text-gray-900 leading-snug">{post.title}</h1>

        {/* Author */}
        <Link href={`/profile/${post.author_nickname}`} className="flex items-center gap-2.5 px-5 py-3">
          <div className="w-9 h-9 rounded-full bg-gray-50 overflow-hidden">
            {post.author_image ? <Image src={post.author_image} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover" /> :
              <span className="w-9 h-9 flex items-center justify-center text-sm text-gray-400">U</span>}
          </div>
          <div>
            <p className="text-[14px] font-semibold text-gray-900">{post.author_nickname}</p>
            <p className="text-[12px] text-gray-400">{timeAgo(post.created_at)} · 조회 {post.view_count}</p>
          </div>
        </Link>

        <hr className="border-gray-100 mx-5" />

        {/* Content */}
        <p className="px-5 py-4 text-[15px] text-gray-900 leading-relaxed whitespace-pre-wrap">{post.content}</p>

        {/* Images */}
        {post.images && post.images.length > 0 && (
          <div className="px-5 space-y-2 pb-3">
            {post.images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => {
                  setLightboxIndex(i);
                  setLightboxOpen(true);
                }}
                className="block w-full rounded-xl overflow-hidden bg-gray-50 active:opacity-80 transition-opacity"
              >
                <Image src={img.image} alt="" width={600} height={400} className="w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <PhotoLightbox
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          images={(post.images || []).map((img) => ({ src: img.image }))}
        />

        {/* Actions */}
        <div className="flex items-center gap-5 px-5 py-3 border-t border-b border-gray-100">
          <button onClick={handleLike} className={`flex items-center gap-1.5 text-sm ${post.is_liked ? "text-red-500" : "text-gray-500"}`}>
            <Icon.Heart size={20} fill={post.is_liked ? "currentColor" : "none"} /> {post.like_count}
          </button>
          <button onClick={() => inputRef.current?.focus()} className="flex items-center gap-1.5 text-sm text-gray-500">
            <Icon.MessageCircle size={20} /> {post.comment_count}
          </button>
          <button onClick={() => { if (typeof navigator !== "undefined" && navigator.share) navigator.share({ title: post.title, text: post.title, url: window.location.href }); }} className="flex items-center gap-1.5 text-sm text-gray-500">
            <Icon.Share size={20} />
          </button>
        </div>

        {/* Section divider */}
        <div className="h-2 bg-gray-50" />

        {/* Comments */}
        <div className="pt-3 pb-2 px-5">
          <h2 className="text-[15px] font-bold text-gray-900">댓글 {post.comment_count}</h2>
        </div>
        {post.comments && post.comments.length > 0 ? (
          post.comments.map((c) => <CommentItem key={c.id} comment={c} postId={postId} onReply={(id, name) => { setReplyTo({ id, name }); inputRef.current?.focus(); }} />)
        ) : (
          <p className="text-center text-sm text-gray-400 py-8">아직 댓글이 없어요</p>
        )}
      </main>

      {/* Comment input */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30 md:pb-0 pb-safe">
        <div className="max-w-2xl mx-auto px-4 py-2.5">
          {replyTo && (
            <div className="flex items-center justify-between mb-2 -mx-4 px-4 py-2 bg-emerald-50 border-y border-emerald-100">
              <span className="text-[12px] text-emerald-800">
                <span className="font-semibold text-emerald-700">@{replyTo.name}</span>
                에게 답글 작성 중
              </span>
              <button
                onClick={() => setReplyTo(null)}
                className="text-[12px] text-emerald-700 hover:text-emerald-900 font-medium"
              >
                취소
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={inputRef}
              className="flex-1 bg-gray-50 rounded-full px-4 py-2.5 text-sm outline-none text-gray-900 placeholder-[#B0B8C1]"
              placeholder={
                !isAuthenticated
                  ? "로그인 후 댓글을 작성할 수 있어요"
                  : replyTo
                  ? `@${replyTo.name}에게 답글`
                  : "댓글을 입력하세요..."
              }
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); } }}
              disabled={!isAuthenticated}
              onClick={() => { if (!isAuthenticated) router.push("/auth/login"); }}
            />
            <button
              onClick={handleSubmitComment}
              disabled={!comment.trim() || submitting}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0 ${
                comment.trim() ? "bg-gray-900" : "bg-gray-200"
              }`}>↑</button>
          </div>
        </div>
      </div>

      {/* Report modal */}
      {showReport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={() => setShowReport(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 pb-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">신고하기</h3>
              <button onClick={() => setShowReport(false)} className="text-gray-400">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-3">신고 사유를 선택해주세요</p>
            {REPORT_REASONS.map((r) => (
              <label key={r.key} className="flex items-center gap-3 py-3 cursor-pointer">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${reportReason === r.key ? "border-[#2D4A2E]" : "border-[#E5E8EB]"}`}>
                  {reportReason === r.key && <div className="w-2.5 h-2.5 rounded-full bg-gray-900" />}
                </div>
                <button onClick={() => setReportReason(r.key)} className="text-[15px] text-gray-900">{r.label}</button>
              </label>
            ))}
            <button onClick={handleReport} disabled={!reportReason}
              className={`w-full mt-4 py-3.5 rounded-xl text-white font-semibold ${reportReason ? "bg-red-500" : "bg-gray-200"}`}>
              신고하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
