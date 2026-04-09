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
