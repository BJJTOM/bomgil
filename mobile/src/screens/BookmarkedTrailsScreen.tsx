/**
 * BookmarkedTrailsScreen — lists trails the user has saved via the
 * server-side bookmark (as opposed to the older on-device offline
 * save that SavedTrailsScreen lists).
 *
 * Kept intentionally small: a header + a FlatList of TrailCards. The
 * bookmark toggle itself lives on the trail detail page; this screen
 * is only for browsing what's already bookmarked.
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import api from '../api/client';
import { colors } from '../theme/colors';
import TrailCard from '../components/TrailCard';
import { useThemeStore } from '../stores/theme';
import type { Trail } from '../types';

type BookmarkEntry = {
  id: number;
  trail: Trail;
  note: string;
  created_at: string;
};

export default function BookmarkedTrailsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isDark } = useThemeStore();

  const bg = isDark ? '#0a0a0a' : '#FAFAFA';
  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#191F28';
  const textSecColor = isDark ? 'rgba(255,255,255,0.6)' : colors.textSecondary;
  const textTertColor = isDark ? 'rgba(255,255,255,0.4)' : colors.textTertiary;

  const { data, isLoading, refetch, isRefetching } = useQuery<BookmarkEntry[]>({
    queryKey: ['my-bookmarks'],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/trails/me/bookmarks/');
        return Array.isArray(res) ? res : (res?.results ?? []);
      } catch {
        return [];
      }
    },
  });

  const entries = data || [];

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
        <Text style={[styles.headerTitle, { color: textColor }]}>저장한 코스</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.centerWrap}>
          <View style={styles.emptyIcon}>
            <Feather name="bookmark" size={28} color={textTertColor} />
          </View>
          <Text style={[styles.emptyTitle, { color: textColor }]}>
            저장한 코스가 없어요
          </Text>
          <Text style={[styles.emptySub, { color: textSecColor }]}>
            코스 상세에서 저장 버튼을 눌러{'\n'}나중에 걸을 코스를 모아보세요
          </Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => navigation.navigate('Main', { screen: 'Explore' })}>
            <Text style={styles.exploreBtnText}>코스 둘러보기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => `bm-${item.id}`}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 24 },
          ]}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <TrailCard
                trail={item.trail}
                onPress={() =>
                  navigation.navigate('TrailDetail', { id: item.trail.id })
                }
              />
              {!!item.note && (
                <Text style={[styles.note, { color: textSecColor }]} numberOfLines={2}>
                  {item.note}
                </Text>
              )}
            </View>
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
    justifyContent: 'space-between',
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
  list: {
    padding: 16,
    gap: 14,
  },
  cardWrap: {
    marginBottom: 14,
  },
  note: {
    marginTop: 6,
    marginLeft: 4,
    fontSize: 12,
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
    marginBottom: 24,
  },
  exploreBtn: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    backgroundColor: '#2D4A2E',
    borderRadius: 22,
  },
  exploreBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
