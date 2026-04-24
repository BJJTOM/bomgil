/**
 * Route trace animation for Moru maps.
 *
 * Two modes built on one controller:
 *   1. "trace" — the polyline reveals from start → end while a glowing
 *      walker dot follows the head. Camera stays at the current viewport
 *      (default for trail detail map; one-shot play, replayable).
 *   2. "cinematic" — same reveal + walker, but the camera zooms in,
 *      pitches to 55°, and eases along the path, rotating bearing to
 *      face the upcoming segment. Used for the fullscreen "시네마틱 프리뷰"
 *      button.
 *
 * Relies on `line-trim-offset` (Mapbox GL JS 2.10+), which cleanly hides
 * any `[start,end]` sub-range of a line without touching the source — so
 * playback is cheap and the existing `moru-trail-main` gradient is
 * preserved.
 */

type Coord = [number, number];

interface AnimationOptions {
  /** Total duration in ms. Trace ≈ 5000, cinematic ≈ 13000. */
  durationMs?: number;
  /** "trace" (static cam) or "cinematic" (cam follows). */
  mode?: "trace" | "cinematic";
  /** Camera zoom for cinematic mode. Auto if undefined. */
  followZoom?: number;
  /** Callback on progress 0→1 (useful for UI timeline). */
  onProgress?: (progress: number) => void;
  /** Callback when finished. */
  onDone?: () => void;
  /** Fired if stopped mid-way via the returned controller. */
  onAbort?: () => void;
}

export interface RouteAnimationController {
  /** Stop the animation, reveal the full line, clean up walker. */
  stop: () => void;
  /** True while requestAnimationFrame is active. */
  isPlaying: () => boolean;
}

const WALKER_SOURCE = "moru-route-walker";
const WALKER_GLOW_LAYER = "moru-route-walker-glow";
const WALKER_DOT_LAYER = "moru-route-walker-dot";

const R_EARTH_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

function haversineKm(a: Coord, b: Coord) {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

function bearingDeg(from: Coord, to: Coord) {
  const φ1 = toRad(from[1]);
  const φ2 = toRad(to[1]);
  const Δλ = toRad(to[0] - from[0]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Pre-compute per-vertex cumulative distance, enabling O(log n) lookups. */
function cumulativeDistances(coords: Coord[]): { cum: number[]; total: number } {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    cum.push(cum[i - 1] + haversineKm(coords[i - 1], coords[i]));
  }
  return { cum, total: cum[cum.length - 1] || 0 };
}

/** Linear interpolation between two lng/lat points. */
function lerpCoord(a: Coord, b: Coord, t: number): Coord {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Walker position + forward bearing at a progress in [0, 1]. */
function sampleAlong(
  coords: Coord[],
  cum: number[],
  total: number,
  progress: number,
): { position: Coord; bearing: number } {
  if (coords.length < 2) return { position: coords[0] || [0, 0], bearing: 0 };
  const target = progress * total;

  // Binary search for the segment containing `target` cumulative distance
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= target) lo = mid;
    else hi = mid;
  }
  const segStart = lo;
  const segEnd = Math.min(segStart + 1, coords.length - 1);
  const segLen = cum[segEnd] - cum[segStart] || 1e-9;
  const t = Math.max(0, Math.min(1, (target - cum[segStart]) / segLen));
  return {
    position: lerpCoord(coords[segStart], coords[segEnd], t),
    bearing: bearingDeg(coords[segStart], coords[segEnd]),
  };
}

/** easeOutCubic — snappier than linear, less dramatic than easeOutExpo. */
function ease(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Apply the progress portion [0..1] of the trail to the existing
 * `moru-trail-main` / `moru-trail-glow` layers via `line-trim-offset`.
 * At p=0 the line is fully hidden; at p=1 the line is fully drawn.
 */
function setLineProgress(map: any, progress: number) {
  const hideStart = Math.max(0, Math.min(1, progress));
  // `line-trim-offset` hides the range [start, end] of the line. We hide
  // from `progress` to `1`, so only [0, progress] is visible.
  const offset = [hideStart, 1] as [number, number];
  ["moru-trail-main", "moru-trail-glow", "moru-trail-outline"].forEach((id) => {
    if (map.getLayer(id)) {
      try {
        map.setPaintProperty(id, "line-trim-offset", offset);
      } catch {
        /* layer may not support trim-offset (older style) — ignore */
      }
    }
  });
  // Arrows look odd on a partially-drawn line; hide while animating.
  if (map.getLayer("moru-trail-arrows")) {
    try {
      map.setLayoutProperty(
        "moru-trail-arrows",
        "visibility",
        progress >= 0.999 ? "visible" : "none",
      );
    } catch {}
  }
}

function clearLineProgress(map: any) {
  ["moru-trail-main", "moru-trail-glow", "moru-trail-outline"].forEach((id) => {
    if (map.getLayer(id)) {
      try {
        map.setPaintProperty(id, "line-trim-offset", [0, 0]);
      } catch {}
    }
  });
  if (map.getLayer("moru-trail-arrows")) {
    try {
      map.setLayoutProperty("moru-trail-arrows", "visibility", "visible");
    } catch {}
  }
}

/** Ensure the walker source+layers exist; create on first use. */
function ensureWalker(map: any, initial: Coord) {
  const fc = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: initial },
      },
    ],
  };
  const src = map.getSource(WALKER_SOURCE);
  if (src) {
    src.setData(fc);
  } else {
    map.addSource(WALKER_SOURCE, { type: "geojson", data: fc });
  }
  if (!map.getLayer(WALKER_GLOW_LAYER)) {
    map.addLayer({
      id: WALKER_GLOW_LAYER,
      type: "circle",
      source: WALKER_SOURCE,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10, 12,
          14, 22,
          18, 32,
        ],
        "circle-color": "#FFB770",
        "circle-opacity": 0.35,
        "circle-blur": 1,
      },
    });
  }
  if (!map.getLayer(WALKER_DOT_LAYER)) {
    map.addLayer({
      id: WALKER_DOT_LAYER,
      type: "circle",
      source: WALKER_SOURCE,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10, 4,
          14, 6,
          18, 9,
        ],
        "circle-color": "#FFFFFF",
        "circle-stroke-color": "#E8563D",
        "circle-stroke-width": 2.5,
      },
    });
  }
}

