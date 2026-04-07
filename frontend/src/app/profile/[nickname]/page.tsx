"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { TrailCard } from "@/components/TrailCard";
import { ReviewCard } from "@/components/ReviewCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { WALKING_STYLE_LABELS } from "@/lib/utils";
import type { User, Trail, Review, ActivityTrack } from "@/types";

const BADGE_CONFIG: Record<string, { emoji: string; label: string }> = {
  verified: { emoji: "✓", label: "본인 인증" },
  trusted: { emoji: "🛡️", label: "신뢰 동행자" },
  first_walk: { emoji: "🌱", label: "첫 걸음" },
  companion_10: { emoji: "🤝", label: "10회 동행" },
  popular: { emoji: "⭐", label: "인기 동행자" },
  trail_creator: { emoji: "🗺️", label: "코스 개척자" },
  storyteller: { emoji: "📝", label: "스토리텔러" },
  walker_10km: { emoji: "🚶", label: "10km 달성" },
  walker_50km: { emoji: "🏃", label: "50km 달성" },
  walker_100km: { emoji: "🏅", label: "100km 달성" },
  early_bird: { emoji: "🌅", label: "얼리버드" },
  night_walker: { emoji: "🌙", label: "야간 산책러" },
  global_walker: { emoji: "🌏", label: "글로벌 워커" },
  photo_lover: { emoji: "📸", label: "사진 매니아" },
  food_explorer: { emoji: "🍜", label: "맛집 탐험가" },
};

type Tab = "trails" | "likes" | "reviews" | "activities";

