/**
 * GPS Signal Indicator
 *
 * Shows a 4-bar signal meter (like Wi-Fi) next to the status pill in
 * WalkScreen. The strength is derived from the most recent GPS fix's
 * accuracy (meters) — lower is better.
 *
 *   accuracy <= 8m    → excellent (4 bars, bright green)
 *   accuracy <= 15m   → good      (3 bars, green)
 *   accuracy <= 25m   → fair      (2 bars, yellow)
 *   accuracy > 25m    → poor      (1 bar, red)
 *   null / stale > 8s → no fix    (0 bars, gray)
 *
 * The component is purely presentational — the parent passes the latest
 * accuracy and last-fix timestamp, and we re-derive the rendering from
 * those on every render.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  accuracy: number | null;
  lastFixAt: number; // epoch ms of last fix callback; 0 = never
}

interface SignalLevel {
  bars: number; // 0..4
  color: string;
  label: string;
}

export function getGpsSignalLevel(
  accuracy: number | null,
  lastFixAt: number,
): SignalLevel {
  // Consider the fix stale if we haven't received an update in ~8 seconds.
  // That covers the case where the service is alive but GPS reception died.
  const STALE_MS = 8000;
  const stale = lastFixAt === 0 || Date.now() - lastFixAt > STALE_MS;
  if (stale || accuracy == null) {
    return { bars: 0, color: '#6B7280', label: 'GPS 없음' };
  }
  if (accuracy <= 8) {
    return { bars: 4, color: '#22C55E', label: '최고' };
  }
  if (accuracy <= 15) {
    return { bars: 3, color: '#4ADE80', label: '좋음' };
  }
  if (accuracy <= 25) {
    return { bars: 2, color: '#FACC15', label: '보통' };
  }
  return { bars: 1, color: '#EF4444', label: '약함' };
}

export default function GpsSignalIndicator({ accuracy, lastFixAt }: Props) {
  const { bars, color, label } = getGpsSignalLevel(accuracy, lastFixAt);
  return (
    <View style={styles.container}>
      <View style={styles.barsRow}>
        {[1, 2, 3, 4].map((b) => (
          <View
            key={b}
            style={[
              styles.bar,
              { height: 4 + b * 2 },
              bars >= b
                ? { backgroundColor: color }
                : { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
        {accuracy != null && bars > 0 ? ` · ${Math.round(accuracy)}m` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 14,
  },
  bar: {
    width: 3,
    borderRadius: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
