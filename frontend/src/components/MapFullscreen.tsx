"use client";

import { useEffect } from "react";
import { MapView } from "./MapView";

interface MapFullscreenProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  pathCoordinates?: [number, number][];
  markers?: {
    id: number;
    lat: number;
    lng: number;
    title: string;
    emoji?: string;
  }[];
  distance?: string;
  duration?: string;
  theme?: "dark" | "light";
}

export function MapFullscreen({
  open,
  onClose,
  title,
  pathCoordinates,
  markers,
  distance,
  duration,
  theme = "dark",
}: MapFullscreenProps) {
  // ESC to close + lock body scroll
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0a0a]" style={{ contain: "layout style" }}>
      <div className="absolute inset-0">
        <MapView
          pathCoordinates={pathCoordinates}
          markers={markers}
          theme={theme}
          showStats={!!(distance || duration)}
          distance={distance}
          duration={duration}
          className="w-full h-full"
        />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[10000] flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),16px)] pb-3 bg-gradient-to-b from-black/60 to-transparent">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          aria-label="닫기"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        {title && (
          <h2 className="text-white text-[15px] font-semibold flex-1 truncate drop-shadow-md">
            {title}
          </h2>
        )}
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          aria-label="닫기"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface MapExpandButtonProps {
  onClick: () => void;
  className?: string;
}

export function MapExpandButton({ onClick, className = "" }: MapExpandButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`absolute top-3 right-3 z-[1000] w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors shadow-lg ${className}`}
      aria-label="전체화면"
      type="button"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
      </svg>
    </button>
  );
}
