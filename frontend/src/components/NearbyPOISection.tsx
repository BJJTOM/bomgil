"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

interface NearbyPOI {
  name: string;
  category: string;
  content_type_id: string;
  lat: number;
  lng: number;
  image: string;
  address: string;
  tel: string;
}

interface NearbyPOISectionProps {
  trailId: number;
  language: string;
}

// ─── Category styling ───────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "음식점": { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300" },
  "관광지": { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300" },
  "숙박": { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300" },
  "문화시설": { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300" },
  "레포츠": { bg: "bg-teal-100 dark:bg-teal-900/30", text: "text-teal-700 dark:text-teal-300" },
  "쇼핑": { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-300" },
};

const CATEGORY_ICONS: Record<string, string> = {
  "음식점": "M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zm4-2V2m4 4V2m4 4V2",
  "관광지": "M3 21l1.65-3.8a9 9 0 1112.7 0L19 21",
  "숙박": "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  "문화시설": "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  "레포츠": "M13 10V3L4 14h7v7l9-11h-7z",
  "쇼핑": "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z",
};

const DEFAULT_COLOR = { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400" };

// ─── Section labels ─────────────────────────────────────────────────────────

const SECTION_TITLE: Record<string, string> = {
  ko: "주변 정보",
  en: "Nearby",
  ja: "周辺情報",
  zh: "周边信息",
};

// ─── Component ──────────────────────────────────────────────────────────────

export function NearbyPOISection({ trailId, language }: NearbyPOISectionProps) {
  const { data: pois, isLoading } = useQuery<NearbyPOI[]>({
    queryKey: ["trail-nearby-poi", trailId],
    queryFn: async () => {
      const { data } = await api.get(`/trails/${trailId}/nearby/`);
      return data;
    },
    staleTime: 1000 * 60 * 30, // 30 min client-side
    retry: 1,
  });

  // Loading: show skeleton cards
  if (isLoading) {
    return (
      <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-text-primary mb-3">
          {SECTION_TITLE[language] || SECTION_TITLE.en}
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-[200px] rounded-xl bg-bg-secondary animate-pulse"
            >
              <div className="h-[80px] rounded-t-xl bg-gray-200 dark:bg-gray-700" />
              <div className="p-2.5 space-y-1.5">
                <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Empty: hide entirely
  if (!pois || pois.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
      <h3 className="text-sm font-bold text-text-primary mb-3">
        {SECTION_TITLE[language] || SECTION_TITLE.en}
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {pois.map((poi, idx) => {
          const color = CATEGORY_COLORS[poi.category] || DEFAULT_COLOR;
          return (
            <div
              key={`${poi.name}-${idx}`}
              className="flex-shrink-0 w-[200px] rounded-xl border border-border-light overflow-hidden bg-surface hover:shadow-soft transition-shadow"
            >
              {/* Image or placeholder */}
              <div className="h-[80px] bg-bg-secondary relative overflow-hidden">
                {poi.image ? (
                  <img
                    src={poi.image}
                    alt={poi.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-bg-secondary">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-text-tertiary"
                    >
                      <path d={CATEGORY_ICONS[poi.category] || "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"} />
                    </svg>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-2.5">
                <div className="flex items-start gap-1.5 mb-1">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold ${color.bg} ${color.text} flex-shrink-0`}
                  >
                    {poi.category}
                  </span>
                </div>
                <p className="text-[12px] font-semibold text-text-primary leading-tight line-clamp-1">
                  {poi.name}
                </p>
                {poi.address && (
                  <p className="text-[10px] text-text-tertiary mt-0.5 line-clamp-1">
                    {poi.address}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
