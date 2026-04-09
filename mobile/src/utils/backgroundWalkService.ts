/**
 * Background Walk Service
 *
 * Wraps react-native-background-actions to run a foreground service on
 * Android while a walk is in progress. This keeps the JS process alive
 * (and therefore the Geolocation.watchPosition subscription) even when
 * the user locks the phone or switches away from the app.
 *
 * Usage:
 *   await startBackgroundWalkService();
 *   // ... start GPS watch ...
 *   await updateBackgroundWalkNotification({ distance: 1.23, duration: 450 });
 *   // ... eventually ...
 *   await stopBackgroundWalkService();
 */
import BackgroundService from 'react-native-background-actions';

const TASK_NAME = '모루 - 걷기 기록 중';

interface BackgroundStats {
  distance: number; // km
  duration: number; // seconds
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * This is the task callback that runs inside the foreground service.
 * It MUST be an infinite async loop — when it returns, the service stops.
 *
 * We don't actually do any work here: the real GPS subscription lives in
 * WalkScreen and keeps running as long as the JS thread is alive. The
 * purpose of this loop is simply to prevent the OS from killing us.
 */
const veryLongTask = async (taskData?: { delay?: number }) => {
  const delay = taskData?.delay ?? 5000;
  // Using Promise-based sleep in a loop. The task can be awoken by
  // updateNotification / stop calls; we just keep looping until stopped.
  // eslint-disable-next-line no-constant-condition
  while (BackgroundService.isRunning()) {
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }
};

const baseOptions = {
  taskName: 'MoruWalkTracking',
  taskTitle: TASK_NAME,
  taskDesc: 'GPS로 걷기를 기록하는 중...',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#2D4A2E',
  linkingURI: 'moru://walk',
  // Android 14+ (targetSdkVersion 34+) requires every foreground service
  // to be started with an explicit type. Without this the library calls
  // Service.startForeground with type=NONE and the OS throws
  // InvalidForegroundServiceTypeException. Passing "location" here tells
  // the library to forward FOREGROUND_SERVICE_TYPE_LOCATION, which the
  // manifest override at android/app/src/main/AndroidManifest.xml also
  // declares.
  foregroundServiceType: ['location'],
  parameters: {
    delay: 5000,
  },
};

export async function startBackgroundWalkService(): Promise<boolean> {
  try {
    if (BackgroundService.isRunning()) {
      return true;
    }
    await BackgroundService.start(veryLongTask, baseOptions);
    return true;
  } catch (e) {
    console.log('[BackgroundWalk] start failed:', e);
    return false;
  }
}

export async function updateBackgroundWalkNotification(
  stats: BackgroundStats,
): Promise<void> {
  try {
    if (!BackgroundService.isRunning()) return;
    await BackgroundService.updateNotification({
      taskTitle: TASK_NAME,
      taskDesc: `${stats.distance.toFixed(2)}km · ${formatDuration(stats.duration)}`,
    });
  } catch (e) {
    // Silently ignore — the service might be in the middle of stopping
    console.log('[BackgroundWalk] updateNotification failed:', e);
  }
}

export async function stopBackgroundWalkService(): Promise<void> {
  try {
    if (!BackgroundService.isRunning()) return;
    await BackgroundService.stop();
  } catch (e) {
    console.log('[BackgroundWalk] stop failed:', e);
  }
}

export function isBackgroundWalkRunning(): boolean {
  try {
    return BackgroundService.isRunning();
  } catch {
    return false;
  }
}
