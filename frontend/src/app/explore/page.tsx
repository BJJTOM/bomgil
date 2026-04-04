"use client";

import { Suspense, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useTrails } from "@/hooks/useTrails";
import { TrailCard } from "@/components/TrailCard";
import { FilterBar } from "@/components/FilterBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrailCardSkeleton } from "@/components/ui/Skeleton";
import { useT } from "@/stores/language";
import type { Trail } from "@/types";

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-warm" />}>
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

  return (
    <div className="md:pt-16 min-h-screen bg-warm">
      {/* Search & Filters Header */}
      <div className="sticky top-0 md:top-[60px] z-30 bg-white/95 backdrop-blur-xl border-b border-border-light">
        <div className="max-w-7xl mx-auto px-5 py-3 space-y-3">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("explore.searchPlaceholder")}
              className="w-full pl-10 pr-4 py-2.5 rounded-pill bg-bg-secondary border-none text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-text-tertiary transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-text-tertiary/30 flex items-center justify-center"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Single row: filters + sort + map toggle — horizontal scroll */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-nowrap">
            <FilterBar
              filters={FILTER_CONFIG}
              selected={filters}
              onChange={handleFilterChange}
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex-shrink-0 text-[12px] bg-bg-secondary border-none rounded-pill px-3 py-1.5 font-medium text-text-secondary focus:outline-none appearance-none cursor-pointer"
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
                className="flex-shrink-0 text-[11px] text-primary font-medium whitespace-nowrap"
              >
                {t("common.reset")}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-6">
          {/* Trail count */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] text-text-secondary">
              {isLoading
                ? t("explore.searching")
                : t("explore.found").replace("{count}", String(trails.length))}
            </p>
          </div>

          {isLoading ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <TrailCardSkeleton key={i} />
              ))}
            </div>
          ) : trails.length === 0 ? (
            <EmptyState
              title={t("explore.noResults")}
              description={t("explore.noResultsDesc")}
              action={
                <button
                  onClick={clearAllFilters}
                  className="btn-primary px-6 py-3 text-[13px]"
                >
                  {t("explore.resetFilters")}
                </button>
              }
            />
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {trails.map((trail) => (
                <div key={trail.id} id={`trail-${trail.id}`}>
                  <TrailCard trail={trail} />
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
