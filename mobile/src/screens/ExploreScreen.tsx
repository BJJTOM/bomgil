import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { Trail, PaginatedResponse } from '../types';
import TrailCard from '../components/TrailCard';
import { FadeInView } from '../components/FadeInView';

const { width } = Dimensions.get('window');

const FILTER_CHIPS = [
  {
    key: 'country',
    label: '국가',
    options: [
      { value: '', label: '전체' },
      { value: 'KR', label: '🇰🇷 한국' },
      { value: 'JP', label: '🇯🇵 일본' },
      { value: 'TW', label: '🇹🇼 대만' },
      { value: 'TH', label: '🇹🇭 태국' },
      { value: 'US', label: '🇺🇸 미국' },
      { value: 'GB', label: '🇬🇧 영국' },
      { value: 'FR', label: '🇫🇷 프랑스' },
      { value: 'ES', label: '🇪🇸 스페인' },
    ],
  },
  {
    key: 'difficulty',
    label: '난이도',
    options: [
      { value: '', label: '전체' },
      { value: 'easy', label: '쉬움' },
      { value: 'moderate', label: '보통' },
      { value: 'hard', label: '어려움' },
    ],
  },
  {
    key: 'trail_type',
    label: '유형',
    options: [
      { value: '', label: '전체' },
      { value: 'urban', label: '도시' },
      { value: 'coastal', label: '해안' },
      { value: 'village', label: '마을' },
      { value: 'cultural', label: '문화' },
      { value: 'nature', label: '자연' },
      { value: 'mixed', label: '복합' },
    ],
  },
  {
    key: 'best_season',
    label: '시즌',
    options: [
      { value: '', label: '전체' },
      { value: 'spring', label: '봄' },
      { value: 'summer', label: '여름' },
      { value: 'fall', label: '가을' },
      { value: 'winter', label: '겨울' },
      { value: 'all', label: '사계절' },
    ],
  },
];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (route.params?.country) initial.country = route.params.country;
    return initial;
  });
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = { ordering: '-like_count' };
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params[k] = v;
    });
    if (search.trim()) params.search = search.trim();
    return params;
  }, [filters, search]);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['trails', queryParams],
    queryFn: async () => {
      const { data: res } = await api.get('/trails/', { params: queryParams });
      return res as PaginatedResponse<Trail>;
    },
  });

  const trails = useMemo(() => {
    const allTrails = data?.results || [];
    if (!search.trim()) return allTrails;
    const q = search.toLowerCase();
    return allTrails.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.region?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.country?.toLowerCase().includes(q),
    );
  }, [data, search]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value) {
        next[key] = value;
      } else {
        delete next[key];
      }
      return next;
    });
    setExpandedFilter(null);
  };

  const clearAllFilters = () => {
    setFilters({});
    setSearch('');
  };

  const renderTrailCard = useCallback(
    ({ item, index }: { item: Trail; index: number }) => (
      <FadeInView delay={index * 50} style={styles.cardWrap}>
        <TrailCard
          trail={item}
          onPress={() =>
            navigation.navigate('TrailDetail', { trailId: item.id })
          }
        />
      </FadeInView>
    ),
    [navigation],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
      {/* Sticky Header */}
      <View style={styles.stickyHeader}>
        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="코스, 지역, 키워드 검색..."
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search ? (
              <TouchableOpacity
                onPress={() => setSearch('')}
                style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          {FILTER_CHIPS.map((filter) => {
            const isActive = !!filters[filter.key];
            const activeLabel = isActive
              ? filter.options.find((o) => o.value === filters[filter.key])
                  ?.label
              : null;
            return (
              <TouchableOpacity
                key={filter.key}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() =>
                  setExpandedFilter(
                    expandedFilter === filter.key ? null : filter.key,
                  )
                }
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.chipText,
                    isActive && styles.chipTextActive,
                  ]}>
                  {activeLabel || filter.label}
                </Text>
                <Text
                  style={[
                    styles.chipArrow,
                    isActive && styles.chipTextActive,
                  ]}>
                  ▾
                </Text>
              </TouchableOpacity>
            );
          })}
          {activeFilterCount > 0 && (
            <TouchableOpacity onPress={clearAllFilters} style={styles.resetBtn}>
              <Text style={styles.resetText}>초기화</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Expanded filter options */}
        {expandedFilter && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterOptionsRow}>
            {FILTER_CHIPS.find((f) => f.key === expandedFilter)?.options.map(
              (opt) => {
                const selected = filters[expandedFilter] === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.filterOption,
                      selected && styles.filterOptionActive,
                    ]}
                    onPress={() => handleFilterChange(expandedFilter, opt.value)}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.filterOptionText,
                        selected && styles.filterOptionTextActive,
                      ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              },
            )}
          </ScrollView>
        )}
      </View>

      {/* Result Count */}
      <View style={styles.resultHeader}>
        <Text style={styles.resultCount}>
          {isLoading ? '검색 중...' : `${trails.length}개 코스`}
        </Text>
      </View>

      {/* Trail List */}
      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={trails}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          numColumns={width > 600 ? 2 : 1}
          key={width > 600 ? 'two-col' : 'one-col'}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          renderItem={renderTrailCard}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>검색 결과가 없습니다</Text>
              <Text style={styles.emptyDesc}>
                다른 키워드나 필터로 검색해보세요
              </Text>
              <TouchableOpacity
                style={styles.emptyResetBtn}
                onPress={clearAllFilters}
                activeOpacity={0.85}>
                <Text style={styles.emptyResetText}>필터 초기화</Text>
              </TouchableOpacity>
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

  // Sticky header
  stickyHeader: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: 12,
  },

  // Search
  searchRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSecondary,
    borderRadius: 9999,
    paddingHorizontal: 14,
    height: 44,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(176,184,193,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Filter chips
  chipRow: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    backgroundColor: colors.bgSecondary,
    gap: 4,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipArrow: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  resetText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
  },

  // Expanded filter options
  filterOptionsRow: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterOption: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  filterOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterOptionText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterOptionTextActive: {
    color: '#FFFFFF',
  },

  // Results
  resultHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  resultCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  cardWrap: {
    marginBottom: 16,
    flex: 1,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyResetBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  emptyResetText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
