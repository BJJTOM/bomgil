"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { TrailCard } from "@/components/TrailCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrailCardSkeleton } from "@/components/ui/Skeleton";
import api from "@/lib/api";
import Link from "next/link";
import type { Trail } from "@/types";

export default function LikesPage() {
  const { isAuthenticated } = useAuthStore();

  const { data: trails = [], isLoading } = useQuery<Trail[]>({
    queryKey: ["user-likes"],
    queryFn: async () => {
      const { data } = await api.get("/auth/me/likes/");
      return data.results ?? data;
    },
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <div className="md:pt-16 flex items-center justify-center min-h-screen">
        <EmptyState
          title="로그인이 필요합니다"
          description="좋아요한 코스를 보려면 로그인해주세요."
          action={
            <Link
              href="/auth/login"
              className="px-6 py-3 bg-primary text-white rounded-button font-medium"
            >
              로그인하기
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="md:pt-16 max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-title mb-8">좋아요한 코스</h1>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <TrailCardSkeleton key={i} />
          ))}
        </div>
      ) : trails.length === 0 ? (
        <EmptyState
          title="좋아요한 코스가 없습니다"
          description="마음에 드는 코스를 발견하면 하트를 눌러보세요!"
          action={
            <Link
              href="/explore"
              className="px-6 py-3 bg-primary text-white rounded-button font-medium"
            >
              코스 탐색하기
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {trails.map((trail) => (
            <TrailCard key={trail.id} trail={trail} />
          ))}
        </div>
      )}
    </div>
  );
}
