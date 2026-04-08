"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

interface GroupMessage {
  id: number;
  sender: number;
  sender_nickname: string;
  sender_image: string | null;
  content: string;
  created_at: string;
}

interface GroupInfo {
  id: number;
  name: string;
  member_count: number;
  is_member: boolean;
}

function timeFormat(dateStr: string) {
  const d = new Date(dateStr);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h < 12 ? "오전" : "오후";
  const hour12 = h % 12 || 12;
  return `${ampm} ${hour12}:${m}`;
}

function dateLabel(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return "오늘";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "어제";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export default function GroupChatPage() {
  const { id } = useParams();
  const router = useRouter();
  const groupId = Number(id);
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: group } = useQuery<GroupInfo>({
    queryKey: ["group", groupId],
    queryFn: async () => (await api.get(`/community/groups/${groupId}/`)).data,
    enabled: !!groupId,
  });

  const { data: messages = [], refetch } = useQuery<GroupMessage[]>({
    queryKey: ["group-messages", groupId],
    queryFn: async () => {
      const { data } = await api.get(`/community/groups/${groupId}/messages/`);
      const msgs = Array.isArray(data) ? data : (data.results ?? []);
      // Server returns newest first; we want oldest first for chat display
      return [...msgs].reverse();
    },
    refetchInterval: 5000,
    enabled: !!groupId,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      await api.post(`/community/groups/${groupId}/messages/create/`, { content });
    },
    onSuccess: () => {
      refetch();
      qc.invalidateQueries({ queryKey: ["group-messages", groupId] });
    },
  });

  const handleSend = useCallback(() => {
    const msg = text.trim();
    if (!msg || sendMutation.isPending) return;
    setText("");
    sendMutation.mutate(msg);
  }, [text, sendMutation]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div className="md:pt-[60px] flex flex-col h-screen bg-[#F7F8FA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors"
          aria-label="뒤로"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#191F28" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-[15px] font-semibold text-gray-900 truncate">{group?.name || "그룹 채팅"}</p>
          <p className="text-[11px] text-gray-400">멤버 {group?.member_count ?? 0}명</p>
        </div>
        <div className="w-9" />
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="text-[40px] mb-3">💬</div>
            <p className="text-[14px] text-gray-500">첫 메시지를 보내보세요!</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
            {messages.map((msg, i) => {
              const isMine = msg.sender === user?.id;
              const prev = messages[i - 1];
              const showDate =
                !prev || new Date(prev.created_at).toDateString() !== new Date(msg.created_at).toDateString();
              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-3">
                      <span className="text-[11px] text-gray-400 bg-white/80 px-3 py-1 rounded-full">
                        {dateLabel(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <div className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
                    {!isMine && (
                      <div className="w-8 h-8 rounded-full bg-white overflow-hidden flex items-center justify-center flex-shrink-0">
                        {msg.sender_image ? (
                          <Image
                            src={msg.sender_image}
                            alt=""
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[14px]">👤</span>
                        )}
                      </div>
                    )}
                    <div className={`max-w-[70%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                      {!isMine && (
                        <p className="text-[11px] text-gray-500 mb-1 ml-1 font-medium">{msg.sender_nickname}</p>
                      )}
                      <div
                        className={`px-3.5 py-2 rounded-[18px] text-[14px] leading-snug whitespace-pre-wrap ${
                          isMine
                            ? "bg-primary text-white rounded-tr-[4px]"
                            : "bg-white text-gray-900 rounded-tl-[4px]"
                        }`}
                      >
                        {msg.content}
                      </div>
                      <p className={`text-[10px] text-gray-400 mt-1 ${isMine ? "mr-1" : "ml-1"}`}>
                        {timeFormat(msg.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 px-3 py-2 flex items-end gap-2 flex-shrink-0 pb-[max(env(safe-area-inset-bottom),8px)]">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="메시지를 입력하세요"
          rows={1}
          maxLength={2000}
          className="flex-1 bg-[#F7F8FA] rounded-2xl px-4 py-2.5 text-[14px] resize-none focus:outline-none max-h-24"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sendMutation.isPending}
          className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0"
          aria-label="전송"
        >
          {sendMutation.isPending ? (
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
  );
}
