/**
 * TrailSegments — vertical timeline showing each segment of a trail.
 *
 * Each node displays start_name -> end_name with distance and duration.
 * Nodes are connected by a vertical line with dots. The final
 * destination gets a green checkmark icon.
 *
 * Returns null when segments are absent or empty.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';
import { useThemeStore } from '../stores/theme';

export interface TrailSegment {
  order: number;
  start_name: string;
  end_name: string;
  distance_km: number;
  duration_minutes: number;
  description?: string;
}

interface TrailSegmentsProps {
  segments: TrailSegment[] | undefined | null;
}

function formatSegmentDistance(km: number): string {
  if (km == null || isNaN(km)) return '-';
  return km >= 1 ? `${km.toFixed(1)}km` : `${Math.round(km * 1000)}m`;
}

function formatSegmentDuration(minutes: number): string {
  if (minutes == null || isNaN(minutes)) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

export function TrailSegments({ segments }: TrailSegmentsProps) {
  const { isDark } = useThemeStore();

  if (!segments || segments.length === 0) return null;

  const sorted = [...segments].sort((a, b) => a.order - b.order);

  const textColor = isDark ? '#FFFFFF' : '#191F28';
  const textSecColor = isDark ? 'rgba(255,255,255,0.65)' : '#8B95A1';
  const textTertColor = isDark ? 'rgba(255,255,255,0.42)' : '#B0B8C1';
  const lineColor = isDark ? 'rgba(255,255,255,0.12)' : '#E5E8EB';
  const dotBg = isDark ? '#1a1a1a' : '#F7F8FA';
  const descBg = isDark ? 'rgba(255,255,255,0.05)' : '#F7F8FA';

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>{'구간 안내'}</Text>

      {sorted.map((seg, index) => {
        const isLast = index === sorted.length - 1;

        return (
          <View key={`seg-${seg.order}`} style={styles.row}>
            {/* Timeline column */}
            <View style={styles.timelineCol}>
              {/* Start dot */}
              <View style={[styles.dot, { backgroundColor: dotBg }]}>
                <View
                  style={[
                    styles.dotInner,
                    { backgroundColor: isLast ? '#22C55E' : colors.primary },
                  ]}
                />
              </View>

              {/* Connector line */}
              {!isLast && <View style={[styles.connector, { backgroundColor: lineColor }]} />}

              {/* End dot (green checkmark on last segment) */}
              {isLast && (
                <View style={[styles.dot, styles.dotEnd, { backgroundColor: '#DCFCE7' }]}>
                  <Feather name="check" size={14} color="#15803D" />
                </View>
              )}
            </View>

            {/* Content column */}
            <View style={[styles.content, !isLast && { paddingBottom: 20 }]}>
              {/* Route label */}
              <View style={styles.routeRow}>
                <Text style={[styles.placeName, { color: textColor }]} numberOfLines={1}>
                  {seg.start_name}
                </Text>
                <Feather
                  name="arrow-right"
                  size={12}
                  color={textTertColor}
                  style={styles.arrowIcon}
                />
                <Text style={[styles.placeName, { color: textColor }]} numberOfLines={1}>
                  {seg.end_name}
                </Text>
              </View>

              {/* Distance + duration chips */}
              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <Feather name="map" size={11} color={textSecColor} />
                  <Text style={[styles.metaText, { color: textSecColor }]}>
                    {formatSegmentDistance(seg.distance_km)}
                  </Text>
                </View>
                <View style={styles.metaChip}>
                  <Feather name="clock" size={11} color={textSecColor} />
                  <Text style={[styles.metaText, { color: textSecColor }]}>
                    {formatSegmentDuration(seg.duration_minutes)}
                  </Text>
                </View>
              </View>

              {/* Description (optional) */}
              {!!seg.description && (
                <View style={[styles.descBox, { backgroundColor: descBg }]}>
                  <Text style={[styles.descText, { color: textSecColor }]} numberOfLines={3}>
                    {seg.description}
                  </Text>
                </View>
              )}

              {/* Last segment: show destination marker */}
              {isLast && (
                <View style={styles.destRow}>
                  <View style={[styles.destBadge, { backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : '#DCFCE7' }]}>
                    <Feather name="flag" size={12} color="#15803D" />
                    <Text style={styles.destText}>{seg.end_name}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#191F28',
    marginBottom: 16,
    letterSpacing: -0.3,
  },

  // ── Row (one segment) ──────────────────────────────────
  row: {
    flexDirection: 'row',
  },

  // ── Timeline column ────────────────────────────────────
  timelineCol: {
    width: 32,
    alignItems: 'center',
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotEnd: {
    marginTop: 4,
  },
  connector: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },

  // ── Content column ─────────────────────────────────────
  content: {
    flex: 1,
    paddingLeft: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  placeName: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  arrowIcon: {
    marginHorizontal: 2,
  },

  // ── Meta chips ─────────────────────────────────────────
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // ── Description ────────────────────────────────────────
  descBox: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  descText: {
    fontSize: 13,
    lineHeight: 18,
  },

  // ── Destination badge ──────────────────────────────────
  destRow: {
    marginTop: 10,
  },
  destBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  destText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
});
