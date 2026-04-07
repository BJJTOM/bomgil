"use client";

import { Suspense, useRef, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { MapView } from "@/components/MapView";
import { useT } from "@/stores/language";
import Link from "next/link";

function WalkCompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t, language } = useT();
  const cardRef = useRef<HTMLDivElement>(null);
  const [showConfetti, setShowConfetti] = useState(true);

  const distance = parseFloat(searchParams.get("distance") || "0");
  const duration = parseInt(searchParams.get("duration") || "0");
  const steps = parseInt(searchParams.get("steps") || "0");
  const calories = parseInt(searchParams.get("calories") || "0");
  const points = JSON.parse(searchParams.get("points") || "[]");

  const pathCoords: [number, number][] = points.map((p: any) => [p.lng, p.lat]);
  const center = points.length > 0
    ? { lat: points[Math.floor(points.length / 2)].lat, lng: points[Math.floor(points.length / 2)].lng }
    : undefined;

  // Format time
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = duration % 60;
  const timeStr = hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // Pace
  const pace = duration > 0 && distance > 0.01 ? duration / 60 / distance : 0;
  const paceMin = Math.floor(pace);
  const paceSec = Math.round((pace - paceMin) * 60);
  const paceStr = pace > 0 ? `${paceMin}'${String(paceSec).padStart(2, "0")}"` : "--";

  // Date
  const dateStr = new Date().toLocaleDateString(language, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  // Hide confetti after 3s
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Share via Web Share API
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Moru - ${distance.toFixed(2)}km ${t("walk.finish")}!`,
          text: `${distance.toFixed(2)}km, ${steps.toLocaleString()} ${t("activities.steps")}, ${timeStr}`,
          url: typeof window !== "undefined" ? window.location.origin : "https://moruwalk.com",
        });
      } catch {}
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center overflow-y-auto z-50">
      {/* Confetti effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                backgroundColor: ["#A8E6CF", "#2D4A2E", "#FFD93D", "#FF6B6B", "#6BCB77", "#4D96FF"][i % 6],
                animation: `confetti-fall ${2 + Math.random() * 2}s ease-in forwards`,
                animationDelay: `${Math.random() * 0.5}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="w-full max-w-md px-5 pt-14 pb-4 text-center">
        <p className="text-[#A8E6CF] text-[14px] font-semibold tracking-widest uppercase animate-fade-in">WALK COMPLETED</p>
        <h1 className="text-white text-[24px] font-bold mt-2 animate-slide-up">{t("walk.completed")}</h1>
      </div>

      {/* Share Card */}
      <div ref={cardRef} className="w-full max-w-md mx-auto px-5 mb-6">
        <div className="bg-gradient-to-b from-[#1a2f1b] via-[#162416] to-[#0d1a0e] rounded-[24px] overflow-hidden shadow-2xl border border-white/5">
          {/* Brand */}
          <div className="px-6 pt-6 pb-2">
            <span className="text-[#A8E6CF]/60 text-[12px] font-bold tracking-[0.2em] uppercase" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              MORU
            </span>
          </div>

          {/* Big distance */}
          <div className="px-6 pb-4">
            <div className="flex items-baseline gap-1">
              <span className="text-[64px] font-bold text-white font-en leading-none tracking-tight">
                {distance.toFixed(2)}
              </span>
              <span className="text-[18px] text-white/40 font-medium">km</span>
            </div>
          </div>

          {/* Mini route map */}
          {pathCoords.length > 2 && (
            <div className="mx-6 mb-5 h-[180px] rounded-[16px] overflow-hidden border border-white/5">
              <MapView
                center={center}
                pathCoordinates={pathCoords}
                zoom={14}
                theme="dark"
                className="w-full h-full"
              />
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-px bg-white/5 mx-6 rounded-[12px] overflow-hidden mb-5">
            <div className="bg-[#162416] p-4 text-center">
              <div className="text-[20px] font-bold text-white font-en">{timeStr}</div>
              <div className="text-[11px] text-white/40 mt-1">{t("walk.time")}</div>
            </div>
            <div className="bg-[#162416] p-4 text-center">
              <div className="text-[20px] font-bold text-[#A8E6CF] font-en">{paceStr}</div>
              <div className="text-[11px] text-white/40 mt-1">{t("walk.pace")}</div>
            </div>
            <div className="bg-[#162416] p-4 text-center">
              <div className="text-[20px] font-bold text-white font-en">{calories}</div>
              <div className="text-[11px] text-white/40 mt-1">kcal</div>
            </div>
          </div>

          {/* Steps + Date */}
          <div className="px-6 pb-5">
            <p className="text-white/80 text-[15px] font-semibold">{steps.toLocaleString()} {t("activities.steps")}</p>
            <p className="text-white/30 text-[13px] mt-1">{dateStr}</p>
          </div>

          {/* Footer branding */}
          <div className="border-t border-white/5 px-6 py-3 flex items-center justify-between">
            <span className="text-white/20 text-[11px]">moruwalk.com</span>
            <span className="text-white/20 text-[11px]">Walk. Discover. Connect.</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-md px-5 pb-10 space-y-3">
        <button
          onClick={handleShare}
          className="w-full py-4 bg-[#2D4A2E] text-white rounded-[16px] text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          {t("walk.shareWalk")}
        </button>

        <Link
          href="/trails/new"
          className="w-full py-3.5 bg-white/10 text-white/80 rounded-[16px] text-[14px] font-medium text-center active:scale-[0.98] transition-transform block"
        >
          코스로 등록하기
        </Link>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/activities"
            className="py-3.5 bg-white/10 text-white/80 rounded-[16px] text-[14px] font-medium text-center active:scale-[0.98] transition-transform"
          >
            {t("walk.viewRecords")}
          </Link>
          <Link
            href="/"
            className="py-3.5 bg-white/10 text-white/80 rounded-[16px] text-[14px] font-medium text-center active:scale-[0.98] transition-transform"
          >
            {t("walk.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function WalkCompletePage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-[#0a0a0a]" />}>
      <WalkCompleteContent />
    </Suspense>
  );
}
