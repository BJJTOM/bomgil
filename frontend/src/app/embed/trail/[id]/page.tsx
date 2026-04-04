"use client";

import { useParams } from "next/navigation";
import { useTrail } from "@/hooks/useTrails";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { formatDistance, formatDuration } from "@/lib/utils";

export default function EmbedTrailPage() {
  const { id } = useParams();
  const { data: trail, isLoading } = useTrail(Number(id));

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center h-48 bg-warm">
        <div className="text-text-secondary">불러오는 중...</div>
      </div>
    );
  }

  if (!trail) {
    return (
      <div className="p-4 flex items-center justify-center h-48 bg-warm">
        <div className="text-text-secondary">코스를 찾을 수 없습니다</div>
      </div>
    );
  }

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="font-body bg-warm p-4 max-w-md">
      <a
        href={`${appUrl}/trails/${trail.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-white rounded-card shadow-soft overflow-hidden hover:shadow-hover transition-shadow"
      >
        {trail.cover_image && (
          <div
            className="h-40 bg-cover bg-center"
            style={{ backgroundImage: `url(${trail.cover_image})` }}
          />
        )}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <DifficultyBadge difficulty={trail.difficulty} />
            <span className="text-xs text-text-secondary">
              {trail.region}, {trail.country}
            </span>
          </div>
          <h3 className="font-bold text-lg">{trail.title}</h3>
          <div className="flex items-center gap-3 mt-2 text-sm text-text-secondary">
            <span>{formatDistance(trail.distance_km)}</span>
            <span>·</span>
            <span>{formatDuration(trail.estimated_minutes)}</span>
            <span>·</span>
            <span>❤️ {trail.like_count}</span>
          </div>
          <div className="mt-3 pt-3 border-t flex items-center justify-between">
            <span className="text-xs text-primary font-medium">
              Roami에서 보기 →
            </span>
            <span className="text-[10px] text-text-secondary">
              Powered by Roami
            </span>
          </div>
        </div>
      </a>
    </div>
  );
}
