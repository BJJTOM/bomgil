"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface LightboxImage {
  src: string;
  caption?: string;
}

interface PhotoLightboxProps {
  images: LightboxImage[];
  index: number;
  open: boolean;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
}

export function PhotoLightbox({ images, index, open, onClose, onIndexChange }: PhotoLightboxProps) {
  const [current, setCurrent] = useState(index);
  const touchStartX = useRef<number | null>(null);

  // Sync external index → internal
  useEffect(() => {
    setCurrent(index);
  }, [index]);

  const go = useCallback(
    (dir: number) => {
      setCurrent((prev) => {
        const next = (prev + dir + images.length) % images.length;
        onIndexChange?.(next);
        return next;
      });
    },
    [images.length, onIndexChange],
  );

  // Keyboard nav + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, go]);

  if (!open || images.length === 0) return null;

  const img = images[current];
  const hasMultiple = images.length > 1;

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/95 flex flex-col"
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 50 && hasMultiple) {
          go(dx > 0 ? -1 : 1);
        }
        touchStartX.current = null;
      }}
    >
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 bg-gradient-to-b from-black/60 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-white/70 text-[13px] font-medium">
          {hasMultiple && `${current + 1} / ${images.length}`}
        </span>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          aria-label="닫기"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.src}
          alt={img.caption || ""}
          className="max-w-full max-h-full object-contain select-none"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />
      </div>

      {/* Caption */}
      {img.caption && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-6 pt-8 pb-[max(env(safe-area-inset-bottom),24px)]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-white text-[14px] text-center max-w-2xl mx-auto">{img.caption}</p>
        </div>
      )}

      {/* Prev/Next buttons (desktop) */}
      {hasMultiple && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 items-center justify-center text-white hover:bg-black/60 transition-colors"
            aria-label="이전"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 items-center justify-center text-white hover:bg-black/60 transition-colors"
            aria-label="다음"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
