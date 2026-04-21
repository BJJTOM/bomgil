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
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-accent" />

      <div className="space-y-6">
        {spots.map((spot, index) => {
          const typeInfo = SPOT_TYPE_CONFIG[spot.spot_type] || {
            label: spot.spot_type,
            icon: "pin",
            color: "#6B7280",
          };

          return (
            <div key={spot.id} className="relative flex gap-4">
              {/* Node — SVG icon inside circle */}
              <div
                className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-white border-2 flex items-center justify-center shadow-soft"
                style={{ borderColor: typeInfo.color }}
              >
                <SpotIcon type={spot.spot_type} size={18} />
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-text-secondary font-en">
                    {formatDistance(spot.distance_from_start_km)}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: `${typeInfo.color}15`,
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
