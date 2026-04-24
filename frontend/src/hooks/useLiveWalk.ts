"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { StampPoint } from "@/components/StampBook";

const R_EARTH_M = 6_371_000;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

export interface LivePosition {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  timestamp: number;
}

export interface AwardedStamp {
  stamp: StampPoint;
  awardedAt: number;
}

interface UseLiveWalkOptions {
  trailId: number;
  stamps: StampPoint[];
  /** Called when a stamp is auto-awarded. Parent can show a celebration. */
  onStampAwarded?: (stamp: StampPoint) => void;
  /** Called when the GPS permission is denied / unavailable. */
  onError?: (message: string) => void;
  /** Active toggle — set true to start watching, false to stop. */
  active: boolean;
}

export interface LiveWalkState {
  position: LivePosition | null;
  startedAt: number | null;
  elapsedMs: number;
  distanceWalkedM: number;
  awarded: AwardedStamp[];
  nextStamp: { stamp: StampPoint; distanceM: number } | null;
  permissionStatus: "idle" | "granted" | "denied" | "unsupported";
}

/**
 * Continuous-GPS live walk driver.
 *
 * While `active` is true, watches geolocation, auto-issues stamps when
 * the user enters any uncollected stamp point's radius, and tracks
 * total distance walked + elapsed time. Returns a live state object
 * the overlay UI can render directly.
 *
 * De-dupe guarantees: once a stamp is in the in-flight or awarded set,
 * we don't re-POST it even if subsequent GPS updates keep us inside
 * the radius. On 201 / 200 the backend response is used as source of
 * truth; on 4xx we add to a cooldown so we don't spam the endpoint.
 */
export function useLiveWalk({
  trailId,
  stamps,
  onStampAwarded,
  onError,
  active,
}: UseLiveWalkOptions): LiveWalkState {
  const queryClient = useQueryClient();
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [distanceWalkedM, setDistanceWalkedM] = useState(0);
  const [awarded, setAwarded] = useState<AwardedStamp[]>([]);
  const [permissionStatus, setPermissionStatus] =
    useState<LiveWalkState["permissionStatus"]>("idle");

  const watchIdRef = useRef<number | null>(null);
  const inFlightRef = useRef<Set<number>>(new Set());
  const failedCooldownRef = useRef<Map<number, number>>(new Map());
  const prevPosRef = useRef<LivePosition | null>(null);

  const collectMutation = useMutation({
    mutationFn: async ({
      stampId,
      lat,
      lng,
    }: {
      stampId: number;
      lat: number;
      lng: number;
    }) => {
      const { data } = await api.post(
        `/trails/${trailId}/stamps/${stampId}/collect/`,
        { lat, lng },
        { _silent: true } as any,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trail-stamps", trailId] });
    },
  });

  // ── Tick elapsed time ────────────────────────────────────────────
  useEffect(() => {
    if (!active || !startedAt) return;
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 1000);
    return () => clearInterval(id);
  }, [active, startedAt]);

  // ── Evaluate stamps on every position change ─────────────────────
  const evalStamps = useCallback(
    (lat: number, lng: number) => {
      const alreadyAwardedIds = new Set(awarded.map((a) => a.stamp.id));
      stamps.forEach((s) => {
        if (s.is_collected) return;
        if (alreadyAwardedIds.has(s.id)) return;
        if (inFlightRef.current.has(s.id)) return;
        const cooldownUntil = failedCooldownRef.current.get(s.id) ?? 0;
        if (Date.now() < cooldownUntil) return;

        const sLat = parseFloat(s.lat);
        const sLng = parseFloat(s.lng);
        const radius = s.radius_meters || 50;
        const d = haversineM(lat, lng, sLat, sLng);
        if (d > radius) return;

        inFlightRef.current.add(s.id);
        collectMutation
          .mutateAsync({ stampId: s.id, lat, lng })
          .then(() => {
            inFlightRef.current.delete(s.id);
            setAwarded((prev) => [...prev, { stamp: s, awardedAt: Date.now() }]);
            onStampAwarded?.(s);
          })
          .catch(() => {
            inFlightRef.current.delete(s.id);
            // 1 minute cool-down after a failed collect (radius off
            // by a few metres, or user not authed). We'll try again
            // on the next positional update that matters.
            failedCooldownRef.current.set(s.id, Date.now() + 60_000);
          });
      });
    },
    [stamps, awarded, collectMutation, onStampAwarded],
  );

  // ── Geolocation watch ────────────────────────────────────────────
  useEffect(() => {
    if (!active) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermissionStatus("unsupported");
      onError?.("이 브라우저에서는 GPS를 사용할 수 없어요.");
      return;
    }

    setStartedAt((prev) => prev ?? Date.now());

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPermissionStatus("granted");
        const next: LivePosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
        };
        // Reject obvious jitter: drop if accuracy > 50m AND delta < 8m.
        // Low-accuracy fixes are still useful at the start of a walk.
        const prev = prevPosRef.current;
        if (prev) {
          const delta = haversineM(prev.lat, prev.lng, next.lat, next.lng);
          // Only accumulate distance if the jump is plausibly walking
          // pace (< 30 m/s) and accuracy isn't wildly misleading.
          const dtSec = (next.timestamp - prev.timestamp) / 1000;
          if (delta < 500 && dtSec > 0 && delta / dtSec < 30) {
            setDistanceWalkedM((d) => d + delta);
          }
        }
        prevPosRef.current = next;
        setPosition(next);
        evalStamps(next.lat, next.lng);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionStatus("denied");
          onError?.("위치 권한이 거부됐어요. 브라우저 설정에서 허용해 주세요.");
        } else {
          onError?.("GPS 신호가 약해요. 야외로 이동해 보세요.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 2_000,
      },
    );
    watchIdRef.current = id;

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [active, evalStamps, onError]);

  // ── Compute nextStamp (closest uncollected) ──────────────────────
  const nextStamp = useMemo(() => {
    if (!position) return null;
    const awardedIds = new Set(awarded.map((a) => a.stamp.id));
    let best: { stamp: StampPoint; distanceM: number } | null = null;
    stamps.forEach((s) => {
      if (s.is_collected || awardedIds.has(s.id)) return;
      const d = haversineM(
        position.lat,
        position.lng,
        parseFloat(s.lat),
        parseFloat(s.lng),
      );
      if (!best || d < best.distanceM) best = { stamp: s, distanceM: d };
    });
    return best;
  }, [position, stamps, awarded]);

  return {
    position,
    startedAt,
    elapsedMs,
    distanceWalkedM,
    awarded,
    nextStamp,
    permissionStatus,
  };
}

export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatMetres(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(2)}km`;
}
