"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useTrail, useToggleLike } from "@/hooks/useTrails";
import { useTrailSpots } from "@/hooks/useSpots";
import { useTrailReviews, useCreateReview, useToggleHelpful } from "@/hooks/useReviews";
import { useTrailActivities } from "@/hooks/useActivities";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { SpotTimeline } from "@/components/SpotTimeline";
import { ReviewCard } from "@/components/ReviewCard";
import { MapView } from "@/components/MapView";
import { MapFullscreen, MapExpandButton } from "@/components/MapFullscreen";
import { StampBook } from "@/components/StampBook";
import { ElevationProfile } from "@/components/ElevationProfile";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDistance, formatDuration, SPOT_TYPE_LABELS } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useT } from "@/stores/language";
import { TrailSegments } from "@/components/TrailSegments";
import { TrailConditionBanner } from "@/components/TrailConditionBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NearbyPOISection, POIDetailModal } from "@/components/NearbyPOISection";
import type { NearbyPOI } from "@/components/NearbyPOISection";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Trail, Spot, ActivityTrack } from "@/types";

// ─── SVG Icon Components ────────────────────────────────────────────────────

function IconHeart({ size = 16, filled = false, className = "" }: { size?: number; filled?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

function IconBookmark({ size = 16, filled = false, className = "" }: { size?: number; filled?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
  );
}

function IconShare({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function IconEye({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconStar({ size = 14, filled = false, className = "" }: { size?: number; filled?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconBus({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 6v6m8-6v6M2 12h20M6 18h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" />
      <circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" />
    </svg>
  );
}

function IconUser({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconHikingPath({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10 40c4-8 8-4 12-12s4-8 8-4 6 8 10 0" />
      <circle cx="24" cy="8" r="3" /><path d="M24 11v8m-4 4l4-4 4 4m-8 6l4-6 4 6" />
    </svg>
  );
}

function IconMapEmpty({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function IconPencil({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconWalker({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="13" cy="4" r="2" /><path d="M10 22l1-7m4 7l-1-5m-3 0l-2-4 3-3 4 2 2 3" /><path d="M8 14l-2 2" />
    </svg>
  );
}

function IconNavigation({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  );
}

function IconSmartphone({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

function IconWatch({ size = 12, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="7" /><polyline points="12 9 12 12 13.5 13.5" />
      <path d="M16.51 17.35l-.35 3.83a2 2 0 01-2 1.82H9.83a2 2 0 01-2-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 019.83 1h4.35a2 2 0 012 1.82l.35 3.83" />
    </svg>
  );
}

function IconPin({ size = 12, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}

// ─── Difficulty labels (standardized noun forms, multilingual) ───────────────

const DIFFICULTY_LABELS: Record<string, Record<string, string>> = {
  easy: { ko: "쉬움", en: "Easy", ja: "簡単", zh: "简单" },
  moderate: { ko: "보통", en: "Moderate", ja: "普通", zh: "中等" },
  hard: { ko: "어려움", en: "Hard", ja: "難しい", zh: "困难" },
};

// ─── Stat text labels (multilingual) ────────────────────────────────────────

const STAT_LABELS = {
  distance: { ko: "거리", en: "Distance", ja: "距離", zh: "距离" },
  time: { ko: "시간", en: "Time", ja: "時間", zh: "时间" },
  difficulty: { ko: "난이도", en: "Difficulty", ja: "難易度", zh: "难度" },
  elevation: { ko: "고도", en: "Elev.", ja: "標高", zh: "海拔" },
  rating: { ko: "평점", en: "Rating", ja: "評価", zh: "评分" },
};

// ─── Tab Types ───────────────────────────────────────────────────────────────

type TabId = "overview" | "reviews" | "records";

interface TabConfig {
  id: TabId;
  label: Record<string, string>;
}

const TABS: TabConfig[] = [
  { id: "overview", label: { ko: "코스 소개", en: "Course Overview", ja: "コース紹介", zh: "路线简介" } },
  { id: "reviews", label: { ko: "리뷰", en: "Reviews", ja: "レビュー", zh: "评价" } },
  { id: "records", label: { ko: "기록", en: "Records", ja: "記録", zh: "记录" } },
];

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function TrailDetailPage() {
  const { id } = useParams();
  const trailId = Number(id);
  const { isAuthenticated, user } = useAuthStore();
  const { t, language } = useT();

  const { data: trail, isLoading: trailLoading } = useTrail(trailId);
  const { data: spots = [] } = useTrailSpots(trailId);
  const { data: reviews = [] } = useTrailReviews(trailId);
  const { data: activities = [] } = useTrailActivities(trailId);
  const toggleLike = useToggleLike();
  const toggleHelpful = useToggleHelpful();

  // ─── State ──────────────────────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showAllSpots, setShowAllSpots] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    content: "",
    visited_date: new Date().toISOString().split("T")[0],
  });
  const [reviewImages, setReviewImages] = useState<File[]>([]);
  const [reviewPreviews, setReviewPreviews] = useState<string[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [certBlobUrl, setCertBlobUrl] = useState<string | null>(null);
  const [certLoading, setCertLoading] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [mapSelectedPOI, setMapSelectedPOI] = useState<NearbyPOI | null>(null);
  const createReview = useCreateReview(trailId);

  const { data: nearbyPOIs = [] } = useQuery<NearbyPOI[]>({
    queryKey: ["trail-nearby-poi", trailId],
    queryFn: async () => {
      const { data } = await api.get(`/trails/${trailId}/nearby/`);
      return data;
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);
  const tabIndicatorRef = useRef<HTMLDivElement>(null);

  // ─── Tab from URL hash ──────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "") as TabId;
    if (TABS.some((tab) => tab.id === hash)) {
      setActiveTab(hash);
    }
  }, []);

  const handleTabChange = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${tabId}`);
    }
    if (tabContentRef.current) {
      const offset = tabBarRef.current?.getBoundingClientRect().bottom ?? 0;
      const contentTop = tabContentRef.current.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: contentTop - offset - 8, behavior: "smooth" });
    }
  }, []);

  // ─── Tab indicator position ─────────────────────────────────────────────────

  useEffect(() => {
    if (!tabBarRef.current || !tabIndicatorRef.current) return;
    const activeButton = tabBarRef.current.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement;
    if (activeButton) {
      const bar = tabBarRef.current.getBoundingClientRect();
      const btn = activeButton.getBoundingClientRect();
      tabIndicatorRef.current.style.left = `${btn.left - bar.left}px`;
      tabIndicatorRef.current.style.width = `${btn.width}px`;
    }
  }, [activeTab]);

  // ─── Saved status from localStorage ────────────────────────────────────────

  useEffect(() => {
    if (typeof window === "undefined" || !trailId) return;
    try {
      const saved = JSON.parse(localStorage.getItem("moru_saved_trails") || "[]");
      setIsSaved(saved.some((t: any) => t.id === trailId));
    } catch {}
  }, [trailId]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleToggleSave = () => {
    if (typeof window === "undefined" || !trail) return;
    try {
      const saved = JSON.parse(localStorage.getItem("moru_saved_trails") || "[]");
      if (isSaved) {
        const filtered = saved.filter((t: any) => t.id !== trailId);
        localStorage.setItem("moru_saved_trails", JSON.stringify(filtered));
        setIsSaved(false);
        alert("저장이 해제되었습니다");
      } else {
        const minimal = { id: trailId, title: trail.title, region: trail.region, distance_km: trail.distance_km, cover_image: trail.cover_image, savedAt: Date.now() };
        saved.push(minimal);
        localStorage.setItem("moru_saved_trails", JSON.stringify(saved));
        setIsSaved(true);
        alert("오프라인 저장 완료");
      }
    } catch {}
  };

  const handleHeroShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: trail?.title, text: trail?.description, url });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert(language === "ko" ? "링크가 복사되었습니다" : "Link copied");
      } catch {}
    }
  };

  const handleReviewImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 3 - reviewImages.length;
    const newFiles = files.slice(0, remaining);
    setReviewImages(prev => [...prev, ...newFiles]);
    setReviewPreviews(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const removeReviewImage = (i: number) => {
    URL.revokeObjectURL(reviewPreviews[i]);
    setReviewImages(prev => prev.filter((_, idx) => idx !== i));
    setReviewPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmitReview = async () => {
    if (isSubmittingReview) return;
    setIsSubmittingReview(true);
    try {
      if (reviewImages.length > 0) {
        const formData = new FormData();
        formData.append("trail", String(trailId));
        formData.append("rating", String(reviewForm.rating));
        formData.append("content", reviewForm.content);
        formData.append("visited_date", reviewForm.visited_date);
        reviewImages.forEach((img) => formData.append("images", img));
        try {
          const api = (await import("@/lib/api")).default;
          await api.post("/reviews/", formData, { headers: { "Content-Type": "multipart/form-data" } });
        } catch (e: any) {
          alert("리뷰 작성 실패");
          return;
        }
      } else {
        await createReview.mutateAsync(reviewForm);
      }
      setShowReviewForm(false);
      setReviewForm({ rating: 5, content: "", visited_date: new Date().toISOString().split("T")[0] });
      setReviewImages([]);
      reviewPreviews.forEach(URL.revokeObjectURL);
      setReviewPreviews([]);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleGpxDownload = () => {
    const apiBase =
      process.env.NODE_ENV === "development"
        ? "/api/v1"
        : process.env.NEXT_PUBLIC_API_URL || "https://api.moruwalk.com/api/v1";
    window.open(`${apiBase}/trails/${trailId}/gpx/`, "_blank");
  };

  const loadCertificate = async () => {
    if (certBlobUrl) {
      setShowCertificate(true);
      return;
    }
    setCertLoading(true);
    try {
      const api = (await import("@/lib/api")).default;
      const response = await api.get(`/trails/${trailId}/certificate/`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      setCertBlobUrl(url);
      setShowCertificate(true);
    } catch {
      alert(language === "ko" ? "인증서를 불러올 수 없습니다." : "Failed to load certificate.");
    } finally {
      setCertLoading(false);
    }
  };

  const handleCertificateDownload = () => {
    if (!certBlobUrl) return;
    const a = document.createElement("a");
    a.href = certBlobUrl;
    a.download = `moru-certificate-${trailId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCertificateNewTab = () => {
    if (!certBlobUrl) return;
    window.open(certBlobUrl, "_blank");
  };

  function formatActivityDuration(minutes: number | null) {
    if (minutes == null) return "-";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (language === "ko") return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
    if (language === "ja") return h > 0 ? `${h}時間${m}分` : `${m}分`;
    if (language === "zh") return h > 0 ? `${h}小时${m}分钟` : `${m}分钟`;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // ─── Derived data (must be before any early returns for hooks rules) ─────

  const pathCoords = useMemo<[number, number][]>(
    () => (trail?.path_data?.coordinates || []).map((c: any) => [c[0], c[1]] as [number, number]),
    [trail?.path_data],
  );
  const mapMarkers = useMemo(() => {
    const POI_CATEGORY_EMOJI: Record<string, string> = {
      "음식점": "🍽️",
      "관광지": "🏞️",
      "숙박": "🏠",
      "문화시설": "🏛️",
      "레포츠": "⚡",
      "쇼핑": "🛍️",
    };
    const spotMarkers = spots.map((s: Spot) => ({
      id: s.id,
      lat: parseFloat(s.lat),
      lng: parseFloat(s.lng),
      title: s.name,
      emoji: SPOT_TYPE_LABELS[s.spot_type]?.emoji,
    }));
    const poiMarkers = nearbyPOIs.map((poi, idx) => ({
      id: -(idx + 1), // negative IDs to distinguish from spot IDs
      lat: poi.lat,
      lng: poi.lng,
      title: poi.name,
      emoji: POI_CATEGORY_EMOJI[poi.category] || "📍",
    }));
    return [...spotMarkers, ...poiMarkers];
  }, [spots, nearbyPOIs]);

  // ─── Loading state ──────────────────────────────────────────────────────────

  if (trailLoading) {
    return (
      <div className="md:pt-16">
        <Skeleton className="h-[260px] md:h-72 w-full rounded-none" />
        <div className="max-w-3xl mx-auto px-5 py-5 space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-20 rounded-full" />
            <Skeleton className="h-10 w-20 rounded-full" />
            <Skeleton className="h-10 w-20 rounded-full" />
          </div>
          <Skeleton className="h-12 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
        </div>
      </div>
    );
  }

  if (!trail) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-text-secondary">{t("common.noResults")}</p>
      </div>
    );
  }

  // ─── Trail alias ────────────────────────────────────────────────────────────

  const tr: Trail = trail;

  // Plain function — NOT a hook, safe after early returns
  function handleMapMarkerClick(markerId: number) {
    // POI markers have negative IDs: -(index + 1)
    if (markerId < 0) {
      const poiIndex = -(markerId + 1);
      const poi = nearbyPOIs[poiIndex];
      if (poi) {
        setMapSelectedPOI(poi);
      }
    }
    // Positive IDs are spot markers — no action needed (they have popups)
  }

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  const visibleSpots = showAllSpots ? spots : spots.slice(0, 3);

  const certLabel = language === "ko" ? "인증서" : language === "ja" ? "証明書" : language === "zh" ? "证书" : "Cert";
  const certDownloadLabel = language === "ko" ? "다운로드" : language === "ja" ? "ダウンロード" : language === "zh" ? "下载" : "Download";
  const certCloseLabel = language === "ko" ? "닫기" : language === "ja" ? "閉じる" : language === "zh" ? "关闭" : "Close";
  const moreLabel = language === "ko" ? "더보기" : language === "ja" ? "もっと見る" : language === "zh" ? "查看更多" : "Show more";
  const difficultyLabel = DIFFICULTY_LABELS[tr.difficulty]?.[language] || DIFFICULTY_LABELS[tr.difficulty]?.en || tr.difficulty;

  // ─── Source icon helper ─────────────────────────────────────────────────────

  function getSourceIcon(source: string) {
    if (source === "apple_watch" || source === "garmin" || source === "samsung_health") {
      return <IconWatch size={11} className="opacity-70" />;
    }
    if (source === "cashwalk" || source === "phone_gps") {
      return <IconWalker size={11} className="opacity-70" />;
    }
    return <IconPin size={11} className="opacity-70" />;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="md:pt-16 min-h-screen" style={{ backgroundColor: "var(--c-warm)" }}>

      {/* ================================================================== */}
      {/* HERO SECTION                                                       */}
      {/* ================================================================== */}
      <div className="relative h-[260px] md:h-72 bg-primary">
        {tr.cover_image || tr.thumbnail_url ? (
          <img
            src={tr.cover_image || tr.thumbnail_url}
            alt={tr.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#2D4A2E] to-[#3A5C3B] flex items-center justify-center">
            <IconHikingPath size={72} className="text-white/20" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        {/* Back button */}
        <button
          onClick={() => window.history.back()}
          className="absolute top-14 left-4 md:top-5 bg-black/40 backdrop-blur-md w-9 h-9 rounded-full flex items-center justify-center border border-white/10 z-10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>

        {/* Action buttons overlay (bottom-right, over the image) */}
        <div className="absolute top-14 right-4 md:top-5 flex items-center gap-1.5 z-10">
          {/* Like */}
          <button
            onClick={() => toggleLike.mutate(trailId)}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all"
            title={tr.is_liked ? (language === "ko" ? "좋아요 취소" : "Unlike") : (language === "ko" ? "좋아요" : "Like")}
          >
            <IconHeart size={16} filled={tr.is_liked} className={tr.is_liked ? "text-red-400" : "text-white"} />
          </button>
          {/* Save */}
          <button
            onClick={handleToggleSave}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all"
            title={isSaved ? (language === "ko" ? "저장 해제" : "Unsave") : (language === "ko" ? "저장" : "Save")}
          >
            <IconBookmark size={16} filled={isSaved} className={isSaved ? "text-amber-400" : "text-white"} />
          </button>
          {/* Share */}
          <button
            onClick={handleHeroShare}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all"
            title={language === "ko" ? "공유" : "Share"}
          >
            <IconShare size={16} className="text-white" />
          </button>
        </div>

        {/* Hero overlay content: badges + title + view count */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 text-white z-10">
          <div className="flex items-center gap-2 mb-1">
            <DifficultyBadge difficulty={tr.difficulty} />
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm font-medium">
              {tr.region}
            </span>
            <span className="ml-auto flex items-center gap-1 text-[11px] text-white/70 font-medium">
              <IconEye size={12} className="text-white/60" />
              <span>{(tr.view_count ?? 0).toLocaleString()}</span>
            </span>
          </div>
          <h1 className="text-2xl md:text-[28px] font-extrabold leading-tight line-clamp-2">{tr.title}</h1>
        </div>
      </div>

      {/* ================================================================== */}
      {/* STATS BAR (text labels, below hero, above tabs)                    */}
      {/* ================================================================== */}
      <div className="bg-surface border-b border-border-light">
        <div className="max-w-3xl mx-auto px-5 py-3">
          <div className="flex items-center">
            {/* Distance */}
            <div className="flex flex-col items-center flex-1">
              <span className="text-[11px] font-medium text-text-tertiary">{STAT_LABELS.distance[language] || STAT_LABELS.distance.en}</span>
              <span className="text-[15px] font-bold text-text-primary">{formatDistance(tr.distance_km)}</span>
            </div>
            <div className="w-px h-8 bg-border-light" />
            {/* Time */}
            <div className="flex flex-col items-center flex-1">
              <span className="text-[11px] font-medium text-text-tertiary">{STAT_LABELS.time[language] || STAT_LABELS.time.en}</span>
              <span className="text-[15px] font-bold text-text-primary">{formatDuration(tr.estimated_minutes)}</span>
            </div>
            <div className="w-px h-8 bg-border-light" />
            {/* Difficulty */}
            <div className="flex flex-col items-center flex-1">
              <span className="text-[11px] font-medium text-text-tertiary">{STAT_LABELS.difficulty[language] || STAT_LABELS.difficulty.en}</span>
              <span className="text-[15px] font-bold text-text-primary">{difficultyLabel}</span>
            </div>
            {tr.elevation_gain && (
              <>
                <div className="w-px h-8 bg-border-light" />
                <div className="flex flex-col items-center flex-1">
                  <span className="text-[11px] font-medium text-text-tertiary">{STAT_LABELS.elevation[language] || STAT_LABELS.elevation.en}</span>
                  <span className="text-[15px] font-bold text-text-primary">+{tr.elevation_gain}m</span>
                </div>
              </>
            )}
            {avgRating && (
              <>
                <div className="w-px h-8 bg-border-light" />
                <div className="flex flex-col items-center flex-1">
                  <span className="text-[11px] font-medium text-text-tertiary">{STAT_LABELS.rating[language] || STAT_LABELS.rating.en}</span>
                  <span className="text-[15px] font-bold text-text-primary flex items-center gap-1">
                    <IconStar size={13} filled className="text-yellow-400" />
                    {avgRating}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* STICKY TAB BAR (tabs only, no action buttons)                      */}
      {/* ================================================================== */}
      <div className="sticky top-0 md:top-16 z-30 bg-surface border-b border-border-light">
        <div className="max-w-3xl mx-auto px-5">
          {/* Utility row: GPX + Edit (compact) */}
          <div className="flex items-center justify-end gap-1.5 pt-1.5 pb-0.5">
            <button
              onClick={handleGpxDownload}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-text-tertiary hover:text-text-primary hover:bg-bg-secondary transition-colors"
              title="GPX"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              GPX
            </button>
            {isAuthenticated && user && tr.author && user.id === tr.author.id && (
              <Link
                href={`/trails/${trailId}/edit`}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-text-tertiary hover:text-text-primary hover:bg-bg-secondary transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {language === "ko" ? "수정" : language === "ja" ? "編集" : language === "zh" ? "编辑" : "Edit"}
              </Link>
            )}
          </div>

          {/* Tab bar */}
          <div ref={tabBarRef} className="relative flex">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 md:flex-none md:px-5 py-2.5 text-[13px] md:text-[14px] font-semibold text-center transition-colors duration-200 relative ${
                  activeTab === tab.id
                    ? "text-primary"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {tab.label[language] || tab.label.en}
              </button>
            ))}
            <div
              ref={tabIndicatorRef}
              className="absolute bottom-0 h-[2.5px] bg-primary rounded-full transition-all duration-300 ease-out"
            />
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* TAB CONTENT                                                        */}
      {/* ================================================================== */}
      <div ref={tabContentRef} className="max-w-3xl mx-auto px-5 py-4">

        {/* ─── Tab 1: Course Overview (merged 소개 + 코스 정보) ─── */}
        {activeTab === "overview" && (
          <ErrorBoundary>
            <div className="animate-fade-in space-y-5">
              {/* Trail Condition Banner */}
              <TrailConditionBanner condition={tr.latest_condition} language={language} />

              {/* Description (no card title — content speaks for itself) */}
              <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                <div className="text-[15px] leading-[1.8] text-text-primary font-normal whitespace-pre-line">
                  {tr.description
                    ? tr.description.split("\n").map((paragraph, i) => (
                        <p key={i} className={i > 0 ? "mt-3" : ""}>
                          {paragraph}
                        </p>
                      ))
                    : null}
                </div>
                {(tr.tags || []).length > 0 && (
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {(tr.tags || []).map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-pill text-[11px] font-medium bg-bg-secondary text-text-secondary"
                      >
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {/* Interactive Map */}
              <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                <div className="h-[260px] md:h-[340px] relative">
                  <MapView
                    country={tr.country}
                    center={{
                      lat: parseFloat(tr.start_lat),
                      lng: parseFloat(tr.start_lng),
                    }}
                    zoom={14}
                    markers={mapMarkers}
                    pathCoordinates={pathCoords}
                    theme="light"
                    locale="ko"
                    showStats
                    distance={tr.distance_km}
                    duration={String(tr.estimated_minutes)}
                    onMarkerClick={handleMapMarkerClick}
                  />
                  <MapExpandButton onClick={() => setMapFullscreen(true)} />
                </div>
                <MapFullscreen
                  open={mapFullscreen}
                  onClose={() => setMapFullscreen(false)}
                  title={tr.title}
                  pathCoordinates={pathCoords}
                  markers={mapMarkers}
                  distance={tr.distance_km}
                  duration={String(tr.estimated_minutes)}
                  theme="dark"
                  onMarkerClick={handleMapMarkerClick}
                />
              </section>

              {/* Nearby POIs */}
              <NearbyPOISection trailId={trailId} language={language} />

              {/* Author — may be null for publicly-sourced trails (e.g. visitkorea) */}
              <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                {tr.author ? (
                  <Link
                    href={`/profile/${tr.author.nickname}`}
                    className="flex items-center gap-3 hover:bg-bg-secondary -m-1 p-1 rounded-[10px] transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#A8E6CF]/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {tr.author.profile_image ? (
                        <Image
                          src={tr.author.profile_image}
                          alt={tr.author.nickname}
                          width={36}
                          height={36}
                          className="object-cover"
                        />
                      ) : (
                        <IconUser size={18} className="text-primary/60" />
                      )}
                    </div>
                    <div className="flex flex-col justify-center">
                      <p className="text-[13px] font-semibold text-text-primary">{tr.author.nickname}</p>
                      {tr.author.is_guide && (
                        <span className="text-[10px] bg-[#f0f7f0] text-primary px-1.5 py-0.5 rounded-pill font-medium mt-0.5 inline-block w-fit">
                          {t("trail.certifiedGuide")}
                        </span>
                      )}
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#A8E6CF]/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                      <IconUser size={18} className="text-primary/60" />
                    </div>
                    <div className="flex flex-col justify-center">
                      <p className="text-[13px] font-semibold text-text-primary">
                        {tr.source === "visitkorea"
                          ? language === "ko"
                            ? "한국관광공사"
                            : language === "ja"
                            ? "韓国観光公社"
                            : language === "zh"
                            ? "韩国观光公社"
                            : "Korea Tourism Organization"
                          : language === "ko"
                          ? "공식 코스"
                          : "Official course"}
                      </p>
                      <span className="text-[10px] bg-[#f0f7f0] text-primary px-1.5 py-0.5 rounded-pill font-medium mt-0.5 inline-block w-fit">
                        {language === "ko" ? "공공 데이터" : language === "ja" ? "公共データ" : language === "zh" ? "公共数据" : "Public data"}
                      </span>
                    </div>
                  </div>
                )}
              </section>

              {/* ─── Separator between overview and course detail sections ─── */}
              <div className="border-t border-border-light" />

              {/* Elevation Profile — require a real coordinates array before
                  touching .length; public imports carry path_data: {} */}
              {Array.isArray(tr.path_data?.coordinates) && tr.path_data!.coordinates.length >= 2 && (
                <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                  <ErrorBoundary fallback={null}>
                    <ElevationProfile pathData={tr.path_data} />
                  </ErrorBoundary>
                </section>
              )}

              {/* Trail Segments */}
              {Array.isArray(tr.segments) && tr.segments.length > 0 && (
                <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                  <h2 className="text-sm font-bold text-text-primary mb-3">
                    {language === "ko" ? "구간별 거리 / 시간" : language === "ja" ? "区間別距離・時間" : language === "zh" ? "分段距离 / 时间" : "Segments"}
                  </h2>
                  <ErrorBoundary fallback={null}>
                    <TrailSegments segments={tr.segments} />
                  </ErrorBoundary>
                </section>
              )}

              {/* Spot Timeline */}
              {Array.isArray(spots) && spots.length > 0 && (
                <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                  <ErrorBoundary fallback={null}>
                    <SpotTimeline spots={visibleSpots} />
                  </ErrorBoundary>
                  {spots.length > 3 && !showAllSpots && (
                    <button
                      onClick={() => setShowAllSpots(true)}
                      className="mt-2 w-full py-2 text-[13px] font-medium text-primary bg-[#f0f7f0] dark:bg-primary/10 rounded-button hover:bg-[#d9eed9] dark:hover:bg-primary/20 transition-colors"
                    >
                      {moreLabel} ({spots.length - 3})
                    </button>
                  )}
                </section>
              )}

              {/* Stamp Book */}
              <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                <ErrorBoundary fallback={null}>
                  <StampBook trailId={trailId} />
                </ErrorBoundary>
              </section>

              {/* Start walking CTA — natural end of overview */}
              <div className="pt-1">
                <button
                  onClick={() => {
                    alert(language === "ko" ? "걷기 기록은 모바일 앱에서 시작할 수 있어요." : language === "ja" ? "ウォーキング記録はモバイルアプリで開始できます。" : language === "zh" ? "请在移动应用中开始步行记录。" : "Start walk recording in the mobile app.");
                  }}
                  className="w-full py-3.5 bg-primary text-white rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <IconSmartphone size={16} />
                  {language === "ko" ? "이 코스로 걷기 시작" : language === "ja" ? "このコースを歩き始める" : language === "zh" ? "开始步行此路线" : "Start walking this trail"}
                </button>
              </div>
            </div>
          </ErrorBoundary>
        )}

        {/* ─── Tab 3: Reviews ─── */}
        {activeTab === "reviews" && (
          <div className="animate-fade-in space-y-3">
            {/* Rating summary + write CTA */}
            <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {avgRating && (
                    <div className="flex items-center gap-2">
                      <span className="text-[26px] font-bold text-text-primary">{avgRating}</span>
                      <div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <IconStar
                              key={star}
                              size={13}
                              filled={star <= Math.round(Number(avgRating))}
                              className={star <= Math.round(Number(avgRating)) ? "text-yellow-400" : "text-gray-200 dark:text-gray-600"}
                            />
                          ))}
                        </div>
                        <p className="text-[11px] text-text-tertiary mt-0.5">
                          {reviews.length}{language === "ko" ? "개 리뷰" : language === "ja" ? "件のレビュー" : language === "zh" ? "条评价" : " reviews"}
                        </p>
                      </div>
                    </div>
                  )}
                  {!avgRating && (
                    <p className="text-sm text-text-tertiary">
                      {language === "ko" ? "아직 리뷰가 없어요" : language === "ja" ? "まだレビューがありません" : language === "zh" ? "暂无评价" : "No reviews yet"}
                    </p>
                  )}
                </div>
                {isAuthenticated && (
                  <button
                    onClick={() => setShowReviewForm(!showReviewForm)}
                    className="px-3.5 py-1.5 bg-primary text-white rounded-button text-[12px] font-semibold"
                  >
                    {t("trail.writeReview")}
                  </button>
                )}
              </div>
            </div>

            {/* Review Form */}
            {showReviewForm && (
              <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                <div className="space-y-3">
                  <div>
                    <label className="text-[12px] text-text-secondary block mb-1">
                      {t("review.rating")}
                    </label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setReviewForm((p) => ({ ...p, rating: star }))}
                          className="transition-colors p-0.5"
                        >
                          <IconStar
                            size={22}
                            filled={star <= reviewForm.rating}
                            className={star <= reviewForm.rating ? "text-yellow-400" : "text-gray-200 dark:text-gray-600"}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[12px] text-text-secondary block mb-1">
                      {t("review.visitDate")}
                    </label>
                    <input
                      type="date"
                      value={reviewForm.visited_date}
                      onChange={(e) => setReviewForm((p) => ({ ...p, visited_date: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] text-text-secondary block mb-1">
                      {t("review.content")}
                    </label>
                    <textarea
                      value={reviewForm.content}
                      onChange={(e) => setReviewForm((p) => ({ ...p, content: e.target.value }))}
                      rows={3}
                      maxLength={1000}
                      placeholder={t("review.placeholder")}
                      className="input-field resize-none"
                    />
                  </div>
                  {/* Image upload (max 3) */}
                  <div>
                    <label className="text-[12px] text-text-secondary block mb-1">
                      {language === "ko" ? "사진 (최대 3장)" : language === "ja" ? "写真 (最大3枚)" : language === "zh" ? "照片 (最多3张)" : "Photos (max 3)"}
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      <input id="review-img-input" type="file" accept="image/*" multiple className="hidden" onChange={handleReviewImagePick} />
                      {reviewImages.length < 3 && (
                        <label htmlFor="review-img-input" className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        </label>
                      )}
                      {reviewPreviews.map((url, i) => (
                        <div key={`${url}-${i}`} className="relative">
                          <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                          <button onClick={() => removeReviewImage(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowReviewForm(false)}
                      className="px-3.5 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-bg-secondary rounded-button transition-colors"
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      onClick={handleSubmitReview}
                      disabled={!reviewForm.content || isSubmittingReview || createReview.isPending}
                      className="px-4 py-1.5 bg-primary text-white rounded-button text-[12px] font-semibold disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {(isSubmittingReview || createReview.isPending) && (
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      {(isSubmittingReview || createReview.isPending) ? t("review.submitting") : t("review.submit")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Review List */}
            {reviews.length > 0 ? (
              <div className="space-y-2">
                {reviews.map((review: any) => (
                  <div key={review.id} className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                    <ReviewCard
                      review={review}
                      onHelpful={(id) => toggleHelpful.mutate(id)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              !showReviewForm && (
                <div className="text-center py-12 rounded-2xl bg-white dark:bg-gray-900 shadow-sm">
                  <IconPencil size={40} className="text-text-tertiary mx-auto mb-2" />
                  <p className="text-sm text-text-tertiary mb-2">
                    {language === "ko" ? "첫 번째 리뷰를 남겨보세요" : language === "ja" ? "最初のレビューを書いてみましょう" : language === "zh" ? "留下第一条评价吧" : "Be the first to review"}
                  </p>
                  {!isAuthenticated && (
                    <Link href="/login" className="text-[13px] text-primary font-medium hover:underline">
                      {t("common.login")}
                    </Link>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* ─── Tab 4: Records ─── */}
        {activeTab === "records" && (
          <div className="animate-fade-in space-y-3">
            {/* Activity Records */}
            {activities.length > 0 ? (
              <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                {/* Summary stats */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-medium text-text-tertiary">
                    {language === "ko" ? "총" : ""} {activities.length}{language === "ko" ? "회 완주" : language === "ja" ? "回完走" : language === "zh" ? "次完成" : " completions"}
                  </span>
                  {avgRating && (
                    <>
                      <span className="text-xs text-text-tertiary">|</span>
                      <span className="flex items-center gap-1 text-xs text-text-tertiary">
                        <IconStar size={11} filled className="text-yellow-400" />
                        {language === "ko" ? "평균" : "Avg"} {avgRating}
                      </span>
                    </>
                  )}
                </div>
                <div className="space-y-1.5">
                  {activities.slice(0, 10).map((act: ActivityTrack) => (
                    <Link key={act.id} href={`/activities/${act.id}`} className="block p-3 rounded-xl border border-border-light hover:border-border-default hover:shadow-soft transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#A8E6CF]/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {act.user?.profile_image ? (
                              <Image src={act.user.profile_image} alt="" width={32} height={32} className="rounded-full object-cover" />
                            ) : (
                              <IconUser size={16} className="text-primary/60" />
                            )}
                          </div>
                          <div className="flex flex-col justify-center">
                            <p className="text-[12px] font-semibold text-text-primary">{act.user?.nickname}</p>
                            <p className="text-[11px] text-text-tertiary">
                              {act.distance_km ? `${parseFloat(act.distance_km).toFixed(1)}km` : "-"} · {formatActivityDuration(act.duration_minutes)}
                              {act.total_steps ? ` · ${act.total_steps.toLocaleString()} ${t("activities.steps")}` : ""}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[10px] font-medium bg-bg-secondary text-text-secondary">
                          {getSourceIcon(act.source)}
                          <span>{act.source.replace("_", " ")}</span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : (
              <div className="text-center py-12 rounded-2xl bg-white dark:bg-gray-900 shadow-sm">
                <IconWalker size={40} className="text-text-tertiary mx-auto mb-2" />
                <p className="text-sm text-text-tertiary">
                  {language === "ko" ? "아직 활동 기록이 없어요" : language === "ja" ? "まだ活動記録がありません" : language === "zh" ? "暂无活动记录" : "No activity records yet"}
                </p>
              </div>
            )}

            {/* Completion Certificate button */}
            {isAuthenticated && (tr as any).is_completed && (
              <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#f0f7f0] dark:bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                        <circle cx="12" cy="8" r="6" />
                        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
                      </svg>
                    </div>
                    <div className="flex flex-col justify-center">
                      <p className="text-[13px] font-semibold text-text-primary">
                        {language === "ko" ? "완주 인증서" : language === "ja" ? "完走証明書" : language === "zh" ? "完成证书" : "Completion Certificate"}
                      </p>
                      <p className="text-[11px] text-text-tertiary">
                        {language === "ko" ? "이 코스를 완주했어요" : language === "ja" ? "このコースを完走しました" : language === "zh" ? "已完成此路线" : "You completed this trail"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={loadCertificate}
                    disabled={certLoading}
                    className="px-3.5 py-1.5 bg-primary text-white rounded-button text-[12px] font-semibold disabled:opacity-50 transition-all"
                  >
                    {certLoading ? "..." : certLabel}
                  </button>
                </div>
              </section>
            )}

            {/* Start walking CTA — natural end of records tab */}
            <div className="pt-1">
              <button
                onClick={() => {
                  alert(language === "ko" ? "걷기 기록은 모바일 앱에서 시작할 수 있어요." : language === "ja" ? "ウォーキング記録はモバイルアプリで開始できます。" : language === "zh" ? "请在移动应用中开始步行记录。" : "Start walk recording in the mobile app.");
                }}
                className="w-full py-3.5 bg-primary text-white rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <IconSmartphone size={16} />
                {language === "ko" ? "이 코스로 걷기 시작" : language === "ja" ? "このコースを歩き始める" : language === "zh" ? "开始步行此路线" : "Start walking this trail"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================== */}

      {/* ================================================================== */}
      {/* Certificate Modal                                                  */}
      {/* ================================================================== */}
      {/* ================================================================== */}
      {/* POI Detail Modal (from map marker click)                         */}
      {/* ================================================================== */}
      {mapSelectedPOI && (
        <POIDetailModal
          contentId={mapSelectedPOI.content_id || ""}
          poi={mapSelectedPOI}
          onClose={() => setMapSelectedPOI(null)}
          language={language}
        />
      )}

      {showCertificate && certBlobUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowCertificate(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-[20px] shadow-xl max-w-[640px] w-full overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-[#f8faf8] dark:bg-gray-800 p-4">
              <img
                src={certBlobUrl}
                alt="Completion Certificate"
                className="w-full rounded-[12px]"
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border-default">
              <button
                onClick={() => setShowCertificate(false)}
                className="px-3.5 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-bg-secondary rounded-button transition-colors"
              >
                {certCloseLabel}
              </button>
              <button
                onClick={handleCertificateNewTab}
                className="px-3.5 py-1.5 text-[12px] font-medium text-primary bg-[#f0f7f0] dark:bg-primary/10 rounded-button hover:bg-[#d9eed9] dark:hover:bg-primary/20 transition-colors"
              >
                {language === "ko" ? "새 탭에서 보기" : "Open in new tab"}
              </button>
              <button
                onClick={handleCertificateDownload}
                className="px-4 py-1.5 bg-primary text-white rounded-button text-[12px] font-semibold"
              >
                {certDownloadLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
