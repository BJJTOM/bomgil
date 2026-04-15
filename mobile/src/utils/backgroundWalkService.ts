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
 *   updateBackgroundWalkNotification({ distance: 1.23, duration: 450, steps: 1200, pace: 12.5 });
 *   // ... eventually ...
 *   await stopBackgroundWalkService();
 */
import BackgroundService from 'react-native-background-actions';

const TASK_NAME = '모루 걷기';

export interface BackgroundStats {
  distance: number; // km
  duration: number; // seconds
  steps?: number;
  pace?: number; // min/km
  isAutoPaused?: boolean;
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

function formatPace(pace: number): string {
  if (!pace || pace <= 0 || pace > 30) return "--'--\"";
  const min = Math.floor(pace);
  const sec = Math.round((pace - min) * 60);
  return `${min}'${sec.toString().padStart(2, '0')}"`;
}

/**
 * Build a rich notification string.
 *
 * Before: "1.23km · 12:45"
 * After:  "🚶 1.23km · 12:45 · 1,200걸음 · 12'30"/km"
 *   or when auto-paused: "⏸ 일시정지 · 1.23km · 12:45"
 */
function buildNotificationDesc(stats: BackgroundStats): string {
  if (stats.isAutoPaused) {
    return `⏸ 일시정지 · ${stats.distance.toFixed(2)}km · ${formatDuration(stats.duration)}`;
  }
  const parts = [
    `🚶 ${stats.distance.toFixed(2)}km`,
    formatDuration(stats.duration),
  ];
  if (stats.steps && stats.steps > 0) {
    parts.push(`${stats.steps.toLocaleString()}걸음`);
  }
  if (stats.pace && stats.pace > 0 && stats.pace < 30) {
    parts.push(`${formatPace(stats.pace)}/km`);
  }
  return parts.join(' · ');
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
  foregroundServiceType: ['location'] as ('location')[],
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

// Throttle: Android throttles notification updates. We keep a minimum
// interval of 2s between updates to avoid dropped/queued notifications.
let lastNotifUpdateAt = 0;
const NOTIF_MIN_INTERVAL_MS = 2000;

export function updateBackgroundWalkNotification(
  stats: BackgroundStats,
): void {
  const now = Date.now();
  if (now - lastNotifUpdateAt < NOTIF_MIN_INTERVAL_MS) return;
  lastNotifUpdateAt = now;

  // Fire-and-forget — never block the caller.
  (async () => {
    try {
      if (!BackgroundService.isRunning()) return;
      await BackgroundService.updateNotification({
        taskTitle: TASK_NAME,
        taskDesc: buildNotificationDesc(stats),
      });
    } catch (e) {
      // Silently ignore — the service might be in the middle of stopping
    }
  })();
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
