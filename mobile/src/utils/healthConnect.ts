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
    const available = await initialize();
    return !!available;
  } catch (e) {
    console.log('[Moru] Health Connect init error:', e);
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

    // If no walking sessions found, just return ALL sessions
    const sessionsToProcess = walkSessions.length > 0 ? walkSessions : sessions.records;

    const results: HealthWalkSession[] = [];

    for (const session of sessionsToProcess) {
      const sessionStart = session.startTime;
      const sessionEnd = session.endTime;
      const durationMs = new Date(sessionEnd).getTime() - new Date(sessionStart).getTime();

      // Read steps for this session
      let totalSteps = 0;
      try {
        const stepsData = await readRecords('Steps', {
          timeRangeFilter: {
            operator: 'between',
            startTime: sessionStart,
            endTime: sessionEnd,
          },
        });
        totalSteps = stepsData.records.reduce((sum: number, r: any) => sum + (r.count || 0), 0);
      } catch {}

      // Read distance
      let totalDistance = 0;
      try {
        const distData = await readRecords('Distance', {
          timeRangeFilter: {
            operator: 'between',
            startTime: sessionStart,
            endTime: sessionEnd,
          },
        });
        totalDistance = distData.records.reduce((sum: number, r: any) => sum + (r.distance?.inKilometers || 0), 0);
      } catch {}

      // Read calories
      let totalCalories = 0;
      try {
        const calData = await readRecords('TotalCaloriesBurned', {
          timeRangeFilter: {
            operator: 'between',
            startTime: sessionStart,
            endTime: sessionEnd,
          },
        });
        totalCalories = calData.records.reduce((sum: number, r: any) => sum + (r.energy?.inKilocalories || 0), 0);
      } catch {}

      // Read heart rate
      let heartRateAvg = 0;
      try {
        const hrData = await readRecords('HeartRate', {
          timeRangeFilter: {
            operator: 'between',
            startTime: sessionStart,
            endTime: sessionEnd,
          },
        });
        if (hrData.records.length > 0) {
          const allSamples = hrData.records.flatMap((r: any) => r.samples || []);
          if (allSamples.length > 0) {
            heartRateAvg = Math.round(allSamples.reduce((sum: number, s: any) => sum + (s.beatsPerMinute || 0), 0) / allSamples.length);
          }
        }
      } catch {}

      // Read exercise route (GPS)
      let trackPoints: { lat: number; lng: number; time: string; ele?: number }[] = [];
      try {
        if ((session as any).exerciseRoute?.route) {
          trackPoints = (session as any).exerciseRoute.route.map((p: any) => ({
            lat: p.latitude,
            lng: p.longitude,
            time: p.time,
            ele: p.altitude || null,
          }));
        }
      } catch {}

      const dateLabel = new Date(sessionStart).toLocaleDateString('ko-KR', {
        month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });

      results.push({
        id: (session as any).metadata?.id || `hc_${Date.now()}_${results.length}`,
        startTime: sessionStart,
        endTime: sessionEnd,
        title: `${dateLabel} 걷기`,
        duration: Math.round(durationMs / 60000),
        distance: Math.round(totalDistance * 100) / 100,
        steps: totalSteps,
        calories: Math.round(totalCalories),
        heartRateAvg,
        trackPoints,
      });
    }

    return results.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  } catch (e) {
    console.log('Health Connect read error:', e);
    return [];
  }
}