export default function ProfilePage() {
  const { nickname } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { user: me, isAuthenticated } = useAuthStore();
  const isMyProfile = me?.nickname === nickname;
  const [activeTab, setActiveTab] = useState<Tab>("trails");

  const { data: profile, isLoading } = useQuery<User>({
    queryKey: ["user-profile", nickname],
    queryFn: async () => {
      const { data } = await api.get(`/auth/users/${nickname}/`);
      return data;
    },
  });

  const { data: trails = [] } = useQuery<Trail[]>({
    queryKey: ["user-trails", nickname],
    queryFn: async () => {
      const { data } = await api.get(`/auth/users/${nickname}/trails/`);
      return data.results ?? data;
    },
    enabled: activeTab === "trails",
  });

  const { data: likedTrails = [] } = useQuery<Trail[]>({
    queryKey: ["user-likes"],
    queryFn: async () => {
      const { data } = await api.get("/auth/me/likes/");
      return data.results ?? data;
    },
    enabled: activeTab === "likes" && isMyProfile,
  });

  const { data: reviews = [] } = useQuery<Review[]>({
    queryKey: ["user-reviews", nickname],
    queryFn: async () => {
      const { data } = await api.get(`/auth/users/${nickname}/reviews/`);
      return data.results ?? data;
    },
    enabled: activeTab === "reviews",
  });

  const { data: activities = [] } = useQuery<ActivityTrack[]>({
    queryKey: ["user-activities", nickname],
    queryFn: async () => {
      const { data } = await api.get(`/activities/users/${nickname}/`);
      return data.results ?? data;
    },
    enabled: activeTab === "activities",
  });

  if (isLoading) {
    return (
      <div className="md:pt-16 max-w-2xl mx-auto px-5 py-8">
        <div className="flex flex-col items-center gap-4 mb-8">
          <Skeleton className="w-20 h-20 rounded-full" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="md:pt-16 flex items-center justify-center min-h-screen">
        <EmptyState title="유저를 찾을 수 없습니다" />
      </div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "trails", label: `코스 ${profile.trail_count || 0}` },
    { key: "activities", label: "활동" },
    ...(isMyProfile ? [{ key: "likes" as Tab, label: "좋아요" }] : []),
    { key: "reviews", label: `리뷰 ${profile.review_count || 0}` },
  ];

  return (
    <div className="md:pt-16 min-h-screen" style={{ backgroundColor: "#FAFAFA" }}>
      <div className="max-w-2xl mx-auto">
        {/* Profile Header — Instagram style */}
        <div className="bg-white px-5 pt-8 pb-5 text-center">
          {/* Centered avatar with ring */}
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#A8E6CF] to-[#2D4A2E] p-[3px]">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
              {profile.profile_image ? (
                <Image
                  src={profile.profile_image}
                  alt={profile.nickname}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl">👤</span>
              )}
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-[22px] font-bold text-[#191F28]">{profile.nickname}</h1>
              {profile.is_guide && (
                <span className="text-[11px] bg-[#f0f7f0] text-[#2D4A2E] px-2 py-0.5 rounded-[20px] font-medium">
                  인증 가이드
                </span>
              )}
            </div>

            {profile.one_liner && (
              <p className="text-[14px] text-[#8B95A1] mt-0.5">{profile.one_liner}</p>
            )}

            {profile.bio && (
              <p className="text-[14px] text-[#8B95A1] mt-1 max-w-sm mx-auto">{profile.bio}</p>
            )}

            {profile.walking_style && WALKING_STYLE_LABELS[profile.walking_style] && (
              <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-[#F7F8FA] rounded-[20px] text-[12px] font-medium text-[#8B95A1]">
                {WALKING_STYLE_LABELS[profile.walking_style].emoji} {WALKING_STYLE_LABELS[profile.walking_style].label}
              </span>
            )}
          </div>

          {/* 3-column stats */}
          <div className="flex items-center justify-center mt-4">
            <div className="flex-1 text-center py-2">
              <p className="text-[18px] font-bold text-[#191F28]">{profile.trail_count || 0}</p>
              <p className="text-[11px] text-[#B0B8C1]">코스</p>
            </div>
            <div className="w-px h-8 bg-[#F2F4F6]" />
            <div className="flex-1 text-center py-2">
              <p className="text-[18px] font-bold text-[#191F28]">{profile.total_walks || 0}</p>
              <p className="text-[11px] text-[#B0B8C1]">동행</p>
            </div>
            <div className="w-px h-8 bg-[#F2F4F6]" />
            <div className="flex-1 text-center py-2">
              <p className="text-[18px] font-bold text-[#191F28]">{profile.review_count || 0}</p>
              <p className="text-[11px] text-[#B0B8C1]">리뷰</p>
            </div>
          </div>

          {/* Badges */}
          {profile.badges && profile.badges.length > 0 && (
            <div className="flex gap-1.5 mt-3 flex-wrap justify-center">
              {profile.badges.map((badge: any) => (
                <span key={badge.badge_type} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#f0f7f0] rounded-[20px] text-[11px] font-medium text-[#2D4A2E]">
                  {BADGE_CONFIG[badge.badge_type]?.emoji || "🏅"} {BADGE_CONFIG[badge.badge_type]?.label || badge.badge_type}
                </span>
              ))}
            </div>
          )}

          {isMyProfile ? (
            <Link
              href="/profile/edit"
              className="mt-3 inline-block w-full max-w-[200px] py-2 bg-[#F7F8FA] text-[#191F28] rounded-[14px] text-[13px] font-medium hover:bg-[#E5E8EB] transition-colors"
            >
              프로필 수정
            </Link>
          ) : (
            <button
              onClick={async () => {
                if (!isAuthenticated) { router.push("/auth/login"); return; }
                try {
                  await api.post(`/auth/users/${nickname}/follow/`);
                  qc.invalidateQueries({ queryKey: ["profile", nickname] });
                } catch {}
              }}
              className={`mt-3 w-full max-w-[200px] py-2.5 rounded-[14px] text-[13px] font-semibold transition-colors ${
                (profile as any).is_following
                  ? "bg-[#F7F8FA] text-[#8B95A1] hover:bg-[#E5E8EB]"
                  : "bg-[#2D4A2E] text-white hover:bg-[#1a3a1b]"
              }`}
            >
              {(profile as any).is_following ? "팔로잉" : "팔로우"}
            </button>
          )}
        </div>

        {/* Clean tab bar */}
        <div className="flex bg-white border-b border-[#F2F4F6] sticky top-0 md:top-[60px] z-20">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-[13px] font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-[#191F28] text-[#191F28]"
                  : "border-transparent text-[#B0B8C1]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="px-5 py-4">
          {activeTab === "trails" && (
            <div>
              {trails.length === 0 ? (
                <EmptyState
                  title="등록한 코스가 없습니다"
                  description={
                    isMyProfile ? "첫 번째 코스를 등록해보세요!" : undefined
                  }
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {trails.map((trail: Trail) => (
                    <TrailCard key={trail.id} trail={trail} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "likes" && isMyProfile && (
            <div>
              {likedTrails.length === 0 ? (
                <EmptyState
                  title="좋아요한 코스가 없습니다"
                  description="마음에 드는 코스에 좋아요를 눌러보세요!"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {likedTrails.map((trail: Trail) => (
                    <TrailCard key={trail.id} trail={trail} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "activities" && (
            <div>
              {activities.length === 0 ? (
                <EmptyState
                  title="활동 기록이 없습니다"
                  description={isMyProfile ? "도보 활동을 기록해보세요!" : undefined}
                />
              ) : (
                <div className="space-y-2">
                  {activities.map((act: ActivityTrack) => (
                    <Link key={act.id} href={`/activities/${act.id}`} className="block bg-white rounded-[16px] border border-[#E5E8EB] p-4 hover:shadow-card transition-shadow">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[14px] font-semibold text-[#191F28]">{act.title || "도보 기록"}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[20px] text-[10px] font-medium bg-[#F7F8FA] text-[#8B95A1]">{act.source.replace("_", " ")}</span>
                      </div>
                      <div className="flex gap-4 text-[12px] text-[#8B95A1]">
                        {act.distance_km && <span>{parseFloat(act.distance_km).toFixed(1)}km</span>}
                        {act.duration_minutes && <span>{Math.floor(act.duration_minutes / 60)}시간 {act.duration_minutes % 60}분</span>}
                        {act.total_steps && <span>{act.total_steps.toLocaleString()}걸음</span>}
                      </div>
                      <p className="text-[11px] text-[#B0B8C1] mt-1">
                        {new Date(act.created_at).toLocaleDateString("ko", { month: "long", day: "numeric" })}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "reviews" && (
            <div>
              {reviews.length === 0 ? (
                <EmptyState title="작성한 리뷰가 없습니다" />
              ) : (
                <div className="space-y-3">
                  {reviews.map((review: Review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
