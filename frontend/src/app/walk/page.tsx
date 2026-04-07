"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth";
import { useT } from "@/stores/language";
import { useCreateActivityJSON } from "@/hooks/useActivities";

type WalkState = "idle" | "countdown" | "walking" | "paused";

interface TrackPoint { lat: number; lng: number; ele: number | null; time: string; speed: number | null; }
interface KmSplit { km: number; pace: string; duration: number; }

class SimpleKalman {
  private est = 0; private ec = 1; private pn = 0.00001; private mn = 0.0001;
  filter(m: number) { const p = this.est; const pe = this.ec + this.pn; const g = pe / (pe + this.mn); this.est = p + g * (m - p); this.ec = (1 - g) * pe; return this.est; }
}

export default function WalkPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { language } = useT();
  const createActivity = useCreateActivityJSON();
  const ko = language === "ko";

  const [state, setState] = useState<WalkState>("idle");
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
  const [gpsStatus, setGpsStatus] = useState(ko ? "GPS 대기 중..." : "Waiting for GPS...");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const trackPointsRef = useRef<TrackPoint[]>([]);
  const distRef = useRef(0);
  const lastAltRef = useRef<number | null>(null);
  const elevRef = useRef(0);
  const splitsRef = useRef<KmSplit[]>([]);
  const splitStartRef = useRef(0);
  const speedSamples = useRef<number[]>([]);
  const kLat = useRef(new SimpleKalman());
  const kLng = useRef(new SimpleKalman());
  const initPos = useRef<{ lat: number; lng: number } | null>(null);

  const watchRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startT = useRef(0);
  const pausedT = useRef(0);

  const mapDiv = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const LRef = useRef<any>(null);
  const polyR = useRef<any>(null);
  const glowR = useRef<any>(null);
  const posR = useRef<any>(null);
  const startM = useRef<any>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const hav = (a1: number, o1: number, a2: number, o2: number) => {
    const R = 6371, dA = ((a2 - a1) * Math.PI) / 180, dO = ((o2 - o1) * Math.PI) / 180;
    const x = Math.sin(dA / 2) ** 2 + Math.cos((a1 * Math.PI) / 180) * Math.cos((a2 * Math.PI) / 180) * Math.sin(dO / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };
  const fmtTime = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = s % 60; return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sc).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(sc).padStart(2, "0")}`; };
  const fmtPace = (p: number) => { if (p <= 0 || p > 30) return "--'--\""; const m = Math.floor(p), s = Math.round((p - m) * 60); return `${m}'${String(s).padStart(2, "0")}"`; };

  const SPOTS = [
    { key: "restaurant", label: ko ? "맛집" : "Food", color: "#FF6B6B" },
    { key: "cafe", label: ko ? "카페" : "Cafe", color: "#F59E0B" },
    { key: "photo", label: ko ? "포토" : "Photo", color: "#4ADE80" },
    { key: "rest", label: ko ? "휴식" : "Rest", color: "#60A5FA" },
    { key: "view", label: ko ? "전망" : "View", color: "#A78BFA" },
  ];

  // ── Init Map ──
  const initMap = useCallback(async (center: { lat: number; lng: number }) => {
    if (!mapDiv.current || mapObj.current) return;
    const L = (await import("leaflet")).default;
    LRef.current = L;
    const map = L.map(mapDiv.current, { center: [center.lat, center.lng], zoom: 16, zoomControl: false, attributionControl: false, fadeAnimation: false });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19, updateWhenIdle: true }).addTo(map);
    glowR.current = L.polyline([], { color: "#4ADE80", weight: 14, opacity: 0.12, lineCap: "round" }).addTo(map);
    polyR.current = L.polyline([], { color: "#4ADE80", weight: 5, opacity: 0.9, lineCap: "round" }).addTo(map);
    const icon = L.divIcon({ html: `<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center"><div style="width:14px;height:14px;background:#4ADE80;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px rgba(74,222,128,0.6);z-index:2"></div><div style="position:absolute;inset:0;border-radius:50%;background:rgba(74,222,128,0.2);animation:mp 2s infinite"></div></div>`, className: "", iconSize: [28, 28], iconAnchor: [14, 14] });
    posR.current = L.marker([center.lat, center.lng], { icon, interactive: false }).addTo(map);
    mapObj.current = map;
    requestAnimationFrame(() => setTimeout(() => { try { map.invalidateSize(); } catch {} setMapLoaded(true); }, 150));
  }, []);

  const addPt = useCallback((lat: number, lng: number) => {
    const m = mapObj.current, L = LRef.current; if (!m || !L) return;
    const ll: [number, number] = [lat, lng];
    polyR.current?.addLatLng(ll); glowR.current?.addLatLng(ll); posR.current?.setLatLng(ll);
    m.panTo(ll, { animate: true, duration: 0.4 });
    if (!startM.current) { startM.current = L.marker(ll, { icon: L.divIcon({ html: `<div style="width:12px;height:12px;background:#34C759;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(52,199,89,0.4)"></div>`, className: "", iconSize: [12, 12], iconAnchor: [6, 6] }), interactive: false }).addTo(m); }
  }, []);

  // ── GPS ──
  const onGPS = useCallback((pos: GeolocationPosition) => {
    const acc = pos.coords.accuracy;
    setGpsAccuracy(Math.round(acc));
    if (acc > 30) { setGpsStatus(ko ? `GPS 부정확 (${Math.round(acc)}m)` : `GPS inaccurate (${Math.round(acc)}m)`); return; }
    setGpsStatus(ko ? "GPS 연결됨" : "GPS connected");

    const lat = kLat.current.filter(pos.coords.latitude);
    const lng = kLng.current.filter(pos.coords.longitude);
    const alt = pos.coords.altitude, ts = pos.timestamp || Date.now();
    const pts = trackPointsRef.current;
    let spd = 0;

    if (pts.length > 0) {
      const last = pts[pts.length - 1];
      const d = hav(last.lat, last.lng, lat, lng);
      if (d < 0.002) return;
      const dt = (ts - new Date(last.time).getTime()) / 1000;
      if (dt <= 0) return;
      const kmh = (d / dt) * 3600; spd = kmh;
      if (kmh > 15) return;

      speedSamples.current.push(kmh);
      if (speedSamples.current.length > 5) speedSamples.current.shift();
      const avg = speedSamples.current.reduce((a, b) => a + b, 0) / speedSamples.current.length;
      if (avg < 0.3) { setIsAutoPaused(true); return; } else setIsAutoPaused(false);

      distRef.current += d; setDistance(distRef.current); setSpeed(kmh);
      setSteps(Math.round(distRef.current * 1350));
      setCalories(Math.round(distRef.current * 65));
      if (distRef.current > 0.01) setAvgPace(((Date.now() - startT.current + pausedT.current) / 1000) / 60 / distRef.current);
      if (d > 0.001 && dt > 0) setCurrentPace(dt / 60 / d);

      if (alt != null) {
        if (lastAltRef.current != null) { const diff = alt - lastAltRef.current; if (Math.abs(diff) >= 1) { if (diff > 0) { elevRef.current += diff; setElevGain(Math.round(elevRef.current)); } lastAltRef.current = alt; } }
        else lastAltRef.current = alt;
      }

      const km = Math.floor(distRef.current);
      if (km > splitsRef.current.length) {
        const dur = (ts - splitStartRef.current) / 1000;
        splitsRef.current.push({ km, pace: fmtPace(dur / 60), duration: dur });
        setSplits([...splitsRef.current]); splitStartRef.current = ts;
      }
      addPt(lat, lng);
    } else {
      posR.current?.setLatLng([lat, lng]);
      mapObj.current?.setView([lat, lng], 16, { animate: false });
      splitStartRef.current = ts;
    }
    trackPointsRef.current.push({ lat, lng, ele: alt, time: new Date(ts).toISOString(), speed: spd });
  }, [addPt, ko]);

  const onGPSErr = useCallback((e: GeolocationPositionError) => {
    setGpsStatus(e.code === 1 ? (ko ? "위치 권한 필요" : "Permission needed") : e.code === 2 ? (ko ? "GPS 신호 없음" : "No signal") : (ko ? "위치 오류" : "Location error"));
  }, [ko]);

  // ── Start Flow ──
  const startCountdown = () => {
    setState("countdown");
    navigator.geolocation?.getCurrentPosition((p) => { kLat.current.filter(p.coords.latitude); kLng.current.filter(p.coords.longitude); initPos.current = { lat: p.coords.latitude, lng: p.coords.longitude }; setGpsStatus(ko ? "GPS 연결됨" : "GPS connected"); }, onGPSErr, { enableHighAccuracy: true, timeout: 8000 });
    let c = 3;
    const t = setInterval(() => { c--; if (c <= 0) { clearInterval(t); doStart(); } else setCountdown(c); }, 1000);
  };

  const doStart = () => {
    setState("walking"); startT.current = Date.now();
    initMap(initPos.current || { lat: 37.5665, lng: 126.978 });
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startT.current + pausedT.current) / 1000)), 1000);
    watchRef.current = navigator.geolocation.watchPosition(onGPS, onGPSErr, { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 });
  };

  const pause = () => { setState("paused"); pausedT.current += Date.now() - startT.current; if (timerRef.current) clearInterval(timerRef.current); if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); };
  const resume = () => { setState("walking"); startT.current = Date.now(); timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startT.current + pausedT.current) / 1000)), 1000); watchRef.current = navigator.geolocation.watchPosition(onGPS, onGPSErr, { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 }); };

  const complete = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    if (isAuthenticated) {
      try { await createActivity.mutateAsync({ track_points: trackPointsRef.current, source: "phone_gps", title: `${new Date().toLocaleDateString(language, { month: "long", day: "numeric" })} ${ko ? "도보" : "Walk"}`, total_steps: steps, calories_burned: calories }); } catch {}
    }
    const p = new URLSearchParams({ distance: distance.toFixed(2), duration: String(elapsed), steps: String(steps), calories: String(calories), points: JSON.stringify(trackPointsRef.current.filter((_, i) => i % Math.max(1, Math.floor(trackPointsRef.current.length / 200)) === 0)) });
    router.push(`/walk/complete?${p.toString()}`);
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const last = trackPointsRef.current.length > 0 ? trackPointsRef.current[trackPointsRef.current.length - 1] : initPos.current;
    if (last) setPhotos(prev => [...prev, { uri: URL.createObjectURL(f), lat: last.lat, lng: last.lng }]);
    e.target.value = "";
  };

  const handleAddSpot = () => {
    if (!spotName.trim()) return;
    const last = trackPointsRef.current.length > 0 ? trackPointsRef.current[trackPointsRef.current.length - 1] : initPos.current;
    if (last) {
      setSpots(prev => [...prev, { name: spotName.trim(), type: spotType, lat: last.lat, lng: last.lng }]);
      const L = LRef.current, m = mapObj.current;
      if (L && m) { const c = SPOTS.find(s => s.key === spotType)?.color || "#4ADE80"; L.marker([last.lat, last.lng], { icon: L.divIcon({ html: `<div style="width:22px;height:22px;background:${c};border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`, className: "", iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false }).addTo(m); }
    }
    setSpotName(""); setShowSpotModal(false);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); if (mapObj.current) try { mapObj.current.remove(); } catch {} }, []);

  const isActive = state === "walking" || state === "paused";

  // ── IDLE: Start screen (like mobile) ──
  if (state === "idle") {
    return (
      <div className="md:pt-[60px] min-h-screen bg-white">
        <header className="sticky top-0 md:top-[60px] z-30 bg-white border-b border-gray-100">
          <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
            <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-lg">←</button>
            <span className="text-[16px] font-semibold text-gray-900">{ko ? "걷기" : "Walk"}</span>
            <div className="w-8" />
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-5 py-8 text-center">
          <div className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🚶</span>
          </div>
          <h1 className="text-[22px] font-bold text-gray-900 mb-2">{ko ? "걷기를 시작하세요" : "Start Walking"}</h1>
          <p className="text-[14px] text-gray-400 mb-8 leading-relaxed">{ko ? "GPS로 경로를 자동 기록합니다.\n카메라와 스팟 마킹도 가능합니다." : "Route will be recorded via GPS.\nYou can also take photos and mark spots."}</p>
          <button onClick={startCountdown} className="w-full max-w-[280px] py-4 bg-gray-900 text-white rounded-2xl text-[16px] font-bold mx-auto hover:bg-gray-800 transition-colors">
            {ko ? "걷기 시작" : "Start Walk"}
          </button>
          <p className="text-[12px] text-gray-300 mt-4">{ko ? "위치 권한이 필요합니다" : "Location permission required"}</p>
        </main>
      </div>
    );
  }

  // ── COUNTDOWN ──
  if (state === "countdown") {
    return (
      <div className="md:pt-[60px] min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center">
        <p className="text-white/15 text-sm font-semibold tracking-[0.4em] mb-12">MORU</p>
        <div className="w-40 h-40 rounded-full flex items-center justify-center animate-pulse" style={{ background: "#2D4A2E", boxShadow: "0 0 60px rgba(45,74,46,0.4)" }}>
          <span className="text-white text-[64px] font-extrabold">{countdown}</span>
        </div>
        <p className="text-white/30 text-sm mt-8">{gpsStatus}</p>
      </div>
    );
  }

  // ── WALKING / PAUSED ──
  return (
    <div className="md:pt-[60px] min-h-screen flex flex-col" style={{ background: "#0a0a0a" }}>
      <style jsx global>{`@keyframes mp{0%,100%{transform:scale(1);opacity:.4}50%{transform:scale(1.5);opacity:0}}.wmap .leaflet-container{background:#0a0a0a!important;width:100%!important;height:100%!important}`}</style>
      <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />

      {/* Map */}
      <div className="wmap relative overflow-hidden" style={{ height: 280 }}>
        <div ref={mapDiv} className="absolute inset-0" style={{ opacity: mapLoaded ? 1 : 0, transition: "opacity 0.4s" }} />
        {/* Status bar */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
            <div className="w-2 h-2 rounded-full" style={{ background: state === "walking" ? (isAutoPaused ? "#F97316" : "#4ADE80") : "#FACC15" }} />
            <span className="text-white/85 text-[12px] font-semibold">
              {state === "walking" ? (isAutoPaused ? (ko ? "자동 일시정지" : "Auto-paused") : "REC") : (ko ? "일시정지" : "Paused")}
            </span>
          </div>
          <div className="rounded-full px-3 py-1.5 text-white/50 text-[12px] font-mono" style={{ background: "rgba(0,0,0,0.6)" }}>
            {fmtTime(elapsed)}
          </div>
        </div>
        {/* GPS accuracy */}
        {gpsAccuracy !== null && (
          <div className="absolute bottom-2 right-2 z-10 text-[10px] text-white/30">GPS ±{gpsAccuracy}m</div>
        )}
      </div>

      {/* Stats */}
      <div className="flex-1 overflow-auto px-5 py-4">
        {/* Big distance */}
        <div className="text-center mb-4">
          <div className="flex items-baseline justify-center">
            <span className="text-[52px] font-extrabold text-white tracking-tighter leading-none">{distance.toFixed(2)}</span>
            <span className="text-[14px] text-white/30 ml-1.5">km</span>
          </div>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-[11px] text-white/30">PACE</span>
            <span className="text-[18px] font-bold text-[#4ADE80]">{fmtPace(currentPace)}</span>
            <span className="text-[11px] text-white/20">/km</span>
          </div>
        </div>

        {/* 4-grid */}
        <div className="grid grid-cols-4 gap-1 rounded-2xl py-3 mb-3" style={{ background: "rgba(255,255,255,0.04)" }}>
          {[
            { v: steps.toLocaleString(), l: ko ? "걸음" : "Steps" },
            { v: String(calories), l: "kcal" },
            { v: speed.toFixed(1), l: "km/h" },
            { v: elevGain > 0 ? `+${elevGain}` : "0", l: ko ? "고도(m)" : "Elev(m)" },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-[15px] font-bold text-white">{s.v}</div>
              <div className="text-[9px] text-white/30 uppercase">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Avg pace */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-[11px] text-white/25">{ko ? "평균" : "Avg"}</span>
          <span className="text-[13px] font-semibold text-white/50">{fmtPace(avgPace)}</span>
        </div>

        {/* Photo/Spot badges */}
        {(photos.length > 0 || spots.length > 0) && (
          <div className="flex gap-3 justify-center mb-3">
            {photos.length > 0 && <span className="text-[11px] text-white/40 bg-white/[0.04] px-3 py-1 rounded-full">📷 {photos.length}</span>}
            {spots.length > 0 && <span className="text-[11px] text-white/40 bg-white/[0.04] px-3 py-1 rounded-full">📍 {spots.length}</span>}
          </div>
        )}

        {/* Splits */}
        {splits.length > 0 && (
          <div className="rounded-2xl p-3 mb-3" style={{ background: "rgba(255,255,255,0.04)" }}>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{ko ? "구간" : "Splits"}</p>
            {splits.map(s => (
              <div key={s.km} className="flex items-center py-0.5 gap-3">
                <span className="text-[11px] text-white/40 w-7">{s.km}km</span>
                <span className="text-[13px] font-bold text-[#4ADE80]">{s.pace}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 flex items-center justify-center gap-5 py-4 pb-6" style={{ background: "rgba(0,0,0,0.3)" }}>
        {state === "walking" ? (
          <>
            <button onClick={() => photoRef.current?.click()} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </button>
            <button onClick={pause} className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#111"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            </button>
            <button onClick={() => setShowSpotModal(true)} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setShowStopModal(true)} className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            </button>
            <button onClick={resume} className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#2D4A2E" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><polygon points="6,3 20,12 6,21"/></svg>
            </button>
          </>
        )}
      </div>

      {/* Stop modal */}
      {showStopModal && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center px-8">
          <div className="bg-[#1a1a1a] rounded-3xl p-6 w-full max-w-[340px] text-center">
            <h3 className="text-[17px] font-bold text-white mb-4">{ko ? "걷기를 종료할까요?" : "End walk?"}</h3>
            <div className="flex bg-white/[0.04] rounded-2xl py-3.5 mb-5">
              {[{ v: distance.toFixed(2), l: "km" }, { v: fmtTime(elapsed), l: ko ? "시간" : "Time" }, { v: steps.toLocaleString(), l: ko ? "걸음" : "Steps" }].map((s, i) => (
                <div key={i} className="flex-1 text-center" style={{ borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                  <div className="text-[17px] font-bold text-white">{s.v}</div>
                  <div className="text-[10px] text-white/35">{s.l}</div>
                </div>
              ))}
            </div>
            <button onClick={() => { setShowStopModal(false); complete(); }} className="w-full py-3.5 bg-red-500 text-white rounded-xl text-[15px] font-bold mb-2">{ko ? "종료하기" : "End"}</button>
            <button onClick={() => setShowStopModal(false)} className="w-full py-3 text-white/40 text-[14px]">{ko ? "계속 걷기" : "Keep walking"}</button>
          </div>
        </div>
      )}

      {/* Spot modal */}
      {showSpotModal && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-end justify-center">
          <div className="bg-[#1a1a1a] rounded-t-3xl p-5 w-full max-w-[400px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-bold text-white">{ko ? "스팟 추가" : "Add Spot"}</h3>
              <button onClick={() => setShowSpotModal(false)} className="text-white/40">✕</button>
            </div>
            <div className="flex gap-1.5 mb-3">
              {SPOTS.map(s => (
                <button key={s.key} onClick={() => setSpotType(s.key)} className="flex-1 py-2 rounded-lg text-[11px] font-semibold text-center" style={{ background: spotType === s.key ? s.color : "rgba(255,255,255,0.06)", color: spotType === s.key ? "#fff" : "rgba(255,255,255,0.4)" }}>{s.label}</button>
              ))}
            </div>
            <input className="w-full bg-white/[0.06] rounded-lg px-3 py-2.5 text-[13px] text-white placeholder-white/25 outline-none mb-3" placeholder={ko ? "스팟 이름" : "Spot name"} value={spotName} onChange={e => setSpotName(e.target.value)} autoFocus />
            <button onClick={handleAddSpot} disabled={!spotName.trim()} className={`w-full py-3 rounded-lg text-[14px] font-bold ${spotName.trim() ? "bg-[#4ADE80] text-black" : "bg-white/[0.06] text-white/25"}`}>{ko ? "추가" : "Add"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
