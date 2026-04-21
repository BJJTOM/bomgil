"use client";

import { useMemo } from "react";
import { useT } from "@/stores/language";

interface ElevationProfileProps {
  /** GeoJSON LineString with coordinates as [lng, lat, elevation?] */
  pathData: {
    type: string;
    coordinates: number[][];
  };
  className?: string;
}

/** Haversine distance in km between two [lng, lat] points */
function haversineKm(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number
): number {
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

interface ElevationPoint {
  distance: number; // cumulative km
  elevation: number; // meters
}

function computeProfile(coordinates: number[][]): ElevationPoint[] {
  const points: ElevationPoint[] = [];
  let cumDist = 0;

  for (let i = 0; i < coordinates.length; i++) {
    const coord = coordinates[i];
    const elevation = coord.length >= 3 ? coord[2] : 0;

    if (i > 0) {
      const prev = coordinates[i - 1];
      cumDist += haversineKm(prev[0], prev[1], coord[0], coord[1]);
    }

    points.push({ distance: cumDist, elevation });
  }

  return points;
}

function computeElevationGain(points: ElevationPoint[]): number {
  let gain = 0;
  for (let i = 1; i < points.length; i++) {
    const diff = points[i].elevation - points[i - 1].elevation;
    if (diff > 0) gain += diff;
  }
  return Math.round(gain);
}

export function ElevationProfile({ pathData, className }: ElevationProfileProps) {
  const { t, language } = useT();

  const profile = useMemo(
    () => computeProfile(pathData.coordinates),
    [pathData.coordinates]
  );

  const hasElevation = useMemo(
    () => profile.some((p) => p.elevation !== 0),
    [profile]
  );

  const stats = useMemo(() => {
    const elevations = profile.map((p) => p.elevation);
    const minElev = Math.min(...elevations);
    const maxElev = Math.max(...elevations);
    const totalDistance = profile[profile.length - 1]?.distance ?? 0;
    const totalGain = computeElevationGain(profile);
    return { minElev, maxElev, totalDistance, totalGain };
  }, [profile]);

  if (!hasElevation || profile.length < 2) {
    return null;
  }

  // --- SVG layout ---
  const SVG_HEIGHT = 160;
  const PADDING_TOP = 20;
  const PADDING_BOTTOM = 28;
  const PADDING_LEFT = 44;
  const PADDING_RIGHT = 12;

  const chartHeight = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  // Elevation range with some breathing room
  const elevRange = stats.maxElev - stats.minElev || 1;
  const elevPad = elevRange * 0.1;
  const yMin = stats.minElev - elevPad;
  const yMax = stats.maxElev + elevPad;
  const yRange = yMax - yMin;

  // Build path as percentage-based for responsive SVG
  // We use viewBox so it scales automatically
  const VIEW_W = 600;
  const chartW = VIEW_W - PADDING_LEFT - PADDING_RIGHT;

  const toX = (dist: number) =>
    PADDING_LEFT + (dist / stats.totalDistance) * chartW;
  const toY = (elev: number) =>
    PADDING_TOP + chartHeight - ((elev - yMin) / yRange) * chartHeight;

  // Area fill path
  const linePoints = profile.map(
    (p) => `${toX(p.distance).toFixed(1)},${toY(p.elevation).toFixed(1)}`
  );
  const linePath = `M${linePoints.join(" L")}`;
  const areaPath = `${linePath} L${toX(stats.totalDistance).toFixed(1)},${(PADDING_TOP + chartHeight).toFixed(1)} L${PADDING_LEFT},${(PADDING_TOP + chartHeight).toFixed(1)} Z`;

  // Y-axis ticks (3-5 nice round values)
  const yTicks = useMemo(() => {
    const range = stats.maxElev - stats.minElev;
    let step: number;
    if (range <= 50) step = 10;
    else if (range <= 100) step = 25;
    else if (range <= 300) step = 50;
    else if (range <= 600) step = 100;
    else step = 200;

    const start = Math.ceil(stats.minElev / step) * step;
    const ticks: number[] = [];
    for (let v = start; v <= stats.maxElev; v += step) {
      ticks.push(v);
    }
    // Ensure we have at least min and max
    if (ticks.length === 0) {
      ticks.push(Math.round(stats.minElev), Math.round(stats.maxElev));
    }
    return ticks;
  }, [stats.minElev, stats.maxElev]);

  // X-axis ticks
  const xTicks = useMemo(() => {
    const totalDist = stats.totalDistance;
    if (totalDist <= 0) return [];
    let step: number;
    if (totalDist <= 1) step = 0.2;
    else if (totalDist <= 3) step = 0.5;
    else if (totalDist <= 8) step = 1;
    else if (totalDist <= 20) step = 2;
    else step = 5;

    const ticks: number[] = [0];
    let v = step;
    while (v < totalDist) {
      ticks.push(v);
      v += step;
    }
    ticks.push(Math.round(totalDist * 10) / 10);
    return ticks;
  }, [stats.totalDistance]);

  // i18n labels
  const elevGainLabel =
    language === "ko"
      ? "누적 상승"
      : language === "ja"
      ? "累積上昇"
      : language === "zh"
      ? "累计上升"
      : "Elev. gain";

  const elevProfileLabel =
    language === "ko"
      ? "고도 프로필"
      : language === "ja"
      ? "標高プロファイル"
      : language === "zh"
      ? "海拔剖面"
      : "Elevation Profile";

  const gradientId = "elev-grad";
  const lineGradientId = "elev-line-grad";

  return (
    <div className={`card p-4 ${className ?? ""}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-bold text-text-primary">
          {elevProfileLabel}
        </h3>
        <div className="flex items-center gap-3 text-[12px] text-text-secondary">
          <span>
            {Math.round(stats.minElev)}m ~ {Math.round(stats.maxElev)}m
          </span>
          <span className="text-primary font-semibold">
            +{stats.totalGain}m {elevGainLabel}
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${VIEW_W} ${SVG_HEIGHT}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: "auto", aspectRatio: `${VIEW_W} / ${SVG_HEIGHT}` }}
        role="img"
        aria-label={elevProfileLabel}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2D4A2E" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2D4A2E" stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id={lineGradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3A5C3B" />
            <stop offset="50%" stopColor="#2D4A2E" />
            <stop offset="100%" stopColor="#3A5C3B" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {yTicks.map((tick) => {
          const y = toY(tick);
          return (
            <g key={`y-${tick}`}>
              <line
                x1={PADDING_LEFT}
                y1={y}
                x2={VIEW_W - PADDING_RIGHT}
                y2={y}
                stroke="var(--c-border-light)"
                strokeWidth="0.5"
              />
              <text
                x={PADDING_LEFT - 6}
                y={y + 3.5}
                textAnchor="end"
                fill="var(--c-text-tertiary)"
                fontSize="9"
                fontFamily="inherit"
              >
                {Math.round(tick)}m
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {xTicks.map((tick) => {
          const x = toX(tick);
          return (
            <text
              key={`x-${tick}`}
              x={x}
              y={SVG_HEIGHT - 6}
              textAnchor="middle"
              fill="var(--c-text-tertiary)"
              fontSize="9"
              fontFamily="inherit"
            >
              {tick.toFixed(tick % 1 === 0 ? 0 : 1)}km
            </text>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Elevation line */}
        <path
          d={linePath}
          fill="none"
          stroke={`url(#${lineGradientId})`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Min/Max markers */}
        <circle
          cx={toX(
            profile.find((p) => p.elevation === stats.maxElev)!.distance
          )}
          cy={toY(stats.maxElev)}
          r="3"
          fill="#2D4A2E"
          stroke="white"
          strokeWidth="1.5"
        />
        <circle
          cx={toX(
            profile.find((p) => p.elevation === stats.minElev)!.distance
          )}
          cy={toY(stats.minElev)}
          r="3"
          fill="#52a858"
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
