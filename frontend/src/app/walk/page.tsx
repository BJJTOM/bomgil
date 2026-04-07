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
  const [showSpotModal, setShowSpotModal] = useState(false);
  const [spotName, setSpotName] = useState("");
  const [spotType, setSpotType] = useState("photo");
  const [photos, setPhotos] = useState<{ uri: string; lat: number; lng: number }[]>([]);
  const [spots, setSpots] = useState<{ name: string; type: string; lat: number; lng: number }[]>([]);
  const [gpsError, setGpsError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const trackPointsRef = useRef<TrackPoint[]>([]);
  const distanceRef = useRef(0);
  const lastAltRef = useRef<number | null>(null);
  const elevGainRef = useRef(0);
  const splitsRef = useRef<KmSplit[]>([]);
  const splitStartRef = useRef(0);
  const speedSamplesRef = useRef<number[]>([]);
  const kalmanLat = useRef(new SimpleKalman());
  const kalmanLng = useRef(new SimpleKalman());
  const initialPosRef = useRef<{ lat: number; lng: number } | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(0);
  const pausedTimeRef = useRef(0);

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const polyRef = useRef<any>(null);
  const glowRef = useRef<any>(null);
  const posRef = useRef<any>(null);
  const startMarkerRef = useRef<any>(null);

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

  // ── INIT MAP (only after countdown ends AND we have GPS position) ──
  const initMap = useCallback(async (center: { lat: number; lng: number }) => {
    if (!mapDivRef.current || mapObjRef.current) return;
    try {
      const L = (await import("leaflet")).default;
      LRef.current = L;

      const map = L.map(mapDivRef.current, {
        center: [center.lat, center.lng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
        fadeAnimation: false,
        zoomAnimation: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        updateWhenZooming: false,
        updateWhenIdle: true,
      }).addTo(map);

      glowRef.current = L.polyline([], { color: "#4ADE80", weight: 14, opacity: 0.12, lineCap: "round", lineJoin: "round" }).addTo(map);
      polyRef.current = L.polyline([], { color: "#4ADE80", weight: 5, opacity: 0.9, lineCap: "round", lineJoin: "round" }).addTo(map);

      const icon = L.divIcon({
        html: `<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center">
          <div style="width:14px;height:14px;background:#4ADE80;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px rgba(74,222,128,0.6);z-index:2"></div>
          <div style="position:absolute;inset:0;border-radius:50%;background:rgba(74,222,128,0.2);animation:mapPulse 2s infinite"></div>
        </div>`,
        className: "", iconSize: [28, 28], iconAnchor: [14, 14],
      });
      posRef.current = L.marker([center.lat, center.lng], { icon, interactive: false }).addTo(map);

      mapObjRef.current = map;

      // Single delayed invalidation after DOM is stable
      requestAnimationFrame(() => {
        setTimeout(() => {
          try { map.invalidateSize(); } catch {}
          setMapReady(true);
        }, 100);
      });
    } catch (e) {
      console.error("Leaflet init:", e);
    }
  }, []);

  // ── MAP POINT UPDATE ──
  const addPointToMap = useCallback((lat: number, lng: number) => {
    const map = mapObjRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    const ll: [number, number] = [lat, lng];
    polyRef.current?.addLatLng(ll);
    glowRef.current?.addLatLng(ll);
    posRef.current?.setLatLng(ll);
    map.panTo(ll, { animate: true, duration: 0.5 });

    if (!startMarkerRef.current) {
      const sIcon = L.divIcon({
        html: `<div style="width:14px;height:14px;background:#34C759;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(52,199,89,0.5)"></div>`,
        className: "", iconSize: [14, 14], iconAnchor: [7, 7],
      });
      startMarkerRef.current = L.marker(ll, { icon: sIcon, interactive: false }).addTo(map);
    }
  }, []);

  // ── GPS HANDLER ──
  const handleGPS = useCallback((pos: GeolocationPosition) => {
    setGpsError("");
    const rawLat = pos.coords.latitude;
    const rawLng = pos.coords.longitude;
    const alt = pos.coords.altitude;
    const acc = pos.coords.accuracy;
    const ts = pos.timestamp || Date.now();

    if (acc > 50) return;

    const lat = kalmanLat.current.filter(rawLat);
    const lng = kalmanLng.current.filter(rawLng);

    const points = trackPointsRef.current;
    let pointSpeed = 0;

    if (points.length > 0) {
      const last = points[points.length - 1];
      const d = haversine(last.lat, last.lng, lat, lng);
      if (d < 0.003) return;
      const timeDiff = (ts - new Date(last.time).getTime()) / 1000;
      if (timeDiff <= 0) return;
      const speedKmh = (d / timeDiff) * 3600;
      pointSpeed = speedKmh;
      if (speedKmh > 20) return;

      speedSamplesRef.current.push(speedKmh);
      if (speedSamplesRef.current.length > 5) speedSamplesRef.current.shift();
      const avgSpd = speedSamplesRef.current.reduce((a, b) => a + b, 0) / speedSamplesRef.current.length;
      if (avgSpd < 0.5) { setIsAutoPaused(true); return; }
      else { setIsAutoPaused(false); }

      distanceRef.current += d;
      setDistance(distanceRef.current);
      setSpeed(speedKmh);
      setSteps(Math.round(distanceRef.current * 1350));
      setCalories(Math.round(distanceRef.current * 65));

      if (distanceRef.current > 0.01) {
        const elapsedSec = (Date.now() - startTimeRef.current + pausedTimeRef.current) / 1000;
        setAvgPace(elapsedSec / 60 / distanceRef.current);
      }
      if (d > 0.001 && timeDiff > 0) setCurrentPace(timeDiff / 60 / d);

      if (alt != null) {
        if (lastAltRef.current != null) {
          const diff = alt - lastAltRef.current;
          if (Math.abs(diff) >= 1) {
            if (diff > 0) { elevGainRef.current += diff; setElevGain(Math.round(elevGainRef.current)); }
            lastAltRef.current = alt;
          }
        } else { lastAltRef.current = alt; }
      }

      const currentKm = Math.floor(distanceRef.current);
      if (currentKm > splitsRef.current.length) {
        const splitDur = (ts - splitStartRef.current) / 1000;
        splitsRef.current.push({ km: currentKm, pace: formatPace(splitDur / 60), duration: splitDur });
        setSplits([...splitsRef.current]);
        splitStartRef.current = ts;
      }

      addPointToMap(lat, lng);
    } else {
      // First GPS point during walk — update map position
      posRef.current?.setLatLng([lat, lng]);
      mapObjRef.current?.setView([lat, lng], 16, { animate: false });
      splitStartRef.current = ts;
    }

    trackPointsRef.current.push({ lat, lng, ele: alt, time: new Date(ts).toISOString(), speed: pointSpeed });
  }, [addPointToMap]);

  const handleGPSError = useCallback((err: GeolocationPositionError) => {
    if (err.code === 1) setGpsError(ko ? "위치 권한을 허용해주세요" : "Location permission required");
    else if (err.code === 2) setGpsError(ko ? "GPS 신호를 찾을 수 없습니다" : "GPS signal unavailable");
    else setGpsError(ko ? "위치를 가져올 수 없습니다" : "Unable to get location");
  }, [ko]);

  const SPOT_TYPES = [
    { key: "restaurant", label: ko ? "맛집" : "Food", color: "#FF6B6B" },
    { key: "cafe", label: ko ? "카페" : "Cafe", color: "#F59E0B" },
    { key: "photo", label: ko ? "포토" : "Photo", color: "#4ADE80" },
    { key: "rest", label: ko ? "휴식" : "Rest", color: "#60A5FA" },
    { key: "view", label: ko ? "전망" : "View", color: "#A78BFA" },
  ];

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const points = trackPointsRef.current;
    const lastPos = points.length > 0 ? points[points.length - 1] : initialPosRef.current;
    if (lastPos) {
      setPhotos((prev) => [...prev, { uri: URL.createObjectURL(file), lat: lastPos.lat, lng: lastPos.lng }]);
    }
    e.target.value = "";
  };

  const handleAddSpot = () => {
    if (!spotName.trim()) return;
    const points = trackPointsRef.current;
    const lastPos = points.length > 0 ? points[points.length - 1] : initialPosRef.current;
    if (lastPos) {
      const newSpot = { name: spotName.trim(), type: spotType, lat: lastPos.lat, lng: lastPos.lng };
      setSpots((prev) => [...prev, newSpot]);

      // Add marker to map
      const L = LRef.current;
      const map = mapObjRef.current;
      if (L && map) {
        const color = SPOT_TYPES.find((s) => s.key === spotType)?.color || "#4ADE80";
        const icon = L.divIcon({
          html: `<div style="width:24px;height:24px;background:${color};border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
            <span style="font-size:11px;color:#fff;font-weight:700">${SPOT_TYPES.findIndex((s) => s.key === spotType) + 1}</span>
          </div>`,
          className: "", iconSize: [24, 24], iconAnchor: [12, 12],
        });
        L.marker([lastPos.lat, lastPos.lng], { icon, interactive: false }).addTo(map);
      }
    }
    setSpotName("");
    setShowSpotModal(false);
  };

  // ── COUNTDOWN: get GPS position first, then start ──
  useEffect(() => {
    if (state !== "countdown") return;

    // Get initial position during countdown
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        kalmanLat.current.filter(lat);
        kalmanLng.current.filter(lng);
        initialPosRef.current = { lat, lng };
      },
      handleGPSError,
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

    // Initialize map with known position (no flash)
    const center = initialPosRef.current || { lat: 37.5665, lng: 126.978 };
    initMap(center);

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current + pausedTimeRef.current) / 1000));
    }, 1000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleGPS, handleGPSError,
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
      handleGPS, handleGPSError,
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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (mapObjRef.current) { try { mapObjRef.current.remove(); } catch {} }
    };
  }, []);

  const isWalking = state === "walking" || state === "paused";

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0a0a0a" }}>
      <style jsx global>{`
        @keyframes mapPulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.5); opacity: 0; }
        }
        .walk-map .leaflet-container {
          background: #0a0a0a !important;
        }
        .walk-map .leaflet-tile-pane {
          will-change: transform;
        }
      `}</style>

      {/* === COUNTDOWN === */}
      {state === "countdown" && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center" style={{ background: "#0a0a0a" }}>
          <button onClick={() => router.back()} className="absolute top-14 left-5 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
            <span className="text-white/50 text-lg">&larr;</span>
          </button>
          <p className="text-white/15 text-sm font-semibold tracking-[0.4em] mb-12">MORU</p>
          <div className="w-40 h-40 rounded-full flex items-center justify-center animate-pulse" style={{ background: "#2D4A2E", boxShadow: "0 0 60px rgba(45,74,46,0.4)" }}>
            <span className="text-white text-[64px] font-extrabold">{countdown}</span>
          </div>
          <p className="text-white/20 text-sm mt-12">{ko ? "GPS 신호 수신 중..." : "Acquiring GPS..."}</p>
        </div>
      )}

      {/* === MAP (only rendered after countdown) === */}
      {isWalking && (
        <div className="walk-map relative flex-shrink-0 overflow-hidden" style={{ height: "48%", background: "#0a0a0a" }}>
          <div ref={mapDivRef} className="absolute inset-0" style={{ opacity: mapReady ? 1 : 0, transition: "opacity 0.3s ease" }} />

          {gpsError && (
            <div className="absolute top-12 left-3 right-3 z-10 bg-red-500/90 backdrop-blur rounded-xl px-4 py-2.5 text-white text-sm font-medium text-center">
              {gpsError}
            </div>
          )}

          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-full px-3.5 py-1.5" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}>
            <div className="w-2 h-2 rounded-full" style={{
              background: state === "walking" ? (isAutoPaused ? "#F97316" : "#4ADE80") : "#FACC15",
            }} />
            <span className="text-white/85 text-[13px] font-semibold">
              {state === "walking" ? (isAutoPaused ? (ko ? "자동 일시정지" : "Auto-paused") : (ko ? "기록 중" : "REC")) : (ko ? "일시정지" : "Paused")}
            </span>
            <span className="text-white/50 text-[13px] font-mono">{formatTime(elapsed)}</span>
          </div>
        </div>
      )}

      {/* === STATS === */}
      {isWalking && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-auto">
          <div className="flex items-baseline mb-0.5">
            <span className="text-[48px] font-extrabold text-white tracking-tighter leading-none">{distance.toFixed(2)}</span>
            <span className="text-[15px] font-medium text-white/35 ml-1.5">km</span>
          </div>
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="text-[11px] text-white/35">{ko ? "페이스" : "Pace"}</span>
            <span className="text-[20px] font-bold text-[#4ADE80]">{formatPace(currentPace)}</span>
            <span className="text-[11px] text-white/25">/km</span>
          </div>
          <div className="w-full flex rounded-2xl py-3 mb-2" style={{ background: "rgba(255,255,255,0.04)" }}>
            {[
              { val: steps.toLocaleString(), label: ko ? "걸음" : "Steps" },
              { val: String(calories), label: "kcal" },
              { val: speed.toFixed(1), label: "km/h" },
              { val: elevGain > 0 ? `+${elevGain}m` : "0m", label: ko ? "고도" : "Elev" },
            ].map((s, i) => (
              <div key={i} className="flex-1 text-center" style={{ borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                <div className="text-[15px] font-bold text-white">{s.val}</div>
                <div className="text-[10px] text-white/35 uppercase">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] text-white/30">{ko ? "평균 페이스" : "Avg Pace"}</span>
            <span className="text-[14px] font-semibold text-white/60">{formatPace(avgPace)}</span>
          </div>
          {splits.length > 0 && (
            <div className="w-full rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">{ko ? "구간 기록" : "Splits"}</p>
              {splits.map((s) => (
                <div key={s.km} className="flex items-center py-0.5 gap-3">
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
        <div className="flex-shrink-0 flex items-center justify-center gap-5 py-4 pb-safe" style={{ height: 100 }}>
          <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />

          {state === "walking" ? (
            <>
              {/* Camera */}
              <button onClick={() => photoInputRef.current?.click()} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </button>
              {/* Pause */}
              <button onClick={pauseWalk} className="w-[68px] h-[68px] rounded-full bg-white flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#111"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
              </button>
              {/* Spot */}
              <button onClick={() => setShowSpotModal(true)} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setShowStopModal(true)} className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
              <button onClick={resumeWalk} className="w-[68px] h-[68px] rounded-full flex items-center justify-center" style={{ background: "#2D4A2E" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><polygon points="6,3 20,12 6,21" /></svg>
              </button>
            </>
          )}

          {/* Photo/Spot count badges */}
          {(photos.length > 0 || spots.length > 0) && (
            <div className="absolute bottom-1 right-5 flex gap-2">
              {photos.length > 0 && <span className="text-[10px] text-white/40">📷 {photos.length}</span>}
              {spots.length > 0 && <span className="text-[10px] text-white/40">📍 {spots.length}</span>}
            </div>
          )}
        </div>
      )}

      {/* === SPOT MODAL === */}
      {showSpotModal && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-end justify-center">
          <div className="bg-[#1a1a1a] rounded-t-3xl p-6 w-full max-w-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold text-white">{ko ? "스팟 추가" : "Add Spot"}</h3>
              <button onClick={() => setShowSpotModal(false)} className="text-white/40 text-lg">✕</button>
            </div>
            <div className="flex gap-2 mb-4">
              {SPOT_TYPES.map((s) => (
                <button key={s.key} onClick={() => setSpotType(s.key)}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-center transition-all"
                  style={{ background: spotType === s.key ? s.color : "rgba(255,255,255,0.06)", color: spotType === s.key ? "#fff" : "rgba(255,255,255,0.5)" }}>
                  {s.label}
                </button>
              ))}
            </div>
            <input
              className="w-full bg-white/[0.06] rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/30 outline-none mb-4"
              placeholder={ko ? "스팟 이름" : "Spot name"}
              value={spotName}
              onChange={(e) => setSpotName(e.target.value)}
              autoFocus
            />
            <button onClick={handleAddSpot} disabled={!spotName.trim()}
              className={`w-full py-3.5 rounded-xl text-[15px] font-bold transition-all ${spotName.trim() ? "bg-[#4ADE80] text-black" : "bg-white/[0.06] text-white/30"}`}>
              {ko ? "추가" : "Add"}
            </button>
          </div>
        </div>
      )}

      {/* === STOP MODAL === */}
      {showStopModal && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center px-8">
          <div className="bg-[#1a1a1a] rounded-3xl p-7 w-full max-w-[340px] text-center">
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
