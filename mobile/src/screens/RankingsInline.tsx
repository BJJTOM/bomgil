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
  TextInput,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import api from '../api/client';
import { colors } from '../theme/colors';
import { Trail } from '../types';

const API_BASE = 'https://api.moruwalk.com';

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

const TABS = [
  { key: 'weekly', label: '주간' },
  { key: 'monthly', label: '월간' },
  { key: 'region', label: '지역별' },
];

export default function RankingsInline() {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState('weekly');
  const [search, setSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['rankings', activeTab],
    queryFn: async () => {
      const { data: res } = await api.get(`/trails/rankings/${activeTab}/`);
      return (res?.results || res || []) as Trail[];
    },
  });

  const trails = (data || []).filter((t) =>
    search ? t.title?.toLowerCase().includes(search.toLowerCase()) || t.region?.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <View style={styles.container}>
      {/* Sub tabs + search */}
      <View style={styles.subTabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.subTab, activeTab === tab.key && styles.subTabActive]}
            onPress={() => setActiveTab(tab.key)}>
            <Text style={[styles.subTabText, activeTab === tab.key && styles.subTabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => setSearchVisible(!searchVisible)} style={styles.searchBtn}>
          <Feather name="search" size={16} color={searchVisible ? colors.primary : colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {searchVisible && (
        <View style={styles.searchBar}>
          <Feather name="search" size={14} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="코스 검색..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={trails}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          renderItem={({ item, index }) => {
            const rank = index + 1;
            const isTop3 = rank <= 3;
            return (
              <TouchableOpacity
                style={styles.rankItem}
                onPress={() => navigation.navigate('TrailDetail', { id: item.id })}
                activeOpacity={0.7}>
                <View style={[styles.rankBadge, isTop3 && styles.rankBadgeTop]}>
                  <Text style={[styles.rankNum, isTop3 && styles.rankNumTop]}>{rank}</Text>
                </View>
                <View style={styles.rankImage}>
                  {resolveImageUrl(item.cover_image) || resolveImageUrl(item.thumbnail_url) ? (
                    <Image source={{ uri: (resolveImageUrl(item.cover_image) || resolveImageUrl(item.thumbnail_url))! }} style={styles.rankImg} resizeMode="cover" />
                  ) : (
                    <View style={styles.rankImgPlaceholder}>
                      <Feather name="map" size={16} color={colors.textTertiary} />
                    </View>
                  )}
                </View>
                <View style={styles.rankContent}>
                  <Text style={styles.rankTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.rankMeta}>{item.region}{item.distance_km ? ` · ${(parseFloat(String(item.distance_km)) || 0).toFixed(1)}km` : ''}</Text>
                  <View style={styles.rankStats}>
                    <Feather name="heart" size={12} color="#FF4B4B" />
                    <Text style={styles.rankStatText}>{item.like_count}</Text>
                    <Feather name="eye" size={12} color={colors.textTertiary} style={{ marginLeft: 10 }} />
                    <Text style={styles.rankStatText}>{item.view_count}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>랭킹 데이터가 없습니다</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  subTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F4F6',
  },
  subTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F7F8FA',
  },
  subTabActive: {
    backgroundColor: colors.primary,
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  subTabTextActive: {
    color: '#fff',
  },
  searchBtn: {
    padding: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 8,
    backgroundColor: '#F7F8FA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F4F6',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankBadgeTop: {
    backgroundColor: colors.primary + '15',
  },
  rankNum: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  rankNumTop: {
    color: colors.primary,
  },
  rankImage: {
    width: 52,
    height: 52,
    borderRadius: 10,
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
    backgroundColor: '#F7F8FA',
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
    alignItems: 'center',
    gap: 4,
  },
  rankStatText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  empty: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
});
