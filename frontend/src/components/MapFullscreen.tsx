"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { MapView } from "./MapView";
import {
  drawSlopeGradientLine,
  removeSlopeGradientLine,
  hasElevationData,
} from "./moruMapLayers";

// ─── Current Location Button ──────────────────────────────────────────────

function CurrentLocationButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors shadow-lg"
      aria-label="현재 위치"
      type="button"
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      )}
    </button>
  );
}

// ─── Trail Info Overlay (compact card) ────────────────────────────────────

function TrailInfoOverlay({ title, distance, duration }: { title?: string; distance?: string; duration?: string }) {
  if (!title && !distance && !duration) return null;

  const formatDuration = (dur: string) => {
    const mins = Number(dur);
    if (isNaN(mins)) return dur;
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}시간${m > 0 ? ` ${m}분` : ''}`;
    }
    return `${mins}분`;
  };

  return (
    <div className="bg-black/60 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10 max-w-[200px]">
      {title && (
        <div className="text-white text-[13px] font-bold truncate leading-tight">{title}</div>
      )}
      {(distance || duration) && (
        <div className="flex items-center gap-2.5 mt-0.5">
          {distance && (
            <span className="text-white/80 text-[11px] font-medium">
              {parseFloat(distance).toFixed(1)} km
            </span>
          )}
          {duration && (
            <span className="text-white/60 text-[11px] font-medium">
              {formatDuration(duration)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface MapFullscreenProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  pathCoordinates?: [number, number][];
  /** Raw path data with optional elevation: [lng, lat, elevation?][] */
  rawCoordinates?: number[][];
  markers?: {
    id: number;
    lat: number;
    lng: number;
    title: string;
    emoji?: string;
  }[];
  distance?: string;
  duration?: string;
  difficulty?: string;
  theme?: "dark" | "light";
  onMarkerClick?: (id: number) => void;
}

// ─── Feature 1: Waypoint Card Slider ──────────────────────────────────────

function WaypointCardSlider({
  markers,
  activeIndex,
  onCardTap,
  bottomOffset,
}: {
  markers: { id: number; lat: number; lng: number; title: string; emoji?: string; distanceFromStart?: number }[];
  activeIndex: number;
  onCardTap: (marker: { id: number; lat: number; lng: number; title: string }, index: number) => void;
  bottomOffset: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current || activeIndex < 0) return;
    const container = scrollRef.current;
    const cards = container.children;
    if (cards[activeIndex]) {
      const card = cards[activeIndex] as HTMLElement;
      const scrollLeft = card.offsetLeft - container.offsetWidth / 2 + card.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  }, [activeIndex]);

  return (
    <div
      className="absolute left-0 right-0 z-[10000] pointer-events-none"
      style={{ bottom: `${bottomOffset + 8}px` }}
    >
      <div
        ref={scrollRef}
        className="flex gap-2 px-4 overflow-x-auto scrollbar-hide pointer-events-auto"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {markers.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onCardTap(m, i)}
            className={`flex-shrink-0 flex items-center gap-2 rounded-xl px-3 py-2 shadow-md transition-all ${
              i === activeIndex
                ? "bg-white border-2 border-green-500 scale-[1.02]"
                : "bg-white/90 backdrop-blur-md border border-white/20"
            }`}
            style={{ width: 140, height: 60 }}
          >
            <span
              className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                i === activeIndex
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {i + 1}
            </span>
            <div className="flex flex-col items-start overflow-hidden min-w-0">
              <span className="text-[12px] font-semibold text-gray-900 truncate w-full text-left leading-tight">
                {m.title}
              </span>
              {m.distanceFromStart !== undefined && (
                <span className="text-[10px] text-gray-400 mt-0.5">
                  {m.distanceFromStart < 1
                    ? `${Math.round(m.distanceFromStart * 1000)}m`
                    : `${m.distanceFromStart.toFixed(1)}km`}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Feature 2: Distance to Trailhead Badge ──────────────────────────────

function DistanceBadge({ distanceKm }: { distanceKm: number }) {
  const label =
    distanceKm < 1
      ? `${Math.round(distanceKm * 1000)}m`
      : `${distanceKm.toFixed(1)}km`;

  return (
    <div className="bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10 flex items-center gap-1.5 shadow-lg">
      <span className="text-[13px]" role="img" aria-label="pin">{"\uD83D\uDCCD"}</span>
      <span className="text-white text-[12px] font-semibold whitespace-nowrap">
        {"출발점까지 약 "}{label}
      </span>
    </div>
  );
}

// ─── Feature 4: Share duration formatter ──────────────────────────────────

function formatDurationForShare(dur?: string): string {
  if (!dur) return "";
  const mins = Number(dur);
  if (isNaN(mins)) return dur;
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h${m > 0 ? ` ${m}m` : ""}`;
  }
  return `${mins}m`;
}

// ─── Elevation helpers ─────────────────────────────────────────────────────

function haversineKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface ElevPoint {
  distance: number;
  elevation: number;
  lng: number;
  lat: number;
}

function buildElevationProfile(coords: number[][]): ElevPoint[] | null {
  if (!coords || coords.length < 2) return null;
  // Check if elevation data exists (3rd component)
  const hasElev = coords.some((c) => c.length >= 3 && c[2] !== 0);
  if (!hasElev) return null;

  const points: ElevPoint[] = [];
  let cumDist = 0;
  for (let i = 0; i < coords.length; i++) {
    const c = coords[i];
    if (i > 0) {
      const prev = coords[i - 1];
      cumDist += haversineKm(prev[0], prev[1], c[0], c[1]);
    }
    points.push({
      distance: cumDist,
      elevation: c.length >= 3 ? c[2] : 0,
      lng: c[0],
      lat: c[1],
    });
  }
  return points;
}

// ─── Bearing calculation ──────────────────────────────────────────────────

function calcBearing(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

// ─── Elevation Profile Bar ─────────────────────────────────────────────────

function ElevationBar({
  profile,
  externalRatio,
  onScrub,
  onScrubEnd,
}: {
  profile: ElevPoint[];
  /** External ratio (0-1) from flythrough to position indicator */
  externalRatio?: number | null;
  /** Called when user drags the elevation bar. ratio is 0-1. */
  onScrub?: (ratio: number, point: ElevPoint) => void;
  /** Called when user ends drag. */
  onScrubEnd?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorX, setIndicatorX] = useState<number | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ elev: number; dist: number } | null>(null);
  const isDragging = useRef(false);

  const stats = useMemo(() => {
    const elevations = profile.map((p) => p.elevation);
    return {
      minElev: Math.min(...elevations),
      maxElev: Math.max(...elevations),
      totalDist: profile[profile.length - 1].distance,
    };
  }, [profile]);

  // Draw the profile on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = containerRef.current;
    if (!container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = 70;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const pad = { top: 8, bottom: 8, left: 0, right: 0 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    const elevRange = stats.maxElev - stats.minElev || 1;
    const elevPad = elevRange * 0.1;
    const yMin = stats.minElev - elevPad;
    const yMax = stats.maxElev + elevPad;
    const yRange = yMax - yMin;

    const toX = (dist: number) => pad.left + (dist / stats.totalDist) * chartW;
    const toY = (elev: number) => pad.top + chartH - ((elev - yMin) / yRange) * chartH;

    // Area fill gradient
    const grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
    grad.addColorStop(0, "rgba(74, 222, 128, 0.5)");
    grad.addColorStop(1, "rgba(74, 222, 128, 0.05)");

    ctx.beginPath();
    ctx.moveTo(toX(profile[0].distance), toY(profile[0].elevation));
    for (let i = 1; i < profile.length; i++) {
      ctx.lineTo(toX(profile[i].distance), toY(profile[i].elevation));
    }
    // Close area
    ctx.lineTo(toX(profile[profile.length - 1].distance), h - pad.bottom);
    ctx.lineTo(toX(profile[0].distance), h - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Profile line
    ctx.beginPath();
    ctx.moveTo(toX(profile[0].distance), toY(profile[0].elevation));
    for (let i = 1; i < profile.length; i++) {
      ctx.lineTo(toX(profile[i].distance), toY(profile[i].elevation));
    }
    ctx.strokeStyle = "rgba(74, 222, 128, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [profile, stats]);

  // Handle external ratio (from flythrough sync)
  useEffect(() => {
    if (externalRatio == null || isDragging.current) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = externalRatio * rect.width;
    const targetDist = externalRatio * stats.totalDist;

    // Find closest point
    let closest = profile[0];
    let minDiff = Math.abs(profile[0].distance - targetDist);
    for (let i = 1; i < profile.length; i++) {
      const diff = Math.abs(profile[i].distance - targetDist);
      if (diff < minDiff) {
        minDiff = diff;
        closest = profile[i];
      }
    }

    setIndicatorX(x);
    setHoverInfo({ elev: closest.elevation, dist: closest.distance });
  }, [externalRatio, profile, stats.totalDist]);

  const getPointAtX = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const targetDist = ratio * stats.totalDist;

      // Find closest point
      let closest = profile[0];
      let closestIdx = 0;
      let minDiff = Math.abs(profile[0].distance - targetDist);
      for (let i = 1; i < profile.length; i++) {
        const diff = Math.abs(profile[i].distance - targetDist);
        if (diff < minDiff) {
          minDiff = diff;
          closest = profile[i];
          closestIdx = i;
        }
      }
      return { x: ratio * rect.width, elev: closest.elevation, dist: closest.distance, ratio, point: closest, index: closestIdx };
    },
    [profile, stats.totalDist],
  );

  const handleInteraction = useCallback(
    (clientX: number) => {
      const result = getPointAtX(clientX);
      if (result) {
        setIndicatorX(result.x);
        setHoverInfo({ elev: result.elev, dist: result.dist });
        if (onScrub) onScrub(result.ratio, result.point);
      }
    },
    [getPointAtX, onScrub],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      handleInteraction(e.clientX);
    },
    [handleInteraction],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      handleInteraction(e.clientX);
    },
    [handleInteraction],
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    setIndicatorX(null);
    setHoverInfo(null);
    if (onScrubEnd) onScrubEnd();
  }, [onScrubEnd]);

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[10001]"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
    >
      {/* Info tooltip */}
      {hoverInfo && indicatorX !== null && (
        <div
          className="absolute bottom-[78px] transform -translate-x-1/2 bg-black/80 backdrop-blur-md text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-white/10 whitespace-nowrap pointer-events-none z-10"
          style={{ left: `${Math.max(40, Math.min(indicatorX, (containerRef.current?.getBoundingClientRect().width ?? 300) - 40))}px` }}
        >
          <span className="font-bold">{Math.round(hoverInfo.elev)}m</span>
          <span className="text-white/60 ml-1.5">{hoverInfo.dist.toFixed(1)}km</span>
        </div>
      )}

      <div
        ref={containerRef}
        className="relative bg-black/60 backdrop-blur-md border-t border-white/10 cursor-crosshair touch-none select-none"
        style={{ height: 70 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          if (!isDragging.current) {
            setIndicatorX(null);
            setHoverInfo(null);
          }
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* Vertical indicator line */}
        {indicatorX !== null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-white/80 pointer-events-none z-10"
            style={{ left: `${indicatorX}px` }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white shadow-lg" />
          </div>
        )}

        {/* Min/Max labels */}
        <div className="absolute top-1 left-2 text-[9px] text-white/40 font-medium pointer-events-none">
          {Math.round(stats.maxElev)}m
        </div>
        <div className="absolute bottom-1 left-2 text-[9px] text-white/40 font-medium pointer-events-none">
          {Math.round(stats.minElev)}m
        </div>
      </div>
    </div>
  );
}

