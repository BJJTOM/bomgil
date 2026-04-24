"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { MapView } from "./MapView";

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
  theme?: "dark" | "light";
  onMarkerClick?: (id: number) => void;
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

// ─── Elevation Profile Bar ─────────────────────────────────────────────────

function ElevationBar({
  profile,
}: {
  profile: ElevPoint[];
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
      let minDiff = Math.abs(profile[0].distance - targetDist);
      for (let i = 1; i < profile.length; i++) {
        const diff = Math.abs(profile[i].distance - targetDist);
        if (diff < minDiff) {
          minDiff = diff;
          closest = profile[i];
        }
      }
      return { x: ratio * rect.width, elev: closest.elevation, dist: closest.distance };
    },
    [profile, stats.totalDist],
  );

  const handleInteraction = useCallback(
    (clientX: number) => {
      const point = getPointAtX(clientX);
      if (point) {
        setIndicatorX(point.x);
        setHoverInfo({ elev: point.elev, dist: point.dist });
      }
    },
    [getPointAtX],
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
  }, []);

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
  theme = "light",
  onMarkerClick,
}: MapFullscreenProps) {
  // Build elevation profile from raw coordinates
  const elevationProfile = useMemo(() => {
    if (rawCoordinates && rawCoordinates.length >= 2) {
      return buildElevationProfile(rawCoordinates);
    }
    return null;
  }, [rawCoordinates]);

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#f0f4f0]" style={{ contain: "layout style" }}>
      <div className="absolute inset-0" style={{ bottom: elevationProfile ? 70 : 0 }}>
        <MapView
          pathCoordinates={pathCoordinates}
          markers={markers}
          theme={theme}
          showStats={!!(distance || duration)}
          distance={distance}
          duration={duration}
          className="w-full h-full"
          onMarkerClick={onMarkerClick}
          showNavigationControl
          enableScrollZoom
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

      {/* Elevation profile bar at bottom */}
      {elevationProfile && <ElevationBar profile={elevationProfile} />}
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
      className={`absolute top-3 right-3 z-[1000] w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors shadow-lg ${className}`}
      aria-label="전체화면"
      type="button"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
      </svg>
    </button>
  );
}
