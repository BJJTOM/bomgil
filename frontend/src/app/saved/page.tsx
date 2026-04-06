"use client";

import { useAuthStore } from "@/stores/auth";
import { useT } from "@/stores/language";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";

export default function SavedPage() {
  const { isAuthenticated } = useAuthStore();
  const { t, language } = useT();
  const ko = language === "ko";

  if (!isAuthenticated) {
    return (
      <div className="md:pt-16 flex items-center justify-center min-h-screen">
        <EmptyState
          title={ko ? "로그인이 필요합니다" : "Login required"}
          description={ko ? "저장한 코스를 보려면 로그인해주세요." : "Please login to view saved trails."}
          action={
            <Link href="/auth/login" className="px-6 py-3 bg-primary text-white rounded-button font-medium">
              {ko ? "로그인하기" : "Login"}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="md:pt-16 max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-title mb-8">{ko ? "저장한 코스" : "Saved Trails"}</h1>
      <EmptyState
        title={ko ? "저장한 코스가 없습니다" : "No saved trails"}
        description={ko ? "오프라인에서 보고 싶은 코스를 저장해보세요!" : "Save trails to view them offline!"}
        action={
          <Link href="/explore" className="px-6 py-3 bg-primary text-white rounded-button font-medium">
            {ko ? "코스 탐색하기" : "Explore trails"}
          </Link>
        }
      />
    </div>
  );
}
