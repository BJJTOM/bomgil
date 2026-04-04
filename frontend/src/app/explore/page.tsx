"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useTrails } from "@/hooks/useTrails";
import { TrailCard } from "@/components/TrailCard";
import { FilterBar } from "@/components/FilterBar";
import { MapView } from "@/components/MapView";
import { InfiniteList } from "@/components/InfiniteList";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrailCardSkeleton } from "@/components/ui/Skeleton";
import Link from "next/link";
import type { Trail } from "@/types";

const FILTER_CONFIG = [
  {
    key: "country",
    label: "국가",
    options: [
      { value: "", label: "전체" },
      { value: "KR", label: "🇰🇷 한국" },
      { value: "JP", label: "🇯🇵 일본" },
      { value: "TW", label: "🇹🇼 대만" },
      { value: "TH", label: "🇹🇭 태국" },
      { value: "US", label: "🇺🇸 미국" },
      { value: "GB", label: "🇬🇧 영국" },
      { value: "FR", label: "🇫🇷 프랑스" },
      { value: "ES", label: "🇪🇸 스페인" },
    ],
  },
  {
    key: "difficulty",
    label: "난이도",
    options: [
      { value: "", label: "전체" },
      { value: "easy", label: "여유롭게" },
      { value: "moderate", label: "보통" },
      { value: "hard", label: "도전적" },
    ],
  },
  {
    key: "trail_type",
    label: "유형",
    options: [
      { value: "", label: "전체" },
      { value: "urban", label: "도심" },
      { value: "coastal", label: "해안" },
      { value: "village", label: "마을" },
      { value: "cultural", label: "문화" },
      { value: "nature", label: "자연" },
      { value: "mixed", label: "복합" },
    ],
  },
  {
    key: "best_season",
    label: "시즌",
    options: [
      { value: "", label: "전체" },
      { value: "spring", label: "봄" },
      { value: "summer", label: "여름" },
      { value: "fall", label: "가을" },
      { value: "winter", label: "겨울" },
      { value: "all", label: "사계절" },
    ],
  },
];

const QUICK_DESTINATIONS = [
  { label: "서울", filter: { key: "region", value: "서울" } },
  { label: "제주", filter: { key: "region", value: "제주" } },
  { label: "부산", filter: { key: "region", value: "부산" } },
  { label: "강릉", filter: { key: "region", value: "강릉" } },
  { label: "도쿄", filter: { key: "country", value: "JP" } },
  { label: "파리", filter: { key: "country", value: "FR" } },
  { label: "런던", filter: { key: "country", value: "GB" } },
  { label: "뉴욕", filter: { key: "country", value: "US" } },
  { label: "바르셀로나", filter: { key: "country", value: "ES" } },
];

const SORT_OPTIONS = [
  { value: "-like_count", label: "인기순" },
  { value: "-created_at", label: "최신순" },
  { value: "distance_km", label: "거리순 (짧은)" },
  { value: "-distance_km", label: "거리순 (긴)" },
];

export default function ExplorePage() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("-like_count");
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    FILTER_CONFIG.forEach((f) => {
      const val = searchParams.get(f.key);
      if (val) initial[f.key] = val;
    });
    // Also check region from URL
    const region = searchParams.get("region");
    if (region) initial["region"] = region;
    return initial;
  });

  const [showMap, setShowMap] = useState(true);

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

  // Client-side search filtering (in addition to server)
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

  const mapMarkers = trails.map((t) => ({
    id: t.id,
    lat: parseFloat(t.start_lat),
    lng: parseFloat(t.start_lng),
    title: t.title,
  }));

  const selectedCountry = filters.country || "KR";

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

  const handleQuickDestination = (dest: (typeof QUICK_DESTINATIONS)[0]) => {
    setFilters((prev) => {
      const next: Record<string, string> = {};
      next[dest.filter.key] = dest.filter.value;
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
        <div className="max-w-7xl mx-auto px-5 pt-4 pb-3">
          {/* Search Bar */}
          <div className="relative mb-3">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="코스명, 지역, 키워드 검색..."
              className="w-full pl-10 pr-4 py-3 rounded-button bg-bg-secondary border-none text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-text-tertiary transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-text-tertiary/30 flex items-center justify-center"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Quick Destinations */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 -mx-1 px-1">
            {QUICK_DESTINATIONS.map((dest) => {
              const isActive =
                (dest.filter.key === "region" &&
                  filters.region === dest.filter.value) ||
                (dest.filter.key === "country" &&
                  filters.country === dest.filter.value);
              return (
                <button
                  key={dest.label}
                  onClick={() => handleQuickDestination(dest)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-pill text-[12px] font-medium transition-all ${
                    isActive
                      ? "bg-primary text-white"
                      : "bg-bg-secondary text-text-secondary hover:bg-border-light"
                  }`}
                >
                  {dest.label}
                </button>
              );
            })}
          </div>

          {/* Filter Chips + Sort */}
          <div className="flex items-center gap-2">
            <div className="flex-1 overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-2">
                <FilterBar
                  filters={FILTER_CONFIG}
                  selected={filters}
                  onChange={handleFilterChange}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-[12px] text-primary font-medium whitespace-nowrap"
                >
                  초기화
                </button>
              )}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-[12px] bg-bg-secondary border-none rounded-pill px-3 py-1.5 font-medium text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary/20"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowMap(!showMap)}
                className={`px-3 py-1.5 rounded-pill text-[12px] font-medium transition-all whitespace-nowrap ${
                  showMap
                    ? "bg-primary text-white"
                    : "bg-bg-secondary text-text-secondary"
                }`}
              >
                {showMap ? "🗺️ 지도" : "🗺️ 지도"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-6">
        <div className={`flex gap-6 ${showMap ? "" : ""}`}>
          {/* Map */}
          {showMap && (
            <div className="hidden lg:block w-1/2 sticky top-[200px] h-[calc(100vh-220px)]">
              <div className="rounded-card overflow-hidden h-full shadow-soft">
                <MapView
                  country={selectedCountry}
                  markers={mapMarkers}
                  onMarkerClick={(id) => {
                    const el = document.getElementById(`trail-${id}`);
                    el?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }}
                  className="w-full h-full"
                />
              </div>
            </div>
          )}

          {/* Trail List */}
          <div className={showMap ? "w-full lg:w-1/2" : "w-full"}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] text-text-secondary">
                {isLoading
                  ? "검색 중..."
                  : `${trails.length}개의 코스를 발견했어요`}
              </p>
            </div>

            {isLoading ? (
              <div
                className={`grid gap-4 ${
                  showMap
                    ? "grid-cols-1"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                }`}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <TrailCardSkeleton key={i} />
                ))}
              </div>
            ) : trails.length === 0 ? (
              <EmptyState
                title="코스를 찾을 수 없어요"
                description="다른 키워드나 필터를 시도해보세요"
                action={
                  <button
                    onClick={clearAllFilters}
                    className="btn-primary px-6 py-3 text-[13px]"
                  >
                    필터 초기화
                  </button>
                }
              />
            ) : (
              <div
                className={`grid gap-4 ${
                  showMap
                    ? "grid-cols-1"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                }`}
              >
                {trails.map((trail) => (
                  <div key={trail.id} id={`trail-${trail.id}`}>
                    <TrailCard
                      trail={trail}
                      variant={showMap ? "horizontal" : "default"}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
