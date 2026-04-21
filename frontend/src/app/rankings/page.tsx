"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { TrailCard } from "@/components/TrailCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useT } from "@/stores/language";
import type { Trail, User } from "@/types";
import Image from "next/image";
import Link from "next/link";

type RankingTab = "weekly" | "monthly" | "region" | "guides";

/* ─── Skeleton Components ─── */

function RankingItemSkeleton() {
  return (
    <div className="flex items-start gap-4">
      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
      <div className="flex-1 bg-white rounded-card shadow-soft overflow-hidden">
        <div className="flex gap-3 p-4">
          <Skeleton className="w-20 h-20 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GuideItemSkeleton() {
  return (
    <div className="flex items-center gap-4 bg-white rounded-card shadow-soft p-4">
      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
      <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

/* ─── Empty State Component ─── */

function RankingEmptyState({
  icon,
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  icon: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-bold text-text-primary mb-2">{title}</h3>
      <p className="text-text-secondary text-sm mb-6 max-w-sm">{description}</p>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary/90 transition-colors"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

/* ─── Rank Badge ─── */

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-sm font-bold font-en">{rank}</span>;
}

/* ─── Main Page ─── */

export default function RankingsPage() {
  const { t } = useT();
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
    { key: "weekly" as const, label: t("rankings.weekly") },
    { key: "monthly" as const, label: t("rankings.monthly") },
    { key: "region" as const, label: t("rankings.region") },
    { key: "guides" as const, label: t("rankings.guides") },
  ];

  const REGIONS = [
    { value: "서울", label: t("region.seoul") },
    { value: "제주", label: t("region.jeju") },
    { value: "강원", label: t("region.gangwon") },
    { value: "부산", label: t("region.busan") },
    { value: "전남", label: t("region.jeonnam") },
    { value: "경북", label: t("region.gyeongbuk") },
  ];

  // Determine current loading / data state
  const isTrailTab = tab === "weekly" || tab === "monthly" || tab === "region";
  const currentLoading = tab === "weekly"
    ? weeklyLoading
    : tab === "monthly"
    ? monthlyLoading
    : tab === "region"
    ? regionLoading
    : guidesLoading;

  const currentTrails = tab === "weekly"
    ? weeklyTrails
    : tab === "monthly"
    ? monthlyTrails
    : regionTrails;

  return (
    <div className="md:pt-16 max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-title mb-2">{t("rankings.title")}</h1>
      <p className="text-text-secondary text-sm mb-8">
        {t("rankings.subtitle")}
      </p>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto scrollbar-hide">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`relative px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === tb.key
                ? "text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tb.label}
            {tab === tb.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Region selector */}
      {tab === "region" && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {REGIONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setRegion(r.value)}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                region === r.value
                  ? "bg-primary text-white"
                  : "bg-white text-text-primary border border-gray-200 hover:border-primary/50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* Trail rankings (weekly / monthly / region) */}
      {isTrailTab && (
        <div className="space-y-4">
          {currentLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <RankingItemSkeleton key={i} />
            ))
          ) : currentTrails.length === 0 ? (
            <RankingEmptyState
              icon="🏃‍♂️"
              title={
                tab === "weekly"
                  ? t("rankings.emptyWeeklyTitle")
                  : tab === "monthly"
                  ? t("rankings.emptyMonthlyTitle")
                  : t("rankings.emptyRegionTitle")
              }
              description={
                tab === "weekly"
                  ? t("rankings.emptyWeeklyDesc")
                  : tab === "monthly"
                  ? t("rankings.emptyMonthlyDesc")
                  : t("rankings.emptyRegionDesc")
              }
              ctaLabel={t("rankings.startRecording")}
              ctaHref="/activities"
            />
          ) : (
            currentTrails.map((trail, index) => (
              <div key={trail.id} className="flex items-start gap-4">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    index < 3
                      ? "bg-primary/10"
                      : "bg-gray-100 text-text-secondary"
                  }`}
                >
                  <RankBadge rank={index + 1} />
                </div>
                <div className="flex-1 min-w-0">
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
            Array.from({ length: 8 }).map((_, i) => (
              <GuideItemSkeleton key={i} />
            ))
          ) : guides.length === 0 ? (
            <RankingEmptyState
              icon="🧭"
              title={t("rankings.emptyGuidesTitle")}
              description={t("rankings.emptyGuidesDesc")}
              ctaLabel={t("rankings.registerTrail")}
              ctaHref="/trails/new"
            />
          ) : (
            guides.map((guide, index) => (
              <div
                key={guide.id}
                className="flex items-center gap-4 bg-white rounded-card shadow-soft p-4"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    index < 3
                      ? "bg-primary/10"
                      : "bg-gray-100 text-text-secondary"
                  }`}
                >
                  <RankBadge rank={index + 1} />
                </div>
                <div className="w-12 h-12 rounded-full bg-accent/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {guide.profile_image ? (
                    <Image
                      src={guide.profile_image}
                      alt={guide.nickname}
                      width={48}
                      height={48}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <span className="text-xl">👤</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{guide.nickname}</p>
                  <p className="text-xs text-text-secondary">
                    {t("rankings.trails")} {guide.trail_count || 0} · {t("rankings.totalLikes")}{" "}
                    {guide.total_likes || 0}
                  </p>
                </div>
                {guide.is_guide && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                    {t("trail.certifiedGuide")}
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
