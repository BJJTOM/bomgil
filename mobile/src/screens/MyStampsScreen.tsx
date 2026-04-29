/**
 * MyStampsScreen — shows all stamps the user has collected across all trails,
 * grouped by trail. Accessible from Settings/Profile.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useThemeStore } from '../stores/theme';
import { CollectedStamp } from '../types';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';

interface TrailGroup {
  trailId: number;
  trailTitle: string;
  stamps: CollectedStamp[];
}

export default function MyStampsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isDark } = useThemeStore();

  const bg = isDark ? '#0a0a0a' : '#FAFAFA';
  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#191F28';
  const textSecColor = isDark ? 'rgba(255,255,255,0.6)' : '#8B95A1';
  const textTertColor = isDark ? 'rgba(255,255,255,0.4)' : '#B0B8C1';
  const sectionBg = isDark ? '#1a1a1a' : '#F7F8FA';
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F6';

  const { data: collectedStamps = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['my-stamps'],
    queryFn: async () => {
      const { data } = await api.get('/trails/me/stamps/');
      return ((data?.results ?? data) || []) as CollectedStamp[];
    },
    retry: 1,
    staleTime: 30000,
  });

  // Group by trail
  const trailGroups: TrailGroup[] = React.useMemo(() => {
    const map = new Map<number, TrailGroup>();
    collectedStamps.forEach((cs) => {
      const tid = cs.trail_id;
      if (!map.has(tid)) {
        map.set(tid, {
          trailId: tid,
          trailTitle: cs.trail_title,
          stamps: [],
        });
      }
      map.get(tid)!.stamps.push(cs);
    });
    // Sort each group by collected_at
    const groups = Array.from(map.values());
    groups.forEach((g) => {
      g.stamps.sort(
        (a, b) => new Date(a.collected_at).getTime() - new Date(b.collected_at).getTime(),
      );
    });
    // Sort groups by most recently collected
    groups.sort((a, b) => {
      const aLatest = a.stamps[a.stamps.length - 1]?.collected_at || '';
      const bLatest = b.stamps[b.stamps.length - 1]?.collected_at || '';
      return new Date(bLatest).getTime() - new Date(aLatest).getTime();
    });
    return groups;
  }, [collectedStamps]);

  const totalCount = collectedStamps.length;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>{'내 스탬프'}</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <LoadingState text="스탬프를 불러오는 중..." />
      ) : totalCount === 0 ? (
        <EmptyState
          icon="map-pin"
          title="아직 수집한 스탬프가 없어요"
          subtitle="코스를 걸으며 스탬프를 수집해보세요"
          ctaText="코스 탐색하기"
          onCta={() => navigation.navigate('Main', { screen: 'Explore' })}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }>
          {/* Summary */}
          <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
            <View style={styles.summaryIcon}>
              <Text style={{ fontSize: 28 }}>{'\uD83C\uDFC5'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryValue, { color: textColor }]}>
                {totalCount}
                <Text style={[styles.summaryUnit, { color: textSecColor }]}>{' 개'}</Text>
              </Text>
              <Text style={[styles.summaryLabel, { color: textTertColor }]}>
                {trailGroups.length}개 코스에서 수집
              </Text>
            </View>
          </View>

          {/* Trail groups */}
          {trailGroups.map((group) => (
            <View key={group.trailId} style={styles.trailSection}>
              <TouchableOpacity
                style={styles.trailHeader}
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate('TrailDetail', { id: group.trailId })
                }>
                <Feather name="map" size={15} color={colors.primary} />
                <Text
                  style={[styles.trailTitle, { color: textColor }]}
                  numberOfLines={1}>
                  {group.trailTitle}
                </Text>
                <Text style={[styles.trailCount, { color: textSecColor }]}>
                  {group.stamps.length}개
                </Text>
                <Feather name="chevron-right" size={16} color={textTertColor} />
              </TouchableOpacity>

              <View style={[styles.stampRow, { backgroundColor: sectionBg }]}>
                {group.stamps.map((cs) => (
                  <View key={cs.id} style={styles.stampChip}>
                    <Text style={styles.stampChipEmoji}>
                      {cs.stamp.emoji || '\uD83D\uDCCD'}
                    </Text>
                    <Text
                      style={[styles.stampChipName, { color: textColor }]}
                      numberOfLines={1}>
                      {cs.stamp.name}
                    </Text>
                    <Text style={[styles.stampChipDate, { color: textTertColor }]}>
                      {formatDate(cs.collected_at)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${month}/${day}`;
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 44,
    marginBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },

  // Empty state
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    marginBottom: 24,
  },
  exploreBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  exploreBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Summary card
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F0F7F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  summaryUnit: {
    fontSize: 16,
    fontWeight: '500',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },

  // Trail sections
  trailSection: {
    marginBottom: 16,
  },
  trailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 8,
  },
  trailTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  trailCount: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Stamp chips
  stampRow: {
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stampChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45,74,46,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  stampChipEmoji: {
    fontSize: 16,
  },
  stampChipName: {
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 120,
  },
  stampChipDate: {
    fontSize: 11,
    fontWeight: '400',
  },
});
