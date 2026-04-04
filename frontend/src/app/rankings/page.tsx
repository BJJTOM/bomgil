"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { TrailCard } from "@/components/TrailCard";
import { TrailCardSkeleton } from "@/components/ui/Skeleton";
import type { Trail, User } from "@/types";
import Image from "next/image";

type RankingTab = "weekly" | "monthly" | "region" | "guides";

export default function RankingsPage() {
  const [tab, setTab] = useState<RankingTab>("weekly");
  const [region, setRegion] = useState("서울");

  const { data: weeklyTrails = [], isLoading: weeklyLoading } = useQuery<Trail[]>({
    queryKey: ["rankings", "weekly"],
    queryFn: async () => (await api.get("/trails/rankings/weekly/")).data,
    enabled: tab === "weekly",
  });

  const { data: monthlyTrails = [], isLoading: monthlyLoading } = useQuery<Trail[]>({
    queryKey: ["rankings", "monthly"],
    queryFn: async () => (await api.get("/trails/rankings/monthly/")).data,
    enabled: tab === "monthly",
  });

  const { data: regionTrails = [], isLoading: regionLoading } = useQuery<Trail[]>({
    queryKey: ["rankings", "region", region],
    queryFn: async () =>
      (await api.get(`/trails/rankings/region/?region=${region}`)).data,
    enabled: tab === "region",
  });

  const { data: guides = [], isLoading: guidesLoading } = useQuery<
    (User & { total_likes?: number })[]
  >({
    queryKey: ["rankings", "guides"],
    queryFn: async () => (await api.get("/trails/rankings/guides/")).data,
    enabled: tab === "guides",
  });

  const TABS = [
    { key: "weekly" as const, label: "주간 인기" },
    { key: "monthly" as const, label: "월간 인기" },
    { key: "region" as const, label: "지역별" },
    { key: "guides" as const, label: "인기 가이드" },
  ];

  const REGIONS = ["서울", "제주", "강원", "부산", "전남", "경북"];

  return (
    <div className="md:pt-16 max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-title mb-2">랭킹</h1>
      <p className="text-text-secondary text-sm mb-8">
        가장 사랑받는 코스와 가이드를 만나보세요
      </p>

      {/* Tabs */}
      <div className="flex border-b mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Region selector */}
      {tab === "region" && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                region === r
                  ? "bg-primary text-white"
                  : "bg-white text-text-primary border border-gray-200"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Trail rankings */}
      {(tab === "weekly" || tab === "monthly" || tab === "region") && (
        <div className="space-y-4">
          {(tab === "weekly" ? weeklyLoading : tab === "monthly" ? monthlyLoading : regionLoading) ? (
            Array.from({ length: 5 }).map((_, i) => <TrailCardSkeleton key={i} />)
          ) : (
            (tab === "weekly"
              ? weeklyTrails
              : tab === "monthly"
              ? monthlyTrails
              : regionTrails
            ).map((trail, index) => (
              <div key={trail.id} className="flex items-start gap-4">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold font-en text-sm flex-shrink-0 ${
                    index < 3
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-text-secondary"
                  }`}
                >
                  {index + 1}
                </div>
                <div className="flex-1">
                  <TrailCard trail={trail} variant="horizontal" />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Guides ranking */}
      {tab === "guides" && (
        <div className="space-y-4">
          {guidesLoading ? (
            <div className="text-center py-8 text-text-secondary">불러오는 중...</div>
          ) : (
            guides.map((guide, index) => (
              <div
                key={guide.id}
                className="flex items-center gap-4 bg-white rounded-card shadow-soft p-4"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold font-en text-sm flex-shrink-0 ${
                    index < 3
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-text-secondary"
                  }`}
                >
                  {index + 1}
                </div>
                <div className="w-12 h-12 rounded-full bg-accent/30 flex items-center justify-center overflow-hidden">
                  {guide.profile_image ? (
                    <Image
                      src={guide.profile_image}
                      alt={guide.nickname}
                      width={48}
                      height={48}
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-xl">👤</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-bold">{guide.nickname}</p>
                  <p className="text-xs text-text-secondary">
                    코스 {guide.trail_count || 0}개 · 총 좋아요{" "}
                    {guide.total_likes || 0}
                  </p>
                </div>
                {guide.is_guide && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    인증 가이드
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
