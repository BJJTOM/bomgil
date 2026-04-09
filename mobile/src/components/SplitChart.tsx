/**
 * SplitChart — per-km pace bar chart
 *
 * Visualises `KmSplit[]` as a horizontal row of vertical bars, one per
 * kilometer. The bar height is proportional to that km's pace (min/km),
 * so longer bars = slower kilometers. The fastest km is highlighted in
 * the accent color.
 *
 * Design goals:
 *   - Matches Nike Run Club / Strava split graphs visually
 *   - No external chart library — pure React Native View/Text
 *   - Handles empty splits gracefully (parent should not render in that case)
 *   - Scales: 6 splits or 50 splits both look reasonable
 *
 * Interaction: tap a bar to see the full row of stats for that km
 * (pace + elevation gain + elevation loss).
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import type { KmSplit } from '../utils/walkEngine';

interface Props {
  splits: KmSplit[];
  isDark?: boolean;
}

function formatPace(paceMinPerKm: number): string {
  if (!paceMinPerKm || paceMinPerKm <= 0 || paceMinPerKm > 60) return "--'--\"";
  const min = Math.floor(paceMinPerKm);
  const sec = Math.round((paceMinPerKm - min) * 60);
  return `${min}'${sec.toString().padStart(2, '0')}"`;
}

export default function SplitChart({ splits, isDark = false }: Props) {
  const [selected, setSelected] = useState<number | null>(null);

  const { minPace, maxPace, avgPace, fastestIdx, slowestIdx } = useMemo(() => {
    // Use avgPace (active-time based) when available, fall back to wall-clock pace.
    const paces = splits.map((s) => s.avgPace || s.pace || 0).filter((p) => p > 0);
    if (paces.length === 0) {
      return {
        minPace: 0,
        maxPace: 0,
        avgPace: 0,
        fastestIdx: -1,
        slowestIdx: -1,
      };
    }
    let fastestIdx = 0;
    let slowestIdx = 0;
    let fastestPace = Infinity;
    let slowestPace = 0;
    let sum = 0;
    splits.forEach((s, i) => {
      const p = s.avgPace || s.pace || 0;
      if (p <= 0) return;
      if (p < fastestPace) {
        fastestPace = p;
        fastestIdx = i;
      }
      if (p > slowestPace) {
        slowestPace = p;
        slowestIdx = i;
      }
      sum += p;
    });
    return {
      minPace: fastestPace,
      maxPace: slowestPace,
      avgPace: sum / paces.length,
      fastestIdx,
      slowestIdx,
    };
  }, [splits]);

  if (splits.length === 0 || minPace === 0) return null;

  const textPrimary = isDark ? '#FFFFFF' : colors.textPrimary;
  const textSec = isDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary;
  const textTert = isDark ? 'rgba(255,255,255,0.4)' : colors.textTertiary;
  const axisColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  // Each bar's height is computed relative to the pace range. Slowest
  // km = 100% height, fastest km = 30% height. Flat walks with identical
  // pace each km still render visible bars this way.
  const range = Math.max(maxPace - minPace, 0.5); // avoid div by 0
  const barHeightFor = (pace: number): number => {
    if (pace <= 0) return 0.1;
    const norm = (pace - minPace) / range; // 0 (fastest) .. 1 (slowest)
    return 0.3 + norm * 0.7; // 30%..100%
  };

  const chartHeight = 110;
  // Bar width: scale so 6 splits look chunky and 30 splits still fit.
  const gap = 4;
  const maxBarWidth = 28;
  const minBarWidth = 6;
  // We let the container take full width and derive bar width via flexBasis,
  // so we don't need to measure. Padding handled by the parent card.

  const sel = selected != null ? splits[selected] : null;

  return (
    <View style={styles.container}>
      {/* Legend row: fastest / slowest / avg */}
      <View style={styles.legendRow}>
        <LegendItem
          label="가장 빠른"
          value={formatPace(minPace)}
          color={colors.primary}
          textPrimary={textPrimary}
          textTert={textTert}
        />
        <LegendItem
          label="평균"
          value={formatPace(avgPace)}
          color={textSec}
          textPrimary={textPrimary}
          textTert={textTert}
        />
        <LegendItem
          label="가장 느린"
          value={formatPace(maxPace)}
          color="#EF4444"
          textPrimary={textPrimary}
          textTert={textTert}
        />
      </View>

      {/* Bar chart */}
      <View style={[styles.chartWrap, { height: chartHeight, borderColor: axisColor }]}>
        {splits.map((s, idx) => {
          const pace = s.avgPace || s.pace || 0;
          const h = barHeightFor(pace) * chartHeight;
          const isFastest = idx === fastestIdx;
          const isSlowest = idx === slowestIdx;
          const isSelected = idx === selected;
          const barColor = isFastest
            ? colors.primary
            : isSlowest
            ? '#EF4444'
            : isDark
            ? 'rgba(255,255,255,0.35)'
            : 'rgba(45,74,46,0.4)';
          return (
            <TouchableOpacity
              key={s.km}
              activeOpacity={0.7}
              onPress={() => setSelected((cur) => (cur === idx ? null : idx))}
              style={[
                styles.barCol,
                { marginHorizontal: gap / 2 },
                isSelected && styles.barColSelected,
              ]}
            >
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(h, 6),
                    backgroundColor: barColor,
                    minWidth: minBarWidth,
                    maxWidth: maxBarWidth,
                  },
                  isSelected && { backgroundColor: colors.primary },
                ]}
              />
              <Text style={[styles.barLabel, { color: textTert }]} numberOfLines={1}>
                {s.km}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected row detail (only shown when a bar is tapped) */}
      {sel && (
        <View style={[styles.selectedDetail, { borderTopColor: axisColor }]}>
          <View style={styles.selectedStat}>
            <Text style={[styles.selectedStatLabel, { color: textTert }]}>구간</Text>
            <Text style={[styles.selectedStatValue, { color: textPrimary }]}>
              {sel.km}km
            </Text>
          </View>
          <View style={styles.selectedStat}>
            <Text style={[styles.selectedStatLabel, { color: textTert }]}>페이스</Text>
            <Text style={[styles.selectedStatValue, { color: textPrimary }]}>
              {formatPace(sel.avgPace || sel.pace)}
            </Text>
          </View>
          <View style={styles.selectedStat}>
            <Text style={[styles.selectedStatLabel, { color: textTert }]}>↑ 상승</Text>
            <Text style={[styles.selectedStatValue, { color: textPrimary }]}>
              {sel.elevationGain || 0}m
            </Text>
          </View>
          <View style={styles.selectedStat}>
            <Text style={[styles.selectedStatLabel, { color: textTert }]}>↓ 하강</Text>
            <Text style={[styles.selectedStatValue, { color: textPrimary }]}>
              {sel.elevationLoss || 0}m
            </Text>
          </View>
        </View>
      )}

      {!sel && (
        <Text style={[styles.hint, { color: textTert }]}>
          막대를 눌러 상세 기록을 볼 수 있어요
        </Text>
      )}
    </View>
  );
}

interface LegendItemProps {
  label: string;
  value: string;
  color: string;
  textPrimary: string;
  textTert: string;
}

function LegendItem({ label, value, color, textPrimary, textTert }: LegendItemProps) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <View>
        <Text style={[styles.legendLabel, { color: textTert }]}>{label}</Text>
        <Text style={[styles.legendValue, { color: textPrimary }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  legendValue: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  chartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 4,
    paddingBottom: 6,
  },
  barColSelected: {
    // Elevation handled via bar color instead
  },
  bar: {
    width: '70%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  barLabel: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '600',
  },
  selectedDetail: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selectedStat: {
    alignItems: 'center',
    flex: 1,
  },
  selectedStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  selectedStatValue: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  hint: {
    marginTop: 10,
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },
});