function removeWalker(map: any) {
  [WALKER_DOT_LAYER, WALKER_GLOW_LAYER].forEach((id) => {
    if (map.getLayer(id)) {
      try {
        map.removeLayer(id);
      } catch {}
    }
  });
  if (map.getSource(WALKER_SOURCE)) {
    try {
      map.removeSource(WALKER_SOURCE);
    } catch {}
  }
}

function updateWalker(map: any, position: Coord) {
  const src = map.getSource(WALKER_SOURCE);
  if (!src) return;
  src.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: position },
      },
    ],
  });
}

/**
 * Start a route animation. Returns a controller so the caller can stop
 * early (e.g. on unmount or user pause).
 */
export function startRouteAnimation(
  map: any,
  coords: Coord[],
  opts: AnimationOptions = {},
): RouteAnimationController {
  const mode = opts.mode ?? "trace";
  const duration = opts.durationMs ?? (mode === "cinematic" ? 13000 : 5200);

  if (!map || !coords || coords.length < 2) {
    return { stop: () => {}, isPlaying: () => false };
  }

  // Wait for the trail line to exist (drawMoruTrailLine may have been
  // called moments earlier).
  const trailReady = () => !!map.getLayer("moru-trail-main");
  if (!trailReady()) {
    let aborted = false;
    const id = setInterval(() => {
      if (aborted) return;
      if (trailReady()) {
        clearInterval(id);
        // Re-entry — same opts, but guarded by a flag.
        startRouteAnimation(map, coords, opts);
      }
    }, 80);
    // Give up after 3s
    setTimeout(() => {
      clearInterval(id);
      aborted = true;
    }, 3000);
    return { stop: () => { aborted = true; clearInterval(id); }, isPlaying: () => !aborted };
  }

  const { cum, total } = cumulativeDistances(coords);
  if (total <= 0) {
    return { stop: () => {}, isPlaying: () => false };
  }

  let rafId = 0;
  let startTs = 0;
  let aborted = false;
  let playing = true;

  const firstSample = sampleAlong(coords, cum, total, 0);
  ensureWalker(map, firstSample.position);
  setLineProgress(map, 0);

  // Cinematic mode: save pre-animation camera so we can restore on stop
  const prevCenter = map.getCenter();
  const prevZoom = map.getZoom();
  const prevPitch = map.getPitch();
  const prevBearing = map.getBearing();

  if (mode === "cinematic") {
    const zoomTarget = opts.followZoom ?? 15.5;
    map.easeTo({
      center: firstSample.position,
      zoom: zoomTarget,
      pitch: 55,
      bearing: firstSample.bearing,
      duration: 1200,
    });
  }

  let lastCamUpdate = 0;

  const tick = (ts: number) => {
    if (aborted) return;
    if (!startTs) startTs = ts;
    const elapsed = ts - startTs;
    const rawProgress = Math.min(1, elapsed / duration);
    const progress = ease(rawProgress);

    setLineProgress(map, progress);
    const { position, bearing } = sampleAlong(coords, cum, total, progress);
    updateWalker(map, position);

    if (mode === "cinematic") {
      // Throttle camera easeTo to ~8 fps — continuous easeTo on every
      // frame thrashes the interpolator. 8 fps looks buttery-smooth
      // because easeTo itself interpolates.
      if (ts - lastCamUpdate > 120) {
        lastCamUpdate = ts;
        map.easeTo({
          center: position,
          bearing,
          duration: 140,
          easing: (t: number) => t,
        });
      }
    }

    opts.onProgress?.(progress);

    if (rawProgress >= 1) {
      playing = false;
      // Leave line at 100% revealed; keep walker at the end for a beat.
      setLineProgress(map, 1);
      setTimeout(() => {
        if (aborted) return;
        removeWalker(map);
        clearLineProgress(map);
      }, 700);
      if (mode === "cinematic") {
        map.easeTo({
          center: prevCenter,
          zoom: prevZoom,
          pitch: prevPitch,
          bearing: prevBearing,
          duration: 1400,
        });
      }
      opts.onDone?.();
      return;
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  return {
    stop: () => {
      if (aborted) return;
      aborted = true;
      playing = false;
      if (rafId) cancelAnimationFrame(rafId);
      removeWalker(map);
      clearLineProgress(map);
      if (mode === "cinematic") {
        map.easeTo({
          center: prevCenter,
          zoom: prevZoom,
          pitch: prevPitch,
          bearing: prevBearing,
          duration: 600,
        });
      }
      opts.onAbort?.();
    },
    isPlaying: () => playing,
  };
}

/** Respect user's OS-level reduced-motion preference. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
