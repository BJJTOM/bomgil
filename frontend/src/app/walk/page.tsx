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
  speed: number | null;
}

interface KmSplit {
  km: number;
  pace: string;
  duration: number;
}

// Kalman filter for GPS noise
class SimpleKalman {
  private estimate = 0;
  private errorCov = 1;
  private processNoise = 0.00001;
  private measureNoise = 0.0001;
  filter(measurement: number): number {
    const predicted = this.estimate;
    const predError = this.errorCov + this.processNoise;
    const gain = predError / (predError + this.measureNoise);
    this.estimate = predicted + gain * (measurement - predicted);
    this.errorCov = (1 - gain) * predError;
    return this.estimate;
  }
}

export default function WalkPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { t, language } = useT();
  const createActivity = useCreateActivityJSON();
  const ko = language === "ko";

  const [state, setState] = useState<WalkState>("countdown");
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [steps, setSteps] = useState(0);
  const [calories, setCalories] = useState(0);
  const [elevGain, setElevGain] = useState(0);
  const [currentPace, setCurrentPace] = useState(0);
  const [avgPace, setAvgPace] = useState(0);
  const [splits, setSplits] = useState<KmSplit[]>([]);
  const [isAutoPaused, setIsAutoPaused] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);

  const trackPointsRef = useRef<TrackPoint[]>([]);
  const distanceRef = useRef(0);
  const lastAltRef = useRef<number | null>(null);
  const elevGainRef = useRef(0);
  const splitsRef = useRef<KmSplit[]>([]);
  const splitStartRef = useRef(0);
  const speedSamplesRef = useRef<number[]>([]);
  const kalmanLat = useRef(new SimpleKalman());
  const kalmanLng = useRef(new SimpleKalman());

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(0);
  const pausedTimeRef = useRef(0);

  // Leaflet
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const polyRef = useRef<any>(null);
  const glowRef = useRef<any>(null);
  const posRef = useRef<any>(null);
  const startMarkerRef = useRef<any>(null);
  const mapReadyRef = useRef(false);

  const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const formatPace = (p: number) => {
    if (p <= 0 || p > 30) return "--'--\"";
    const m = Math.floor(p);
    const s = Math.round((p - m) * 60);
    return `${m}'${String(s).padStart(2, "0")}"`;
  };

  // ---- INIT LEAFLET (runs once on mount, hidden during countdown) ----
  useEffect(() => {
    if (!mapDivRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !mapDivRef.current) return;
        LRef.current = L;

        const map = L.map(mapDivRef.current, {
          center: [37.5665, 126.978],
          zoom: 16,
          zoomControl: false,
          attributionControl: false,
        });

        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);

        // Glow line
        glowRef.current = L.polyline([], { color: "#4ADE80", weight: 14, opacity: 0.12, lineCap: "round", lineJoin: "round" }).addTo(map);
        // Main line
        polyRef.current = L.polyline([], { color: "#4ADE80", weight: 5, opacity: 0.9, lineCap: "round", lineJoin: "round" }).addTo(map);

        // Position marker
        const icon = L.divIcon({
          html: `<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center">
            <div style="width:14px;height:14px;background:#4ADE80;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px rgba(74,222,128,0.6);z-index:2"></div>
            <div style="position:absolute;inset:0;border-radius:50%;background:rgba(74,222,128,0.2);animation:mapPulse 2s infinite"></div>
          </div>`,
          className: "", iconSize: [28, 28], iconAnchor: [14, 14],
        });
        posRef.current = L.marker([37.5665, 126.978], { icon, interactive: false }).addTo(map);

        mapObjRef.current = map;
        mapReadyRef.current = true;

        // Resize after a beat
        setTimeout(() => { try { map.invalidateSize(); } catch {} }, 300);
        setTimeout(() => { try { map.invalidateSize(); } catch {} }, 1000);
      } catch (e) {
        console.error("Leaflet init:", e);
      }
    })();

    return () => {
      cancelled = true;
      if (mapObjRef.current) {
        try { mapObjRef.current.remove(); } catch {}
        mapObjRef.current = null;
        mapReadyRef.current = false;
      }
    };
  }, []);

  // Invalidate map size when state changes (countdown → walking reveals the map)
  useEffect(() => {
    if (state !== "countdown" && mapObjRef.current) {
      setTimeout(() => { try { mapObjRef.current.invalidateSize(); } catch {} }, 100);
      setTimeout(() => { try { mapObjRef.current.invalidateSize(); } catch {} }, 500);
    }
  }, [state]);

  // ---- ADD POINT TO MAP (imperative, no re-render) ----
  const addPointToMap = useCallback((lat: number, lng: number) => {
    if (!mapReadyRef.current) return;
    const map = mapObjRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    const ll: [number, number] = [lat, lng];
    polyRef.current?.addLatLng(ll);
    glowRef.current?.addLatLng(ll);
    posRef.current?.setLatLng(ll);
    map.panTo(ll, { animate: true, duration: 0.5 });

    // Start marker (first point only)
    if (!startMarkerRef.current) {
      const sIcon = L.divIcon({
        html: `<div style="width:14px;height:14px;background:#34C759;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(52,199,89,0.5)"></div>`,
        className: "", iconSize: [14, 14], iconAnchor: [7, 7],
      });
      startMarkerRef.current = L.marker(ll, { icon: sIcon, interactive: false }).addTo(map);
    }
  }, []);

  // ---- GPS HANDLER ----
  const handleGPS = useCallback((pos: GeolocationPosition) => {
    const rawLat = pos.coords.latitude;
    const rawLng = pos.coords.longitude;
    const alt = pos.coords.altitude;
    const ts = pos.timestamp || Date.now();

    // Kalman filter
    const lat = kalmanLat.current.filter(rawLat);
    const lng = kalmanLng.current.filter(rawLng);

    const points = trackPointsRef.current;
    let pointSpeed = 0;

    if (points.length > 0) {
      const last = points[points.length - 1];
      const d = haversine(last.lat, last.lng, lat, lng);

      // Jitter filter: < 3m
      if (d < 0.003) return;

      const timeDiff = (ts - new Date(last.time).getTime()) / 1000;
      if (timeDiff <= 0) return;

      const speedKmh = (d / timeDiff) * 3600;
      pointSpeed = speedKmh;

      // Reject > 20 km/h
      if (speedKmh > 20) return;

      // Auto-pause check
      speedSamplesRef.current.push(speedKmh);
      if (speedSamplesRef.current.length > 5) speedSamplesRef.current.shift();
      const avgSpd = speedSamplesRef.current.reduce((a, b) => a + b, 0) / speedSamplesRef.current.length;

      if (avgSpd < 0.5) {
        setIsAutoPaused(true);
        return;
      } else {
        setIsAutoPaused(false);
      }

      // Add distance
      distanceRef.current += d;
      setDistance(distanceRef.current);
      setSpeed(speedKmh);

      // Stats
      const totalSteps = Math.round(distanceRef.current * 1350);
      setSteps(totalSteps);
      setCalories(Math.round(distanceRef.current * 65));

      // Current pace (from recent points)
      if (distanceRef.current > 0.01) {
        const elapsedSec = (Date.now() - startTimeRef.current + pausedTimeRef.current) / 1000;
        setAvgPace(elapsedSec / 60 / distanceRef.current);
      }
      if (d > 0.001 && timeDiff > 0) {
        setCurrentPace(timeDiff / 60 / d);
      }

      // Elevation
      if (alt != null) {
        if (lastAltRef.current != null) {
          const diff = alt - lastAltRef.current;
          if (Math.abs(diff) >= 1) {
            if (diff > 0) {
              elevGainRef.current += diff;
              setElevGain(Math.round(elevGainRef.current));
            }
            lastAltRef.current = alt;
          }
        } else {
          lastAltRef.current = alt;
        }
      }

      // Splits
      const currentKm = Math.floor(distanceRef.current);
      if (currentKm > splitsRef.current.length) {
        const splitDur = (ts - splitStartRef.current) / 1000;
        const split: KmSplit = {
          km: currentKm,
          pace: formatPace(splitDur / 60),
          duration: splitDur,
        };
        splitsRef.current.push(split);
        setSplits([...splitsRef.current]);
        splitStartRef.current = ts;
      }

      // Update map
      addPointToMap(lat, lng);
    } else {
      // First point — center map
      if (mapObjRef.current) {
        mapObjRef.current.setView([lat, lng], 16);
        posRef.current?.setLatLng([lat, lng]);
      }
      splitStartRef.current = ts;
    }

    const point: TrackPoint = { lat, lng, ele: alt, time: new Date(ts).toISOString(), speed: pointSpeed };
    trackPointsRef.current.push(point);
  }, [addPointToMap]);

  // ---- COUNTDOWN ----
  useEffect(() => {
    if (state !== "countdown") return;

    // Pre-fetch GPS
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        kalmanLat.current.filter(lat);
        kalmanLng.current.filter(lng);
        if (mapObjRef.current) {
          mapObjRef.current.setView([lat, lng], 16);
          posRef.current?.setLatLng([lat, lng]);
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    );

    let count = 3;
    const timer = setInterval(() => {
      count--;
      if (count <= 0) { clearInterval(timer); doStartWalk(); }
      else setCountdown(count);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const doStartWalk = () => {
    setState("walking");
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current + pausedTimeRef.current) / 1000));
    }, 1000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleGPS, () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  };

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
      handleGPS, () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  };

  const completeWalk = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);

    if (isAuthenticated) {
      try {
        const dateLabel = new Date().toLocaleDateString(language, { month: "long", day: "numeric" });
        await createActivity.mutateAsync({
          track_points: trackPointsRef.current,
          source: "phone_gps",
          title: `${dateLabel} ${ko ? "도보" : "Walk"}`,
          total_steps: steps,
          calories_burned: calories,
        });
      } catch (e) { console.error(e); }
    }

    const params = new URLSearchParams({
      distance: distance.toFixed(2), duration: String(elapsed),
      steps: String(steps), calories: String(calories),
      points: JSON.stringify(trackPointsRef.current.filter((_, i) => i % Math.max(1, Math.floor(trackPointsRef.current.length / 200)) === 0)),
    });
    router.push(`/walk/complete?${params.toString()}`);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const isWalking = state === "walking" || state === "paused";

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col z-50">
      {/* Pulse animation */}
      <style jsx global>{`
        @keyframes mapPulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>

      {/* === COUNTDOWN OVERLAY (hidden once walking) === */}
      {state === "countdown" && (
        <div className="absolute inset-0 z-[60] bg-[#0a0a0a] flex flex-col items-center justify-center">
          <button onClick={() => router.back()} className="absolute top-14 left-5 w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center">
            <span className="text-white/50 text-lg">&larr;</span>
          </button>
          <p className="text-white/15 text-[14px] font-semibold tracking-[0.4em] mb-12">MORU</p>
          <div className="w-[160px] h-[160px] rounded-full bg-[#2D4A2E] flex items-center justify-center shadow-[0_0_60px_rgba(45,74,46,0.4)] animate-pulse">
            <span className="text-white text-[64px] font-extrabold">{countdown}</span>
          </div>
          <p className="text-white/20 text-[14px] mt-12 tracking-wide">{ko ? "경로 자동 기록" : "Route auto-recording"}</p>
        </div>
      )}

      {/* === MAP (always mounted, visible when walking) === */}
      <div className="relative" style={{ height: "50vh", display: isWalking ? "block" : "none" }}>
        <div ref={mapDivRef} style={{ width: "100%", height: "100%" }} />

        {/* Status pill */}
        <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2 bg-black/65 backdrop-blur-sm rounded-full px-3.5 py-1.5">
          <div className={`w-2 h-2 rounded-full ${state === "walking" ? (isAutoPaused ? "bg-orange-400" : "bg-green-400 animate-pulse") : "bg-yellow-400"}`} />
          <span className="text-white/85 text-[13px] font-semibold">
            {state === "walking" ? (isAutoPaused ? (ko ? "자동 일시정지" : "Auto-paused") : (ko ? "기록 중" : "Recording")) : (ko ? "일시정지" : "Paused")}
          </span>
          <span className="text-white/50 text-[13px] font-mono">{formatTime(elapsed)}</span>
        </div>
      </div>

      {/* === STATS (visible when walking) === */}
      {isWalking && (
        <div className="flex-1 flex flex-col items-center justify-center px-7 overflow-y-auto">
          {/* Distance */}
          <div className="flex items-baseline mb-1">
            <span className="text-[48px] font-extrabold text-white tracking-tight leading-none">{distance.toFixed(2)}</span>
            <span className="text-[15px] font-medium text-white/35 ml-1.5">km</span>
          </div>

          {/* Pace */}
          <div className="flex items-baseline gap-1.5 mb-4">
            <span className="text-[11px] text-white/35">{ko ? "페이스" : "Pace"}</span>
            <span className="text-[20px] font-bold text-[#4ADE80]">{formatPace(currentPace)}</span>
            <span className="text-[11px] text-white/25">/km</span>
          </div>

          {/* 3-stat row */}
          <div className="w-full flex bg-white/[0.04] rounded-2xl py-3 mb-3">
            <div className="flex-1 text-center">
              <div className="text-[15px] font-bold text-white">{steps.toLocaleString()}</div>
              <div className="text-[10px] text-white/35 uppercase">{ko ? "걸음" : "Steps"}</div>
            </div>
            <div className="w-px h-6 bg-white/[0.06] self-center" />
            <div className="flex-1 text-center">
              <div className="text-[15px] font-bold text-white">{calories}</div>
              <div className="text-[10px] text-white/35 uppercase">kcal</div>
            </div>
            <div className="w-px h-6 bg-white/[0.06] self-center" />
            <div className="flex-1 text-center">
              <div className="text-[15px] font-bold text-white">{speed.toFixed(1)}</div>
              <div className="text-[10px] text-white/35 uppercase">km/h</div>
            </div>
          </div>

          {/* 2-stat row */}
          <div className="w-full flex bg-white/[0.04] rounded-2xl py-3 mb-3">
            <div className="flex-1 text-center">
              <div className="text-[15px] font-bold text-white">{elevGain > 0 ? `+${elevGain}m` : "0m"}</div>
              <div className="text-[10px] text-white/35 uppercase">{ko ? "고도" : "Elev"}</div>
            </div>
            <div className="w-px h-6 bg-white/[0.06] self-center" />
            <div className="flex-1 text-center">
              <div className="text-[15px] font-bold text-white">{formatPace(avgPace)}</div>
              <div className="text-[10px] text-white/35 uppercase">{ko ? "평균 페이스" : "Avg Pace"}</div>
            </div>
          </div>

          {/* Live splits */}
          {splits.length > 0 && (
            <div className="w-full bg-white/[0.04] rounded-2xl p-3 mb-2">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">{ko ? "구간 기록" : "Splits"}</p>
              {splits.map((s) => (
                <div key={s.km} className="flex items-center py-1 gap-3">
                  <span className="text-[12px] font-semibold text-white/50 w-8">{s.km}km</span>
                  <span className="text-[14px] font-bold text-[#4ADE80]">{s.pace}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === CONTROLS === */}
      {isWalking && (
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
      )}

      {/* === STOP MODAL === */}
      {showStopModal && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center px-8">
          <div className="bg-[#1a1a1a] rounded-[24px] p-7 w-full max-w-[340px] text-center">
            <div className="w-14 h-14 rounded-full bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <span className="text-[28px]">🚶</span>
            </div>
            <h3 className="text-[18px] font-bold text-white mb-5">{ko ? "걷기를 종료할까요?" : "End walk?"}</h3>
            <div className="flex bg-white/[0.04] rounded-2xl py-4 mb-6">
              <div className="flex-1 text-center">
                <div className="text-[18px] font-bold text-white">{distance.toFixed(2)}</div>
                <div className="text-[11px] text-white/40">km</div>
              </div>
              <div className="w-px h-7 bg-white/[0.08] self-center" />
              <div className="flex-1 text-center">
                <div className="text-[18px] font-bold text-white">{formatTime(elapsed)}</div>
                <div className="text-[11px] text-white/40">{ko ? "시간" : "Time"}</div>
              </div>
              <div className="w-px h-7 bg-white/[0.08] self-center" />
              <div className="flex-1 text-center">
                <div className="text-[18px] font-bold text-white">{steps.toLocaleString()}</div>
                <div className="text-[11px] text-white/40">{ko ? "걸음" : "Steps"}</div>
              </div>
            </div>
            <button onClick={() => { setShowStopModal(false); completeWalk(); }} className="w-full py-4 bg-red-500 text-white rounded-[14px] text-[16px] font-bold mb-2.5">
              {ko ? "종료하기" : "End"}
            </button>
            <button onClick={() => setShowStopModal(false)} className="w-full py-3.5 text-white/50 text-[15px] font-medium">
              {ko ? "계속 걷기" : "Keep walking"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
