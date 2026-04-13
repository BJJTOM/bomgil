/**
 * TrailSeriesDetailScreen — one series' hero, progress, and segment
 * list. Segments show a completion state (checkmark for done, number
 * for pending). Tapping a segment opens the individual Trail detail.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useThemeStore } from '../stores/theme';
import type { TrailSeries } from '../types';

export default function TrailSeriesDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const slug = route.params?.slug as string | undefined;
  const { isDark } = useThemeStore();

  const bg = isDark ? '#0a0a0a' : '#FAFAFA';
  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#191F28';
  const textSecColor = isDark ? 'rgba(255,255,255,0.65)' : colors.textSecondary;
  const textTertColor = isDark ? 'rgba(255,255,255,0.42)' : colors.textTertiary;
  const trackColor = isDark ? 'rgba(255,255,255,0.1)' : '#EEF1F4';
  const segmentBorder = isDark ? 'rgba(255,255,255,0.08)' : '#F2F4F6';

  const { data, isLoading, refetch, isRefetching } = useQuery<TrailSeries>({
    queryKey: ['trail-series', slug],
    queryFn: async () => {
      const { data: res } = await api.get(`/trails/series/${slug}/`);
      return res;
    },
    enabled: !!slug,
  });

  if (!slug) return null;

  const segments = data?.segments || [];
  const progressPct = data?.progress_pct ?? 0;
  const completed = data?.progress_completed ?? 0;
  const total = data?.progress_total ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle="light-content" backgroundColor="#2D4A2E" />

      {/* Hero */}
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.heroBackBtn, { top: insets.top + 12 }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.heroContent}>
          <Text style={styles.heroEmoji}>{data?.accent_emoji || '🚶'}</Text>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {data?.title || ' '}
          </Text>
          {!!data?.subtitle && (
            <Text style={styles.heroSub} numberOfLines={2}>
              {data.subtitle}
            </Text>
          )}

          {/* Progress */}
          <View style={styles.heroProgressRow}>
            <View style={styles.heroTrack}>
              <View
                style={[
                  styles.heroFill,
                  { width: `${Math.min(100, progressPct)}%` },
                ]}
              />
            </View>
            <Text style={styles.heroProgressText}>
              {completed}/{total} · {progressPct}%
            </Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
          {/* Completion celebration — when 100% done */}
          {progressPct >= 100 && (
            <View style={styles.celebrationCard}>
              <Text style={styles.celebrationEmoji}>🏆</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.celebrationTitle}>시리즈 완주!</Text>
                <Text style={styles.celebrationSub}>
                  모든 구간을 완주했어요. 진짜 워커네요.
                </Text>
              </View>
            </View>
          )}

          {/* Stats summary — total distance / duration / completers */}
          <View style={[styles.statsSection, { backgroundColor: cardBg }]}>
            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Feather name="map" size={14} color={textTertColor} />
                <Text style={[styles.statValue, { color: textColor }]}>
                  {(data as any)?.total_distance_km?.toFixed(1) || 0}
                  <Text style={styles.statUnit}>km</Text>
                </Text>
                <Text style={[styles.statLabel, { color: textTertColor }]}>총 거리</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: trackColor }]} />
              <View style={styles.statCol}>
                <Feather name="clock" size={14} color={textTertColor} />
                <Text style={[styles.statValue, { color: textColor }]}>
                  {Math.floor(((data as any)?.total_minutes || 0) / 60)}
                  <Text style={styles.statUnit}>h</Text>
                </Text>
                <Text style={[styles.statLabel, { color: textTertColor }]}>예상 시간</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: trackColor }]} />
              <View style={styles.statCol}>
                <Feather name="award" size={14} color={textTertColor} />
                <Text style={[styles.statValue, { color: textColor }]}>
                  {(data as any)?.total_completers || 0}
                </Text>
                <Text style={[styles.statLabel, { color: textTertColor }]}>완주자</Text>
              </View>
            </View>
          </View>

          {/* Description */}
          {!!data?.description && (
            <View style={[styles.section, { backgroundColor: cardBg }]}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>소개</Text>
              <Text style={[styles.descText, { color: textSecColor }]}>
                {data.description}
              </Text>
            </View>
          )}

          {/* Segment list */}
          <View style={[styles.section, { backgroundColor: cardBg }]}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              구간 {total}개
            </Text>
            {segments.map((seg, idx) => (
              <TouchableOpacity
                key={`seg-${seg.id}`}
                style={[
                  styles.segmentRow,
                  idx < segments.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: segmentBorder,
                  },
                ]}
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate('TrailDetail', { id: seg.trail.id })
                }>
                {/* Status circle */}
                <View
                  style={[
                    styles.segmentMarker,
                    seg.is_completed && styles.segmentMarkerDone,
                  ]}>
                  {seg.is_completed ? (
                    <Feather name="check" size={14} color="#fff" />
                  ) : (
                    <Text style={styles.segmentMarkerText}>{idx + 1}</Text>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.segmentTitleRow}>
                    {!!seg.segment_label && (
                      <View style={[styles.labelChip, { backgroundColor: trackColor }]}>
                        <Text style={[styles.labelChipText, { color: textSecColor }]}>
                          {seg.segment_label}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={[styles.segmentTitle, { color: textColor }]}
                      numberOfLines={1}>
                      {seg.trail.title}
                    </Text>
                  </View>
                  <Text
                    style={[styles.segmentMeta, { color: textTertColor }]}
                    numberOfLines={1}>
                    {seg.trail.region}
                    {seg.trail.distance_km ? ` · ${Number(seg.trail.distance_km).toFixed(1)}km` : ''}
                    {seg.trail.estimated_minutes ? ` · ${Math.round(seg.trail.estimated_minutes / 60)}h${seg.trail.estimated_minutes % 60}m` : ''}
                  </Text>
                </View>

                <Feather name="chevron-right" size={20} color={textTertColor} />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    backgroundColor: '#2D4A2E',
    paddingBottom: 24,
  },
  heroBackBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  heroContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: 'flex-start',
  },
  heroEmoji: {
    fontSize: 44,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
    lineHeight: 20,
  },
  heroProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    alignSelf: 'stretch',
    gap: 12,
  },
  heroTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  heroFill: {
    height: '100%',
    backgroundColor: '#A8E6CF',
  },
  heroProgressText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  celebrationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#F59E0B',
    gap: 14,
  },
  celebrationEmoji: {
    fontSize: 36,
  },
  celebrationTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#78350F',
    marginBottom: 2,
  },
  celebrationSub: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  statsSection: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.6,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 36,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  descText: {
    fontSize: 13,
    lineHeight: 21,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  segmentMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EEF1F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentMarkerDone: {
    backgroundColor: '#15803D',
  },
  segmentMarkerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B95A1',
  },
  segmentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  labelChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  labelChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  segmentTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  segmentMeta: {
    fontSize: 11,
    fontWeight: '500',
  },
});
