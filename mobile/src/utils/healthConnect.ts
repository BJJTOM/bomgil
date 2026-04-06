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
      // Note: Health Connect exercise routes require explicit READ_EXERCISE_ROUTE permission
      // and Samsung Health may not sync route data to Health Connect
      let trackPoints: { lat: number; lng: number; time: string; ele?: number }[] = [];
      try {
        // Only use exerciseRoute.route — the official field
        const route = (session as any).exerciseRoute?.route;
        if (route && Array.isArray(route) && route.length > 0) {
          // Validate: check if first point has valid lat/lng
          const firstPoint = route[0];
          const hasValidCoords = (firstPoint.latitude || firstPoint.lat) &&
            Math.abs(firstPoint.latitude || firstPoint.lat) > 1;

          if (hasValidCoords) {
            trackPoints = route.map((p: any) => ({
              lat: p.latitude || p.lat,
              lng: p.longitude || p.lng,
              time: p.time || sessionStart,
              ele: p.altitude || null,
            })).filter((p: any) => p.lat && p.lng && Math.abs(p.lat) > 1 && Math.abs(p.lng) > 1);
          }
        }
      } catch {}

      const dateLabel = new Date(sessionStart).toLocaleDateString('ko-KR', {
        month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });

      // Fallback: estimate steps from distance if steps not available
      if (totalSteps === 0 && totalDistance > 0) {
        totalSteps = Math.round(totalDistance * 1500); // ~1500 steps per km
      }
      // Fallback: estimate calories from distance
      if (totalCalories === 0 && totalDistance > 0) {
        totalCalories = Math.round(totalDistance * 75);
      }
      // Fallback: estimate distance from duration if not available
      if (totalDistance === 0 && durationMs > 0) {
        totalDistance = (durationMs / 3600000) * 4.5; // ~4.5 km/h walking speed
      }

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
