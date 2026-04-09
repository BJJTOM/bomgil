/**
 * ElevationChart — vertical bar approximation of an elevation profile
 *
 * Takes the full trackPoints array and renders the elevation over
 * cumulative distance as a column of narrow bars. Each bar height is
 * normalized to the range between minEle and maxEle so even small
 * elevation changes become visible.
 *
 * Built with plain View (no react-native-svg dependency) — dense narrow
 * bars approximate a filled area chart well enough for a walk summary.
 *
 * Shows:
 *   - min / max / gain / loss in the header row
 *   - the chart itself (clickable sample? no, keep it simple)
 *   - elevation labels on the left axis (min / max)
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface TrackPoint {
  lat?: number;
  lng?: number;
  ele?: number | null;
  time?: string;
}

interface Props {
  trackPoints: TrackPoint[];
  isDark?: boolean;
  elevationGain?: number;
  elevationLoss?: number;
}

const CHART_HEIGHT = 120;
const BAR_COUNT = 60; // number of bars to draw; we down-sample trackPoints to this

export default function ElevationChart({
  trackPoints,
  isDark = false,
  elevationGain = 0,
  elevationLoss = 0,
}: Props) {
  const { samples, minEle, maxEle } = useMemo(() => {
    const pts = trackPoints.filter((p) => typeof p.ele === 'number') as { ele: number }[];
    if (pts.length === 0) {
      return { samples: [], minEle: 0, maxEle: 0 };
    }
    // Down-sample to BAR_COUNT bars. Walk over pts in chunks and pick
    // the average of each chunk so tall spikes get smoothed into the bar.
    const chunkSize = Math.max(1, Math.ceil(pts.length / BAR_COUNT));
    const samples: number[] = [];
    for (let i = 0; i < pts.length; i += chunkSize) {
      let sum = 0;
      let count = 0;
      for (let j = i; j < Math.min(i + chunkSize, pts.length); j++) {
        sum += pts[j].ele;
        count++;
      }
      if (count > 0) samples.push(sum / count);
    }
    let minEle = Infinity;
    let maxEle = -Infinity;
    for (const e of samples) {
      if (e < minEle) minEle = e;
      if (e > maxEle) maxEle = e;
    }
    if (!isFinite(minEle)) minEle = 0;
    if (!isFinite(maxEle)) maxEle = 0;
    return { samples, minEle, maxEle };
  }, [trackPoints]);

  if (samples.length === 0) return null;

  const textPrimary = isDark ? '#FFFFFF' : colors.textPrimary;
  const textSec = isDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary;
  const textTert = isDark ? 'rgba(255,255,255,0.4)' : colors.textTertiary;
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  // Normalize bar heights. Keep at least 8% so flat sections are visible.
  const range = Math.max(maxEle - minEle, 1);
  const heightFor = (ele: number): number => {
    const norm = (ele - minEle) / range;
    return Math.max(0.08, norm) * CHART_HEIGHT;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: textTert }]}>최저</Text>
          <Text style={[styles.statValue, { color: textPrimary }]}>
            {Math.round(minEle)}m
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: textTert }]}>최고</Text>
          <Text style={[styles.statValue, { color: textPrimary }]}>
            {Math.round(maxEle)}m
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: textTert }]}>↑ 상승</Text>
          <Text style={[styles.statValue, { color: '#22C55E' }]}>
            {Math.round(elevationGain)}m
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: textTert }]}>↓ 하강</Text>
          <Text style={[styles.statValue, { color: '#F97316' }]}>
            {Math.round(elevationLoss)}m
          </Text>
        </View>
      </View>

      <View style={[styles.chartWrap, { borderColor: gridColor }]}>
        {/* Grid lines */}
        <View style={[styles.gridLine, { top: 0, backgroundColor: gridColor }]} />
        <View style={[styles.gridLine, { top: CHART_HEIGHT / 2, backgroundColor: gridColor }]} />
        <View style={[styles.gridLine, { bottom: 0, backgroundColor: gridColor }]} />

        <View style={styles.barsRow}>
          {samples.map((ele, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: heightFor(ele),
                  backgroundColor: colors.primary,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.axisRow}>
        <Text style={[styles.axisLabel, { color: textTert }]}>시작</Text>
        <Text style={[styles.axisLabel, { color: textTert }]}>끝</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  chartWrap: {
    height: CHART_HEIGHT,
    borderBottomWidth: 1,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
  },
  bar: {
    flex: 1,
    marginHorizontal: 0.5,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
    opacity: 0.9,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  axisLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
});
