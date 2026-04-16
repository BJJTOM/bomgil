"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useChatMessages, useSendMessage, useChatRooms } from "@/hooks/useCompanions";
import { useAuthStore } from "@/stores/auth";

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
  if (d.toDateString() === today.toDateString()) return "오늘";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "어제";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export default function ChatRoomPage() {
  const { id } = useParams();
  const router = useRouter();
  const roomId = Number(id);
  const { user } = useAuthStore();
  const { data: messages = [] } = useChatMessages(roomId);
  const { data: rooms = [] } = useChatRooms();
  const sendMsg = useSendMessage();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Resolve room info from cache
  const room = rooms.find((r) => r.id === roomId);
  const partner = room?.participants?.find((p) => p.id !== user?.id);
  const roomTitle = partner?.nickname || room?.walk_plan_title || "채팅";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || sendMsg.isPending) return;
    setInput("");
    try {
      await sendMsg.mutateAsync({ roomId, content: msg });
    } catch {
      setInput(msg);
    }
  }, [input, roomId, sendMsg]);

  return (
    <div className="md:pt-[60px] flex flex-col h-screen bg-[#F7F8FA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors"
          aria-label="뒤로"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-primary)" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {partner?.profile_image ? (
            <Image
              src={partner.profile_image}
              alt=""
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center flex-shrink-0">
              <span className="text-[14px]">👤</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-gray-900 truncate">{roomTitle}</p>
            {room?.walk_plan_title && partner && (
              <p className="text-[11px] text-gray-400 truncate">{room.walk_plan_title}</p>
            )}
          </div>
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
              const isMine = msg.sender.id === user?.id;
              const prev = messages[i - 1];
              const showDate =
                !prev || new Date(prev.created_at).toDateString() !== new Date(msg.created_at).toDateString();
              const groupWithPrev =
                prev &&
                prev.sender.id === msg.sender.id &&
                !showDate &&
                new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 60_000;
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
                      <div className={`w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ${groupWithPrev ? "invisible" : ""}`}>
                        {msg.sender.profile_image ? (
                          <Image
                            src={msg.sender.profile_image}
                            alt=""
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-white flex items-center justify-center">
                            <span className="text-[14px]">👤</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className={`max-w-[70%] flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                      {!isMine && !groupWithPrev && (
                        <p className="text-[11px] text-gray-500 mb-1 ml-1 font-medium">{msg.sender.nickname}</p>
                      )}
                      <div
                        className={`px-3.5 py-2 text-[14px] leading-snug whitespace-pre-wrap ${
                          isMine
                            ? "bg-primary text-white rounded-[18px] rounded-tr-[4px]"
                            : "bg-white text-gray-900 rounded-[18px] rounded-tl-[4px]"
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
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
          disabled={!input.trim() || sendMsg.isPending}
          className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0"
          aria-label="전송"
        >
          {sendMsg.isPending ? (
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
