/**
 * ElevationProfile — elevation chart for a trail detail screen.
 *
 * Renders a gradient-filled bar chart of elevation over distance using
 * pure Views + react-native-linear-gradient. No external chart library
 * required.
 *
 * Features:
 *   - X-axis: cumulative distance in km
 *   - Y-axis: elevation in meters (min/max labels on left edge)
 *   - Gradient fill under the elevation line
 *   - Grade coloring: green <5%, orange 5-10%, red >10%
 *   - Total ascent / descent stats
 *   - Min / max elevation labels
 *   - Total distance
 *   - Responsive to screen width
 *   - Dark / light theme support
 *
 * Input: path coordinates as [lng, lat, ele?]. If fewer than half the
 * points have elevation data, the component renders nothing.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, darkColors, getColors } from '../theme/colors';

type PathPoint = [number, number] | [number, number, number];

type Props = {
  coordinates: PathPoint[];
  isDark?: boolean;
  /** Chart area height in dp. Default 120. */
  height?: number;
};

// Number of bars — enough to show shape, few enough to avoid layout
// jank on mid-tier Android.
const BAR_COUNT = 60;

// Y-axis label count (excluding min — we show min at bottom, max at
// top, and one midpoint).
const Y_LABELS = 3;

/**
 * Haversine distance in meters between two lat/lng points.
 */
function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Pick a bar color based on grade percentage (absolute slope).
 */
function gradeColor(grade: number): string {
  if (grade > 0.10) return '#FCA5A5'; // red — steep
  if (grade > 0.05) return '#FDBA74'; // orange — moderate slope
  return '#86EFAC'; // green — flat / gentle
}

/**
 * Dark-mode adjusted grade colors — slightly muted so they don't glare
 * on a black background.
 */
function gradeColorDark(grade: number): string {
  if (grade > 0.10) return '#EF4444';
  if (grade > 0.05) return '#F59E0B';
  return '#22C55E';
}

interface Sample {
  ele: number;
  dist: number; // cumulative distance in meters from start
  grade: number; // absolute grade 0..1 to next sample (last = 0)
}

