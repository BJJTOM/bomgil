"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { TrailCard } from "@/components/TrailCard";
import { ReviewCard } from "@/components/ReviewCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { User, Trail, Review, ActivityTrack } from "@/types";

type Tab = "trails" | "likes" | "reviews" | "activities";

export default function ProfilePage() {
  const { nickname } = useParams();
  const { user: me } = useAuthStore();
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
      <div className="md:pt-16 max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-6 mb-8">
          <Skeleton className="w-24 h-24 rounded-full" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
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
    <div className="md:pt-16 max-w-4xl mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="flex items-center gap-6 mb-8">
        <div className="w-24 h-24 rounded-full bg-accent/30 flex items-center justify-center overflow-hidden flex-shrink-0">
          {profile.profile_image ? (
            <Image
              src={profile.profile_image}
              alt={profile.nickname}
              width={96}
              height={96}
              className="object-cover"
            />
          ) : (
            <span className="text-4xl">👤</span>
          )}
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{profile.nickname}</h1>
            {profile.is_guide && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                인증 가이드
              </span>
            )}
          </div>
          {profile.bio && (
            <p className="text-text-secondary mt-1">{profile.bio}</p>
          )}
          {isMyProfile && (
            <Link
              href="/profile/edit"
              className="mt-3 inline-block px-4 py-2 bg-bg-secondary text-text-primary rounded-button text-[13px] font-medium hover:bg-border-light transition-colors"
            >
              프로필 수정
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="space-y-3">
              {activities.map((act: ActivityTrack) => (
                <Link key={act.id} href={`/activities/${act.id}`} className="card-hover p-4 block">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[14px] font-semibold">{act.title || "도보 기록"}</p>
                    <span className="chip text-[10px]">{act.source.replace("_", " ")}</span>
                  </div>
                  <div className="flex gap-4 text-[12px] text-text-secondary">
                    {act.distance_km && <span>{parseFloat(act.distance_km).toFixed(1)}km</span>}
                    {act.duration_minutes && <span>{Math.floor(act.duration_minutes / 60)}시간 {act.duration_minutes % 60}분</span>}
                    {act.total_steps && <span>{act.total_steps.toLocaleString()}걸음</span>}
                  </div>
                  <p className="text-[11px] text-text-tertiary mt-1">
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
            <div className="space-y-4">
              {reviews.map((review: Review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
