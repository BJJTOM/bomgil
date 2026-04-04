"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useChatMessages, useSendMessage } from "@/hooks/useCompanions";
import { useAuthStore } from "@/stores/auth";

export default function ChatRoomPage() {
  const { id } = useParams();
  const roomId = Number(id);
  const { user } = useAuthStore();
  const { data: messages = [] } = useChatMessages(roomId);
  const sendMsg = useSendMessage();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMsg.mutateAsync({ roomId, content: input });
    setInput("");
  };

  return (
    <div className="md:pt-16 flex flex-col h-screen">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => {
          const isMe = msg.sender.id === user?.id;
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${isMe ? "justify-end" : ""}`}
            >
              {!isMe && (
                <div className="w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {msg.sender.profile_image ? (
                    <Image src={msg.sender.profile_image} alt="" width={32} height={32} className="object-cover" />
                  ) : (
                    <span className="text-xs">👤</span>
                  )}
                </div>
              )}
              <div className={`max-w-[70%]`}>
                {!isMe && (
                  <p className="text-xs text-text-secondary mb-0.5">{msg.sender.nickname}</p>
                )}
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm ${
                    isMe
                      ? "bg-primary text-white rounded-br-md"
                      : "bg-white shadow-soft rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
                <p className="text-[10px] text-text-secondary mt-0.5">
                  {new Date(msg.created_at).toLocaleTimeString("ko", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-white px-4 py-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="메시지를 입력하세요"
          className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 text-sm focus:border-primary focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sendMsg.isPending}
          className="px-5 py-2.5 bg-primary text-white rounded-full text-sm font-medium disabled:opacity-50"
        >
          전송
        </button>
      </div>
    </div>
  );
}
