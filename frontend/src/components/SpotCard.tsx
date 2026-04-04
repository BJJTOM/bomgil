"use client";

import { useState } from "react";
import Image from "next/image";
import type { Spot } from "@/types";

interface SpotCardProps {
  spot: Spot;
}

export function SpotCard({ spot }: SpotCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isExpandable =
    spot.spot_type === "restaurant" || spot.spot_type === "cafe";

  return (
    <div className="bg-white rounded-card shadow-soft p-4">
      <h4 className="font-bold text-base">{spot.name}</h4>
      {spot.description && (
        <p className="text-text-secondary text-sm mt-1">{spot.description}</p>
      )}

      {isExpandable && (
        <>
          {!expanded && (spot.menu_highlight || spot.price_range) && (
            <button
              onClick={() => setExpanded(true)}
              className="text-primary text-sm mt-2 hover:underline"
            >
              상세 보기
            </button>
          )}

          {expanded && (
            <div className="mt-3 space-y-2 border-t pt-3">
              {spot.menu_highlight && (
                <div className="flex gap-2 text-sm">
                  <span className="text-text-secondary">대표 메뉴</span>
                  <span className="font-medium">{spot.menu_highlight}</span>
                </div>
              )}
              {spot.price_range && (
                <div className="flex gap-2 text-sm">
                  <span className="text-text-secondary">가격대</span>
                  <span className="font-medium">{spot.price_range}</span>
                </div>
              )}
              {spot.rating && (
                <div className="flex gap-2 text-sm">
                  <span className="text-text-secondary">평점</span>
                  <span className="font-medium text-yellow-600">
                    ★ {spot.rating}
                  </span>
                </div>
              )}
              {spot.tip && (
                <div className="bg-accent/10 rounded-lg p-2 text-sm">
                  <span className="font-medium">💡 꿀팁:</span> {spot.tip}
                </div>
              )}
              <button
                onClick={() => setExpanded(false)}
                className="text-text-secondary text-sm hover:underline"
              >
                접기
              </button>
            </div>
          )}
        </>
      )}

      {!isExpandable && spot.tip && (
        <div className="bg-accent/10 rounded-lg p-2 text-sm mt-2">
          <span className="font-medium">💡 꿀팁:</span> {spot.tip}
        </div>
      )}

      {/* Spot images */}
      {spot.images.length > 0 && (
        <div className="flex gap-2 mt-3 overflow-x-auto">
          {spot.images.map((img) => (
            <div
              key={img.id}
              className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden"
            >
              <Image
                src={img.image}
                alt={spot.name}
                fill
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
