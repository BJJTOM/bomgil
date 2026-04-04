"use client";

import { SPOT_TYPE_LABELS, formatDistance } from "@/lib/utils";
import { SpotCard } from "./SpotCard";
import type { Spot } from "@/types";

interface SpotTimelineProps {
  spots: Spot[];
}

export function SpotTimeline({ spots }: SpotTimelineProps) {
  if (spots.length === 0) return null;

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-accent" />

      <div className="space-y-6">
        {spots.map((spot, index) => {
          const typeInfo = SPOT_TYPE_LABELS[spot.spot_type] || {
            label: spot.spot_type,
            emoji: "📍",
          };

          return (
            <div key={spot.id} className="relative flex gap-4">
              {/* Node */}
              <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-white border-2 border-accent flex items-center justify-center text-lg shadow-soft">
                {typeInfo.emoji}
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-text-secondary font-en">
                    {formatDistance(spot.distance_from_start_km)}
                  </span>
                  <span className="text-xs bg-accent/20 text-primary px-2 py-0.5 rounded-full">
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
