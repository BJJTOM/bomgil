/**
 * Barometer — barometric pressure sensor for accurate altitude tracking.
 *
 * GPS altitude is noisy (±10-30m). The barometric pressure sensor gives
 * relative altitude changes accurate to ±0.5-1m — a 20x improvement.
 *
 * We use RELATIVE changes within a single walk session. The absolute
 * value drifts with weather but the delta within 1-2 hours is excellent.
 *
 * Usage:
 *   const ok = await startBarometer();
 *   const sub = subscribeToBarometer(({ pressure, altitude }) => { ... });
 *   // ... later ...
 *   sub.remove();
 *   stopBarometer();
 */
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

interface BarometerNative {
  start: () => Promise<{ available: boolean }>;
  stop: () => void;
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
}

export interface BarometerData {
  pressure: number;  // hPa
  altitude: number;  // meters (ISA formula, relative)
}

const Native: BarometerNative | undefined =
  NativeModules.Barometer as BarometerNative | undefined;

let emitter: NativeEventEmitter | null = null;
function getEmitter(): NativeEventEmitter | null {
  if (Platform.OS !== 'android') return null;
  if (!Native) return null;
  if (!emitter) {
    emitter = new NativeEventEmitter(Native as unknown as any);
  }
  return emitter;
}

export async function startBarometer(): Promise<boolean> {
  if (Platform.OS !== 'android' || !Native) return false;
  try {
    const result = await Native.start();
    return !!result?.available;
  } catch (e) {
    console.log('[Barometer] start failed:', e);
    return false;
  }
}

export function stopBarometer(): void {
  if (Platform.OS !== 'android' || !Native) return;
  try {
    Native.stop();
  } catch {
    // ignore
  }
}

export function subscribeToBarometer(
  callback: (data: BarometerData) => void,
): { remove: () => void } {
  const em = getEmitter();
  if (!em) return { remove: () => {} };
  const sub = em.addListener('BarometerUpdate', callback);
  return { remove: () => sub.remove() };
}
