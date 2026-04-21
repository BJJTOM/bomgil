"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { ShareButton } from "@/components/ShareButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDistance, formatDuration, SPOT_TYPE_LABELS } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useT } from "@/stores/language";
import { TrailSegments } from "@/components/TrailSegments";
import { TrailConditionBanner } from "@/components/TrailConditionBanner";
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

function IconEye({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconRoute({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="6" cy="19" r="3" /><circle cx="18" cy="5" r="3" />
      <path d="M12 19h4.5a3.5 3.5 0 000-7h-9a3.5 3.5 0 010-7H12" />
    </svg>
  );
}

function IconClock({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconSignal({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="6" y1="20" x2="6" y2="16" /><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" />
    </svg>
  );
}

function IconMountain({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 3l4 8 5-5 5 16H2L8 3z" />
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

// ─── Tab Types ───────────────────────────────────────────────────────────────

type TabId = "overview" | "course" | "reviews" | "records";

interface TabConfig {
  id: TabId;
  label: Record<string, string>;
}

const TABS: TabConfig[] = [
  { id: "overview", label: { ko: "소개", en: "Overview", ja: "紹介", zh: "简介" } },
  { id: "course", label: { ko: "코스 정보", en: "Course Info", ja: "コース情報", zh: "路线信息" } },
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
  const createReview = useCreateReview(trailId);

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
    if (!minutes) return "-";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (language === "ko") return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
    if (language === "ja") return h > 0 ? `${h}時間${m}分` : `${m}分`;
    if (language === "zh") return h > 0 ? `${h}小时${m}分钟` : `${m}分钟`;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // ─── Loading state ──────────────────────────────────────────────────────────

  if (trailLoading) {
    return (
      <div className="md:pt-16">
        <Skeleton className="h-[260px] md:h-72 w-full rounded-none" />
        <div className="max-w-3xl mx-auto px-5 py-6 space-y-4">
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

  // ─── Derived data ───────────────────────────────────────────────────────────

  const tr: Trail = trail;
  const pathCoords = tr.path_data?.coordinates || [];
  const mapMarkers = spots.map((s: Spot) => ({
    id: s.id,
    lat: parseFloat(s.lat),
    lng: parseFloat(s.lng),
    title: s.name,
    emoji: SPOT_TYPE_LABELS[s.spot_type]?.emoji,
  }));

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

        {/* Smooth gradient overlay covering 60%+ of hero */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" style={{ top: "0%" }} />

        {/* Back button */}
        <button
          onClick={() => window.history.back()}
          className="absolute top-14 left-4 md:top-5 bg-black/40 backdrop-blur-md w-9 h-9 rounded-full flex items-center justify-center border border-white/10 z-10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>

        {/* Hero overlay content: title, region, stats, view count */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 text-white z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <DifficultyBadge difficulty={tr.difficulty} />
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm font-medium">
              {tr.region}
            </span>
            {/* View count in hero */}
            <span className="ml-auto flex items-center gap-1 text-[11px] text-white/70 font-medium">
              <IconEye size={12} className="text-white/60" />
              <span>{language === "ko" ? "조회" : ""} {tr.view_count.toLocaleString()}</span>
            </span>
          </div>
          <h1 className="text-[22px] md:text-[28px] font-bold leading-tight mb-3">{tr.title}</h1>

          {/* Stats row inside hero */}
          <div className="flex items-center gap-0 text-[13px] font-medium">
            {/* Distance */}
            <div className="flex items-center gap-1.5 pr-3">
              <IconRoute size={14} className="text-white/70" />
              <span>{formatDistance(tr.distance_km)}</span>
            </div>
            <div className="w-px h-3.5 bg-white/25" />
            {/* Duration */}
            <div className="flex items-center gap-1.5 px-3">
              <IconClock size={14} className="text-white/70" />
              <span>{formatDuration(tr.estimated_minutes)}</span>
            </div>
            <div className="w-px h-3.5 bg-white/25" />
            {/* Difficulty */}
            <div className="flex items-center gap-1.5 px-3">
              <IconSignal size={14} className="text-white/70" />
              <span>{difficultyLabel}</span>
            </div>
            {tr.elevation_gain && (
              <>
                <div className="w-px h-3.5 bg-white/25" />
                <div className="flex items-center gap-1.5 px-3">
                  <IconMountain size={14} className="text-white/70" />
                  <span>+{tr.elevation_gain}m</span>
                </div>
              </>
            )}
            {avgRating && (
              <>
                <div className="w-px h-3.5 bg-white/25" />
                <div className="flex items-center gap-1.5 pl-3">
                  <IconStar size={14} filled className="text-yellow-400" />
                  <span>{avgRating}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* STICKY HEADER: Action bar + Tabs                                   */}
      {/* ================================================================== */}
      <div className="sticky top-0 md:top-16 z-30 bg-surface border-b border-border-light">
        <div className="max-w-3xl mx-auto px-5">

          {/* Slim action buttons bar */}
          <div className="flex items-center gap-1.5 py-2.5 overflow-x-auto scrollbar-hide">
            {/* Like */}
            <button
              onClick={() => toggleLike.mutate(trailId)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all whitespace-nowrap ${
                tr.is_liked
                  ? "bg-red-50 text-red-500 border border-red-200"
                  : "bg-white border border-border-default text-text-secondary hover:text-text-primary"
              }`}
            >
              <IconHeart size={14} filled={tr.is_liked} className={tr.is_liked ? "text-red-500" : ""} />
              <span className="hidden md:inline">{tr.is_liked ? (language === "ko" ? "좋아요" : "Liked") : (language === "ko" ? "좋아요" : "Like")}</span>
              {tr.like_count > 0 && <span>{tr.like_count}</span>}
            </button>

            {/* Save */}
            <button
              onClick={handleToggleSave}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all ${
                isSaved
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-white border border-border-default text-text-secondary hover:text-text-primary"
              }`}
            >
              <IconBookmark size={14} filled={isSaved} className={isSaved ? "text-amber-600" : ""} />
              <span className="hidden md:inline">{isSaved ? (language === "ko" ? "저장됨" : "Saved") : (language === "ko" ? "저장" : "Save")}</span>
            </button>

            {/* Share */}
            <ShareButton
              title={tr.title}
              description={tr.description}
              url={typeof window !== "undefined" ? window.location.href : ""}
            />

            {/* GPX Download */}
            <button
              onClick={handleGpxDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-white border border-border-default text-text-secondary hover:text-text-primary transition-colors whitespace-nowrap"
              title="GPX"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span className="hidden md:inline">GPX</span>
            </button>

            {/* Edit button — only visible to trail author */}
            {isAuthenticated && user && tr.author && user.id === tr.author.id && (
              <Link
                href={`/trails/${trailId}/edit`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-white border border-border-default text-text-secondary hover:text-text-primary transition-colors whitespace-nowrap"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span className="hidden md:inline">
                  {language === "ko" ? "수정" : language === "ja" ? "編集" : language === "zh" ? "编辑" : "Edit"}
                </span>
              </Link>
            )}
          </div>

          {/* ─── TAB BAR ─── */}
          <div ref={tabBarRef} className="relative flex">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 md:flex-none md:px-5 py-3 text-[13px] md:text-[14px] font-semibold text-center transition-colors duration-200 relative ${
                  activeTab === tab.id
                    ? "text-primary"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {tab.label[language] || tab.label.en}
              </button>
            ))}
            {/* Animated indicator */}
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
      <div ref={tabContentRef} className="max-w-3xl mx-auto px-5 py-6">

        {/* ─── Tab 1: Overview ─── */}
        {activeTab === "overview" && (
          <div className="animate-fade-in space-y-5">
            {/* Trail Condition Banner */}
            <TrailConditionBanner condition={tr.latest_condition} language={language} />

            {/* Description Card */}
            <section className="rounded-2xl bg-white dark:bg-gray-900 p-5 mb-4 shadow-sm">
              <h2 className="text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
                <span className="border-l-[3px] border-primary h-5 inline-block" />
                {t("trail.description")}
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                {tr.description}
              </p>
              {tr.tags.length > 0 && (
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {tr.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center px-2.5 py-1 rounded-pill text-[12px] font-medium bg-bg-secondary text-text-secondary"
                    >
                      #{tag.name}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Interactive Map Card */}
            <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
              <div className="h-[280px] md:h-[360px] relative">
                <MapView
                  country={tr.country}
                  center={{
                    lat: parseFloat(tr.start_lat),
                    lng: parseFloat(tr.start_lng),
                  }}
                  zoom={14}
                  markers={mapMarkers}
                  pathCoordinates={pathCoords}
                  theme="dark"
                  showStats
                  distance={tr.distance_km}
                  duration={String(tr.estimated_minutes)}
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
              />
            </section>

            {/* Transport/Access Card */}
            {tr.transport_access && (
              <section className="rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-sm">
                <h3 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                  <span className="border-l-[3px] border-primary h-5 inline-block" />
                  <IconBus size={18} className="text-primary" />
                  {language === "ko" ? "교통/접근" : language === "ja" ? "アクセス" : language === "zh" ? "交通" : "Access"}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line mb-3">
                  {tr.transport_access}
                </p>
                {/* Google Maps directions deep link */}
                {tr.start_lat && tr.start_lng && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${tr.start_lat},${tr.start_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary/10 text-primary rounded-button text-[13px] font-semibold hover:bg-primary/20 transition-colors"
                  >
                    <IconNavigation size={14} className="text-primary" />
                    {language === "ko" ? "길찾기" : language === "ja" ? "ルート案内" : language === "zh" ? "导航" : "Directions"}
                  </a>
                )}
              </section>
            )}

            {/* Author Card */}
            <section className="rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-sm">
              <h3 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                <span className="border-l-[3px] border-primary h-5 inline-block" />
                {t("trail.author")}
              </h3>
              <Link
                href={`/profile/${tr.author.nickname}`}
                className="flex items-center gap-3 hover:bg-bg-secondary -m-2 p-2 rounded-[12px] transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#A8E6CF]/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {tr.author.profile_image ? (
                    <Image
                      src={tr.author.profile_image}
                      alt={tr.author.nickname}
                      width={40}
                      height={40}
                      className="object-cover"
                    />
                  ) : (
                    <IconUser size={20} className="text-primary/60" />
                  )}
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-sm font-semibold text-text-primary">{tr.author.nickname}</p>
                  {tr.author.is_guide && (
                    <span className="text-[11px] bg-[#f0f7f0] text-primary px-2 py-0.5 rounded-pill font-medium mt-0.5 inline-block w-fit">
                      {t("trail.certifiedGuide")}
                    </span>
                  )}
                </div>
              </Link>
            </section>
          </div>
        )}

        {/* ─── Tab 2: Course Info ─── */}
        {activeTab === "course" && (
          <div className="animate-fade-in space-y-5">
            {/* Elevation Profile */}
            {tr.path_data && tr.path_data.coordinates.length >= 2 && (
              <section className="rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-sm">
                <ElevationProfile pathData={tr.path_data} />
              </section>
            )}

            {/* Trail Segments */}
            {tr.segments && tr.segments.length > 0 && (
              <section className="rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-sm">
                <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                  <span className="border-l-[3px] border-primary h-5 inline-block" />
                  {language === "ko" ? "구간별 거리 / 시간" : language === "ja" ? "区間別距離・時間" : language === "zh" ? "分段距离 / 时间" : "Segments"}
                </h2>
                <TrailSegments segments={tr.segments} />
              </section>
            )}

            {/* Spot Timeline */}
            {spots.length > 0 && (
              <section className="rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-sm">
                <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                  <span className="border-l-[3px] border-primary h-5 inline-block" />
                  {t("trail.spotTimeline")}
                </h2>
                <SpotTimeline spots={visibleSpots} />
                {spots.length > 3 && !showAllSpots && (
                  <button
                    onClick={() => setShowAllSpots(true)}
                    className="mt-3 w-full py-2.5 text-[13px] font-medium text-primary bg-[#f0f7f0] dark:bg-primary/10 rounded-button hover:bg-[#d9eed9] dark:hover:bg-primary/20 transition-colors"
                  >
                    {moreLabel} ({spots.length - 3})
                  </button>
                )}
              </section>
            )}

            {/* Stamp Book */}
            <section className="rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-sm">
              <StampBook trailId={trailId} />
            </section>

            {/* Empty state if no course data */}
            {!tr.path_data?.coordinates?.length && !tr.segments?.length && spots.length === 0 && (
              <div className="text-center py-16 rounded-2xl bg-white dark:bg-gray-900 shadow-sm">
                <IconMapEmpty size={48} className="text-text-tertiary mx-auto mb-3" />
                <p className="text-sm text-text-tertiary">
                  {language === "ko" ? "상세 코스 정보가 아직 없어요" : language === "ja" ? "詳細なコース情報はまだありません" : language === "zh" ? "暂无详细路线信息" : "No detailed course info yet"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── Tab 3: Reviews ─── */}
        {activeTab === "reviews" && (
          <div className="animate-fade-in space-y-5">
            {/* Rating summary + write CTA */}
            <div className="rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {avgRating && (
                    <div className="flex items-center gap-2">
                      <span className="text-[28px] font-bold text-text-primary">{avgRating}</span>
                      <div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <IconStar
                              key={star}
                              size={14}
                              filled={star <= Math.round(Number(avgRating))}
                              className={star <= Math.round(Number(avgRating)) ? "text-yellow-400" : "text-gray-200 dark:text-gray-600"}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-text-tertiary mt-0.5">
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
                    className="px-4 py-2 bg-primary text-white rounded-button text-[13px] font-semibold"
                  >
                    {t("trail.writeReview")}
                  </button>
                )}
              </div>
            </div>

            {/* Review Form */}
            {showReviewForm && (
              <div className="rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-sm">
                <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                  <span className="border-l-[3px] border-primary h-5 inline-block" />
                  {t("review.write")}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[13px] text-text-secondary block mb-1.5">
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
                            size={24}
                            filled={star <= reviewForm.rating}
                            className={star <= reviewForm.rating ? "text-yellow-400" : "text-gray-200 dark:text-gray-600"}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[13px] text-text-secondary block mb-1.5">
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
                    <label className="text-[13px] text-text-secondary block mb-1.5">
                      {t("review.content")}
                    </label>
                    <textarea
                      value={reviewForm.content}
                      onChange={(e) => setReviewForm((p) => ({ ...p, content: e.target.value }))}
                      rows={4}
                      maxLength={1000}
                      placeholder={t("review.placeholder")}
                      className="input-field resize-none"
                    />
                  </div>
                  {/* Image upload (max 3) */}
                  <div>
                    <label className="text-[13px] text-text-secondary block mb-1.5">
                      {language === "ko" ? "사진 (최대 3장)" : language === "ja" ? "写真 (最大3枚)" : language === "zh" ? "照片 (最多3张)" : "Photos (max 3)"}
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      <input id="review-img-input" type="file" accept="image/*" multiple className="hidden" onChange={handleReviewImagePick} />
                      {reviewImages.length < 3 && (
                        <label htmlFor="review-img-input" className="w-[72px] h-[72px] rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        </label>
                      )}
                      {reviewPreviews.map((url, i) => (
                        <div key={i} className="relative">
                          <img src={url} alt="" className="w-[72px] h-[72px] rounded-xl object-cover" />
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
                      className="px-4 py-2 text-[13px] font-medium text-text-secondary hover:bg-bg-secondary rounded-button transition-colors"
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      onClick={handleSubmitReview}
                      disabled={!reviewForm.content || createReview.isPending}
                      className="px-5 py-2 bg-primary text-white rounded-button text-[13px] font-semibold disabled:opacity-50"
                    >
                      {createReview.isPending ? t("review.submitting") : t("review.submit")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Review List */}
            {reviews.length > 0 ? (
              <div className="space-y-3">
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
                <div className="text-center py-16 rounded-2xl bg-white dark:bg-gray-900 shadow-sm">
                  <IconPencil size={48} className="text-text-tertiary mx-auto mb-3" />
                  <p className="text-sm text-text-tertiary mb-3">
                    {language === "ko" ? "첫 번째 리뷰를 남겨보세요!" : language === "ja" ? "最初のレビューを書いてみましょう！" : language === "zh" ? "留下第一条评价吧！" : "Be the first to review!"}
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
          <div className="animate-fade-in space-y-5">
            {/* Activity Records */}
            {activities.length > 0 ? (
              <section className="rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <span className="border-l-[3px] border-primary h-5 inline-block" />
                    {t("activities.title")}
                  </h2>
                </div>
                {/* Summary stats */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs text-text-tertiary">
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
                <div className="space-y-2">
                  {activities.slice(0, 10).map((act: ActivityTrack) => (
                    <Link key={act.id} href={`/activities/${act.id}`} className="block p-3.5 rounded-xl border border-border-light hover:border-border-default hover:shadow-soft transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#A8E6CF]/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {act.user?.profile_image ? (
                              <Image src={act.user.profile_image} alt="" width={36} height={36} className="rounded-full object-cover" />
                            ) : (
                              <IconUser size={18} className="text-primary/60" />
                            )}
                          </div>
                          <div className="flex flex-col justify-center">
                            <p className="text-[13px] font-semibold text-text-primary">{act.user?.nickname}</p>
                            <p className="text-xs text-text-tertiary">
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
              <div className="text-center py-16 rounded-2xl bg-white dark:bg-gray-900 shadow-sm">
                <IconWalker size={48} className="text-text-tertiary mx-auto mb-3" />
                <p className="text-sm text-text-tertiary">
                  {language === "ko" ? "아직 활동 기록이 없어요" : language === "ja" ? "まだ活動記録がありません" : language === "zh" ? "暂无活动记录" : "No activity records yet"}
                </p>
              </div>
            )}

            {/* Completion Certificate button */}
            {isAuthenticated && (tr as any).is_completed && (
              <section className="rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#f0f7f0] dark:bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                        <circle cx="12" cy="8" r="6" />
                        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
                      </svg>
                    </div>
                    <div className="flex flex-col justify-center">
                      <p className="text-sm font-semibold text-text-primary">
                        {language === "ko" ? "완주 인증서" : language === "ja" ? "完走証明書" : language === "zh" ? "完成证书" : "Completion Certificate"}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        {language === "ko" ? "이 코스를 완주했어요!" : language === "ja" ? "このコースを完走しました！" : language === "zh" ? "已完成此路线！" : "You completed this trail!"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={loadCertificate}
                    disabled={certLoading}
                    className="px-4 py-2 bg-primary text-white rounded-button text-[13px] font-semibold disabled:opacity-50 transition-all"
                  >
                    {certLoading ? "..." : certLabel}
                  </button>
                </div>
              </section>
            )}

            {/* Walk in app CTA */}
            <section className="rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-sm text-center">
              <p className="text-sm text-text-secondary mb-3">
                {language === "ko" ? "이 코스를 직접 걸어보세요" : language === "ja" ? "このコースを歩いてみましょう" : language === "zh" ? "亲自走走这条路线吧" : "Walk this trail yourself"}
              </p>
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  alert(language === "ko" ? "걷기 기록은 모바일 앱에서 시작할 수 있어요." : language === "ja" ? "ウォーキング記録はモバイルアプリで開始できます。" : language === "zh" ? "请在移动应用中开始步行记录。" : "Start walk recording in the mobile app.");
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-button text-[13px] font-semibold"
              >
                <IconSmartphone size={15} />
                {language === "ko" ? "앱에서 걷기" : language === "ja" ? "アプリで歩く" : language === "zh" ? "在应用中步行" : "Walk in app"}
              </a>
            </section>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* Certificate Modal                                                  */}
      {/* ================================================================== */}
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
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border-default">
              <button
                onClick={() => setShowCertificate(false)}
                className="px-4 py-2 text-[13px] font-medium text-text-secondary hover:bg-bg-secondary rounded-button transition-colors"
              >
                {certCloseLabel}
              </button>
              <button
                onClick={handleCertificateNewTab}
                className="px-4 py-2 text-[13px] font-medium text-primary bg-[#f0f7f0] dark:bg-primary/10 rounded-button hover:bg-[#d9eed9] dark:hover:bg-primary/20 transition-colors"
              >
                {language === "ko" ? "새 탭에서 보기" : "Open in new tab"}
              </button>
              <button
                onClick={handleCertificateDownload}
                className="px-5 py-2 bg-primary text-white rounded-button text-[13px] font-semibold"
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
