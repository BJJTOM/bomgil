"use client";

import { SPOT_TYPE_CONFIG, SPOT_ICON_PATHS, formatDistance } from "@/lib/utils";
import { SpotCard } from "./SpotCard";
import type { Spot } from "@/types";

interface SpotTimelineProps {
  spots: Spot[];
}

/** Inline SVG icon for a spot type */
function SpotIcon({ type, size = 16 }: { type: string; size?: number }) {
  const config = SPOT_TYPE_CONFIG[type];
  const iconKey = config?.icon;
  const pathData = iconKey ? SPOT_ICON_PATHS[iconKey] : null;
  const color = config?.color ?? "#6B7280";

  if (!pathData) {
    // Fallback: small filled circle (map pin dot)
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" fill={color} opacity="0.2" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {pathData.split(" M").map((d, i) => (
        <path key={i} d={i === 0 ? d : `M${d}`} />
      ))}
    </svg>
  );
}

export function SpotTimeline({ spots }: SpotTimelineProps) {
  if (spots.length === 0) return null;

  return (
    <div className="relative">
      {/* 수직 진행선 — 좌측 닷 중앙 정렬 (7px = dot 14px / 2) */}
      <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-border-default dark:bg-white/10" />

      <div className="space-y-5">
        {spots.map((spot) => {
          const typeInfo = SPOT_TYPE_CONFIG[spot.spot_type] || {
            label: spot.spot_type,
            icon: "pin",
            color: "#6B7280",
          };
          return (
            <div key={spot.id} className="relative flex gap-3.5">
              {/* 좌측 — 더 이상 컬러 아이콘 원이 아니라 단색 닷.
                   타입은 우측 상단의 pill 에서 표현되므로 좌측은 깔끔 유지. */}
              <div className="relative z-10 flex-shrink-0 mt-1.5">
                <div
                  className="w-[14px] h-[14px] rounded-full bg-white dark:bg-gray-900 ring-2"
                  style={{ boxShadow: `0 0 0 2px ${typeInfo.color}` } as React.CSSProperties}
                />
              </div>

              {/* Content */}
              <div className="flex-1 pb-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11.5px] text-text-secondary font-en">
                    {formatDistance(spot.distance_from_start_km)}
                  </span>
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: `${typeInfo.color}18`,
                      color: typeInfo.color,
                    }}
                  >
                    {typeInfo.label}
                  </span>
                </div>
                <SpotCard spot={spot} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
