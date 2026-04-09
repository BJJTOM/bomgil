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
 *   no fix yet, but screen opened < 60s ago → acquiring (blue pulse)
 *   no fix after 60s / fix > 10s stale → lost (red)
 *
 * The component is purely presentational — the parent passes the latest
 * accuracy and last-fix timestamp plus the walk start time, and we
 * re-derive the rendering from those on every render.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

interface Props {
  accuracy: number | null;
  lastFixAt: number; // epoch ms of last fix callback; 0 = never
  startedAt?: number; // epoch ms when the walk screen mounted (for "acquiring" grace period)
}

export type SignalState = 'acquiring' | 'excellent' | 'good' | 'fair' | 'poor' | 'lost';

interface SignalLevel {
  state: SignalState;
  bars: number; // 0..4
  color: string;
  label: string;
}

// How long we treat "no fix yet" as "still acquiring" vs "truly lost".
// Cold start GPS can take 30-90s indoors, so we give it a minute before
// flipping from blue "찾는 중" to red "없음".
const ACQUIRING_GRACE_MS = 60_000;
// After we HAVE had a fix, anything older than this is a lost signal.
const STALE_MS = 10_000;

export function getGpsSignalLevel(
  accuracy: number | null,
  lastFixAt: number,
  startedAt: number = 0,
): SignalLevel {
  const now = Date.now();
  if (lastFixAt === 0 || accuracy == null) {
    // Never received a fix. Acquiring if within grace period.
    const elapsed = startedAt > 0 ? now - startedAt : 0;
    if (elapsed < ACQUIRING_GRACE_MS) {
      return {
        state: 'acquiring',
        bars: 0,
        color: '#60A5FA',
        label: 'GPS 찾는 중',
      };
    }
    return { state: 'lost', bars: 0, color: '#EF4444', label: 'GPS 없음' };
  }
  // Had a fix at some point — check staleness.
  if (now - lastFixAt > STALE_MS) {
    return { state: 'lost', bars: 0, color: '#EF4444', label: 'GPS 끊김' };
  }
  if (accuracy <= 8) {
    return { state: 'excellent', bars: 4, color: '#22C55E', label: '최고' };
  }
  if (accuracy <= 15) {
    return { state: 'good', bars: 3, color: '#4ADE80', label: '좋음' };
  }
  if (accuracy <= 25) {
    return { state: 'fair', bars: 2, color: '#FACC15', label: '보통' };
  }
  return { state: 'poor', bars: 1, color: '#F97316', label: '약함' };
}

export default function GpsSignalIndicator({ accuracy, lastFixAt, startedAt = 0 }: Props) {
  const { state, bars, color, label } = getGpsSignalLevel(accuracy, lastFixAt, startedAt);

  // Pulse the whole row while acquiring so the user can tell the app is
  // actively trying to get a fix (vs. permanently broken).
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (state === 'acquiring') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 0.4,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [state, pulse]);

  return (
    <Animated.View style={[styles.container, { opacity: pulse }]}>
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
    </Animated.View>
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