export function ElevationProfile({
  coordinates,
  isDark = false,
  height = 120,
}: Props) {
  const c = useMemo(() => getColors(isDark), [isDark]);

  const data = useMemo(() => {
    if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

    // Filter points that actually have elevation
    const withEle = coordinates.filter(
      (p) => Array.isArray(p) && p.length >= 3 && typeof p[2] === 'number',
    );
    if (withEle.length < coordinates.length / 2) return null;

    // Build cumulative distances and elevations for ALL points that have
    // elevation, then down-sample to BAR_COUNT.
    const full: { lat: number; lng: number; ele: number; dist: number }[] = [];
    let cumDist = 0;
    for (let i = 0; i < coordinates.length; i++) {
      const pt = coordinates[i];
      const ele = typeof pt[2] === 'number' ? pt[2] : null;
      if (ele == null) continue;

      if (full.length > 0) {
        const prev = full[full.length - 1];
        cumDist += haversineM(prev.lat, prev.lng, pt[1], pt[0]);
      }
      full.push({ lng: pt[0], lat: pt[1], ele, dist: cumDist });
    }

    if (full.length < 2) return null;

    const totalDist = full[full.length - 1].dist;

    // Total ascent / descent across all elevation-carrying points
    let ascent = 0;
    let descent = 0;
    for (let i = 1; i < full.length; i++) {
      const d = full[i].ele - full[i - 1].ele;
      if (d > 0) ascent += d;
      else descent -= d;
    }

    // Down-sample to BAR_COUNT equally-spaced-by-distance samples.
    // This gives a more truthful x-axis than index-based sampling.
    const stepDist = totalDist / BAR_COUNT;
    const samples: Sample[] = [];
    let fi = 0; // index into `full`

    for (let b = 0; b < BAR_COUNT; b++) {
      const targetDist = b * stepDist;
      // Advance fi to bracket the target
      while (fi < full.length - 1 && full[fi + 1].dist < targetDist) fi++;
      // Linear interpolation between full[fi] and full[fi+1]
      const lo = full[fi];
      const hi = fi < full.length - 1 ? full[fi + 1] : lo;
      const segLen = hi.dist - lo.dist;
      const t = segLen > 0 ? (targetDist - lo.dist) / segLen : 0;
      const ele = lo.ele + t * (hi.ele - lo.ele);

      samples.push({ ele, dist: targetDist, grade: 0 });
    }
    // Always include the endpoint
    const last = full[full.length - 1];
    samples.push({ ele: last.ele, dist: last.dist, grade: 0 });

    // Compute grades between consecutive samples
    for (let i = 0; i < samples.length - 1; i++) {
      const dx = samples[i + 1].dist - samples[i].dist;
      const dy = samples[i + 1].ele - samples[i].ele;
      samples[i].grade = dx > 0 ? Math.abs(dy / dx) : 0;
    }

    const eles = samples.map((s) => s.ele);
    const minEle = Math.min(...eles);
    const maxEle = Math.max(...eles);

    return { samples, minEle, maxEle, totalDist, ascent, descent };
  }, [coordinates]);

  if (!data) return null;

  const { samples, minEle, maxEle, totalDist, ascent, descent } = data;
  const range = maxEle - minEle || 1;

  // Colors
  const textPrimary = isDark ? '#FFFFFF' : colors.textPrimary;
  const textSec = isDark ? darkColors.textSecondary : colors.textSecondary;
  const textTert = isDark ? darkColors.textTertiary : colors.textTertiary;
  const bgCard = isDark ? '#1a1a1a' : '#F7F8FA';
  const chartBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  // X-axis labels: 0, 1/4, 1/2, 3/4, total distance
  const totalKm = totalDist / 1000;
  const xLabels: string[] = [];
  const xCount = 5;
  for (let i = 0; i < xCount; i++) {
    const km = (totalKm * i) / (xCount - 1);
    xLabels.push(km >= 1 ? `${km.toFixed(1)}` : `${Math.round(km * 1000)}m`);
  }

  // Y-axis labels
  const yLabels: { label: string; frac: number }[] = [];
  for (let i = 0; i < Y_LABELS; i++) {
    const frac = i / (Y_LABELS - 1);
    const ele = minEle + frac * range;
    yLabels.push({ label: `${Math.round(ele)}`, frac });
  }

  // Gradient colors for the fill under each bar — from primary to
  // transparent, creating a soft area chart look.
  const gradientTop = isDark ? 'rgba(74,222,128,0.55)' : 'rgba(45,74,46,0.40)';
  const gradientBot = isDark ? 'rgba(74,222,128,0.05)' : 'rgba(45,74,46,0.03)';

  return (
    <View style={[styles.container, { backgroundColor: bgCard }]}>
      {/* ── Header: stats ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.sectionLabel, { color: textTert }]}>고도 프로필</Text>
          <Text style={[styles.eleRange, { color: textPrimary }]}>
            {Math.round(minEle)}m – {Math.round(maxEle)}m
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.statCol}>
            <Text style={[styles.statLabel, { color: textTert }]}>거리</Text>
            <Text style={[styles.statValue, { color: textPrimary }]}>
              {totalKm >= 1 ? `${totalKm.toFixed(1)}km` : `${Math.round(totalDist)}m`}
            </Text>
          </View>
          <View style={styles.statCol}>
            <Text style={[styles.statLabel, { color: textTert }]}>상승</Text>
            <Text style={[styles.statValue, { color: '#15803D' }]}>
              +{Math.round(ascent)}m
            </Text>
          </View>
          <View style={styles.statCol}>
            <Text style={[styles.statLabel, { color: textTert }]}>하강</Text>
            <Text style={[styles.statValue, { color: '#B91C1C' }]}>
              -{Math.round(descent)}m
            </Text>
          </View>
        </View>
      </View>

      {/* ── Chart area ── */}
      <View style={styles.chartRow}>
        {/* Y-axis labels */}
        <View style={[styles.yAxis, { height }]}>
          {yLabels
            .slice()
            .reverse()
            .map((y, i) => (
              <Text
                key={i}
                style={[
                  styles.yLabel,
                  { color: textTert },
                  { position: 'absolute', top: (1 - y.frac) * height - 6 },
                ]}
              >
                {y.label}
              </Text>
            ))}
        </View>

        {/* Bars + grid */}
        <View style={[styles.chartWrap, { height, backgroundColor: chartBg }]}>
          {/* Horizontal grid lines */}
          {yLabels.map((y, i) => (
            <View
              key={`grid-${i}`}
              style={[
                styles.gridLine,
                {
                  backgroundColor: gridColor,
                  bottom: y.frac * height,
                },
              ]}
            />
          ))}

          {/* Bars */}
          <View style={styles.barsRow}>
            {samples.map((s, i) => {
              const norm = (s.ele - minEle) / range;
              const barH = Math.max(2, norm * height);
              const color = isDark
                ? gradeColorDark(s.grade)
                : gradeColor(s.grade);

              return (
                <View key={i} style={[styles.barOuter, { height }]}>
                  <LinearGradient
                    colors={[color, isDark ? 'rgba(74,222,128,0.08)' : 'rgba(45,74,46,0.06)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[styles.bar, { height: barH }]}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* ── X-axis labels ── */}
      <View style={styles.xAxisRow}>
        {/* Spacer matching y-axis width */}
        <View style={styles.yAxisSpacer} />
        <View style={styles.xLabels}>
          {xLabels.map((label, i) => (
            <Text key={i} style={[styles.xLabel, { color: textTert }]}>
              {label}
            </Text>
          ))}
        </View>
      </View>

      {/* ── Legend ── */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: isDark ? '#22C55E' : '#86EFAC' },
            ]}
          />
          <Text style={[styles.legendText, { color: textSec }]}>
            {'평지 (<5%)'}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: isDark ? '#F59E0B' : '#FDBA74' },
            ]}
          />
          <Text style={[styles.legendText, { color: textSec }]}>
            {'완경사 (5-10%)'}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: isDark ? '#EF4444' : '#FCA5A5' },
            ]}
          />
          <Text style={[styles.legendText, { color: textSec }]}>
            {'급경사 (>10%)'}
          </Text>
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

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerLeft: {},
  headerRight: {
    flexDirection: 'row',
    gap: 14,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: -0.2,
    textTransform: 'uppercase',
  },
  eleRange: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  statCol: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.3,
  },

  // ── Chart ──
  chartRow: {
    flexDirection: 'row',
  },
  yAxis: {
    width: 30,
    position: 'relative',
    marginRight: 4,
  },
  yLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'right',
    width: 28,
  },
  chartWrap: {
    flex: 1,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flex: 1,
  },
  barOuter: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    marginHorizontal: 0.25,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },

  // ── X-axis ──
  xAxisRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  yAxisSpacer: {
    width: 34, // matches yAxis width + marginRight
  },
  xLabels: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xLabel: {
    fontSize: 9,
    fontWeight: '500',
  },

  // ── Legend ──
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
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
  legendText: {
    fontSize: 10,
    fontWeight: '500',
  },
});
