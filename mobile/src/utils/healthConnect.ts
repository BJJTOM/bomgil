import {
  initialize,
  requestPermission,
  readRecords,
  getGrantedPermissions,
} from 'react-native-health-connect';
import type { Permission } from 'react-native-health-connect';

const PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
];

export async function initHealthConnect(): Promise<boolean> {
  try {
    // On Android 14+ (SDK 34+), Health Connect is built-in
    // On Android 16 (SDK 36), initialize() may throw due to API changes
    // Wrap everything — any failure means HC is not usable right now
    let available: any;
    try {
      available = await initialize();
    } catch (initErr: any) {
      console.log('[Moru] Health Connect initialize() threw:', initErr?.message || String(initErr));
      return false;
    }
    console.log('[Moru] Health Connect initialize result:', available);
    return !!available;
  } catch (e: any) {
    // Outer catch — should never reach here, but just in case
    console.log('[Moru] Health Connect unexpected error:', e?.message || String(e));
    return false;
  }
}

export async function requestHealthPermissions(): Promise<boolean> {
  try {
    const granted = await requestPermission(PERMISSIONS);
    return (granted?.length || 0) > 0;
  } catch (e) {
    // Try with fewer permissions as fallback
    try {
      const minPerms: Permission[] = [
        { accessType: 'read', recordType: 'ExerciseSession' },
        { accessType: 'read', recordType: 'Steps' },
      ];
      const granted = await requestPermission(minPerms);
      return (granted?.length || 0) > 0;
    } catch {
      return false;
    }
  }
}

export async function hasHealthPermissions(): Promise<boolean> {
  try {
    const granted = await getGrantedPermissions();
    return granted.length > 0;
  } catch {
    return false;
  }
}

export interface HealthWalkSession {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  duration: number; // minutes
  distance: number; // km
  steps: number;
  calories: number;
  heartRateAvg: number;
  trackPoints: { lat: number; lng: number; time: string; ele?: number }[];
}

// Hard cap on how many Health Connect sessions we'll enrich with
// per-session Steps/Distance/Calories/HeartRate reads. A Samsung Watch can
// produce dozens of auto-detected sessions per day — on a 30-day window
// that was ~300 sessions × 4 reads = 1200+ Health Connect round trips,
// which wedged the UI for minutes. 30 most recent is plenty for the list.
const MAX_SESSIONS_TO_ENRICH = 30;

/**
 * Samsung Health often writes the same metric twice: once under its own
 * package (com.samsung.android.shealth) and once under Health Connect's
 * raw sensor source. Summing all records double-counts and inflates steps,
 * distance, and calories by ~2x.
 *
 * Group by `metadata.dataOrigin.packageName` and pick the LARGEST total
 * from any single source — this assumes each source has the full data for
 * the window (the common case) and avoids the duplicate.
 */
function sumByBestOrigin<T>(
  records: any[],
  getValue: (record: T) => number,
): number {
  if (!records || records.length === 0) return 0;
  const totals = new Map<string, number>();
  for (const r of records) {
    const origin = r?.metadata?.dataOrigin || 'unknown';
    const key = typeof origin === 'string' ? origin : origin?.packageName || 'unknown';
    totals.set(key, (totals.get(key) || 0) + (getValue(r) || 0));
  }
  let best = 0;
  totals.forEach((v) => {
    if (v > best) best = v;
  });
  return best;
}

