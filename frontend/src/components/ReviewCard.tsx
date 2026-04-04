"use client";

import Image from "next/image";
import type { Review } from "@/types";

interface ReviewCardProps {
  review: Review;
  onHelpful?: (id: number) => void;
}

export function ReviewCard({ review, onHelpful }: ReviewCardProps) {
  return (
    <div className="bg-white rounded-card shadow-soft p-4">
      {/* Author & Rating */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center overflow-hidden">
            {review.author.profile_image ? (
              <Image
                src={review.author.profile_image}
                alt={review.author.nickname}
                width={40}
                height={40}
                className="object-cover"
              />
            ) : (
              <span className="text-sm">👤</span>
            )}
          </div>
          <div>
            <p className="font-medium text-sm">{review.author.nickname}</p>
            <p className="text-xs text-text-secondary">{review.visited_date}</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`text-sm ${
                i < review.rating ? "text-yellow-400" : "text-gray-200"
              }`}
            >
              ★
            </span>
          ))}
        </div>
      </div>

      {/* Content */}
      <p className="text-sm mt-3 leading-relaxed">{review.content}</p>

      {/* Images */}
      {review.images.length > 0 && (
        <div className="flex gap-2 mt-3 overflow-x-auto">
          {review.images.map((img) => (
            <div
              key={img.id}
              className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden"
            >
              <Image
                src={img.image}
                alt="리뷰 사진"
                fill
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* Helpful */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t">
        <button
          onClick={() => onHelpful?.(review.id)}
          className="text-sm text-text-secondary hover:text-primary transition-colors"
        >
          👍 도움됐어요 ({review.helpful_count})
        </button>
      </div>
    </div>
  );
}
