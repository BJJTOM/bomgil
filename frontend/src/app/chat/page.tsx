"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useChatRooms } from "@/hooks/useCompanions";
import { useAuthStore } from "@/stores/auth";
import { useT } from "@/stores/language";
import api from "@/lib/api";
import type { ChatRoom } from "@/types";

export default function ChatPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { data: chatRooms } = useChatRooms();
  const { t, language } = useT();
  const [activeTab, setActiveTab] = useState<"companion" | "open">("companion");
  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [creating, setCreating] = useState(false);

  const rooms = Array.isArray(chatRooms) ? chatRooms : [];
  const companionRooms = rooms.filter((r: any) => r.walk_plan);
  const openRooms = rooms.filter((r: any) => !r.walk_plan);

  const currentRooms = activeTab === "companion" ? companionRooms : openRooms;

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    setCreating(true);
    try {
      await api.post("/chat-rooms/", { name: newRoomName.trim() });
      setNewRoomName("");
      setShowCreate(false);
      // Refetch would happen via react-query
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const tabLabels = {
    companion: language === "ko" ? "동행 채팅" : language === "ja" ? "同行チャット" : language === "zh" ? "同行聊天" : "Companion",
    open: language === "ko" ? "오픈 채팅" : language === "ja" ? "オープンチャット" : language === "zh" ? "开放聊天" : "Open Chat",
  };

  return (
    <div className="md:pt-[60px] min-h-screen bg-warm pb-24">
      {/* Header */}
      <header className="sticky top-0 md:top-[60px] z-30 bg-white/95 backdrop-blur-xl border-b border-border-light">
        <div className="max-w-2xl mx-auto px-5 pt-14 md:pt-3 pb-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-[20px] font-bold">{language === "ko" ? "채팅" : language === "ja" ? "チャット" : language === "zh" ? "聊天" : "Chat"}</h1>
            {isAuthenticated && activeTab === "open" && (
              <button
                onClick={() => setShowCreate(true)}
                className="px-3 py-1.5 bg-primary text-white rounded-pill text-[12px] font-medium"
              >
                + {language === "ko" ? "채팅방 만들기" : "Create"}
              </button>
            )}
          </div>
          {/* Tabs */}
          <div className="flex border-b border-border-light -mx-5 px-5">
            {(["companion", "open"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-[14px] font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-text-tertiary"
                }`}
              >
                {tabLabels[tab]}
                {tab === "companion" && companionRooms.length > 0 && (
                  <span className="ml-1.5 text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{companionRooms.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Room List */}
      <div className="max-w-2xl mx-auto px-5 py-4">
        {currentRooms.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">{activeTab === "companion" ? "👥" : "💬"}</p>
            <p className="text-[15px] font-semibold mb-1">
              {activeTab === "companion"
                ? (language === "ko" ? "동행 채팅이 없어요" : "No companion chats")
                : (language === "ko" ? "오픈 채팅방이 없어요" : "No open chats")}
            </p>
            <p className="text-[13px] text-text-tertiary">
              {activeTab === "companion"
                ? (language === "ko" ? "동행 매칭 후 채팅이 시작됩니다" : "Chat starts after companion matching")
                : (language === "ko" ? "첫 번째 채팅방을 만들어보세요" : "Create the first chat room")}
            </p>
            {activeTab === "open" && isAuthenticated && (
              <button
                onClick={() => setShowCreate(true)}
                className="btn-primary mt-4 !py-2.5 !px-5 !text-[13px]"
              >
                {language === "ko" ? "채팅방 만들기" : "Create Room"}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {currentRooms.map((room: ChatRoom) => (
              <Link
                key={room.id}
                href={`/chat/${room.id}`}
                className="flex items-center gap-3.5 p-4 card-hover"
              >
                <div className="w-12 h-12 rounded-full bg-accent/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">{activeTab === "companion" ? "👥" : "💬"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[14px] truncate">{room.walk_plan_title || `Chat #${room.id}`}</p>
                  <p className="text-[12px] text-text-tertiary truncate">
                    {room.last_message
                      ? `${room.last_message.sender.nickname}: ${room.last_message.content}`
                      : (language === "ko" ? "아직 메시지가 없습니다" : "No messages yet")}
                  </p>
                </div>
                {room.unread_count > 0 && (
                  <span className="min-w-[20px] h-5 bg-danger text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1.5">
                    {room.unread_count}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white rounded-t-[24px] md:rounded-[24px] w-full max-w-md p-6 pb-8 safe-bottom">
            <h2 className="text-[18px] font-bold mb-4">{language === "ko" ? "오픈 채팅방 만들기" : "Create Open Chat"}</h2>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder={language === "ko" ? "채팅방 이름" : "Room name"}
              className="input-field mb-4"
              maxLength={50}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">{language === "ko" ? "취소" : "Cancel"}</button>
              <button
                onClick={handleCreateRoom}
                disabled={!newRoomName.trim() || creating}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {creating ? "..." : (language === "ko" ? "만들기" : "Create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
