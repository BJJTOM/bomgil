import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { Trail, PaginatedResponse } from '../types';

const API_BASE = 'https://api.moruwalk.com';

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

const TABS = [
  { key: 'weekly', label: '주간', endpoint: '/trails/rankings/weekly/' },
  { key: 'monthly', label: '월간', endpoint: '/trails/rankings/monthly/' },
  { key: 'region', label: '지역별', endpoint: '/trails/rankings/region/' },
  { key: 'guides', label: '가이드', endpoint: '/trails/rankings/guides/' },
];

export default function RankingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState('weekly');

  const currentTab = TABS.find((t) => t.key === activeTab) || TABS[0];

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['rankings', activeTab],
    queryFn: async () => {
      const { data: res } = await api.get(currentTab.endpoint);
      return (res?.results || res || []) as Trail[];
    },
  });

  const trails = data || [];

  const renderRankItem = ({ item, index }: { item: Trail; index: number }) => {
    const rank = index + 1;
    const isTop3 = rank <= 3;

    return (
      <TouchableOpacity
        style={styles.rankItem}
        onPress={() => navigation.navigate('TrailDetail', { id: item.id })}
        activeOpacity={0.8}>
        <View style={[styles.rankBadge, isTop3 && styles.rankBadgeTop]}>
          <Text style={[styles.rankNumber, isTop3 && styles.rankNumberTop]}>
            {rank}
          </Text>
        </View>
        <View style={styles.rankImage}>
          {resolveImageUrl(item.cover_image) || resolveImageUrl(item.thumbnail_url) ? (
            <Image
              source={{ uri: (resolveImageUrl(item.cover_image) || resolveImageUrl(item.thumbnail_url))! }}
              style={styles.rankImg}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.rankImgPlaceholder}>
              <Text style={{ fontSize: 20 }}>{'\u{1F6B6}'}</Text>
            </View>
          )}
        </View>
        <View style={styles.rankContent}>
          <Text style={styles.rankTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.rankMeta}>
            {item.region}{' · '}{item.distance_km ? `${parseFloat(String(item.distance_km)).toFixed(1)}km` : '-'}
          </Text>
          <View style={styles.rankStats}>
            <Text style={styles.rankLikes}>{'❤️'} {item.like_count}</Text>
            <Text style={styles.rankViews}>{'\u{1F441}'} {item.view_count}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>랭킹</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}>
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={trails}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRankItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>{'\u{1F3C6}'}</Text>
              <Text style={styles.emptyText}>랭킹 데이터가 없습니다</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 22,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankBadgeTop: {
    backgroundColor: colors.primary,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  rankNumberTop: {
    color: '#FFFFFF',
  },
  rankImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
  },
  rankImg: {
    width: '100%',
    height: '100%',
  },
  rankImgPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankContent: {
    flex: 1,
  },
  rankTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  rankMeta: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 4,
  },
  rankStats: {
    flexDirection: 'row',
    gap: 12,
  },
  rankLikes: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  rankViews: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textTertiary,
  },
});
