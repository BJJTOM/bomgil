"use client";

import { useEffect, useRef, useState } from "react";
import {
  prefersReducedMotion,
  startRouteAnimation,
  type RouteAnimationController,
} from "./routeAnimation";

interface Props {
  /** Mapbox instance. Parent must hand it over via onMapReady. */
  map: any;
  /** LineString coordinates [lng, lat][]. */
  coords: [number, number][];
  /** Auto-play once when map + coords first become ready. Default true. */
  autoPlay?: boolean;
  /** Expose cinematic camera-follow button. Default true on fullscreen. */
  allowCinematic?: boolean;
  /** Corner on the map. Default "bottom-left". */
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
}

/**
 * Floating control pill that drives the route trace animation. Handles
 * autoplay, replay, cinematic mode, and progress bar. Lives as an
 * absolute-positioned overlay on top of the map container.
 */
export function RouteAnimationControls({
  map,
  coords,
  autoPlay = true,
  allowCinematic = false,
  position = "bottom-left",
}: Props) {
  const controllerRef = useRef<RouteAnimationController | null>(null);
  const autoplayedRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<"trace" | "cinematic">("trace");

  // Cleanup on unmount or when coords change
  useEffect(() => {
    return () => {
      controllerRef.current?.stop();
      controllerRef.current = null;
    };
  }, [coords]);

  // Auto-play once, after both map and coords are ready + user hasn't
  // opted into reduced motion.
  useEffect(() => {
    if (!autoPlay || autoplayedRef.current) return;
    if (!map || !coords || coords.length < 2) return;
    if (prefersReducedMotion()) return;

    autoplayedRef.current = true;
    // Short delay so the map idle-settles (bounds fit, peak labels)
    // before we start the reveal.
    const t = setTimeout(() => play("trace"), 650);
    return () => clearTimeout(t);
  }, [map, coords, autoPlay]);

  const play = (nextMode: "trace" | "cinematic" = "trace") => {
    if (!map || !coords || coords.length < 2) return;
    controllerRef.current?.stop();
    setMode(nextMode);
    setIsPlaying(true);
    setProgress(0);
    controllerRef.current = startRouteAnimation(map, coords, {
      mode: nextMode,
      onProgress: (p) => setProgress(p),
      onDone: () => {
        setIsPlaying(false);
        setProgress(1);
      },
      onAbort: () => {
        setIsPlaying(false);
      },
    });
  };

  const stop = () => {
    controllerRef.current?.stop();
    controllerRef.current = null;
    setIsPlaying(false);
  };

  const cornerClass =
    position === "bottom-left"
      ? "left-3 bottom-3"
      : position === "bottom-right"
        ? "right-3 bottom-3"
        : position === "top-left"
          ? "left-3 top-3"
          : "right-3 top-3";

  return (
    <div className={`absolute ${cornerClass} z-20 pointer-events-none`}>
      <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 px-2.5 py-1.5 shadow-lg">
        {isPlaying ? (
          <button
            onClick={stop}
            className="flex items-center justify-center w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
            aria-label="정지"
            title="정지"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="6" width="12" height="12" rx="1.5" />
            </svg>
          </button>
        ) : (
          <button
            onClick={() => play("trace")}
            className="flex items-center justify-center w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
            aria-label={progress >= 1 ? "다시 보기" : "재생"}
            title={progress >= 1 ? "다시 보기" : "재생"}
          >
            {progress >= 1 ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4v6h6M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        )}

        {/* Progress bar */}
        <div className="w-28 h-1 rounded-full bg-white/15 overflow-hidden">
          <div
            className="h-full bg-[#FFB770] transition-[width] duration-100"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>

        <span className="text-[10.5px] font-en text-white/80 tabular-nums w-7 text-right">
          {Math.round(progress * 100)}%
        </span>

        {allowCinematic && (
          <button
            onClick={() => play(isPlaying && mode === "cinematic" ? "trace" : "cinematic")}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10.5px] font-semibold transition-colors ${
              mode === "cinematic" && isPlaying
                ? "bg-[#FFB770] text-black"
                : "bg-white/15 text-white hover:bg-white/25"
            }`}
            aria-label="시네마틱 프리뷰"
            title="시네마틱 프리뷰 (카메라 따라가기)"
          >
            <span>🎬</span>
            <span>시네마틱</span>
          </button>
        )}
      </div>
    </div>
  );
}
