"use client";

import Link from "next/link";
import Image from "next/image";
import { useChatRooms } from "@/hooks/useCompanions";
import { useAuthStore } from "@/stores/auth";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ChatListPage() {
  const { isAuthenticated } = useAuthStore();
  const { data: rooms = [], isLoading } = useChatRooms();

  if (!isAuthenticated) {
    return (
      <div className="md:pt-16 flex items-center justify-center min-h-screen">
        <EmptyState title="로그인이 필요합니다" />
      </div>
    );
  }

  return (
    <div className="md:pt-16 max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-title mb-6">채팅</h1>

      {isLoading ? (
        <div className="text-center py-12 text-text-secondary">불러오는 중...</div>
      ) : rooms.length === 0 ? (
        <EmptyState
          title="채팅방이 없습니다"
          description="동행이 매칭되면 채팅방이 자동으로 개설됩니다."
        />
      ) : (
        <div className="space-y-2">
          {rooms.map((room) => (
            <Link
              key={room.id}
              href={`/chat/${room.id}`}
              className="flex items-center gap-4 p-4 bg-white rounded-card shadow-soft hover:shadow-hover transition-shadow"
            >
              <div className="w-12 h-12 rounded-full bg-accent/30 flex items-center justify-center">
                <span className="text-xl">💬</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{room.walk_plan_title || `채팅방 #${room.id}`}</p>
                <p className="text-xs text-text-secondary truncate">
                  {room.last_message
                    ? `${room.last_message.sender.nickname}: ${room.last_message.content}`
                    : "아직 메시지가 없습니다"}
                </p>
              </div>
              {room.unread_count > 0 && (
                <span className="bg-danger text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {room.unread_count}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