// ─── Flythrough Controls ──────────────────────────────────────────────────

type FlythroughSpeed = 1 | 2 | 4;

function FlythroughControls({
  playing,
  speed,
  onToggle,
  onSpeedChange,
  hasPath,
}: {
  playing: boolean;
  speed: FlythroughSpeed;
  onToggle: () => void;
  onSpeedChange: (s: FlythroughSpeed) => void;
  hasPath: boolean;
}) {
  if (!hasPath) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Speed controls (visible when playing) */}
      {playing && (
        <div className="flex gap-1 bg-black/60 backdrop-blur-md rounded-full px-1.5 py-1 border border-white/10">
          {([1, 2, 4] as FlythroughSpeed[]).map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className="px-2 py-0.5 rounded-full text-[11px] font-bold transition-colors"
              style={{
                background: speed === s ? "rgba(74,222,128,0.85)" : "transparent",
                color: speed === s ? "#0a1a10" : "rgba(255,255,255,0.7)",
              }}
              type="button"
            >
              {s}x
            </button>
          ))}
        </div>
      )}

      {/* Play/Pause button */}
      <button
        onClick={onToggle}
        className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95"
        style={{
          background: playing ? "rgba(74,222,128,0.9)" : "rgba(74,222,128,0.85)",
          color: "#0a1a10",
        }}
        aria-label={playing ? "일시정지" : "경로 따라가기"}
        type="button"
      >
        {playing ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5.14v14.72a1 1 0 001.5.86l11.04-7.36a1 1 0 000-1.72L9.5 4.28A1 1 0 008 5.14z" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ─── MapFullscreen Component ───────────────────────────────────────────────

export function MapFullscreen({
  open,
  onClose,
  title,
  pathCoordinates,
  rawCoordinates,
  markers,
  distance,
  duration,
  difficulty,
  theme = "light",
  onMarkerClick,
}: MapFullscreenProps) {
  const [terrain3D, setTerrain3D] = useState(false);
  const [slopeView, setSlopeView] = useState(false);
  const [locating, setLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mapInstanceRef = useRef<any>(null);
  // Feature 1: active waypoint card index
  const [activeWaypointIndex, setActiveWaypointIndex] = useState(-1);
  // Feature 2: distance from user to trailhead
  const [distanceToStart, setDistanceToStart] = useState<number | null>(null);
  // Feature 3: POI visibility toggle
  const [showPOIMarkers, setShowPOIMarkers] = useState(true);
  // Feature 4: share toast
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Flythrough state
  const [flythroughPlaying, setFlythroughPlaying] = useState(false);
  const [flythroughSpeed, setFlythroughSpeed] = useState<FlythroughSpeed>(1);
  const [elevBarRatio, setElevBarRatio] = useState<number | null>(null);
  const flythroughIndexRef = useRef(0);
  const flythroughTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flythroughMarkerRef = useRef<any>(null);
  const flythroughMapboxglRef = useRef<any>(null);
  // We need a ref to track flythroughSpeed inside the animation loop
  const flythroughSpeedRef = useRef<FlythroughSpeed>(1);

  // Elevation scrub state (for map sync)
  const scrubMarkerRef = useRef<any>(null);
  const scrubPanThrottleRef = useRef(0);

  // Check if raw coordinates have elevation data (needed for slope toggle)
  const canShowSlope = useMemo(() => hasElevationData(rawCoordinates), [rawCoordinates]);

  // Build elevation profile from raw coordinates
  const elevationProfile = useMemo(() => {
    if (rawCoordinates && rawCoordinates.length >= 2) {
      return buildElevationProfile(rawCoordinates);
    }
    return null;
  }, [rawCoordinates]);

  // Feature 1: Compute distances from start for each marker
  const markersWithDistance = useMemo(() => {
    if (!markers || markers.length === 0) return [];
    if (!pathCoordinates || pathCoordinates.length === 0)
      return markers.map((m) => ({ ...m, distanceFromStart: undefined }));

    const startLng = pathCoordinates[0][0];
    const startLat = pathCoordinates[0][1];
    return markers.map((m) => ({
      ...m,
      distanceFromStart: haversineKm(startLng, startLat, m.lng, m.lat),
    }));
  }, [markers, pathCoordinates]);

  // Feature 2: Calculate distance to trailhead on open
  useEffect(() => {
    if (!open || !pathCoordinates || pathCoordinates.length === 0) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        const startLng = pathCoordinates[0][0];
        const startLat = pathCoordinates[0][1];
        const dist = haversineKm(userLng, userLat, startLng, startLat);
        setDistanceToStart(dist);
      },
      () => {
        // Geolocation denied — hide badge silently
        setDistanceToStart(null);
      },
      { enableHighAccuracy: false, timeout: 5000 }
    );
  }, [open, pathCoordinates]);

  // Feature 4: Toast auto-dismiss
  useEffect(() => {
    if (!shareToast) return;
    const timer = setTimeout(() => setShareToast(null), 2500);
    return () => clearTimeout(timer);
  }, [shareToast]);

  // Handle map ready — store instance for slope overlay control
  const handleMapReady = useCallback((map: any) => {
    mapInstanceRef.current = map;
  }, []);

  // ── Flythrough helpers ──────────────────────────────────────────────────

  const cleanupFlythroughMarker = useCallback(() => {
    if (flythroughMarkerRef.current) {
      flythroughMarkerRef.current.remove();
      flythroughMarkerRef.current = null;
    }
  }, []);

  const cleanupScrubMarker = useCallback(() => {
    if (scrubMarkerRef.current) {
      scrubMarkerRef.current.remove();
      scrubMarkerRef.current = null;
    }
  }, []);

  const cleanupHighlightLayer = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    try {
      if (map.getLayer("flythrough-highlight-line")) map.removeLayer("flythrough-highlight-line");
      if (map.getSource("flythrough-highlight")) map.removeSource("flythrough-highlight");
    } catch { /* ignore */ }
  }, []);

  const stopFlythrough = useCallback(() => {
    if (flythroughTimerRef.current) {
      clearTimeout(flythroughTimerRef.current);
      flythroughTimerRef.current = null;
    }
  }, []);

  const createOrUpdateFlythroughMarker = useCallback((lng: number, lat: number) => {
    const map = mapInstanceRef.current;
    const mapboxgl = flythroughMapboxglRef.current;
    if (!map || !mapboxgl) return;
    if (flythroughMarkerRef.current) {
      flythroughMarkerRef.current.setLngLat([lng, lat]);
    } else {
      const el = document.createElement("div");
      el.style.cssText = "position:relative;display:flex;align-items:center;justify-content:center;width:24px;height:24px;pointer-events:none";
      el.innerHTML = `<div style="position:absolute;width:24px;height:24px;border-radius:50%;background:rgba(74,222,128,0.3);animation:moru-pulse 1.5s ease-out infinite"></div><div style="width:14px;height:14px;background:#4ADE80;border-radius:50%;border:3px solid white;box-shadow:0 0 12px rgba(74,222,128,0.7);z-index:2"></div>`;
      flythroughMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat([lng, lat]).addTo(map);
    }
  }, []);

  const createOrUpdateScrubMarker = useCallback((lng: number, lat: number) => {
    const map = mapInstanceRef.current;
    const mapboxgl = flythroughMapboxglRef.current;
    if (!map || !mapboxgl) return;
    if (scrubMarkerRef.current) {
      scrubMarkerRef.current.setLngLat([lng, lat]);
    } else {
      const el = document.createElement("div");
      el.style.cssText = "position:relative;display:flex;align-items:center;justify-content:center;width:20px;height:20px;pointer-events:none";
      el.innerHTML = `<div style="width:14px;height:14px;background:#FF3B30;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(255,59,48,0.6);z-index:2"></div>`;
      scrubMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat([lng, lat]).addTo(map);
    }
  }, []);

  const updateHighlightLayer = useCallback((coords: [number, number][], upToIndex: number) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const highlightCoords = coords.slice(0, upToIndex + 1);
    if (highlightCoords.length < 2) return;
    const geojson: any = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: highlightCoords } };
    try {
      const src = map.getSource("flythrough-highlight");
      if (src) { src.setData(geojson); } else {
        map.addSource("flythrough-highlight", { type: "geojson", data: geojson });
        map.addLayer({ id: "flythrough-highlight-line", type: "line", source: "flythrough-highlight", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#4ADE80", "line-width": 5, "line-opacity": 0.9 } });
      }
    } catch { /* ignore */ }
  }, []);

  const resetCamera = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !pathCoordinates || pathCoordinates.length < 2) return;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      const bounds = new mapboxgl.LngLatBounds();
      pathCoordinates.forEach((c) => bounds.extend(c));
      map.flyTo({ center: bounds.getCenter(), zoom: map.getZoom() > 13 ? 13 : map.getZoom(), pitch: 0, bearing: 0, duration: 1000 });
      setTimeout(() => { try { map.fitBounds(bounds, { padding: 60, duration: 800 }); } catch {} }, 1100);
    })();
  }, [pathCoordinates]);

  // Keep speed ref in sync
  useEffect(() => { flythroughSpeedRef.current = flythroughSpeed; }, [flythroughSpeed]);

  const flythroughStep = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !pathCoordinates || pathCoordinates.length < 2) return;
    const idx = flythroughIndexRef.current;
    const coords = pathCoordinates;
    if (idx >= coords.length - 1) {
      setFlythroughPlaying(false); stopFlythrough(); cleanupFlythroughMarker(); cleanupHighlightLayer(); setElevBarRatio(null); flythroughIndexRef.current = 0; resetCamera(); return;
    }
    const cur = coords[idx];
    const nextIdx = Math.min(idx + 1, coords.length - 1);
    const next = coords[nextIdx];
    const bearing = calcBearing(cur[0], cur[1], next[0], next[1]);
    map.easeTo({ center: [cur[0], cur[1]], bearing, zoom: 15, pitch: 60, duration: 200 });
    createOrUpdateFlythroughMarker(cur[0], cur[1]);
    updateHighlightLayer(coords, idx);
    setElevBarRatio(idx / (coords.length - 1));
    const currentSpeed = flythroughSpeedRef.current;
    const skipMap: Record<FlythroughSpeed, number> = { 1: 5, 2: 3, 4: 1 };
    const skip = skipMap[currentSpeed] ?? 5;
    const nextAnimIdx = Math.min(idx + skip, coords.length - 1);
    flythroughIndexRef.current = nextAnimIdx === idx ? coords.length - 1 : nextAnimIdx;
    flythroughTimerRef.current = setTimeout(flythroughStep, 200);
  }, [pathCoordinates, stopFlythrough, cleanupFlythroughMarker, cleanupHighlightLayer, createOrUpdateFlythroughMarker, updateHighlightLayer, resetCamera]);

  const handleFlythroughToggle = useCallback(() => {
    if (flythroughPlaying) {
      stopFlythrough(); setFlythroughPlaying(false);
    } else {
      if (!pathCoordinates || pathCoordinates.length < 2) return;
      if (flythroughIndexRef.current >= pathCoordinates.length - 1) flythroughIndexRef.current = 0;
      (async () => {
        if (!flythroughMapboxglRef.current) flythroughMapboxglRef.current = (await import("mapbox-gl")).default;
        setFlythroughPlaying(true); flythroughStep();
      })();
    }
  }, [flythroughPlaying, pathCoordinates, stopFlythrough, flythroughStep]);

  const handleSpeedChange = useCallback((s: FlythroughSpeed) => { setFlythroughSpeed(s); }, []);

  // ── Elevation bar scrub -> map sync ─────────────────────────────────────

  const handleElevationScrub = useCallback((ratio: number, point: ElevPoint) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (flythroughPlaying) { stopFlythrough(); setFlythroughPlaying(false); }
    (async () => {
      if (!flythroughMapboxglRef.current) flythroughMapboxglRef.current = (await import("mapbox-gl")).default;
      createOrUpdateScrubMarker(point.lng, point.lat);
      if (pathCoordinates && pathCoordinates.length > 1) {
        const idx = Math.floor(ratio * (pathCoordinates.length - 1));
        updateHighlightLayer(pathCoordinates, idx);
      }
      const now = Date.now();
      if (now - scrubPanThrottleRef.current > 100) { scrubPanThrottleRef.current = now; map.panTo([point.lng, point.lat], { duration: 200 }); }
    })();
  }, [flythroughPlaying, stopFlythrough, pathCoordinates, createOrUpdateScrubMarker, updateHighlightLayer]);

  const handleElevationScrubEnd = useCallback(() => {
    cleanupScrubMarker(); cleanupHighlightLayer();
  }, [cleanupScrubMarker, cleanupHighlightLayer]);

  // Cleanup flythrough on unmount
  useEffect(() => {
    return () => {
      if (flythroughTimerRef.current) { clearTimeout(flythroughTimerRef.current); flythroughTimerRef.current = null; }
      if (flythroughMarkerRef.current) { try { flythroughMarkerRef.current.remove(); } catch {} flythroughMarkerRef.current = null; }
      if (scrubMarkerRef.current) { try { scrubMarkerRef.current.remove(); } catch {} scrubMarkerRef.current = null; }
    };
  }, []);

  // Toggle slope overlay on/off
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Wait for style to load
    const apply = () => {
      if (!map.isStyleLoaded()) {
        map.once('idle', apply);
        return;
      }

      if (slopeView && rawCoordinates && canShowSlope) {
        // Hide normal trail line layers
        for (const id of ['moru-trail-main', 'moru-trail-glow', 'moru-trail-outline', 'moru-trail-arrows']) {
          if (map.getLayer(id)) {
            try { map.setLayoutProperty(id, 'visibility', 'none'); } catch {}
          }
        }
        // Draw slope gradient
        drawSlopeGradientLine(map, rawCoordinates, { theme });
      } else {
        // Remove slope layers
        removeSlopeGradientLine(map);
        // Restore normal trail line layers
        for (const id of ['moru-trail-main', 'moru-trail-glow', 'moru-trail-outline', 'moru-trail-arrows']) {
          if (map.getLayer(id)) {
            try { map.setLayoutProperty(id, 'visibility', 'visible'); } catch {}
          }
        }
      }
    };

    apply();
  }, [slopeView, rawCoordinates, canShowSlope, theme]);

  // ESC to close + lock body scroll
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Reset states when closed
  useEffect(() => {
    if (!open) {
      setTerrain3D(false);
      setSlopeView(false);
      setUserLocation(null);
      setActiveWaypointIndex(-1);
      setDistanceToStart(null);
      setShowPOIMarkers(true);
      setShareToast(null);
      // Clean up flythrough
      stopFlythrough();
      cleanupFlythroughMarker();
      cleanupScrubMarker();
      cleanupHighlightLayer();
      setFlythroughPlaying(false);
      setElevBarRatio(null);
      flythroughIndexRef.current = 0;
      mapInstanceRef.current = null;
    }
  }, [open, stopFlythrough, cleanupFlythroughMarker, cleanupScrubMarker, cleanupHighlightLayer]);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Feature 1: Handle waypoint card tap — fly to marker
  const handleWaypointTap = useCallback(
    (marker: { id: number; lat: number; lng: number; title: string }, index: number) => {
      setActiveWaypointIndex(index);
      if (onMarkerClick) onMarkerClick(marker.id);
      const map = mapInstanceRef.current;
      if (map) {
        map.flyTo({ center: [marker.lng, marker.lat], zoom: 16, duration: 1000 });
      }
    },
    [onMarkerClick],
  );

  // Feature 4: Handle share/download
  const handleShare = useCallback(async () => {
    const map = mapInstanceRef.current;
    try {
      if (!map) throw new Error("No map instance");

      const mapCanvas = map.getCanvas();
      const mapDataUrl = mapCanvas.toDataURL("image/png");

      // Create composite image canvas (1200x630 for OG)
      const OG_W = 1200;
      const OG_H = 630;
      const offscreen = document.createElement("canvas");
      offscreen.width = OG_W;
      offscreen.height = OG_H;
      const ctx = offscreen.getContext("2d");
      if (!ctx) throw new Error("No 2d context");

      // Draw map screenshot
      const mapImg = new Image();
      mapImg.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        mapImg.onload = () => resolve();
        mapImg.onerror = () => reject(new Error("Image load failed"));
        mapImg.src = mapDataUrl;
      });

      const scale = Math.max(OG_W / mapImg.width, OG_H / mapImg.height);
      const sw = mapImg.width * scale;
      const sh = mapImg.height * scale;
      ctx.drawImage(mapImg, (OG_W - sw) / 2, (OG_H - sh) / 2, sw, sh);

      // Semi-transparent overlays for text readability
      const topGrad = ctx.createLinearGradient(0, 0, 0, 120);
      topGrad.addColorStop(0, "rgba(0,0,0,0.65)");
      topGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, OG_W, 120);

      const botGrad = ctx.createLinearGradient(0, OG_H - 100, 0, OG_H);
      botGrad.addColorStop(0, "rgba(0,0,0,0)");
      botGrad.addColorStop(1, "rgba(0,0,0,0.65)");
      ctx.fillStyle = botGrad;
      ctx.fillRect(0, OG_H - 100, OG_W, 100);

      // Top-left: Moru logo text + trail name
      ctx.fillStyle = "#4ADE80";
      ctx.font = "bold 28px 'Pretendard Variable', system-ui, sans-serif";
      ctx.fillText("Moru", 40, 50);
      if (title) {
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 36px 'Pretendard Variable', system-ui, sans-serif";
        ctx.fillText(title, 40, 92);
      }

      // Bottom-right: distance + time + difficulty
      const infoItems: string[] = [];
      if (distance) infoItems.push(`${parseFloat(distance).toFixed(1)}km`);
      if (duration) infoItems.push(formatDurationForShare(duration));
      if (difficulty) {
        const diffMap: Record<string, string> = { easy: "\uC26C\uC6C0", moderate: "\uBCF4\uD1B5", hard: "\uC5B4\uB824\uC6C0" };
        infoItems.push(diffMap[difficulty] || difficulty);
      }
      if (infoItems.length > 0) {
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "600 22px 'Pretendard Variable', system-ui, sans-serif";
        const infoText = infoItems.join("  \u00B7  ");
        const tw = ctx.measureText(infoText).width;
        ctx.fillText(infoText, OG_W - tw - 40, OG_H - 30);
      }

      // Bottom-center: moruwalk.com
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "500 18px 'Pretendard Variable', system-ui, sans-serif";
      const brand = "moruwalk.com";
      const brandW = ctx.measureText(brand).width;
      ctx.fillText(brand, (OG_W - brandW) / 2, OG_H - 30);

      // Convert to blob
      const blob = await new Promise<Blob | null>((resolve) =>
        offscreen.toBlob((b) => resolve(b), "image/png")
      );
      if (!blob) throw new Error("Blob creation failed");

      // Try Web Share API first (mobile)
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `moru-${title || "trail"}.png`, { type: "image/png" });
        const shareData = { files: [file], title: title || "Moru Trail" };
        if (navigator.canShare(shareData)) {
          try {
            await navigator.share(shareData);
            return;
          } catch { /* user cancelled */ }
        }
      }

      // Fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `moru-${title || "trail"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShareToast("\uC774\uBBF8\uC9C0\uAC00 \uB2E4\uC6B4\uB85C\uB4DC\uB418\uC5C8\uC2B5\uB2C8\uB2E4");
    } catch {
      // Canvas capture failed — fallback to copy URL
      try {
        const url = typeof window !== "undefined" ? window.location.href : "";
        await navigator.clipboard.writeText(url);
        setShareToast("\uB9C1\uD06C\uAC00 \uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4");
      } catch {
        setShareToast("\uACF5\uC720\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4");
      }
    }
  }, [title, distance, duration, difficulty]);

  if (!open) return null;

  // Compute the center for MapView — prefer user location if set, otherwise trail start
  const mapCenter = userLocation || (pathCoordinates && pathCoordinates.length > 0
    ? { lat: pathCoordinates[0][1], lng: pathCoordinates[0][0] }
    : undefined);

  return (
    <div className="fixed inset-0 z-[9999] bg-[#f0f4f0]" style={{ contain: "layout style" }}>
      <div className="absolute inset-0" style={{ bottom: elevationProfile ? 70 : 0 }}>
        <MapView
          pathCoordinates={pathCoordinates}
          markers={markers}
          theme={theme}
          className="w-full h-full"
          onMarkerClick={onMarkerClick}
          showNavigationControl
          enableScrollZoom
          terrain3D={terrain3D}
          showTerrainToggle={false}
          center={mapCenter}
          onMapReady={handleMapReady}
          showPOIMarkers={showPOIMarkers}
          enableRouteAnimation
          allowCinematicAnimation
        />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[10000] flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),16px)] pb-3 bg-gradient-to-b from-black/60 to-transparent">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          aria-label="닫기"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        {title && (
          <h2 className="text-white text-[15px] font-semibold flex-1 truncate drop-shadow-md">
            {title}
          </h2>
        )}
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          aria-label="닫기"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Trail info overlay (top-left, below top bar) */}
      <div className="absolute z-[10000] left-4" style={{ top: "calc(max(env(safe-area-inset-top), 16px) + 56px)" }}>
        <TrailInfoOverlay title={title} distance={distance} duration={duration} />
      </div>

      {/* Feature 2: Distance to trailhead badge (below trail info) */}
      {distanceToStart !== null && (
        <div className="absolute z-[10000] left-4" style={{ top: "calc(max(env(safe-area-inset-top), 16px) + 110px)" }}>
          <DistanceBadge distanceKm={distanceToStart} />
        </div>
      )}

      {/* Right toolbar: Terrain 3D + Slope + POI toggle + Share */}
      <div className="absolute z-[10000] right-4 flex flex-col gap-2" style={{ top: "calc(max(env(safe-area-inset-top), 16px) + 56px)" }}>
        <button
          onClick={() => setTerrain3D((v) => !v)}
          className="w-10 h-10 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors shadow-lg"
          style={{
            background: terrain3D ? "rgba(74,222,128,0.85)" : "rgba(0,0,0,0.6)",
            color: terrain3D ? "#0a1a10" : "#fff",
          }}
          aria-label="3D 지형 토글"
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3L2 9l10 6 10-6-10-6z" />
            <path d="M2 17l10 6 10-6" />
            <path d="M2 13l10 6 10-6" />
          </svg>
        </button>

        {/* Slope/grade toggle — only shown when elevation data exists */}
        {canShowSlope && (
          <button
            onClick={() => setSlopeView((v) => !v)}
            className="w-10 h-10 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/80 transition-colors shadow-lg"
            style={{
              background: slopeView ? "rgba(255,107,53,0.85)" : "rgba(0,0,0,0.6)",
              color: slopeView ? "#fff" : "#fff",
            }}
            aria-label="경사도 보기 토글"
            aria-pressed={slopeView}
            type="button"
          >
            {/* Mountain slope icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 20L9 6l5 8 3-4 5 10" />
              <path d="M2 20h20" />
            </svg>
          </button>
        )}

        {/* Feature 3: POI visibility toggle */}
        <button
          onClick={() => setShowPOIMarkers((v) => !v)}
          className="w-10 h-10 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/80 transition-colors shadow-lg"
          style={{
            background: showPOIMarkers ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.15)",
            color: showPOIMarkers ? "#fff" : "rgba(255,255,255,0.5)",
          }}
          aria-label={showPOIMarkers ? "POI 마커 숨기기" : "POI 마커 보기"}
          aria-pressed={showPOIMarkers}
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </button>

        {/* Feature 4: Share / download button */}
        <button
          onClick={handleShare}
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors shadow-lg"
          aria-label="지도 공유"
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
      </div>

      {/* Current location button (bottom-left, offset for waypoint cards + elev bar) */}
      <div
        className="absolute z-[10000] left-4"
        style={{ bottom: `${(elevationProfile ? 70 : 0) + (markers && markers.length >= 2 ? 76 : 0) + 16}px` }}
      >
        <CurrentLocationButton onClick={handleLocate} loading={locating} />
      </div>

      {/* Flythrough controls (bottom-right, above waypoint cards + elevation bar) */}
      {!slopeView && (
        <div
          className="absolute z-[10000] right-4"
          style={{ bottom: `${(elevationProfile ? 70 : 0) + (markers && markers.length >= 2 ? 76 : 0) + 16}px` }}
        >
          <FlythroughControls
            playing={flythroughPlaying}
            speed={flythroughSpeed}
            onToggle={handleFlythroughToggle}
            onSpeedChange={handleSpeedChange}
            hasPath={!!(pathCoordinates && pathCoordinates.length > 1)}
          />
        </div>
      )}

      {/* Feature 1: Waypoint card slider (above elevation bar) */}
      {markers && markers.length >= 2 && (
        <WaypointCardSlider
          markers={markersWithDistance}
          activeIndex={activeWaypointIndex}
          onCardTap={handleWaypointTap}
          bottomOffset={elevationProfile ? 70 : 0}
        />
      )}

      {/* Slope legend (bottom-right, above elevation bar) */}
      {slopeView && (
        <div
          className="absolute z-[10000] right-3"
          style={{ bottom: elevationProfile ? "calc(70px + 12px)" : "12px" }}
        >
          <div className="bg-black/60 backdrop-blur-md rounded-lg px-2.5 py-2 border border-white/10 shadow-lg">
            <div className="text-white/70 text-[9px] font-semibold mb-1 tracking-wide uppercase">
              경사도
            </div>
            {[
              { color: "#4A90D9", label: "내리막" },
              { color: "#34C759", label: "평지 0-3%" },
              { color: "#FFB347", label: "완경사 3-7%" },
              { color: "#FF6B35", label: "급경사 7-12%" },
              { color: "#FF3B30", label: "초급경사 12%+" },
            ].map((item) => (
              <div key={item.color} className="flex items-center gap-1.5 py-[1px]">
                <div
                  className="w-3 h-[3px] rounded-full flex-shrink-0"
                  style={{ background: item.color }}
                />
                <span className="text-white/80 text-[9px] font-medium whitespace-nowrap">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Elevation profile bar at bottom */}
      {elevationProfile && (
        <ElevationBar
          profile={elevationProfile}
          externalRatio={flythroughPlaying ? elevBarRatio : null}
          onScrub={handleElevationScrub}
          onScrubEnd={handleElevationScrubEnd}
        />
      )}

      {/* Feature 4: Share toast */}
      {shareToast && (
        <div className="absolute bottom-[120px] left-1/2 -translate-x-1/2 z-[10002] animate-fade-in">
          <div className="bg-gray-900 text-white text-[13px] font-medium px-4 py-2.5 rounded-full shadow-lg whitespace-nowrap">
            {shareToast}
          </div>
        </div>
      )}
    </div>
  );
}

interface MapExpandButtonProps {
  onClick: () => void;
  className?: string;
}

export function MapExpandButton({ onClick, className = "" }: MapExpandButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`absolute top-3 left-3 z-[1000] w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors shadow-lg ${className}`}
      aria-label="전체화면"
      type="button"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
      </svg>
    </button>
  );
}
