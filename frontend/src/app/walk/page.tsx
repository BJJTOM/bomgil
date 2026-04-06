"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { useT } from "@/stores/language";
import { useCreateActivityJSON } from "@/hooks/useActivities";

type WalkState = "countdown" | "walking" | "paused";

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

  const [state, setState] = useState<WalkState>("countdown");
  const [countdown, setCountdown] = useState(3);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [showStopModal, setShowStopModal] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  // Leaflet refs — map initialized once, layers updated incrementally
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const posMarkerRef = useRef<any>(null);
  const mapInitializedRef = useRef(false);

  const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // --- Initialize Leaflet map once when walking starts ---
  const initMap = useCallback(async (lat: number, lng: number) => {
    if (mapInitializedRef.current || !mapContainerRef.current) return;
    try {
      const L = (await import("leaflet")).default;
      leafletRef.current = L;

      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);

      // Create empty polyline — points added incrementally
      polylineRef.current = L.polyline([], {
        color: "#4ADE80", weight: 5, opacity: 0.9, lineCap: "round", lineJoin: "round",
      }).addTo(map);

      // Glow polyline
      L.polyline([], {
        color: "#4ADE80", weight: 12, opacity: 0.15, lineCap: "round", lineJoin: "round",
      }).addTo(map);

      // Current position marker
      const posIcon = L.divIcon({
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center">
          <div style="width:16px;height:16px;background:#4ADE80;border-radius:50%;border:3px solid white;box-shadow:0 0 12px rgba(74,222,128,0.6);z-index:2"></div>
          <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(74,222,128,0.2);animation:mapPulse 2s infinite"></div>
        </div>`,
        className: "", iconSize: [28, 28], iconAnchor: [14, 14],
      });
      posMarkerRef.current = L.marker([lat, lng], { icon: posIcon, interactive: false }).addTo(map);

      mapRef.current = map;
      mapInitializedRef.current = true;

      setTimeout(() => { try { map.invalidateSize(); } catch {} }, 200);
    } catch (e) {
      console.error("Map init error:", e);
    }
  }, []);

  // --- Update map when position changes (no destroy/recreate!) ---
  const updateMap = useCallback((lat: number, lng: number) => {
    if (!mapRef.current || !leafletRef.current) return;
    const L = leafletRef.current;

    // Pan to new position
    mapRef.current.setView([lat, lng], mapRef.current.getZoom(), { animate: true, duration: 0.5 });

    // Add point to polyline (incremental!)
    if (polylineRef.current) {
      polylineRef.current.addLatLng([lat, lng]);
    }

    // Move position marker
    if (posMarkerRef.current) {
      posMarkerRef.current.setLatLng([lat, lng]);
    }
  }, []);

  // --- Countdown ---
  useEffect(() => {
    if (state !== "countdown") return;

    // Request GPS during countdown
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    let count = 3;
    const timer = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(timer);
        startWalk();
      } else {
        setCountdown(count);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Start walk ---
  const startWalk = () => {
    setState("walking");
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current + pausedTimeRef.current) / 1000));
    }, 1000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point: TrackPoint = {
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          ele: pos.coords.altitude, time: new Date().toISOString(),
        };
        setCurrentPos({ lat: point.lat, lng: point.lng });

        setTrackPoints((prev) => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const d = haversine(last.lat, last.lng, point.lat, point.lng);
            if (d > 0.003) {
              setDistance((prevDist) => prevDist + d);
              updateMap(point.lat, point.lng);
              return [...prev, point];
            }
            return prev;
          }
          return [...prev, point];
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  };

  // --- Init map when walking state renders ---
  useEffect(() => {
    if (state !== "walking" && state !== "paused") return;
    const pos = currentPos || { lat: 37.5665, lng: 126.978 };
    // Small delay for DOM to render
    const timer = setTimeout(() => initMap(pos.lat, pos.lng), 100);
    return () => clearTimeout(timer);
  }, [state === "walking" || state === "paused"]);

  // --- Cleanup ---
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (mapRef.current) { try { mapRef.current.remove(); } catch {} }
    };
  }, []);

  const pauseWalk = () => {
    setState("paused");
    pausedTimeRef.current += Date.now() - startTimeRef.current;
    if (timerRef.current) clearInterval(timerRef.current);
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
  };

  const resumeWalk = () => {
    setState("walking");
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current + pausedTimeRef.current) / 1000));
    }, 1000);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point: TrackPoint = {
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          ele: pos.coords.altitude, time: new Date().toISOString(),
        };
        setCurrentPos({ lat: point.lat, lng: point.lng });
        setTrackPoints((prev) => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const d = haversine(last.lat, last.lng, point.lat, point.lng);
            if (d > 0.003) {
              setDistance((prevDist) => prevDist + d);
              updateMap(point.lat, point.lng);
              return [...prev, point];
            }
            return prev;
          }
          return [...prev, point];
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  };

  const completeWalk = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);

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
      } catch (e) { console.error(e); }
    }

    const params = new URLSearchParams({
      distance: distance.toFixed(2),
      duration: String(elapsed),
      steps: String(Math.round(distance * 1300)),
      calories: String(Math.round(distance * 65)),
      points: JSON.stringify(trackPoints.filter((_, i) => i % Math.max(1, Math.floor(trackPoints.length / 200)) === 0)),
    });
    router.push(`/walk/complete?${params.toString()}`);
  };

  const pace = elapsed > 0 && distance > 0.01 ? elapsed / 60 / distance : 0;
  const paceMin = Math.floor(pace);
  const paceSec = Math.round((pace - paceMin) * 60);
  const steps = Math.round(distance * 1300);
  const calories = Math.round(distance * 65);

  // ---- COUNTDOWN ----
  if (state === "countdown") {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center z-50">
        <button onClick={() => router.back()} className="absolute top-14 left-5 w-9 h-9 rounded-full bg-white/8 flex items-center justify-center">
          <span className="text-white/50 text-lg">&larr;</span>
        </button>
        <p className="text-white/15 text-[14px] font-semibold tracking-[0.4em] mb-12">MORU</p>
        <div className="w-[160px] h-[160px] rounded-full bg-[#2D4A2E] flex items-center justify-center shadow-[0_0_60px_rgba(45,74,46,0.4)] animate-pulse">
          <span className="text-white text-[64px] font-extrabold">{countdown}</span>
        </div>
        <p className="text-white/20 text-[14px] mt-12 tracking-wide">{language === "ko" ? "경로 자동 기록" : "Route auto-recording"}</p>
      </div>
    );
  }

  // ---- WALKING / PAUSED ----
  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col z-50">
      {/* Pulse animation style */}
      <style jsx global>{`
        @keyframes mapPulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>

      {/* === MAP: top 48% === */}
      <div className="relative" style={{ height: "48vh" }}>
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Status pill - top left */}
        <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2 bg-black/65 backdrop-blur-sm rounded-full px-3.5 py-1.5">
          <div className={`w-2 h-2 rounded-full ${state === "walking" ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} />
          <span className="text-white/85 text-[13px] font-semibold">
            {state === "walking" ? (language === "ko" ? "기록 중" : "Recording") : (language === "ko" ? "일시정지" : "Paused")}
          </span>
        </div>
      </div>

      {/* === STATS === */}
      <div className="flex-1 flex flex-col items-center justify-center px-7">
        {/* Time */}
        <p className="text-[11px] font-medium text-white/30 uppercase tracking-[2px] mb-0.5">{language === "ko" ? "시간" : "TIME"}</p>
        <p className="text-[20px] font-bold text-white/70 tabular-nums mb-1">{formatTime(elapsed)}</p>

        {/* Distance */}
        <div className="flex items-baseline mb-0.5">
          <span className="text-[52px] font-extrabold text-white tracking-tight leading-none">{distance.toFixed(2)}</span>
          <span className="text-[16px] font-medium text-white/35 ml-1.5 mb-1.5">km</span>
        </div>

        {/* Pace */}
        <div className="flex items-baseline gap-1.5 mb-5">
          <span className="text-[12px] text-white/35">{language === "ko" ? "현재 페이스" : "Pace"}</span>
          <span className="text-[22px] font-bold text-[#4ADE80]">
            {pace > 0 ? `${paceMin}'${String(paceSec).padStart(2, "0")}"` : "--'--\""}
          </span>
          <span className="text-[12px] text-white/25">/km</span>
        </div>

        {/* 4-stat grid */}
        <div className="w-full flex bg-white/4 rounded-2xl py-3.5">
          <div className="flex-1 text-center">
            <div className="text-[16px] font-bold text-white">{steps.toLocaleString()}</div>
            <div className="text-[10px] text-white/35 uppercase tracking-wide">{language === "ko" ? "걸음" : "Steps"}</div>
          </div>
          <div className="w-px h-7 bg-white/6 self-center" />
          <div className="flex-1 text-center">
            <div className="text-[16px] font-bold text-white">{calories}</div>
            <div className="text-[10px] text-white/35 uppercase tracking-wide">kcal</div>
          </div>
          <div className="w-px h-7 bg-white/6 self-center" />
          <div className="flex-1 text-center">
            <div className="text-[16px] font-bold text-white">{distance > 0 && elapsed > 0 ? ((distance / elapsed) * 3600).toFixed(1) : "0.0"}</div>
            <div className="text-[10px] text-white/35 uppercase tracking-wide">km/h</div>
          </div>
        </div>
      </div>

      {/* === CONTROLS === */}
      <div className="pb-8 pt-3 flex items-center justify-center gap-7">
        {state === "walking" ? (
          <button onClick={pauseWalk} className="w-[68px] h-[68px] rounded-full bg-white flex items-center justify-center active:scale-90 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#111">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </button>
        ) : (
          <>
            <button onClick={() => setShowStopModal(true)} className="w-[56px] h-[56px] rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition-transform">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            </button>
            <button onClick={resumeWalk} className="w-[68px] h-[68px] rounded-full bg-[#2D4A2E] flex items-center justify-center active:scale-90 transition-transform">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><polygon points="6,3 20,12 6,21" /></svg>
            </button>
          </>
        )}
      </div>

      {/* === STOP MODAL === */}
      {showStopModal && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center px-8">
          <div className="bg-[#1a1a1a] rounded-[24px] p-7 w-full max-w-[340px] text-center">
            <div className="w-14 h-14 rounded-full bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <span className="text-[28px]">🚶</span>
            </div>
            <h3 className="text-[18px] font-bold text-white mb-5">{language === "ko" ? "걷기를 종료할까요?" : "End walk?"}</h3>
            <div className="flex bg-white/[0.04] rounded-2xl py-4 mb-6">
              <div className="flex-1 text-center">
                <div className="text-[18px] font-bold text-white">{distance.toFixed(2)}</div>
                <div className="text-[11px] text-white/40">km</div>
              </div>
              <div className="w-px h-7 bg-white/[0.08] self-center" />
              <div className="flex-1 text-center">
                <div className="text-[18px] font-bold text-white">{formatTime(elapsed)}</div>
                <div className="text-[11px] text-white/40">{language === "ko" ? "시간" : "Time"}</div>
              </div>
              <div className="w-px h-7 bg-white/[0.08] self-center" />
              <div className="flex-1 text-center">
                <div className="text-[18px] font-bold text-white">{steps.toLocaleString()}</div>
                <div className="text-[11px] text-white/40">{language === "ko" ? "걸음" : "Steps"}</div>
              </div>
            </div>
            <button onClick={() => { setShowStopModal(false); completeWalk(); }} className="w-full py-4 bg-red-500 text-white rounded-[14px] text-[16px] font-bold mb-2.5">
              {language === "ko" ? "종료하기" : "End"}
            </button>
            <button onClick={() => setShowStopModal(false)} className="w-full py-3.5 text-white/50 text-[15px] font-medium">
              {language === "ko" ? "계속 걷기" : "Keep walking"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
