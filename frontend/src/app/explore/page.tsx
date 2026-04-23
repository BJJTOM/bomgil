"use client";

import { Suspense, useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  usePopularTrails,
} from "@/hooks/useTrails";
import { TrailCard } from "@/components/TrailCard";
import { FilterBar } from "@/components/FilterBar";
import { ExploreMap } from "@/components/ExploreMap";
import { Skeleton } from "@/components/ui/Skeleton";
import { useT } from "@/stores/language";
import api from "@/lib/api";
import type { Trail, User } from "@/types";
import Image from "next/image";

const ITEMS_PER_PAGE = 21;

// --- Skeleton Loading Component ---
function TrailCardSkeleton() {
  return (
    <div className="bg-white rounded-[16px] overflow-hidden shadow-sm">
      <div className="animate-pulse bg-gray-200 h-48 w-full" />
      <div className="p-4 space-y-3">
        <div className="animate-pulse bg-gray-200 rounded-md h-5 w-3/4" />
        <div className="animate-pulse bg-gray-200 rounded-md h-4 w-1/2" />
        <div className="flex gap-2 pt-1">
          <div className="animate-pulse bg-gray-200 rounded-full h-6 w-16" />
          <div className="animate-pulse bg-gray-200 rounded-full h-6 w-16" />
          <div className="animate-pulse bg-gray-200 rounded-full h-6 w-20" />
        </div>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <TrailCardSkeleton key={i} />
      ))}
    </div>
  );
}

// --- Empty State Component (multi-language) ---
const EMPTY_STATE_MESSAGES = {
  ko: {
    noFilterTitle: "베타 운영 중이라 코스가 아직 적어요",
    noFilterDesc: "첫 번째 코스를 등록해보세요!",
    filterTitle: "조건에 맞는 코스가 없어요",
    filterDesc: "다른 필터를 시도해보세요",
    ctaCreate: "코스 등록하기",
    ctaClear: "다른 인기 코스 보기",
    suggestion: "이런 코스는 어떠세요?",
  },
  en: {
    noFilterTitle: "Not many trails yet — we're in beta",
    noFilterDesc: "Be the first to register a trail!",
    filterTitle: "No trails match your filters",
    filterDesc: "Try different filters or keywords",
    ctaCreate: "Create a Trail",
    ctaClear: "View popular trails",
    suggestion: "How about these trails?",
  },
  ja: {
    noFilterTitle: "ベータ版のため、まだコースが少ないです",
    noFilterDesc: "最初のコースを登録してみましょう！",
    filterTitle: "条件に合うコースがありません",
    filterDesc: "別のフィルターをお試しください",
    ctaCreate: "コースを登録する",
    ctaClear: "人気コースを見る",
    suggestion: "こんなコースはいかがですか？",
  },
  zh: {
    noFilterTitle: "测试阶段，路线还比较少",
    noFilterDesc: "来注册第一条路线吧！",
    filterTitle: "没有符合条件的路线",
    filterDesc: "请尝试不同的筛选条件",
    ctaCreate: "注册路线",
    ctaClear: "查看热门路线",
    suggestion: "试试这些路线？",
  },
};

interface ExploreEmptyStateProps {
  hasActiveFilters: boolean;
  language: "ko" | "en" | "ja" | "zh";
  onClearFilters: () => void;
  popularTrails: Trail[];
}

