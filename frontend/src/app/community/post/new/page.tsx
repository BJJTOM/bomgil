"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { CommunityPost, PostCategory } from "@/types";

const CATEGORIES: { key: PostCategory; label: string }[] = [
  { key: "free", label: "자유" },
  { key: "qna", label: "질문" },
  { key: "recommend", label: "추천" },
  { key: "review", label: "후기" },
  { key: "meetup", label: "번개" },
  { key: "tip", label: "꿀팁" },
];

const TITLE_MIN = 2;
const TITLE_MAX = 100;
const CONTENT_MIN = 5;
const CONTENT_MAX = 5000;

function PostNewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const qc = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  const [category, setCategory] = useState<PostCategory>("free");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load edit data
  const { data: editPost } = useQuery<CommunityPost>({
    queryKey: ["post-detail", Number(editId)],
    queryFn: async () => (await api.get(`/community/posts/${editId}/`)).data,
    enabled: !!editId,
  });

  useEffect(() => {
    if (editPost) {
      setCategory(editPost.category);
      setTitle(editPost.title);
      setContent(editPost.content || "");
    }
  }, [editPost]);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/auth/login");
  }, [isAuthenticated]);

  const canSubmit = title.trim().length >= TITLE_MIN && content.trim().length >= CONTENT_MIN;

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 10 - images.length;
    const newFiles = files.slice(0, remaining);
    setImages((prev) => [...prev, ...newFiles]);
    setPreviews((prev) => [...prev, ...newFiles.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      let postId: number;
      if (editId) {
        await api.patch(`/community/posts/${editId}/update/`, { category, title: title.trim(), content: content.trim() });
        postId = Number(editId);
      } else {
        const { data } = await api.post("/community/posts/create/", { category, title: title.trim(), content: content.trim() });
        postId = data.id;
      }

      if (images.length > 0 && postId) {
        const formData = new FormData();
        images.forEach((img) => formData.append("images", img));
        await api.post(`/community/posts/${postId}/images/`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      }

      qc.invalidateQueries({ queryKey: ["community-posts"] });
      qc.invalidateQueries({ queryKey: ["post-detail", postId] });
      router.push(editId ? `/community/post/${postId}` : "/community");
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.response?.data?.title?.[0] || "게시글 저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="md:pt-[60px] min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 md:top-[60px] z-30 bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="text-[15px] text-gray-500">취소</button>
          <span className="text-[16px] font-semibold text-gray-900">{editId ? "수정하기" : "글쓰기"}</span>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold ${
              canSubmit ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"
            }`}>
            {submitting ? "..." : editId ? "수정" : "완료"}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {/* Categories */}
        <div className="flex gap-2 px-5 py-4 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-medium transition-colors ${
                category === c.key ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-500"
              }`}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Title */}
        <div className="relative px-5">
          <input
            className="w-full text-lg font-semibold text-gray-900 placeholder-[#B0B8C1] outline-none py-3 pr-16"
            placeholder={`제목 (${TITLE_MIN}~${TITLE_MAX}자)`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={TITLE_MAX}
          />
          <span className={`absolute right-5 top-4 text-[11px] ${title.length > 0 && title.length < TITLE_MIN ? "text-red-500" : "text-gray-400"}`}>
            {title.length}/{TITLE_MAX}
          </span>
        </div>

        <hr className="border-gray-100 mx-5" />

        {/* Content */}
        <div className="relative px-5">
          <textarea
            className="w-full min-h-[240px] text-[15px] text-gray-900 placeholder-[#B0B8C1] outline-none py-4 leading-relaxed resize-none"
            placeholder={`내용을 입력하세요 (${CONTENT_MIN}~${CONTENT_MAX}자)`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={CONTENT_MAX}
          />
          <span className={`absolute right-5 bottom-4 text-[11px] ${content.length > 0 && content.length < CONTENT_MIN ? "text-red-500" : "text-gray-400"}`}>
            {content.length}/{CONTENT_MAX}
          </span>
        </div>

        {/* Images */}
        <div className="flex flex-wrap gap-2 px-5 py-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-[72px] h-[72px] rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
            <span className="text-xl font-light text-gray-400">+</span>
            <span className="text-[10px] text-gray-400">{images.length}/10</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImagePick} />
          {previews.map((url, i) => (
            <div key={i} className="relative">
              <Image src={url} alt="" width={72} height={72} className="w-[72px] h-[72px] rounded-xl object-cover" />
              <button onClick={() => removeImage(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center">✕</button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function PostNewPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20 text-sm text-gray-400">로딩 중...</div>}>
      <PostNewContent />
    </Suspense>
  );
}
