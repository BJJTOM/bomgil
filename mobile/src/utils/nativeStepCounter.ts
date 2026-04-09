/**
 * Native Step Counter wrapper
 *
 * Thin JS shim around the StepCounterModule (Kotlin) which in turn
 * listens to Sensor.TYPE_STEP_COUNTER. This is what lets the app count
 * steps — and derive distance from them — when GPS is unavailable
 * (indoors, underground, etc.).
 *
 * Usage:
 *   const ok = await startStepCounter();
 *   const sub = subscribeToSteps((steps) => { ... });
 *   // ... later ...
 *   sub.remove();
 *   stopStepCounter();
 */
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

interface StepCounterNative {
  start: () => Promise<{ available: boolean }>;
  stop: () => void;
  getSteps: () => Promise<number>;
  getCumulativeSteps: () => Promise<{ available: boolean; steps: number }>;
  // Bookkeeping methods required by NativeEventEmitter to avoid warnings
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
}

const Native: StepCounterNative | undefined =
  NativeModules.StepCounter as StepCounterNative | undefined;

let emitter: NativeEventEmitter | null = null;
function getEmitter(): NativeEventEmitter | null {
  if (Platform.OS !== 'android') return null;
  if (!Native) return null;
  if (!emitter) {
    emitter = new NativeEventEmitter(Native as unknown as any);
  }
  return emitter;
}

export async function startStepCounter(): Promise<boolean> {
  if (Platform.OS !== 'android' || !Native) return false;
  try {
    const result = await Native.start();
    return !!result?.available;
  } catch (e) {
    console.log('[StepCounter] start failed:', e);
    return false;
  }
}

export function stopStepCounter(): void {
  if (Platform.OS !== 'android' || !Native) return;
  try {
    Native.stop();
  } catch {
    // ignore
  }
}

export async function getStepCount(): Promise<number> {
  if (Platform.OS !== 'android' || !Native) return 0;
  try {
    return await Native.getSteps();
  } catch {
    return 0;
  }
}

/**
 * Read the device's cumulative step count since reboot, without
 * starting a long-lived subscription. Used to compute "today's steps"
 * even when the user hasn't opened the walking screen.
 */
export async function getCumulativeSteps(): Promise<number> {
  if (Platform.OS !== 'android' || !Native?.getCumulativeSteps) return 0;
  try {
    const r = await Native.getCumulativeSteps();
    return r?.available ? r.steps : 0;
  } catch {
    return 0;
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const TODAY_BASELINE_KEY = '@moru/step_baseline';

interface DailyBaseline {
  date: string; // YYYY-MM-DD
  cumulative: number; // sensor value at start of day
}

/**
 * Returns today's step count by comparing the current sensor value
 * against a baseline captured at the start of the day. Persists the
 * baseline in AsyncStorage so it survives app restarts.
 *
 * Returns 0 on the first call of a new day (until next reading) and
 * monotonically increases through the day.
 */
export async function getTodayPassiveSteps(): Promise<number> {
  const current = await getCumulativeSteps();
  if (current === 0) return 0;

  const today = new Date().toISOString().split('T')[0];
  let baseline: DailyBaseline | null = null;
  try {
    const raw = await AsyncStorage.getItem(TODAY_BASELINE_KEY);
    if (raw) baseline = JSON.parse(raw) as DailyBaseline;
  } catch {}

  if (!baseline || baseline.date !== today || baseline.cumulative > current) {
    // New day or device rebooted (cumulative reset). Snapshot the
    // current value as today's starting point.
    const fresh: DailyBaseline = { date: today, cumulative: current };
    try {
      await AsyncStorage.setItem(TODAY_BASELINE_KEY, JSON.stringify(fresh));
    } catch {}
    return 0;
  }

  return Math.max(0, current - baseline.cumulative);
}

export interface StepSubscription {
  remove: () => void;
}

export function subscribeToSteps(
  callback: (steps: number) => void,
): StepSubscription {
  const em = getEmitter();
  if (!em) {
    return { remove: () => {} };
  }
  const sub = em.addListener('StepCounterUpdate', (event: { steps: number }) => {
    if (typeof event?.steps === 'number') {
      callback(event.steps);
    }
  });
  return {
    remove: () => {
      try {
        sub.remove();
      } catch {}
    },
  };
}
