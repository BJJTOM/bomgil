"use client";

import type { TrailSegment } from "@/types";

interface TrailSegmentsProps {
  segments: TrailSegment[];
  /** Optional heading. Hidden when the parent already labels the block. */
  title?: string;
}

/**
 * 구간별 거리·시간. 지도 아래에 얹혀지는 컴포넌트로 재디자인 — 연결된
 * 진행바 + 숫자 배지 + 거리 pill 조합으로 시인성 UP.
 */
export function TrailSegments({ segments, title }: TrailSegmentsProps) {
  if (!segments || segments.length === 0) return null;

  const totalKm = segments.reduce(
    (sum, s) => sum + parseFloat(s.distance_km || "0"),
    0,
  );
  const totalMin = segments.reduce(
    (sum, s) => sum + Number(s.duration_minutes || 0),
    0,
  );

  return (
    <div className="space-y-3">
      {title && (
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-bold text-text-primary">{title}</h3>
          <div className="text-[11px] text-text-tertiary">
            총 <span className="font-en font-semibold text-text-secondary">
              {totalKm.toFixed(1)}km
            </span>{" "}
            · {totalMin}분
          </div>
        </div>
      )}

      <ol className="space-y-2">
        {segments.map((seg, idx) => {
          const distanceKm = parseFloat(seg.distance_km || "0");
          const fraction = totalKm > 0 ? distanceKm / totalKm : 0;
          return (
            <li
              key={seg.id ?? idx}
              className="relative rounded-xl bg-white dark:bg-gray-900/60 border border-border-light dark:border-white/5 px-3.5 py-3 flex items-center gap-3"
            >
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-[13px] font-semibold text-text-primary leading-tight truncate">
                  <span className="truncate">{seg.start_name}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-text-tertiary shrink-0">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  <span className="truncate">{seg.end_name}</span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-border-light dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${Math.max(fraction * 100, 6)}%` }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[12px] font-en font-semibold text-text-primary">
                  {distanceKm.toFixed(1)}km
                </div>
                <div className="text-[10.5px] text-text-tertiary">
                  {seg.duration_minutes}분
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
