"use client";

import Image from "next/image";
import Link from "next/link";
import { DifficultyBadge } from "./DifficultyBadge";
import { formatDistance, formatDuration, TRAIL_TYPE_CONFIG } from "@/lib/utils";
import type { Trail } from "@/types";

interface TrailCardProps {
  trail: Trail;
  variant?: "default" | "horizontal" | "compact";
}

export function TrailCard({ trail, variant = "default" }: TrailCardProps) {
  const trailType = TRAIL_TYPE_CONFIG[trail.trail_type] || TRAIL_TYPE_CONFIG.mixed;

  if (variant === "horizontal") {
    return (
      <Link
        href={`/trails/${trail.id}`}
        className="flex card-hover overflow-hidden active:scale-[0.98]"
      >
        <div className="relative w-28 h-28 flex-shrink-0">
          {trail.cover_image ? (
            <Image src={trail.cover_image} alt={trail.title} fill className="object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-accent-light to-accent flex items-center justify-center text-2xl">
              {trailType.emoji}
            </div>
          )}
        </div>
        <div className="p-3.5 flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[11px] text-text-tertiary">{trailType.emoji} {trail.region}</span>
            </div>
            <h3 className="font-semibold text-[15px] truncate leading-snug">{trail.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <DifficultyBadge difficulty={trail.difficulty} />
            <span className="text-[12px] text-text-tertiary font-en">
              {formatDistance(trail.distance_km)} · {formatDuration(trail.estimated_minutes)}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/trails/${trail.id}`}
      className={`block card-hover overflow-hidden ${variant === "compact" ? "min-w-[280px]" : ""}`}
    >
      <div className="relative h-44 w-full">
        {trail.cover_image ? (
          <Image src={trail.cover_image} alt={trail.title} fill className="object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-accent-light to-primary-100 flex items-center justify-center text-5xl">
            {trailType.emoji}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <DifficultyBadge difficulty={trail.difficulty} />
          {trail.is_multi_day && trail.total_days && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill text-[11px] font-semibold bg-white/90 text-primary backdrop-blur-sm">
              {trail.total_days}일
            </span>
          )}
        </div>
        {trail.is_liked && (
          <div className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#FF4B4B" stroke="none">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[12px] text-text-secondary">{trailType.emoji} {trailType.label}</span>
          <span className="text-[12px] text-text-tertiary">· {trail.region}</span>
        </div>
        <h3 className="font-semibold text-[16px] leading-snug truncate">{trail.title}</h3>
        <div className="flex items-center gap-2 mt-2.5 text-[13px] text-text-secondary">
          <span className="font-en font-medium">{formatDistance(trail.distance_km)}</span>
          <span className="text-text-tertiary">·</span>
          <span>{formatDuration(trail.estimated_minutes)}</span>
          <span className="text-text-tertiary">·</span>
          <span className="flex items-center gap-0.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#FF4B4B" stroke="none">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            {trail.like_count}
          </span>
        </div>
        {trail.tags?.length > 0 && (
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {trail.tags.slice(0, 3).map((tag) => (
              <span key={tag.id} className="chip !py-1 !text-[11px]">
                #{tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
