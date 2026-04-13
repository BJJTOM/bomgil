/**
 * TrailSeriesListScreen — grid of all curated series with per-user
 * progress. Hits GET /trails/series/ (ReadOnlyModelViewSet list).
 *
 * Series are presented as rich horizontal cards with progress bars
 * instead of a plain list — the "how far through am I?" signal is
 * the main value this screen offers, so it gets the visual weight.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useThemeStore } from '../stores/theme';
import type { TrailSeries } from '../types';

export default function TrailSeriesListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isDark } = useThemeStore();

  const bg = isDark ? '#0a0a0a' : '#FAFAFA';
  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#191F28';
  const textSecColor = isDark ? 'rgba(255,255,255,0.65)' : colors.textSecondary;
  const textTertColor = isDark ? 'rgba(255,255,255,0.42)' : colors.textTertiary;
  const trackColor = isDark ? 'rgba(255,255,255,0.1)' : '#EEF1F4';

  const { data, isLoading, refetch, isRefetching } = useQuery<TrailSeries[]>({
    queryKey: ['trail-series-list'],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/trails/series/');
        return Array.isArray(res) ? res : (res?.results ?? []);
      } catch {
        return [];
      }
    },
    staleTime: 60 * 1000,
  });

  const seriesList = data || [];

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={bg}
      />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: cardBg }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="chevron-left" size={24} color={textColor} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: textColor }]}>시리즈 도전</Text>
          <Text style={[styles.headerSub, { color: textTertColor }]}>장거리 코스 챌린지</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : seriesList.length === 0 ? (
        <View style={styles.centerWrap}>
          <View style={styles.emptyIcon}>
            <Feather name="flag" size={28} color={textTertColor} />
          </View>
          <Text style={[styles.emptyTitle, { color: textColor }]}>
            시리즈가 아직 없어요
          </Text>
          <Text style={[styles.emptySub, { color: textSecColor }]}>
            곧 새로운 장거리 챌린지를 추가할 예정이에요
          </Text>
        </View>
      ) : (
        <FlatList
          data={seriesList}
          keyExtractor={(item) => `series-${item.id}`}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.seriesCard, { backgroundColor: cardBg }]}
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate('TrailSeriesDetail', { slug: item.slug })
              }>
              <View style={styles.seriesRow}>
                <View style={styles.emojiCircle}>
                  <Text style={styles.emojiText}>{item.accent_emoji || '🚶'}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={[styles.seriesTitle, { color: textColor }]}
                    numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text
                    style={[styles.seriesSub, { color: textSecColor }]}
                    numberOfLines={1}>
                    {item.subtitle || item.region || ''}
                  </Text>
                </View>
                {item.is_featured && (
                  <View style={styles.featuredBadge}>
                    <Feather name="star" size={10} color="#fff" />
                  </View>
                )}
              </View>

              <View style={styles.progressRow}>
                <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(100, item.progress_pct)}%` },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: textSecColor }]}>
                  {item.progress_completed}/{item.progress_total}
                </Text>
              </View>

              {/* Quick-stat row — distance + duration + completer count */}
              <View style={styles.statsMicroRow}>
                {item.total_distance_km != null && (
                  <View style={styles.statsMicroItem}>
                    <Feather name="map" size={11} color={textTertColor} />
                    <Text style={[styles.statsMicroText, { color: textTertColor }]}>
                      {item.total_distance_km}km
                    </Text>
                  </View>
                )}
                {item.total_minutes != null && item.total_minutes > 0 && (
                  <View style={styles.statsMicroItem}>
                    <Feather name="clock" size={11} color={textTertColor} />
                    <Text style={[styles.statsMicroText, { color: textTertColor }]}>
                      {Math.floor(item.total_minutes / 60)}h{item.total_minutes % 60}m
                    </Text>
                  </View>
                )}
                {item.total_completers != null && item.total_completers > 0 && (
                  <View style={styles.statsMicroItem}>
                    <Feather name="award" size={11} color={textTertColor} />
                    <Text style={[styles.statsMicroText, { color: textTertColor }]}>
                      {item.total_completers}명 완주
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  list: {
    padding: 16,
    gap: 14,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  seriesCard: {
    padding: 16,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  seriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emojiCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F0F7F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 24,
  },
  seriesTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  seriesSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  featuredBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2D4A2E',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  statsMicroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 12,
  },
  statsMicroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statsMicroText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
