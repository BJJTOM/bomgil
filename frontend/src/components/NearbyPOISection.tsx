"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NearbyPOI {
  name: string;
  category: string;
  content_type_id: string;
  content_id: string;
  lat: number;
  lng: number;
  image: string;
  address: string;
  tel: string;
}

interface POIDetail {
  name: string;
  category: string;
  content_type_id: string;
  overview: string;
  address: string;
  tel: string;
  homepage: string;
  image: string;
  lat: number;
  lng: number;
  operating_hours: string;
  closed_days: string;
  parking: string;
  main_menu: string;
  menu_info: string;
  fee: string;
  checkin: string;
  checkout: string;
  info_center: string;
  room_type: string;
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

// ─── POI Detail Modal ───────────────────────────────────────────────────────

export function POIDetailModal({
  contentId,
  poi,
  onClose,
  language,
}: {
  contentId: string;
  poi: NearbyPOI;
  onClose: () => void;
  language: string;
}) {
  const [isVisible, setIsVisible] = useState(false);

  const hasContentId = !!contentId && contentId !== "";
  const { data: detail, isLoading, isError } = useQuery<POIDetail>({
    queryKey: ["poi-detail", contentId],
    queryFn: async () => {
      const { data } = await api.get(`/poi/${contentId}/`);
      return data;
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
    enabled: hasContentId,
  });

  // Animate in on mount
  useEffect(() => {
    // Small delay so the initial render is off-screen, then slide up
    const t = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const color = CATEGORY_COLORS[poi.category] || DEFAULT_COLOR;

  const directionsUrl = detail
    ? `https://www.google.com/maps/dir/?api=1&destination=${detail.lat},${detail.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lng}`;

  const displayTel = detail?.tel || poi.tel;
  const displayImage = detail?.image || poi.image;
  const displayName = detail?.name || poi.name;
  const displayAddress = detail?.address || poi.address;

  const directionsLabel: Record<string, string> = {
    ko: "길찾기",
    en: "Directions",
    ja: "経路",
    zh: "路线",
  };

  const callLabel: Record<string, string> = {
    ko: "전화",
    en: "Call",
    ja: "電話",
    zh: "电话",
  };

  const errorLabel: Record<string, string> = {
    ko: "정보를 불러올 수 없습니다",
    en: "Unable to load information",
    ja: "情報を読み込めません",
    zh: "无法加载信息",
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center md:justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          isVisible ? "opacity-50" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full md:max-w-[480px] max-h-[80vh] bg-white dark:bg-gray-900 md:rounded-2xl rounded-t-2xl shadow-xl overflow-hidden transform transition-transform duration-300 ease-out ${
          isVisible
            ? "translate-y-0 md:scale-100"
            : "translate-y-full md:translate-y-0 md:scale-95"
        }`}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Handle bar (mobile) */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        <div className="overflow-y-auto max-h-[calc(80vh-12px)] md:max-h-[80vh]">
          {/* Image */}
          <div className="h-[200px] bg-bg-secondary relative overflow-hidden">
            {displayImage ? (
              <img
                src={displayImage}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-bg-secondary">
                <svg
                  width="40"
                  height="40"
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

          {/* Content — always show basic info immediately, detail loads in background */}
          <div className="p-5">
            {(
              /* Detail content */
              <>
                {/* Category badge */}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${color.bg} ${color.text} mb-2`}
                >
                  {detail?.category || poi.category}
                </span>

                {/* Name */}
                <h2 className="text-lg font-bold text-text-primary leading-tight mb-3">
                  {displayName}
                </h2>

                {/* Address */}
                {displayAddress && (
                  <div className="flex items-start gap-2 mb-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary flex-shrink-0 mt-0.5">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <p className="text-[13px] text-text-secondary leading-snug">{displayAddress}</p>
                  </div>
                )}

                {/* Phone */}
                {displayTel && (
                  <div className="flex items-center gap-2 mb-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary flex-shrink-0">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                    </svg>
                    <a
                      href={`tel:${displayTel}`}
                      className="text-[13px] text-primary font-medium hover:underline"
                    >
                      {displayTel}
                    </a>
                  </div>
                )}

                {/* Overview */}
                {detail?.overview && (
                  <div className="mt-3 mb-4">
                    <p className="text-[14px] leading-[1.7] text-text-primary">
                      {detail.overview}
                    </p>
                  </div>
                )}

                {/* Additional detail info */}
                {detail && (() => {
                  const rows: { label: string; value: string }[] = [];
                  if (detail.operating_hours) rows.push({ label: "영업시간", value: detail.operating_hours });
                  if (detail.closed_days) rows.push({ label: "휴무일", value: detail.closed_days });
                  if (detail.parking) rows.push({ label: "주차", value: detail.parking });
                  if (detail.main_menu) rows.push({ label: "대표메뉴", value: detail.main_menu });
                  if (detail.menu_info) rows.push({ label: "메뉴", value: detail.menu_info });
                  if (detail.fee) rows.push({ label: "이용요금", value: detail.fee });
                  if (detail.checkin && detail.checkout) {
                    rows.push({ label: "체크인/아웃", value: `${detail.checkin} / ${detail.checkout}` });
                  } else if (detail.checkin) {
                    rows.push({ label: "체크인", value: detail.checkin });
                  } else if (detail.checkout) {
                    rows.push({ label: "체크아웃", value: detail.checkout });
                  }
                  if (detail.info_center) rows.push({ label: "문의", value: detail.info_center });

                  if (rows.length === 0) return null;

                  return (
                    <div className="mt-3 mb-4 rounded-xl border border-border-light overflow-hidden">
                      {rows.map((row, i) => (
                        <div
                          key={row.label}
                          className={`flex items-start gap-3 px-3 py-2.5 ${
                            i < rows.length - 1 ? "border-b border-border-light" : ""
                          }`}
                        >
                          <span className="text-[12px] font-semibold text-text-secondary w-[72px] flex-shrink-0 pt-[1px]">
                            {row.label}
                          </span>
                          <span className="text-[13px] text-text-primary leading-snug flex-1 break-words">
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Action buttons */}
                <div className="flex gap-2 mt-4">
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl text-[13px] font-semibold hover:opacity-90 transition-opacity"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 11 22 2 13 21 11 13 3 11" />
                    </svg>
                    {directionsLabel[language] || directionsLabel.en}
                  </a>
                  {displayTel && (
                    <a
                      href={`tel:${displayTel}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-bg-secondary text-text-primary rounded-xl text-[13px] font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                      </svg>
                      {callLabel[language] || callLabel.en}
                    </a>
                  )}
                </div>

                {/* Mini map */}
                <div className="mt-4 rounded-xl overflow-hidden border border-border-light">
                  <img
                    src={`https://maps.googleapis.com/maps/api/staticmap?center=${detail?.lat || poi.lat},${detail?.lng || poi.lng}&zoom=15&size=480x160&markers=color:red%7C${detail?.lat || poi.lat},${detail?.lng || poi.lng}&key=${typeof window !== "undefined" ? (window as any).__NEXT_DATA__?.props?.pageProps?.gmapKey || "" : ""}`}
                    alt="map"
                    className="w-full h-[120px] object-cover bg-bg-secondary"
                    onError={(e) => {
                      // If Google static map fails, show a placeholder
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function NearbyPOISection({ trailId, language }: NearbyPOISectionProps) {
  const [selectedPOI, setSelectedPOI] = useState<NearbyPOI | null>(null);

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
    <>
      <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-text-primary mb-3">
          {SECTION_TITLE[language] || SECTION_TITLE.en}
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {pois.map((poi, idx) => {
            const color = CATEGORY_COLORS[poi.category] || DEFAULT_COLOR;
            return (
              <button
                key={`${poi.name}-${idx}`}
                onClick={() => setSelectedPOI(poi)}
                className="flex-shrink-0 w-[200px] rounded-xl border border-border-light overflow-hidden bg-surface hover:shadow-soft transition-shadow text-left cursor-pointer"
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
                    <p className="text-[10px] text-text-secondary mt-0.5 line-clamp-1">
                      {poi.address}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* POI Detail Modal */}
      {selectedPOI && (
        <POIDetailModal
          contentId={selectedPOI.content_id || ""}
          poi={selectedPOI}
          onClose={() => setSelectedPOI(null)}
          language={language}
        />
      )}
    </>
  );
}
