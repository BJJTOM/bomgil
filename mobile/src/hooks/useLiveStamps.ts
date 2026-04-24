import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client';

/**
 * Mobile-side live stamp auto-collector.
 *
 * Mirrors the web `useLiveWalk` hook: fetches the trail's stamp points
 * once, then exposes `checkPosition(lat, lng)` — WalkScreen calls it on
 * every GPS tick, and any uncollected stamp inside its radius is
 * auto-POSTed to the collect endpoint. De-duped via in-flight set +
 * per-stamp cooldown on failure, so a user standing on a stamp point
 * doesn't spam the backend.
 */

export interface StampPoint {
  id: number;
  trail: number;
  name: string;
  lat: string;
  lng: string;
  radius_meters: number;
  description: string;
  emoji: string;
  order: number;
  is_collected: boolean;
}

export interface LiveStampAward {
  stamp: StampPoint;
  awardedAt: number;
}

const R_EARTH_M = 6_371_000;
const toRad = (d: number) => (d * Math.PI) / 180;

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

interface UseLiveStampsOpts {
  trailId: number | null | undefined;
  /** Called on each new auto-award. Parent uses it for haptic + toast. */
  onAward?: (award: LiveStampAward) => void;
  /** Active toggle — normally tied to "walk in progress". */
  active: boolean;
}

export interface UseLiveStampsResult {
  stamps: StampPoint[];
  awarded: LiveStampAward[];
  totalCount: number;
  collectedCount: number;
  nextStamp: { stamp: StampPoint; distanceM: number } | null;
  /** Call on every GPS update. Fires auto-collects as side-effect. */
  checkPosition: (lat: number, lng: number) => void;
  refresh: () => Promise<void>;
}

export function useLiveStamps({
  trailId,
  onAward,
  active,
}: UseLiveStampsOpts): UseLiveStampsResult {
  const [stamps, setStamps] = useState<StampPoint[]>([]);
  const [awarded, setAwarded] = useState<LiveStampAward[]>([]);
  const [nextStamp, setNextStamp] =
    useState<UseLiveStampsResult['nextStamp']>(null);

  const inFlightRef = useRef<Set<number>>(new Set());
  const failedCooldownRef = useRef<Map<number, number>>(new Map());
  const awardedIdsRef = useRef<Set<number>>(new Set());

  const refresh = useCallback(async () => {
    if (!trailId) return;
    try {
      const { data } = await api.get(`/trails/${trailId}/stamps/`);
      setStamps(Array.isArray(data) ? data : []);
    } catch {
      // Silent — stamps are optional overlay on top of the walk.
    }
  }, [trailId]);

  // Load + refresh stamps whenever a trail is attached to the walk
  useEffect(() => {
    awardedIdsRef.current = new Set();
    setAwarded([]);
    if (!trailId || !active) {
      setStamps([]);
      return;
    }
    refresh();
  }, [trailId, active, refresh]);

  const checkPosition = useCallback(
    (lat: number, lng: number) => {
      if (!active || !trailId || stamps.length === 0) return;

      let closest: { stamp: StampPoint; distanceM: number } | null = null;

      stamps.forEach((s) => {
        if (s.is_collected) return;
        if (awardedIdsRef.current.has(s.id)) return;

        const sLat = parseFloat(s.lat);
        const sLng = parseFloat(s.lng);
        const d = haversineM(lat, lng, sLat, sLng);

        if (!closest || d < closest.distanceM) {
          closest = { stamp: s, distanceM: d };
        }

        if (inFlightRef.current.has(s.id)) return;
        const cooldownUntil = failedCooldownRef.current.get(s.id) ?? 0;
        if (Date.now() < cooldownUntil) return;

        const radius = s.radius_meters || 50;
        if (d > radius) return;

        inFlightRef.current.add(s.id);
        api
          .post(`/trails/${trailId}/stamps/${s.id}/collect/`, { lat, lng })
          .then(() => {
            inFlightRef.current.delete(s.id);
            awardedIdsRef.current.add(s.id);
            const award: LiveStampAward = { stamp: s, awardedAt: Date.now() };
            setAwarded((prev) => [...prev, award]);
            onAward?.(award);
          })
          .catch(() => {
            inFlightRef.current.delete(s.id);
            failedCooldownRef.current.set(s.id, Date.now() + 60_000);
          });
      });

      setNextStamp(closest);
    },
    [active, trailId, stamps, onAward],
  );

  const totalCount = stamps.length;
  const collectedCount =
    stamps.filter((s) => s.is_collected).length + awarded.length;

  return {
    stamps,
    awarded,
    totalCount,
    collectedCount,
    nextStamp,
    checkPosition,
    refresh,
  };
}

export function formatMetres(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(2)}km`;
}
