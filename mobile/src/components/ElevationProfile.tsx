/**
 * ElevationProfile — a lightweight elevation chart for a trail.
 *
 * Implemented with pure View bars rather than a chart library so the
 * app doesn't grow a new dependency for one use case. Good enough
 * for the trail detail at the resolution we ship (30-60 sample
 * points across the screen width).
 *
 * Input: path coordinates as [lng, lat, ele?]. If any point lacks
 * elevation, we fall back to a flat profile. Grade coloring:
 * green <5%, orange 5-10%, red >10%. Total ascent/descent shown
 * above the chart.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

type PathPoint = [number, number] | [number, number, number];

type Props = {
  coordinates: PathPoint[];
  isDark?: boolean;
  height?: number;
};

// Reasonable default sample count — enough to show shape, few enough
// to avoid janky layout on mid-tier Android.
const SAMPLES = 48;

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function ElevationProfile({ coordinates, isDark, height = 100 }: Props) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  // Check we have elevation data on at least half the points.
  const withEle = coordinates.filter((c) => Array.isArray(c) && c.length >= 3 && typeof c[2] === 'number');
  if (withEle.length < coordinates.length / 2) {
    return null;
  }

  // Resample to SAMPLES equally spaced indices
  const n = coordinates.length;
  const step = Math.max(1, Math.floor(n / SAMPLES));
  const samples: { ele: number; lat: number; lng: number }[] = [];
  for (let i = 0; i < n; i += step) {
    const c = coordinates[i];
    samples.push({
      lng: c[0],
      lat: c[1],
      ele: typeof c[2] === 'number' ? c[2] : 0,
    });
  }
  // Always include the last point
  const lastC = coordinates[n - 1];
  samples.push({
    lng: lastC[0],
    lat: lastC[1],
    ele: typeof lastC[2] === 'number' ? lastC[2] : 0,
  });

  const eles = samples.map((s) => s.ele);
  const minEle = Math.min(...eles);
  const maxEle = Math.max(...eles);
  const range = maxEle - minEle || 1;

  // Total ascent/descent across all input coordinates (not the
  // samples) for accuracy.
  let ascent = 0;
  let descent = 0;
  for (let i = 1; i < withEle.length; i++) {
    const d = (withEle[i][2] as number) - (withEle[i - 1][2] as number);
    if (d > 0) ascent += d;
    else descent -= d;
  }

  const bg = isDark ? '#1a1a1a' : '#F7F8FA';
  const textSec = isDark ? 'rgba(255,255,255,0.65)' : colors.textSecondary;
  const textTert = isDark ? 'rgba(255,255,255,0.42)' : colors.textTertiary;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.label, { color: textTert }]}>고도</Text>
          <Text style={[styles.value, { color: isDark ? '#fff' : colors.textPrimary }]}>
            {Math.round(minEle)}m – {Math.round(maxEle)}m
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View>
            <Text style={[styles.label, { color: textTert }]}>상승</Text>
            <Text style={[styles.value, { color: '#15803D' }]}>▲ {Math.round(ascent)}m</Text>
          </View>
          <View>
            <Text style={[styles.label, { color: textTert }]}>하강</Text>
            <Text style={[styles.value, { color: '#B91C1C' }]}>▼ {Math.round(descent)}m</Text>
          </View>
        </View>
      </View>

      <View style={[styles.chart, { height }]}>
        {samples.map((s, i) => {
          const h = ((s.ele - minEle) / range) * height;

          // Grade relative to next sample (for coloring)
          let color = '#86EFAC'; // green
          if (i < samples.length - 1) {
            const next = samples[i + 1];
            const distance = haversineM(
              { lat: s.lat, lng: s.lng },
              { lat: next.lat, lng: next.lng },
            );
            const rise = next.ele - s.ele;
            const grade = distance > 0 ? Math.abs(rise / distance) : 0;
            if (grade > 0.1) color = '#FCA5A5';
            else if (grade > 0.05) color = '#FDBA74';
          }

          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: Math.max(1, h),
                backgroundColor: color,
                marginHorizontal: 0.5,
                borderTopLeftRadius: 1,
                borderTopRightRadius: 1,
              }}
            />
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#86EFAC' }]} />
          <Text style={[styles.legendText, { color: textSec }]}>평지 (&lt;5%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FDBA74' }]} />
          <Text style={[styles.legendText, { color: textSec }]}>완경사 (5-10%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FCA5A5' }]} />
          <Text style={[styles.legendText, { color: textSec }]}>급경사 (&gt;10%)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: { fontSize: 10, fontWeight: '600' },
  value: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 6,
    overflow: 'hidden',
    paddingHorizontal: 2,
    paddingBottom: 1,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: { fontSize: 10, fontWeight: '500' },
});