export async function getWalkSessions(days: number = 30): Promise<HealthWalkSession[]> {
  try {
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Read exercise sessions
    const sessions = await readRecords('ExerciseSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: now.toISOString(),
      },
    });

    // Include walking + general exercise sessions
    // exerciseType 79 = walking, 56 = hiking, 0 = unknown/other
    const walkSessions = sessions.records.filter(
      (s: any) => {
        const t = s.exerciseType;
        return t === 79 || t === 56 || t === 0 || t === 'walking' || t === 'hiking' ||
               t === 'EXERCISE_TYPE_WALKING' || t === 'EXERCISE_TYPE_HIKING' ||
               typeof t === 'undefined'; // include if type is not set
      }
    );

    // If no walking-specific sessions found, fall back to ALL sessions —
    // the user probably has untyped auto-detected sessions.
    const candidateSessions: any[] = walkSessions.length > 0 ? walkSessions : sessions.records;

    // Sort by start time descending (most recent first) and cap the count.
    // Without this cap, Samsung Watch users can hit 300+ sessions and every
    // session triggers 4 Health Connect reads, freezing the screen.
    const sessionsToProcess = candidateSessions
      .slice()
      .sort(
        (a: any, b: any) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
      )
      .slice(0, MAX_SESSIONS_TO_ENRICH);

    // Enrich sessions in parallel. For each session we fire the 4 per-session
    // reads concurrently, then run all sessions concurrently too. Health
    // Connect on Android 14+ handles this fine and the wall-clock time drops
    // from minutes to a few seconds.
    const enriched = await Promise.all(
      sessionsToProcess.map(async (session: any): Promise<HealthWalkSession> => {
        const sessionStart: string = session.startTime;
        const sessionEnd: string = session.endTime;
        const durationMs =
          new Date(sessionEnd).getTime() - new Date(sessionStart).getTime();

        const filter = {
          timeRangeFilter: {
            operator: 'between' as const,
            startTime: sessionStart,
            endTime: sessionEnd,
          },
        };

        const [stepsRes, distRes, calRes, hrRes] = await Promise.all([
          readRecords('Steps', filter).catch(() => ({ records: [] as any[] })),
          readRecords('Distance', filter).catch(() => ({ records: [] as any[] })),
          readRecords('TotalCaloriesBurned', filter).catch(() => ({ records: [] as any[] })),
          readRecords('HeartRate', filter).catch(() => ({ records: [] as any[] })),
        ]);

        let totalSteps = sumByBestOrigin<any>(
          stepsRes.records as any[],
          (r) => r.count || 0,
        );
        let totalDistance = sumByBestOrigin<any>(
          distRes.records as any[],
          (r) => r.distance?.inKilometers || 0,
        );
        let totalCalories = sumByBestOrigin<any>(
          calRes.records as any[],
          (r) => r.energy?.inKilocalories || 0,
        );

        let heartRateAvg = 0;
        if (hrRes.records.length > 0) {
          const allSamples = (hrRes.records as any[]).flatMap((r: any) => r.samples || []);
          if (allSamples.length > 0) {
            heartRateAvg = Math.round(
              allSamples.reduce(
                (sum: number, s: any) => sum + (s.beatsPerMinute || 0),
                0,
              ) / allSamples.length,
            );
          }
        }

        // Read exercise route (GPS). Samsung Health may not sync route data
        // to Health Connect — we silently fall through if absent.
        let trackPoints: { lat: number; lng: number; time: string; ele?: number }[] = [];
        try {
          const route = (session as any).exerciseRoute?.route;
          if (route && Array.isArray(route) && route.length > 0) {
            const firstPoint = route[0];
            const hasValidCoords =
              (firstPoint.latitude || firstPoint.lat) &&
              Math.abs(firstPoint.latitude || firstPoint.lat) > 1;
            if (hasValidCoords) {
              trackPoints = route
                .map((p: any) => ({
                  lat: p.latitude || p.lat,
                  lng: p.longitude || p.lng,
                  time: p.time || sessionStart,
                  ele: p.altitude || null,
                }))
                .filter(
                  (p: any) =>
                    p.lat && p.lng && Math.abs(p.lat) > 1 && Math.abs(p.lng) > 1,
                );
            }
          }
        } catch {}

        const dateLabel = new Date(sessionStart).toLocaleDateString('ko-KR', {
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        // Fallbacks when the watch didn't record one of the metrics
        if (totalSteps === 0 && totalDistance > 0) {
          totalSteps = Math.round(totalDistance * 1500); // ~1500 steps / km
        }
        if (totalCalories === 0 && totalDistance > 0) {
          totalCalories = Math.round(totalDistance * 75);
        }
        if (totalDistance === 0 && durationMs > 0) {
          totalDistance = (durationMs / 3600000) * 4.5; // ~4.5 km/h
        }

        return {
          id:
            (session as any).metadata?.id ||
            `hc_${new Date(sessionStart).getTime()}`,
          startTime: sessionStart,
          endTime: sessionEnd,
          title: `${dateLabel} 걷기`,
          duration: Math.round(durationMs / 60000),
          distance: Math.round(totalDistance * 100) / 100,
          steps: totalSteps,
          calories: Math.round(totalCalories),
          heartRateAvg,
          trackPoints,
        };
      }),
    );

    return enriched.sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );
  } catch (e) {
    console.log('Health Connect read error:', e);
    return [];
  }
}
