"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { DifficultyBadge } from "./DifficultyBadge";
import { formatDistance, formatDuration, TRAIL_TYPE_CONFIG, TRAIL_TYPE_ICON_PATHS } from "@/lib/utils";
import type { Trail } from "@/types";

interface TrailCardProps {
  trail: Trail;
  variant?: "default" | "horizontal" | "compact";
}

/** Small inline SVG icon for trail type */
function TrailTypeIcon({ type, size = 14 }: { type: string; size?: number }) {
  const config = TRAIL_TYPE_CONFIG[type] || TRAIL_TYPE_CONFIG.mixed;
  const pathData = TRAIL_TYPE_ICON_PATHS[config.icon];
  if (!pathData) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={config.color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
    >
      {pathData.split(/(?=[A-Z])/).length > 1
        ? pathData.split(" M").map((d, i) => (
            <path key={i} d={i === 0 ? d : `M${d}`} />
          ))
        : <path d={pathData} />
      }
    </svg>
  );
}

/**
 * Region-themed emoji + gradient for trails without a cover image.
 * Spreads visual variety across the hundreds of public-API trails that
 * came in with `cover_image: null`, so Explore no longer looks like a
 * grid of identical placeholder tiles.
 */
function fallbackTheme(trail: Trail): { emoji: string; gradient: string } {
  const type = trail.trail_type;
  if (type === "coastal") return { emoji: "🌊", gradient: "from-[#A3C9E2] to-[#3D7EB5]" };
  if (type === "urban") return { emoji: "🏙️", gradient: "from-[#D9C8B4] to-[#6B5A45]" };
  if (type === "cultural") return { emoji: "🏯", gradient: "from-[#E9D5B4] to-[#8B6F3E]" };
  if (type === "nature") return { emoji: "🌲", gradient: "from-[#BFD8BD] to-[#3D6B4A]" };
  if (type === "village") return { emoji: "🏘️", gradient: "from-[#EAD9A8] to-[#A8883D]" };
  const region = (trail.region || "").toLowerCase();
  if (region.includes("제주")) return { emoji: "🏝️", gradient: "from-[#B7E0E6] to-[#3E8B9A]" };
  if (region.includes("부산") || region.includes("해운대"))
    return { emoji: "🌊", gradient: "from-[#A3C9E2] to-[#3D7EB5]" };
  if (region.includes("강원") || region.includes("설악"))
    return { emoji: "⛰️", gradient: "from-[#A8C0A3] to-[#4A7C59]" };
  if (region.includes("서울") || region.includes("종로") || region.includes("성동"))
    return { emoji: "🏙️", gradient: "from-[#D9C8B4] to-[#6B5A45]" };
  return { emoji: "🥾", gradient: "from-[#C9D8C5] to-[#6B8A6E]" };
}

/** Star rating display */
function StarRating({ rating, count }: { rating?: number; count?: number }) {
  if (!rating && !count) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-text-secondary">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#FBBF24" stroke="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      <span className="font-en font-medium">{rating?.toFixed(1) ?? "-"}</span>
      {count != null && count > 0 && (
        <span className="text-text-tertiary">({count})</span>
      )}
    </span>
  );
}

export function TrailCard({ trail, variant = "default" }: TrailCardProps) {
  const trailType = TRAIL_TYPE_CONFIG[trail.trail_type] || TRAIL_TYPE_CONFIG.mixed;
  const [imgBroken, setImgBroken] = useState(false);
  const rawSrc = trail.cover_image || trail.thumbnail_url || "";
  const showImage = !!rawSrc && !imgBroken;

  if (variant === "horizontal") {
    return (
      <Link
        href={`/trails/${trail.id}`}
        className="flex card-hover overflow-hidden active:scale-[0.98]"
      >
        <div className="relative w-28 h-28 flex-shrink-0">
          {showImage ? (
            <img
              src={rawSrc}
              alt={trail.title}
              className="w-full h-full object-cover"
              onError={() => setImgBroken(true)}
            />
          ) : (
            (() => {
              const { emoji, gradient } = fallbackTheme(trail);
              return (
                <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                  <span className="text-[36px] leading-none select-none" aria-hidden>{emoji}</span>
                </div>
              );
            })()
          )}
        </div>
        <div className="p-3.5 flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <TrailTypeIcon type={trail.trail_type} size={12} />
              <span className="text-[11px] text-text-tertiary">{trail.region}</span>
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
      <div className="relative h-36 md:h-44 w-full">
        {showImage ? (
          <img
            src={rawSrc}
            alt={trail.title}
            className="w-full h-full object-cover"
            onError={() => setImgBroken(true)}
          />
        ) : (
          (() => {
            const { emoji, gradient } = fallbackTheme(trail);
            return (
              <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-1`}>
                <span className="text-[56px] leading-none select-none drop-shadow-sm" aria-hidden>
                  {emoji}
                </span>
                <span className="text-[11px] text-white/85 font-semibold tracking-wide">
                  {trail.region}
                </span>
              </div>
            );
          })()
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        <div className="absolute top-2.5 left-2.5 md:top-3 md:left-3 flex gap-1.5">
          <DifficultyBadge difficulty={trail.difficulty} />
          {trail.is_multi_day && trail.total_days && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill text-[11px] font-semibold bg-white/90 text-primary backdrop-blur-sm">
              {trail.total_days}일
            </span>
          )}
        </div>
        {trail.is_liked && (
          <div className="absolute top-2.5 right-2.5 md:top-3 md:right-3 w-7 h-7 md:w-8 md:h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF4B4B" stroke="none" className="md:w-4 md:h-4">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-3 md:p-4">
        <div className="flex items-center gap-1.5 mb-1 md:mb-1.5">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: trailType.color }}
          />
          <span className="text-[11px] md:text-[12px] text-text-secondary">{trailType.label}</span>
          <span className="text-[11px] md:text-[12px] text-text-tertiary">· {trail.region}</span>
        </div>
        <h3 className="font-semibold text-[14px] md:text-[16px] leading-snug truncate">{trail.title}</h3>

        {/* Rating + completion row */}
        {(trail.avg_rating || trail.review_count || trail.completion_count) ? (
          <div className="flex items-center gap-3 mt-1 md:mt-1.5">
            <StarRating rating={trail.avg_rating} count={trail.review_count} />
            {(trail.completion_count ?? 0) > 0 && (
              <span className="text-[10px] md:text-[11px] text-text-tertiary font-medium">
                {trail.completion_count}명 완주
              </span>
            )}
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 md:gap-2 mt-2 md:mt-2.5 text-[12px] md:text-[13px] text-text-secondary">
          <span className="font-en font-medium">{formatDistance(trail.distance_km)}</span>
          <span className="text-text-tertiary">·</span>
          <span>{formatDuration(trail.estimated_minutes)}</span>
          <span className="text-text-tertiary">·</span>
          <span className="flex items-center gap-0.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#FF4B4B" stroke="none" className="md:w-3 md:h-3">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            {trail.like_count}
          </span>
        </div>
        {trail.tags?.length > 0 && (
          <div className="flex gap-1 md:gap-1.5 mt-2 md:mt-3 flex-wrap">
            {trail.tags.slice(0, 3).map((tag) => (
              <span key={tag.id} className="chip !py-0.5 md:!py-1 !text-[10px] md:!text-[11px]">
                #{tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