function ExploreEmptyState({
  hasActiveFilters,
  language,
  onClearFilters,
  popularTrails,
}: ExploreEmptyStateProps) {
  const msg = EMPTY_STATE_MESSAGES[language] || EMPTY_STATE_MESSAGES.ko;

  return (
    <div className="flex flex-col items-center pt-12 pb-8 px-4">
      {/* Illustration */}
      <div className="w-20 h-20 rounded-full bg-[#F0F7F0] flex items-center justify-center mb-5">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2D4A2E"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 4v16" />
          <path d="M17 4v16" />
          <path d="M19 4H14.5a3.5 3.5 0 0 0 0 7h4a3.5 3.5 0 0 1 0 7H13" />
          <path d="M5 20l4-16" />
          <path d="M3 20h6" />
        </svg>
      </div>

      {/* Title & Description */}
      <h3 className="text-[18px] font-bold text-gray-900 mb-2 text-center leading-snug">
        {hasActiveFilters ? msg.filterTitle : msg.noFilterTitle}
      </h3>
      <p className="text-[14px] text-[#8B95A1] text-center mb-6 max-w-xs whitespace-pre-line">
        {hasActiveFilters ? msg.filterDesc : msg.noFilterDesc}
      </p>

      {/* CTA Buttons */}
      <div className="flex flex-col items-center gap-3">
        <Link
          href="/trails/new"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#2D4A2E] text-white rounded-[14px] text-[14px] font-semibold hover:bg-[#1F351F] transition-colors shadow-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {msg.ctaCreate}
        </Link>

        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-[13px] text-[#2D4A2E] font-medium hover:underline"
          >
            {msg.ctaClear}
          </button>
        )}
      </div>

      {/* Popular Trails Suggestion */}
      {popularTrails.length > 0 && (
        <div className="mt-10 w-full max-w-xl">
          <h4 className="text-[14px] font-bold text-gray-900 mb-3 px-1">
            {msg.suggestion}
          </h4>
          <div className="space-y-2">
            {popularTrails.map((trail) => (
              <Link
                key={trail.id}
                href={`/trails/${trail.id}`}
                className="flex items-center gap-3 bg-white rounded-[14px] p-3 border border-[#F2F4F6] hover:border-[#2D4A2E]/30 hover:shadow-sm transition-all"
              >
                {trail.cover_image ? (
                  <img
                    src={trail.cover_image}
                    alt=""
                    className="w-14 h-14 rounded-[10px] object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-[10px] bg-[#F0F7F0] flex items-center justify-center flex-shrink-0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2D4A2E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      <path d="M9 22V12h6v10" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-gray-900 truncate">
                    {trail.title}
                  </p>
                  <p className="text-[12px] text-[#8B95A1] truncate">
                    {trail.region || ""}
                    {trail.distance_km
                      ? ` · ${parseFloat(trail.distance_km).toFixed(1)}km`
                      : ""}
                  </p>
                </div>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#8B95A1"
                  strokeWidth="2"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Explore Page ---
export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="md:pt-16 min-h-screen" style={{ backgroundColor: "var(--c-warm)" }}>
          {/* Static HTML shell for SSR/crawlers */}
          <div className="sticky top-0 md:top-[60px] z-30 bg-white/95 backdrop-blur-xl border-b border-[#F2F4F6]">
            <div className="max-w-5xl mx-auto px-5 pt-14 md:pt-3">
              <div className="flex gap-4 mb-2 overflow-x-auto scrollbar-hide">
                <span className="relative pb-2 text-[15px] font-bold text-gray-900 whitespace-nowrap">
                  전체 코스
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 rounded-full" />
                </span>
                <span className="pb-2 text-[15px] font-medium text-gray-400 whitespace-nowrap">유저 코스</span>
                <span className="pb-2 text-[15px] font-medium text-gray-400 whitespace-nowrap">공식 코스</span>
                <span className="pb-2 text-[15px] font-medium text-gray-400 whitespace-nowrap">랭킹</span>
              </div>
            </div>
            <div className="max-w-5xl mx-auto px-5 pb-3 space-y-2.5">
              <div className="animate-pulse bg-gray-200 rounded-[12px] h-10 w-full" />
            </div>
          </div>
          <div className="max-w-5xl mx-auto px-5 py-5">
            <SkeletonGrid />
          </div>
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}

// AI Search placeholder text per language
const AI_SEARCH_PLACEHOLDERS: Record<string, string> = {
  ko: "어떤 코스를 찾고 계세요?",
  en: "What kind of trail are you looking for?",
  ja: "どんなコースをお探しですか？",
  zh: "您在找什么样的路线？",
};

const AI_SEARCH_LABELS: Record<string, string> = {
  ko: "AI 검색",
  en: "AI Search",
  ja: "AI検索",
  zh: "AI搜索",
};

// --- Rankings Sub-components (inlined from rankings page) ---

type RankingTab = "weekly" | "monthly" | "region" | "guides";

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

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-sm font-bold font-en">{rank}</span>;
}

function InlineRankings() {
  const { t } = useT();
  const [tab, setTab] = useState<RankingTab>("weekly");
  const [region, setRegion] = useState("\uC11C\uC6B8");

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
    { value: "\uC11C\uC6B8", label: t("region.seoul") },
    { value: "\uC81C\uC8FC", label: t("region.jeju") },
    { value: "\uAC15\uC6D0", label: t("region.gangwon") },
    { value: "\uBD80\uC0B0", label: t("region.busan") },
    { value: "\uC804\uB0A8", label: t("region.jeonnam") },
    { value: "\uACBD\uBD81", label: t("region.gyeongbuk") },
  ];

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
    <>
      <h2 className="text-xl font-bold mb-1">{t("rankings.title")}</h2>
      <p className="text-text-secondary text-sm mb-6">
        {t("rankings.subtitle")}
      </p>

      {/* Ranking sub-tabs */}
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

      {/* Trail rankings */}
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
    </>
  );
}

// --- Pagination Controls ---
function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 py-8">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className={`px-4 py-2 rounded-[12px] text-[14px] font-medium transition-colors ${
          currentPage <= 1
            ? "text-gray-300 cursor-not-allowed"
            : "text-gray-700 hover:bg-gray-100"
        }`}
      >
        &lt; 이전
      </button>
      <span className="text-[14px] font-semibold text-gray-700">
        {currentPage}/{totalPages}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={`px-4 py-2 rounded-[12px] text-[14px] font-medium transition-colors ${
          currentPage >= totalPages
            ? "text-gray-300 cursor-not-allowed"
            : "text-gray-700 hover:bg-gray-100"
        }`}
      >
        다음 &gt;
      </button>
    </div>
  );
}

function ExploreContent() {
  const searchParams = useSearchParams();
  const { t, language } = useT();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("-created_at");
  const [currentPage, setCurrentPage] = useState(1);

  // AI Search state
  const [aiMode, setAiMode] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResults, setAiResults] = useState<Trail[]>([]);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Check if AI search is available on mount
  useEffect(() => {
    api
      .get("/trails/ai-search/")
      .then((res) => setAiAvailable(res.data?.available === true))
      .catch(() => setAiAvailable(false));
  }, []);

  const handleAiSearch = useCallback(async () => {
    const q = aiQuery.trim();
    if (!q) return;
    setAiLoading(true);
    setAiSummary("");
    setAiResults([]);
    try {
      const { data } = await api.post("/trails/ai-search/", {
        query: q,
        language,
      });
      setAiResults(data.results || []);
      setAiSummary(data.search_summary || "");
    } catch {
      setAiSummary(
        language === "ko"
          ? "AI 검색에 실패했어요. 다시 시도해주세요."
          : "AI search failed. Please try again."
      );
      setAiResults([]);
    } finally {
      setAiLoading(false);
    }
  }, [aiQuery, language]);

  const FILTER_CONFIG = [
    {
      key: "country",
      label: t("explore.filterCountry"),
      options: [
        { value: "", label: t("explore.filterAll") },
        { value: "KR", label: `🇰🇷 ${t("country.KR")}` },
        { value: "JP", label: `🇯🇵 ${t("country.JP")}` },
        { value: "TW", label: "🇹🇼 Taiwan" },
        { value: "TH", label: "🇹🇭 Thailand" },
        { value: "US", label: `🇺🇸 ${t("country.US")}` },
        { value: "GB", label: "🇬🇧 UK" },
        { value: "FR", label: "🇫🇷 France" },
        { value: "ES", label: "🇪🇸 Spain" },
      ],
    },
    {
      key: "difficulty",
      label: t("explore.filterDifficulty"),
      options: [
        { value: "", label: t("explore.filterAll") },
        { value: "easy", label: t("explore.difficultyEasy") },
        { value: "moderate", label: t("explore.difficultyModerate") },
        { value: "hard", label: t("explore.difficultyHard") },
      ],
    },
    {
      key: "trail_type",
      label: t("explore.filterType"),
      options: [
        { value: "", label: t("explore.filterAll") },
        { value: "urban", label: t("explore.typeUrban") },
        { value: "coastal", label: t("explore.typeCoastal") },
        { value: "village", label: t("explore.typeVillage") },
        { value: "cultural", label: t("explore.typeCultural") },
        { value: "nature", label: t("explore.typeNature") },
        { value: "mixed", label: t("explore.typeMixed") },
      ],
    },
    {
      key: "best_season",
      label: t("explore.filterSeason"),
      options: [
        { value: "", label: t("explore.filterAll") },
        { value: "spring", label: t("season.spring") },
        { value: "summer", label: t("season.summer") },
        { value: "fall", label: t("season.fall") },
        { value: "winter", label: t("season.winter") },
        { value: "all", label: t("season.all") },
      ],
    },
  ];

  const SORT_OPTIONS = [
    { value: "-created_at", label: t("explore.sortNewest") },
    { value: "-like_count", label: t("explore.sortPopular") },
    { value: "distance_km", label: t("explore.sortDistanceShort") },
    { value: "-distance_km", label: t("explore.sortDistanceLong") },
  ];

  const [activeTab, setActiveTab] = useState<"all" | "user" | "official" | "rankings">("all");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    FILTER_CONFIG.forEach((f) => {
      const val = searchParams.get(f.key);
      if (val) initial[f.key] = val;
    });
    const region = searchParams.get("region");
    if (region) initial["region"] = region;
    return initial;
  });

  // Build query params for API (with pagination)
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      ordering: sortBy,
      limit: String(ITEMS_PER_PAGE),
      offset: String((currentPage - 1) * ITEMS_PER_PAGE),
    };
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params[k] = v;
    });
    if (search.trim()) params["search"] = search.trim();
    // Tab-based is_official filter
    if (activeTab === "user") params["is_official"] = "false";
    else if (activeTab === "official") params["is_official"] = "true";
    return params;
  }, [filters, sortBy, search, currentPage, activeTab]);

  // Use standard query with keepPreviousData for smooth page transitions
  const queryClient = useQueryClient();
  const { data: trailsData, isLoading, isPlaceholderData } = useQuery<{
    count: number;
    results: Trail[];
    next?: string | null;
    previous?: string | null;
  }>({
    queryKey: ["trails", "paginated", queryParams],
    queryFn: async () => {
      const { data } = await api.get("/trails/", { params: queryParams });
      return data;
    },
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const trails: Trail[] = trailsData?.results ?? [];
  const totalCount = trailsData?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  // Prefetch next page
  useEffect(() => {
    if (currentPage < totalPages) {
      const nextParams = { ...queryParams, offset: String(currentPage * ITEMS_PER_PAGE) };
      queryClient.prefetchQuery({
        queryKey: ["trails", "paginated", nextParams],
        queryFn: async () => {
          const { data } = await api.get("/trails/", { params: nextParams });
          return data;
        },
        staleTime: 60_000,
      });
    }
  }, [currentPage, totalPages, queryParams, queryClient]);

  // Prefetch other tabs' first page so tab switching feels instant
  useEffect(() => {
    const tabConfigs = [
      { tab: "all", is_official: undefined },
      { tab: "user", is_official: "false" },
      { tab: "official", is_official: "true" },
    ];
    tabConfigs.forEach(({ tab, is_official }) => {
      if (tab === activeTab) return;
      const prefetchParams: Record<string, string> = {
        ordering: sortBy,
        limit: String(ITEMS_PER_PAGE),
        offset: "0",
      };
      if (is_official !== undefined) prefetchParams["is_official"] = is_official;
      queryClient.prefetchQuery({
        queryKey: ["trails", "paginated", prefetchParams],
        queryFn: async () => {
          const { data } = await api.get("/trails/", { params: prefetchParams });
          return data;
        },
        staleTime: 60_000,
      });
    });
  // Only prefetch once on mount and when sortBy changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]);

  const { data: popularData } = usePopularTrails();
  const popularTrails: Trail[] = (popularData?.results ?? popularData ?? []).slice(0, 3);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Reset to page 1 when filters, search, or sort change
  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value) {
        next[key] = value;
      } else {
        delete next[key];
      }
      return next;
    });
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setFilters({});
    setSearch("");
    setSortBy("-created_at");
    setCurrentPage(1);
  };

  // Reset page when search or sort changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    setCurrentPage(1);
  };

  const handleTabChange = (tab: "all" | "user" | "official" | "rankings") => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const isTrailsTab = activeTab === "all" || activeTab === "user" || activeTab === "official";

  // Total count label
  const totalCountLabel = useMemo(() => {
    if (isLoading) return t("explore.searching");
    const unit = language === "ko" ? "개 코스" : language === "ja" ? "件のコース" : language === "zh" ? "条路线" : " trails";
    return `${language === "ko" ? "총 " : ""}${totalCount}${unit}`;
  }, [isLoading, totalCount, language, t]);

  return (
    <div className="md:pt-16 min-h-screen" style={{ backgroundColor: "var(--c-warm)" }}>
      {/* Tabs + Search Header */}
      <div className="sticky top-0 md:top-[60px] z-30 bg-white/95 backdrop-blur-xl border-b border-[#F2F4F6]">
        <div className="max-w-5xl mx-auto px-5 pt-14 md:pt-3">
          {/* Tabs */}
          <div className="flex gap-4 mb-2 overflow-x-auto scrollbar-hide">
            {([
              { key: "all" as const, label: t("explore.tabAll") },
              { key: "user" as const, label: t("explore.tabUser") },
              { key: "official" as const, label: t("explore.tabOfficial") },
              { key: "rankings" as const, label: t("explore.tabRankings") },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`relative pb-2 text-[15px] font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.key ? "text-gray-900 font-bold" : "text-gray-400"
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {isTrailsTab && <div className="max-w-5xl mx-auto px-5 pb-3 space-y-2.5">
          {/* Region quick-filters */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {[
              { value: "서울", label: "서울", color: "#6B7280" },
              { value: "경기", label: "경기", color: "#22C55E" },
              { value: "인천", label: "인천", color: "#0EA5E9" },
              { value: "강원", label: "강원", color: "#8B5CF6" },
              { value: "충청", label: "충청", color: "#10B981" },
              { value: "경상", label: "경상", color: "#0284C7" },
              { value: "전라", label: "전라", color: "#D97706" },
              { value: "제주", label: "제주", color: "#F97316" },
            ].map((r) => {
              const isActive = filters["region"] === r.value;
              return (
                <button
                  key={r.value}
                  onClick={() => handleFilterChange("region", isActive ? "" : r.value)}
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                    isActive
                      ? "bg-[#2D4A2E] text-white"
                      : "bg-[#F0F7F0] text-[#2D4A2E] hover:bg-[#E5EFE5]"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: isActive ? "#fff" : r.color }} />
                  <span>{r.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search + AI Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              {aiMode ? (
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6C5CE7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
                </svg>
              ) : (
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-tertiary)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              )}
              <input
                type="text"
                value={aiMode ? aiQuery : search}
                onChange={(e) =>
                  aiMode ? setAiQuery(e.target.value) : handleSearchChange(e.target.value)
                }
                onKeyDown={(e) => {
                  if (aiMode && e.key === "Enter") {
                    e.preventDefault();
                    handleAiSearch();
                  }
                }}
                placeholder={
                  aiMode
                    ? AI_SEARCH_PLACEHOLDERS[language] || AI_SEARCH_PLACEHOLDERS.ko
                    : t("explore.searchPlaceholder")
                }
                aria-label={aiMode ? "AI search" : t("explore.searchPlaceholder")}
                className={`w-full pl-10 pr-4 py-2.5 rounded-[12px] border-none text-[13px] focus:outline-none focus:ring-2 placeholder:text-[#B0B8C1] transition-all ${
                  aiMode
                    ? "bg-[#F0F0FF] focus:ring-[#6C5CE7]/20"
                    : "bg-[#F7F8FA] focus:ring-[#2D4A2E]/20"
                }`}
              />
              {(aiMode ? aiQuery : search) && (
                <button
                  onClick={() => (aiMode ? setAiQuery("") : handleSearchChange(""))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#B0B8C1]/30 flex items-center justify-center"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
            {/* AI toggle button -- only shown when AI is available */}
            {aiAvailable && (
              <button
                onClick={() => {
                  setAiMode(!aiMode);
                  setAiResults([]);
                  setAiSummary("");
                  setAiQuery("");
                }}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-[12px] text-[12px] font-semibold transition-all ${
                  aiMode
                    ? "bg-purple-500 text-white shadow-[0_0_12px_rgba(108,92,231,0.5)] animate-pulse-slow"
                    : "bg-[#F7F8FA] text-[#8B95A1] hover:bg-[#EEF0F4]"
                }`}
                style={aiMode ? { animation: 'ai-glow 2s ease-in-out infinite' } : undefined}
                title={AI_SEARCH_LABELS[language] || AI_SEARCH_LABELS.ko}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
                </svg>
                <span>{AI_SEARCH_LABELS[language] || AI_SEARCH_LABELS.ko}</span>
              </button>
            )}
          </div>

          {/* Filter chips + sort (hidden in AI mode) */}
          {!aiMode && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-nowrap">
              <FilterBar
                filters={FILTER_CONFIG}
                selected={filters}
                onChange={handleFilterChange}
              />
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="flex-shrink-0 text-[12px] bg-[#F7F8FA] border-none rounded-[20px] px-3 py-1.5 font-medium text-[#8B95A1] focus:outline-none appearance-none cursor-pointer"
                style={{ WebkitAppearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23B0B8C1' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: "28px" }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="flex-shrink-0 text-[11px] text-[#2D4A2E] font-medium whitespace-nowrap"
                >
                  {t("common.reset")}
                </button>
              )}
            </div>
          )}

          {/* AI mode hint */}
          {aiMode && (
            <p className="text-[11px] text-[#8B95A1] pl-1">
              {language === "ko"
                ? "예: \"서울 근처 가을에 좋은 쉬운 코스\", \"조용한 해안길 3km 이하\""
                : language === "ja"
                  ? "例: \"東京近くの簡単なコース\", \"海岸沿いの3km以下のコース\""
                  : language === "zh"
                    ? "例: \"首尔附近简单的路线\", \"海边3公里以下的路线\""
                    : "e.g. \"easy coastal trail under 3km\", \"autumn trails near Seoul\""}
            </p>
          )}
        </div>}
      </div>

      {/* Rankings tab - inline content */}
      {activeTab === "rankings" && (
        <div className="max-w-4xl mx-auto px-5 py-8">
          <InlineRankings />
        </div>
      )}

      {isTrailsTab && <div className="max-w-5xl mx-auto px-5 py-5">
        {/* AI search results */}
        {aiMode ? (
          <>
            {/* AI search summary */}
            {aiSummary && (
              <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-[12px] bg-[#F0F0FF] border border-[#E0DFFF]">
                <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6C5CE7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
                </svg>
                <p className="text-[13px] text-[#4A4A6A] font-medium leading-relaxed">{aiSummary}</p>
              </div>
            )}

            {aiLoading ? (
              <SkeletonGrid />
            ) : aiResults.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] text-[#8B95A1]">
                    {t("explore.found").replace("{count}", String(aiResults.length))}
                  </p>
                </div>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {aiResults.map((trail) => (
                    <div key={trail.id} id={`trail-${trail.id}`}>
                      <TrailCard trail={trail} />
                    </div>
                  ))}
                </div>
              </>
            ) : aiQuery.trim() && !aiLoading ? (
              <ExploreEmptyState
                hasActiveFilters={true}
                language={language}
                onClearFilters={() => { setAiQuery(""); setAiResults([]); setAiSummary(""); }}
                popularTrails={popularTrails}
              />
            ) : (
              <div className="flex flex-col items-center pt-16 pb-8 text-center">
                <div className="w-16 h-16 rounded-full bg-[#F0F0FF] flex items-center justify-center mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6C5CE7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
                  </svg>
                </div>
                <h3 className="text-[16px] font-bold text-gray-900 mb-2">
                  {language === "ko"
                    ? "자연스럽게 말해보세요"
                    : language === "ja"
                      ? "自然に話してみてください"
                      : language === "zh"
                        ? "用自然语言搜索"
                        : "Search in natural language"}
                </h3>
                <p className="text-[13px] text-[#8B95A1] max-w-xs">
                  {language === "ko"
                    ? "원하는 코스를 자유롭게 설명해보세요. AI가 맞는 코스를 찾아드려요."
                    : language === "ja"
                      ? "お探しのコースを自由に説明してください。AIがぴったりのコースを見つけます。"
                      : language === "zh"
                        ? "自由描述您想要的路线，AI会帮您找到合适的路线。"
                        : "Describe the trail you want in your own words. AI will find the best match."}
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Regular search results */}
            {/* Trail count + view toggle */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] text-[#8B95A1]">
                {totalCountLabel}
              </p>

              {/* List / Map toggle */}
              <div className="flex rounded-pill overflow-hidden border border-[#F2F4F6] shadow-soft">
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                    viewMode === "list"
                      ? "bg-primary text-white"
                      : "bg-surface text-text-secondary hover:bg-[#F7F8FA]"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  {t("explore.viewList")}
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                    viewMode === "map"
                      ? "bg-primary text-white"
                      : "bg-surface text-text-secondary hover:bg-[#F7F8FA]"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                    <line x1="8" y1="2" x2="8" y2="18" />
                    <line x1="16" y1="6" x2="16" y2="22" />
                  </svg>
                  {t("explore.viewMap")}
                </button>
              </div>
            </div>

            {isLoading ? (
              <SkeletonGrid />
            ) : trails.length === 0 ? (
              <ExploreEmptyState
                hasActiveFilters={activeFilterCount > 0 || !!search.trim()}
                language={language}
                onClearFilters={clearAllFilters}
                popularTrails={popularTrails}
              />
            ) : viewMode === "list" ? (
              <>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {trails.map((trail) => (
                    <div key={trail.id} id={`trail-${trail.id}`}>
                      <TrailCard trail={trail} />
                    </div>
                  ))}
                </div>
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </>
            ) : (
              <>
                <ExploreMap trails={trails} />
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </>
        )}
      </div>}
    </div>
  );
}
