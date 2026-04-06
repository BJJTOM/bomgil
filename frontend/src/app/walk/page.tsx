"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapView } from "@/components/MapView";
import { useAuthStore } from "@/stores/auth";
import { useT } from "@/stores/language";
import { useCreateActivityJSON } from "@/hooks/useActivities";

type WalkState = "ready" | "countdown" | "walking" | "paused" | "completed";

interface TrackPoint {
  lat: number;
  lng: number;
  ele: number | null;
  time: string;
}

export default function WalkPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { t, language } = useT();
  const createActivity = useCreateActivityJSON();

  const [state, setState] = useState<WalkState>("ready");
  const [countdown, setCountdown] = useState(3);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [currentPos, setCurrentPos] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [gpsReady, setGpsReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(true);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  const haversine = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Location permission is now requested via the custom modal instead of auto-requesting

  const handlePosition = (pos: GeolocationPosition) => {
    const point: TrackPoint = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      ele: pos.coords.altitude,
      time: new Date().toISOString(),
    };

    setCurrentPos({ lat: point.lat, lng: point.lng });

    setTrackPoints((prev) => {
      const newPoints = [...prev, point];
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        const d = haversine(last.lat, last.lng, point.lat, point.lng);
        if (d > 0.003) {
          setDistance((prevDist) => prevDist + d);
          return newPoints;
        }
        return prev;
      }
      return newPoints;
    });
  };

  const beginCountdown = () => {
    setState("countdown");
    setCountdown(3);
    let count = 3;
    const timer = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(timer);
        actuallyStartWalk();
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  const actuallyStartWalk = () => {
    setState("walking");
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setElapsed(
        Math.floor(
          (Date.now() - startTimeRef.current + pausedTimeRef.current) / 1000,
        ),
      );
    }, 1000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      (err) => console.error("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );
  };

  const pauseWalk = () => {
    setState("paused");
    pausedTimeRef.current += Date.now() - startTimeRef.current;
    if (timerRef.current) clearInterval(timerRef.current);
    if (watchIdRef.current !== null)
      navigator.geolocation.clearWatch(watchIdRef.current);
  };

  const resumeWalk = () => {
    setState("walking");
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(
        Math.floor(
          (Date.now() - startTimeRef.current + pausedTimeRef.current) / 1000,
        ),
      );
    }, 1000);
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );
  };

  const completeWalk = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (watchIdRef.current !== null)
      navigator.geolocation.clearWatch(watchIdRef.current);

    if (isAuthenticated) {
      try {
        const dateLabel = new Date().toLocaleDateString(language, { month: "long", day: "numeric" });
        await createActivity.mutateAsync({
          track_points: trackPoints,
          source: "phone_gps",
          title: `${dateLabel} ${t("walk.walkTitle")}`,
          total_steps: Math.round(distance * 1300),
          calories_burned: Math.round(distance * 65),
        });
      } catch (e) {
        console.error(e);
      }
    }

    const params = new URLSearchParams({
      distance: distance.toFixed(2),
      duration: String(elapsed),
      steps: String(Math.round(distance * 1300)),
      calories: String(Math.round(distance * 65)),
      points: JSON.stringify(
        trackPoints.filter(
          (_, i) =>
            i %
              Math.max(1, Math.floor(trackPoints.length / 200)) ===
            0,
        ),
      ),
    });
    router.push(`/walk/complete?${params.toString()}`);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const pace = elapsed > 0 && distance > 0.01 ? elapsed / 60 / distance : 0;
  const paceMin = Math.floor(pace);
  const paceSec = Math.round((pace - paceMin) * 60);

  const pathCoords: [number, number][] = trackPoints.map((p) => [p.lng, p.lat]);

  // Ready state
  if (state === "ready") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-[#1a2f1b] to-[#0d1a0e] flex flex-col items-center justify-center z-50">
        {showPermissionModal && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center px-8">
            <div className="bg-white rounded-[24px] p-6 max-w-[320px] w-full text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2D4A2E" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <h3 className="text-[17px] font-bold mb-2">위치 정보 사용</h3>
              <p className="text-[13px] text-text-secondary mb-5 leading-relaxed">
                걷기 경로를 기록하려면 위치 정보 접근이 필요합니다
              </p>
              <button
                onClick={() => {
                  setShowPermissionModal(false);
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => { setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsReady(true); },
                      () => { setGpsReady(true); },
                      { enableHighAccuracy: true, timeout: 5000 }
                    );
                  } else {
                    setGpsReady(true);
                  }
                }}
                className="w-full py-3.5 bg-primary text-white rounded-[14px] text-[15px] font-semibold mb-2"
              >
                허용
              </button>
              <button
                onClick={() => { setShowPermissionModal(false); setGpsReady(true); }}
                className="w-full py-3 text-text-tertiary text-[14px]"
              >
                나중에
              </button>
            </div>
          </div>
        )}
        <div className="relative z-10 flex flex-col items-center">
          {/* GPS status */}
          <div className={`flex items-center gap-2 mb-10 px-4 py-2 rounded-pill ${gpsReady ? "bg-green-500/20" : "bg-white/10"}`}>
            <div className={`w-2 h-2 rounded-full ${gpsReady ? "bg-green-400" : "bg-yellow-400 animate-pulse"}`} />
            <span className={`text-[13px] font-medium ${gpsReady ? "text-green-400" : "text-white/60"}`}>
              {gpsReady ? t("walk.gpsReady") : t("walk.gpsSearching")}
            </span>
          </div>

          {/* Brand */}
          <p className="text-white/20 text-[13px] font-medium tracking-[0.3em] uppercase mb-16" style={{ fontFamily: "'DM Sans', sans-serif" }}>MORU</p>

          {/* Start button */}
          <button
            onClick={beginCountdown}
            className="relative w-[140px] h-[140px] rounded-full bg-[#2D4A2E] text-white text-[18px] font-bold active:scale-95 transition-transform"
          >
            {/* Pulse rings */}
            <span className="absolute inset-0 rounded-full border-2 border-[#A8E6CF]/30 animate-ping" style={{ animationDuration: "2s" }} />
            <span className="absolute -inset-4 rounded-full border border-[#A8E6CF]/15 animate-pulse" />
            {t("walk.start")}
          </button>

          {/* Hint */}
          <p className="text-white/25 text-[13px] mt-12">
            {language === "ko" ? "GPS로 경로가 자동 기록됩니다" : "Your route will be tracked via GPS"}
          </p>
        </div>

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-14 left-5 text-white/40 text-[14px] flex items-center gap-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          {language === "ko" ? "돌아가기" : "Back"}
        </button>
      </div>
    );
  }

  // Countdown state
  if (state === "countdown") {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center z-50">
        <p className="text-white/15 text-[14px] font-semibold tracking-[0.4em] mb-12">MORU</p>
        <div className="w-[160px] h-[160px] rounded-full bg-[#2D4A2E] flex items-center justify-center shadow-[0_0_60px_rgba(45,74,46,0.4)] animate-pulse">
          <span className="text-white text-[64px] font-extrabold">{countdown}</span>
        </div>
        <p className="text-white/20 text-[14px] mt-12 tracking-wide">경로 자동 기록</p>
      </div>
    );
  }

  // Walking / Paused state
  return (
    <div className="fixed inset-0 bg-[#111] flex flex-col z-50">
      <div className="flex-1 relative">
        <MapView
          center={currentPos || undefined}
          zoom={16}
          theme="dark"
          pathCoordinates={pathCoords}
          markers={
            currentPos
              ? [
                  {
                    id: 999,
                    lat: currentPos.lat,
                    lng: currentPos.lng,
                    title: t("walk.currentLocation"),
                    emoji: "📍",
                  },
                ]
              : []
          }
          className="w-full h-full"
        />

        {locked && (
          <div
            className="absolute inset-0 bg-black/60 flex items-center justify-center z-20"
            onClick={() => setLocked(false)}
          >
            <div className="text-center">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="1.5"
                className="mx-auto mb-3"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <p className="text-white/60 text-[14px]">{t("walk.tapToUnlock")}</p>
            </div>
          </div>
        )}

        <div className="absolute top-12 left-0 right-0 flex justify-center z-10">
          <div className="bg-black/50 backdrop-blur-md rounded-full px-5 py-2 flex items-center gap-3">
            <div
              className={`w-2 h-2 rounded-full ${state === "walking" ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`}
            />
            <span className="text-white/80 text-[13px] font-medium">
              {state === "walking" ? t("walk.recording") : t("walk.paused")}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-[#111] border-t border-white/10 px-6 pt-6 pb-8">
        <div className="text-center mb-5">
          <div className="text-[56px] font-bold text-white font-en leading-none tracking-tight">
            {distance.toFixed(2)}
          </div>
          <div className="text-[13px] text-white/40 font-medium tracking-wider uppercase mt-1">
            {t("walk.km")}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center">
            <div className="text-[22px] font-bold text-white font-en">
              {formatTime(elapsed)}
            </div>
            <div className="text-[11px] text-white/40 mt-0.5">{t("walk.time")}</div>
          </div>
          <div className="text-center">
            <div className="text-[22px] font-bold text-[#A8E6CF] font-en">
              {pace > 0
                ? `${paceMin}'${String(paceSec).padStart(2, "0")}"`
                : "--'--\""}
            </div>
            <div className="text-[11px] text-white/40 mt-0.5">{t("walk.pace")}</div>
          </div>
          <div className="text-center">
            <div className="text-[22px] font-bold text-white font-en">
              {Math.round(distance * 65)}
            </div>
            <div className="text-[11px] text-white/40 mt-0.5">kcal</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6">
          {state === "walking" ? (
            <>
              <button
                onClick={() => setLocked(true)}
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </button>

              <button
                onClick={pauseWalk}
                className="w-[72px] h-[72px] rounded-full bg-white flex items-center justify-center active:scale-90 transition-transform"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#111">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              </button>

              <div className="w-12 h-12" />
            </>
          ) : (
            <>
              <button
                onClick={() => setShowStopModal(true)}
                className="w-[60px] h-[60px] rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition-transform"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>

              <button
                onClick={resumeWalk}
                className="w-[72px] h-[72px] rounded-full bg-[#2D4A2E] flex items-center justify-center active:scale-90 transition-transform"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                  <polygon points="6,3 20,12 6,21" />
                </svg>
              </button>

              <div className="w-[60px] h-[60px]" />
            </>
          )}
        </div>
      </div>

      {/* Stop Confirmation Modal */}
      {showStopModal && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center px-8">
          <div className="bg-[#1a1a1a] rounded-[24px] p-7 w-full max-w-[340px] text-center">
            <div className="w-14 h-14 rounded-full bg-white/6 flex items-center justify-center mx-auto mb-4">
              <span className="text-[28px]">🚶</span>
            </div>
            <h3 className="text-[18px] font-bold text-white mb-5">걷기를 종료할까요?</h3>
            <div className="flex bg-white/4 rounded-2xl py-4 mb-6">
              <div className="flex-1 text-center">
                <div className="text-[18px] font-bold text-white">{distance.toFixed(2)}</div>
                <div className="text-[11px] text-white/40">km</div>
              </div>
              <div className="w-px h-7 bg-white/8 self-center" />
              <div className="flex-1 text-center">
                <div className="text-[18px] font-bold text-white">{formatTime(elapsed)}</div>
                <div className="text-[11px] text-white/40">시간</div>
              </div>
              <div className="w-px h-7 bg-white/8 self-center" />
              <div className="flex-1 text-center">
                <div className="text-[18px] font-bold text-white">{Math.round(distance * 1300).toLocaleString()}</div>
                <div className="text-[11px] text-white/40">걸음</div>
              </div>
            </div>
            <button
              onClick={() => { setShowStopModal(false); completeWalk(); }}
              className="w-full py-4 bg-red-500 text-white rounded-[14px] text-[16px] font-bold mb-2.5"
            >
              종료하기
            </button>
            <button
              onClick={() => setShowStopModal(false)}
              className="w-full py-3.5 text-white/50 text-[15px] font-medium"
            >
              계속 걷기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
