"use client";

import { Suspense, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTrails, usePopularTrails } from "@/hooks/useTrails";
import { TrailCard } from "@/components/TrailCard";
import { FilterBar } from "@/components/FilterBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrailCardSkeleton } from "@/components/ui/Skeleton";
import { useT } from "@/stores/language";
import type { Trail } from "@/types";

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: "#FAFAFA" }} />}>
      <ExploreContent />
    </Suspense>
  );
}

function ExploreContent() {
  const searchParams = useSearchParams();
  const { t } = useT();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("-like_count");

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
    { value: "-like_count", label: t("explore.sortPopular") },
    { value: "-created_at", label: t("explore.sortNewest") },
    { value: "distance_km", label: t("explore.sortDistanceShort") },
    { value: "-distance_km", label: t("explore.sortDistanceLong") },
  ];

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

  const queryParams = useMemo(() => {
    const params: Record<string, string> = { ordering: sortBy };
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params[k] = v;
    });
    if (search.trim()) params["search"] = search.trim();
    return params;
  }, [filters, sortBy, search]);

  const { data, isLoading } = useTrails(queryParams);
  const allTrails: Trail[] = data?.results ?? data ?? [];

  const { data: popularData } = usePopularTrails();
  const popularTrails: Trail[] = (popularData?.results ?? popularData ?? []).slice(0, 3);

  const trails = useMemo(() => {
    if (!search.trim()) return allTrails;
    const q = search.toLowerCase();
    return allTrails.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.region?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.country?.toLowerCase().includes(q)
    );
  }, [allTrails, search]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

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
  };

  const clearAllFilters = () => {
    setFilters({});
    setSearch("");
    setSortBy("-like_count");
  };

  const [activeTab, setActiveTab] = useState<"courses" | "rankings">("courses");

  return (
    <div className="md:pt-16 min-h-screen" style={{ backgroundColor: "#FAFAFA" }}>
      {/* Tabs + Search Header */}
      <div className="sticky top-0 md:top-[60px] z-30 bg-white/95 backdrop-blur-xl border-b border-[#F2F4F6]">
        <div className="max-w-5xl mx-auto px-5 pt-14 md:pt-3">
          {/* Tabs — 코스/랭킹 */}
          <div className="flex gap-6 mb-2">
            <button onClick={() => setActiveTab("courses")} className={`relative pb-2 text-[15px] font-medium ${activeTab === "courses" ? "text-gray-900 font-bold" : "text-gray-400"}`}>
              {t("explore.title")}
              {activeTab === "courses" && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 rounded-full" />}
            </button>
            <button onClick={() => setActiveTab("rankings")} className={`relative pb-2 text-[15px] font-medium ${activeTab === "rankings" ? "text-gray-900 font-bold" : "text-gray-400"}`}>
              {t("rankings.title")}
              {activeTab === "rankings" && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 rounded-full" />}
            </button>
          </div>
        </div>

        {activeTab === "courses" && <div className="max-w-5xl mx-auto px-5 pb-3 space-y-2.5">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("explore.searchPlaceholder")}
              className="w-full pl-10 pr-4 py-2.5 rounded-[12px] bg-[#F7F8FA] border-none text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2D4A2E]/20 placeholder:text-[#B0B8C1] transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#B0B8C1]/30 flex items-center justify-center"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter chips + sort */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-nowrap">
            <FilterBar
              filters={FILTER_CONFIG}
              selected={filters}
              onChange={handleFilterChange}
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
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
        </div>}
      </div>

      {activeTab === "rankings" && (
        <div className="max-w-5xl mx-auto px-5 py-5">
          <div className="text-center py-4">
            <a href="/rankings" className="inline-block px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors">
              {t("rankings.title")} {"\u2192"}
            </a>
          </div>
        </div>
      )}

      {activeTab === "courses" && <div className="max-w-5xl mx-auto px-5 py-5">
        {/* Trail count */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] text-[#8B95A1]">
            {isLoading
              ? t("explore.searching")
              : t("explore.found").replace("{count}", String(trails.length))}
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <TrailCardSkeleton key={i} />
            ))}
          </div>
        ) : trails.length === 0 ? (
          <div>
            <EmptyState
              title={t("explore.noResults")}
              description={t("explore.noResultsDesc")}
              action={
                <button
                  onClick={clearAllFilters}
                  className="px-5 py-2.5 bg-[#2D4A2E] text-white rounded-[14px] text-[13px] font-semibold"
                >
                  {t("explore.resetFilters")}
                </button>
              }
            />
            {popularTrails.length > 0 && (
              <div className="mt-8 max-w-xl mx-auto">
                <h3 className="text-[14px] font-bold text-gray-900 mb-3 px-1">
                  이런 코스는 어떠세요?
                </h3>
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
                        <div className="w-14 h-14 rounded-[10px] bg-[#F7F8FA] flex items-center justify-center flex-shrink-0">
                          <span className="text-[20px]">🥾</span>
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" strokeWidth="2">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {trails.map((trail) => (
              <div key={trail.id} id={`trail-${trail.id}`}>
                <TrailCard trail={trail} />
              </div>
            ))}
          </div>
        )}
      </div>}
    </div>
  );
}
