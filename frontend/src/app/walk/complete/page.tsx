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
  const points: { lat: number; lng: number; ele?: number | null }[] = JSON.parse(searchParams.get("points") || "[]");

  const pathCoords: [number, number][] = points.map((p) => [p.lng, p.lat]);
  const center = points.length > 0
    ? { lat: points[Math.floor(points.length / 2)].lat, lng: points[Math.floor(points.length / 2)].lng }
    : undefined;

  // Compute KM splits using haversine
  const splits = (() => {
    if (points.length < 2 || distance < 1) return [] as { km: number; pace: string }[];
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const result: { km: number; pace: string }[] = [];
    let cumDist = 0;
    let cumTime = 0;
    let lastSplitDist = 0;
    let lastSplitTime = 0;
    // We don't have per-point timestamps; distribute time evenly
    const timePerPoint = duration / Math.max(1, points.length - 1);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
      cumDist += 2 * R * Math.asin(Math.sqrt(x));
      cumTime += timePerPoint;
      while (cumDist - lastSplitDist >= 1) {
        const splitTime = cumTime - lastSplitTime;
        const splitMin = splitTime / 60;
        const m = Math.floor(splitMin);
        const s = Math.round((splitMin - m) * 60);
        result.push({ km: result.length + 1, pace: `${m}'${String(s).padStart(2, "0")}"` });
        lastSplitDist += 1;
        lastSplitTime = cumTime;
      }
    }
    return result;
  })();

  // Elevation summary
  const elevations = points.map((p) => p.ele).filter((e): e is number => e != null);
  const eleGain = (() => {
    if (elevations.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < elevations.length; i++) {
      const diff = elevations[i] - elevations[i - 1];
      if (diff > 0) total += diff;
    }
    return Math.round(total);
  })();
  const minEle = elevations.length ? Math.min(...elevations) : 0;
  const maxEle = elevations.length ? Math.max(...elevations) : 0;

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

          {/* Splits */}
          {splits.length > 0 && (
            <div className="mx-6 mb-5">
              <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2">Splits</p>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                {splits.slice(0, 6).map((s) => (
                  <div key={s.km} className="flex items-center gap-2">
                    <span className="text-[11px] text-white/40 w-8">{s.km}km</span>
                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-[#A8E6CF]" style={{ width: "100%" }} />
                    </div>
                    <span className="text-[12px] text-white font-en font-semibold w-12 text-right">{s.pace}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Elevation summary */}
          {elevations.length > 1 && (
            <div className="mx-6 mb-5 grid grid-cols-3 gap-px bg-white/5 rounded-[12px] overflow-hidden">
              <div className="bg-[#162416] p-3 text-center">
                <div className="text-[15px] font-bold text-white font-en">+{eleGain}m</div>
                <div className="text-[10px] text-white/40 mt-0.5">상승</div>
              </div>
              <div className="bg-[#162416] p-3 text-center">
                <div className="text-[15px] font-bold text-white font-en">{Math.round(minEle)}m</div>
                <div className="text-[10px] text-white/40 mt-0.5">최저</div>
              </div>
              <div className="bg-[#162416] p-3 text-center">
                <div className="text-[15px] font-bold text-white font-en">{Math.round(maxEle)}m</div>
                <div className="text-[10px] text-white/40 mt-0.5">최고</div>
              </div>
            </div>
          )}

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

        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.setItem(
                "moru_walk_to_trail",
                JSON.stringify({
                  distance,
                  duration,
                  steps,
                  calories,
                  eleGain,
                  points,
                  pathCoords,
                  savedAt: Date.now(),
                }),
              );
            } catch {}
            router.push("/trails/new?from=walk");
          }}
          className="w-full py-3.5 bg-white/10 text-white/80 rounded-[16px] text-[14px] font-medium text-center active:scale-[0.98] transition-transform"
        >
          코스로 등록하기
        </button>

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
