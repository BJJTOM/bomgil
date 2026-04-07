import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import api from '../api/client';
import { colors } from '../theme/colors';
import RankingsInline from './RankingsInline';
import { Trail, PaginatedResponse } from '../types';
import TrailCard from '../components/TrailCard';
import { FadeInView } from '../components/FadeInView';

const { width } = Dimensions.get('window');

const SORT_OPTIONS = [
  { value: '-like_count', label: '인기순' },
  { value: '-created_at', label: '최신순' },
  { value: 'distance_km', label: '거리 짧은순' },
];

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
  const [searchVisible, setSearchVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'courses' | 'rankings'>('courses');
  const [sortBy, setSortBy] = useState('-created_at');
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (route.params?.country) initial.country = route.params.country;
    return initial;
  });
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);
  const [showSortModal, setShowSortModal] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (sortBy) params.ordering = sortBy;
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params[k] = v;
    });
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    return params;
  }, [filters, debouncedSearch, sortBy]);

  // Filtered query (with search param for API)
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['trails', queryParams],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/trails/', { params: { ...queryParams, page_size: 30 } });
        return res;
      } catch (e) {
        console.log('Trails fetch error:', e);
        return { results: [] };
      }
    },
    retry: 1,
    staleTime: 30000,
  });

  // Also load all trails for client-side tag search
  const { data: allData } = useQuery({
    queryKey: ['trails-all'],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/trails/', { params: { page_size: 50 } });
        return res;
      } catch { return { results: [] }; }
    },
    staleTime: 60000,
  });

  const trails = useMemo(() => {
    const apiResults = data?.results ?? (Array.isArray(data) ? data : []);
    if (!debouncedSearch.trim()) return apiResults as Trail[];

    const q = debouncedSearch.toLowerCase();

    // Also search through all trails for tag matches
    const allTrails = allData?.results ?? (Array.isArray(allData) ? allData : []);
    const tagMatches = (allTrails as Trail[]).filter(
      (t) => t.tags?.some(tag =>
        tag.name.toLowerCase().includes(q) ||
        tag.name_en?.toLowerCase().includes(q)
      ),
    );

    // Merge API results + tag matches, deduplicate by id
    const merged = new Map<number, Trail>();
    for (const t of apiResults as Trail[]) merged.set(t.id, t);
    for (const t of tagMatches) merged.set(t.id, t);

    // Also client-side filter on title/region/description
    const allMerged = Array.from(merged.values());
    return allMerged.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.region?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.country?.toLowerCase().includes(q) ||
        t.tags?.some(tag => tag.name.toLowerCase().includes(q) || tag.name_en?.toLowerCase().includes(q)),
    );
  }, [data, allData, debouncedSearch]);

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
            navigation.navigate('TrailDetail', { id: item.id })
          }
        />
      </FadeInView>
    ),
    [navigation],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      {/* Header — Tabs */}
      <View style={styles.header}>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'courses' && styles.tabBtnActive]}
            onPress={() => setActiveTab('courses')}>
            <Text style={[styles.tabBtnText, activeTab === 'courses' && styles.tabBtnTextActive]}>코스</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'rankings' && styles.tabBtnActive]}
            onPress={() => setActiveTab('rankings')}>
            <Text style={[styles.tabBtnText, activeTab === 'rankings' && styles.tabBtnTextActive]}>랭킹</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Row + Search (courses tab only) */}
        {activeTab === 'courses' && (
          <>
            {searchVisible && (
              <View style={styles.searchBar}>
                <Feather name="search" size={16} color={colors.textTertiary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="코스, 지역, 키워드 검색..."
                  placeholderTextColor={colors.textTertiary}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                  autoFocus
                />
                {search ? (
                  <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
                    <Feather name="x" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

        {/* Filter Row */}
        <View style={styles.filterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            style={{ flex: 1 }}>
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
                    {' ▾'}
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
          <TouchableOpacity onPress={() => setShowSortModal(true)} style={styles.sortBtn} activeOpacity={0.7}>
            <Text style={styles.sortBtnText}>
              {SORT_OPTIONS.find((s) => s.value === sortBy)?.label || '인기순'}{' ▾'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSearchVisible(!searchVisible)} style={styles.searchToggleSmall}>
            <Feather name="search" size={16} color={searchVisible ? colors.primary : colors.textTertiary} />
          </TouchableOpacity>
        </View>

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

        {/* Sort Modal */}
        <Modal visible={showSortModal} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            onPress={() => setShowSortModal(false)}
            activeOpacity={1}>
            <View style={styles.sortModal}>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.sortItem, sortBy === opt.value && styles.sortItemActive]}
                  onPress={() => { setSortBy(opt.value); setShowSortModal(false); }}>
                  <Text style={[styles.sortItemText, sortBy === opt.value && { color: colors.primary, fontWeight: '600' }]}>
                    {opt.label}
                  </Text>
                  {sortBy === opt.value && <Text style={{ color: colors.primary }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
          </>
        )}
      </View>

      {/* Content — courses or rankings */}
      {activeTab === 'rankings' ? (
        <RankingsInline />
      ) : (
      <>
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
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  // Header
  header: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 4,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 0,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: colors.primary,
  },
  tabBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  tabBtnTextActive: {
    color: colors.textPrimary,
  },
  searchToggle: {
    padding: 8,
  },
  searchToggleSmall: {
    padding: 8,
    marginLeft: 4,
  },

  // Search — pill shape, subtle shadow
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    borderRadius: 9999,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 16,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(176,184,193,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    fontSize: 10,
    color: '#8B95A1',
    fontWeight: '600',
  },

  // Filter row — compact single line
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F2F4F6',
  },
  chipRow: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: '#F7F8FA',
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
    paddingVertical: 6,
  },
  resetText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
  },

  // Sort button — clean pill
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: '#F7F8FA',
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },

  // Ranking button
  rankBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBtnText: {
    fontSize: 14,
  },

  // Sort modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 8,
    width: 220,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  sortItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sortItemActive: {
    backgroundColor: 'rgba(45,74,46,0.06)',
  },
  sortItemText: {
    fontSize: 14,
    color: colors.textPrimary,
  },

  // Expanded filter options
  filterOptionsRow: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterOption: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: '#F7F8FA',
  },
  filterOptionActive: {
    backgroundColor: colors.primary,
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
    paddingVertical: 10,
  },
  resultCount: {
    fontSize: 13,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 16,
  },
  cardWrap: {
    flex: 1,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },

  // Empty state — clean
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyResetBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 14,
  },
  emptyResetText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
