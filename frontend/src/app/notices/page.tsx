"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

interface Notice {
  id: number;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
}

export default function NoticesPage() {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: notices = [], isLoading } = useQuery<Notice[]>({
    queryKey: ["notices"],
    queryFn: async () => {
      const { data } = await api.get("/community/notices/");
      return data.results ?? data;
    },
    staleTime: 60000,
  });

  return (
    <div className="md:pt-[60px] min-h-screen bg-gray-50">
      <header className="sticky top-0 md:top-[60px] z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-lg">←</button>
          <span className="text-[16px] font-semibold text-gray-900">공지사항</span>
          <div className="w-8" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-3">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <span className="text-sm text-gray-400">로딩 중...</span>
          </div>
        ) : notices.length === 0 ? (
          <div className="flex flex-col items-center py-20">
            <svg className="w-8 h-8 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            <p className="text-sm text-gray-400">공지사항이 없습니다</p>
          </div>
        ) : (
          notices.map((notice) => {
            const isExpanded = expandedId === notice.id;
            const dateStr = new Date(notice.created_at).toLocaleDateString("ko-KR", {
              year: "numeric", month: "long", day: "numeric",
            });
            return (
              <button
                key={notice.id}
                onClick={() => setExpandedId(isExpanded ? null : notice.id)}
                className="w-full text-left bg-white rounded-[14px] mt-2.5 overflow-hidden transition-shadow hover:shadow-sm"
              >
                <div className="flex items-center p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {notice.is_pinned && (
                        <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded-md">중요</span>
                      )}
                      <span className="text-[12px] text-gray-400">{dateStr}</span>
                    </div>
                    <p className="text-[15px] font-semibold text-gray-900 leading-snug">{notice.title}</p>
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-3 border-t border-gray-100">
                    <p className="text-[14px] text-gray-500 leading-relaxed whitespace-pre-wrap">{notice.content}</p>
                  </div>
                )}
              </button>
            );
          })
        )}
      </main>
    </div>
  );
}
