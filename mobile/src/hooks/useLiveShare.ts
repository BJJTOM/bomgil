/**
 * useLiveShare — drive a /live-walks/ session from WalkScreen.
 *
 * Starts a backend session on demand, then pushes throttled position
 * updates (default every 10s) while active. Cleans up on unmount.
 *
 * The parent re-renders roughly every second (WalkScreen's stats timer),
 * so this hook piggy-backs on that render cycle instead of spinning its
 * own interval. Throttling is done by comparing timestamps in a ref.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  endLiveShare,
  LiveSession,
  pushLiveUpdate,
  startLiveShare,
} from '../utils/liveShare';
import type { WalkStats } from '../utils/walkEngine';

interface Opts {
  stats: WalkStats;
  currentPos: { lat: number; lng: number } | null;
  pushIntervalMs?: number;
}

interface UseLiveShareReturn {
  session: LiveSession | null;
  active: boolean;
  starting: boolean;
  start: () => Promise<LiveSession | null>;
  stop: () => Promise<void>;
}

const DEFAULT_PUSH_INTERVAL_MS = 10_000;

export function useLiveShare({
  stats,
  currentPos,
  pushIntervalMs = DEFAULT_PUSH_INTERVAL_MS,
}: Opts): UseLiveShareReturn {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [starting, setStarting] = useState(false);
  const lastPushAtRef = useRef(0);
  // Track the session in a ref too so the unmount cleanup sees the
  // latest value without needing `session` in the deps array (which
  // would re-run the cleanup every time session changed).
  const sessionRef = useRef<LiveSession | null>(null);

  const start = useCallback(async (): Promise<LiveSession | null> => {
    if (sessionRef.current || starting) return sessionRef.current;
    setStarting(true);
    try {
      const s = await startLiveShare();
      sessionRef.current = s;
      setSession(s);
      lastPushAtRef.current = 0; // force an immediate first push on the next render
      return s;
    } catch (e) {
      console.log('[useLiveShare] start failed:', e);
      return null;
    } finally {
      setStarting(false);
    }
  }, [starting]);

  const stop = useCallback(async (): Promise<void> => {
    const token = sessionRef.current?.token;
    sessionRef.current = null;
    setSession(null);
    if (token) {
      await endLiveShare(token);
    }
  }, []);

  // Auto-push: the parent bumps its stats state ~1/s, which re-runs this
  // effect. We push only if the throttle interval has elapsed AND we have
  // a fresh position. All parameters are primitives so the deps array
  // captures the changes cleanly.
  useEffect(() => {
    const token = sessionRef.current?.token;
    if (!token) return;
    if (!currentPos) return;
    const now = Date.now();
    if (now - lastPushAtRef.current < pushIntervalMs) return;
    lastPushAtRef.current = now;
    pushLiveUpdate(token, {
      lat: currentPos.lat,
      lng: currentPos.lng,
      distanceKm: stats.distance,
      durationSeconds: stats.duration,
      speedKmh: stats.speed,
    }).catch(() => {});
  }, [
    session,
    currentPos,
    stats.distance,
    stats.duration,
    stats.speed,
    pushIntervalMs,
  ]);

  // Unmount cleanup — always terminate any active session so the backend
  // flips `is_live` to false promptly. Runs once per hook lifetime.
  useEffect(() => {
    return () => {
      const token = sessionRef.current?.token;
      if (token) {
        endLiveShare(token).catch(() => {});
        sessionRef.current = null;
      }
    };
  }, []);

  return {
    session,
    active: !!session,
    starting,
    start,
    stop,
  };
}
