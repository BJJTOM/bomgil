/**
 * Live Walk Sharing — client wrapper
 *
 * Calls the backend's /live-walks/ endpoints during a walk so a
 * trusted contact can watch the user's progress in real time via a
 * shareable URL. Strava Beacon equivalent.
 */
import api from '../api/client';

export interface LiveSession {
  token: string;
  share_url: string;
  expires_in: number;
}

/** Start a live session, return the share URL the user will text out. */
export async function startLiveShare(): Promise<LiveSession> {
  const { data } = await api.post('/live-walks/', {});
  return data as LiveSession;
}

interface UpdatePayload {
  lat: number;
  lng: number;
  accuracy?: number | null;
  speedKmh?: number;
  distanceKm?: number;
  durationSeconds?: number;
}

export async function pushLiveUpdate(token: string, p: UpdatePayload): Promise<boolean> {
  try {
    await api.post(`/live-walks/${token}/`, {
      lat: p.lat,
      lng: p.lng,
      accuracy: p.accuracy,
      speed_kmh: p.speedKmh,
      distance_km: p.distanceKm,
      duration_seconds: p.durationSeconds,
    });
    return true;
  } catch (e) {
    console.log('[liveShare] update failed:', e);
    return false;
  }
}

export async function endLiveShare(token: string): Promise<void> {
  try {
    await api.delete(`/live-walks/${token}/`);
  } catch {}
}
