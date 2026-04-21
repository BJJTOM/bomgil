"use client";

import type { TrailSegment } from "@/types";

interface TrailSegmentsProps {
  segments: TrailSegment[];
}

export function TrailSegments({ segments }: TrailSegmentsProps) {
  if (segments.length === 0) return null;

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-border-default" />

      <div className="space-y-0">
        {segments.map((seg, index) => {
          const isLast = index === segments.length - 1;

          return (
            <div key={seg.id} className="relative flex gap-3.5 items-start">
              {/* Start dot */}
              <div className="relative z-10 flex-shrink-0 mt-1">
                <div className="w-[22px] h-[22px] rounded-full bg-white border-2 border-primary flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
              </div>

              {/* Segment content */}
              <div className={`flex-1 ${isLast ? "pb-0" : "pb-5"}`}>
                <div className="flex items-center gap-1.5 text-[14px] font-semibold text-text-primary leading-snug">
                  <span>{seg.start_name}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary flex-shrink-0">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  <span>{seg.end_name}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[12px] text-text-secondary">
                  <span className="font-en">{parseFloat(seg.distance_km).toFixed(1)}km</span>
                  <span className="text-text-tertiary">·</span>
                  <span>{seg.duration_minutes}분</span>
                </div>
                {seg.description && (
                  <p className="mt-1.5 text-[12px] text-text-tertiary leading-relaxed">
                    {seg.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Final destination dot */}
        {segments.length > 0 && (
          <div className="relative flex gap-3.5 items-start">
            <div className="relative z-10 flex-shrink-0 mt-1">
              <div className="w-[22px] h-[22px] rounded-full bg-primary flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
            </div>
            <div className="text-[13px] font-medium text-text-secondary mt-0.5">
              {segments[segments.length - 1].end_name}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
