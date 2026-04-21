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
import { useThemeStore } from '../stores/theme';

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
    key: 'time_bucket',
    label: '소요',
    options: [
      { value: '', label: '전체' },
      { value: 'short', label: '1시간 이하' },
      { value: 'half', label: '반나절' },
      { value: 'full', label: '종일' },
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
    label: '테마',
    options: [
      { value: '', label: '전체' },
      { value: 'coastal', label: '🌊 바다' },
      { value: 'nature', label: '🌳 숲' },
      { value: 'cultural', label: '🏯 역사' },
      { value: 'urban', label: '🏙 도심' },
      { value: 'village', label: '🏡 마을' },
      { value: 'mixed', label: '🧩 복합' },
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
  {
    key: 'is_official',
    label: '출처',
    options: [
      { value: '', label: '전체' },
      { value: 'true', label: '✓ 공식' },
      { value: 'false', label: '유저' },
    ],
  },
];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDark } = useThemeStore();

  const bg = isDark ? '#0a0a0a' : '#FAFAFA';
  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#191F28';
  const textSecColor = isDark ? 'rgba(255,255,255,0.6)' : colors.textSecondary;
  const textTertColor = isDark ? 'rgba(255,255,255,0.4)' : colors.textTertiary;
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#F2F4F6';
  const chipBg = isDark ? '#2a2a2a' : '#F7F8FA';

  const [search, setSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'courses' | 'series' | 'rankings'>('courses');
  const [sortBy, setSortBy] = useState('-created_at');
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (route.params?.country) initial.country = route.params.country;
    if (route.params?.is_official) initial.is_official = route.params.is_official;
    if (route.params?.trail_type) initial.trail_type = route.params.trail_type;
    if (route.params?.time_bucket) initial.time_bucket = route.params.time_bucket;
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Reset page when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [queryParams.search, queryParams.ordering, queryParams.country, queryParams.difficulty, queryParams.trail_type, queryParams.best_season]);

  // Filtered query with pagination
  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['trails', queryParams, currentPage],
    queryFn: async () => {
      const { data: res } = await api.get('/trails/', {
        params: { ...queryParams, page: currentPage, page_size: PAGE_SIZE },
      });
      return res;
    },
    retry: 1,
    staleTime: 30000,
  });

  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

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

  // Series for the new "시리즈" tab. Fetched lazily — only when the
  // user actually switches to the series tab — so we don't pay for
  // an extra request if they only ever look at trail listings.
  const { data: seriesData, refetch: refetchSeries, isRefetching: seriesRefetching } = useQuery({
    queryKey: ['trail-series-list'],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/trails/series/');
        return Array.isArray(res) ? res : (res?.results ?? []);
      } catch { return []; }
    },
    enabled: activeTab === 'series',
    staleTime: 60 * 1000,
  });
  const seriesList = seriesData || [];

  // Helper: check if a trail has an image (cover_image or thumbnail_url)
  const trailHasImage = useCallback((trail: Trail): boolean => {
    return !!(trail.cover_image || trail.thumbnail_url);
  }, []);

  const trails = useMemo(() => {
    const apiResults: Trail[] = data?.results ?? (Array.isArray(data) ? data : []);

    let result: Trail[];

    if (!debouncedSearch.trim()) {
      result = apiResults;
    } else {
      const q = debouncedSearch.toLowerCase();

      // Also search through all trails for tag matches
      const allTrails = allData?.results ?? (Array.isArray(allData) ? allData : []);
      const tagMatches = (allTrails as Trail[]).filter(
        (trail) => trail.tags?.some(tag =>
          tag.name.toLowerCase().includes(q) ||
          tag.name_en?.toLowerCase().includes(q)
        ),
      );

      // Merge API results + tag matches, deduplicate by id
      const merged = new Map<number, Trail>();
      for (const trail of apiResults) merged.set(trail.id, trail);
      for (const trail of tagMatches) merged.set(trail.id, trail);

      // Also client-side filter on title/region/description
      const allMerged = Array.from(merged.values());
      result = allMerged.filter(
        (trail) =>
          trail.title.toLowerCase().includes(q) ||
          trail.region?.toLowerCase().includes(q) ||
          trail.description?.toLowerCase().includes(q) ||
          trail.country?.toLowerCase().includes(q) ||
          trail.tags?.some(tag => tag.name.toLowerCase().includes(q) || tag.name_en?.toLowerCase().includes(q)),
      );
    }

    // Sort: trails with images first, preserving server ordering as secondary sort
    return [...result].sort((a, b) => {
      const aHas = trailHasImage(a) ? 0 : 1;
      const bHas = trailHasImage(b) ? 0 : 1;
      return aHas - bHas;
    });
  }, [data, allData, debouncedSearch, trailHasImage]);

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
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />

      {/* Header — Tabs */}
      <View style={[styles.header, { backgroundColor: cardBg }]}>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'courses' && styles.tabBtnActive]}
            onPress={() => setActiveTab('courses')}>
            <Text style={[styles.tabBtnText, { color: textTertColor }, activeTab === 'courses' && { color: textColor }]}>코스</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'series' && styles.tabBtnActive]}
            onPress={() => setActiveTab('series')}>
            <Text style={[styles.tabBtnText, { color: textTertColor }, activeTab === 'series' && { color: textColor }]}>시리즈</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'rankings' && styles.tabBtnActive]}
            onPress={() => setActiveTab('rankings')}>
            <Text style={[styles.tabBtnText, { color: textTertColor }, activeTab === 'rankings' && { color: textColor }]}>랭킹</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Row + Search (courses tab only) */}
        {activeTab === 'courses' && (
          <>
            {searchVisible && (
              <View style={[styles.searchBar, { backgroundColor: chipBg }]}>
                <Feather name="search" size={16} color={textTertColor} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInput, { color: textColor }]}
                  placeholder="코스, 지역, 키워드 검색..."
                  placeholderTextColor={textTertColor}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                  autoFocus
                />
                {search ? (
                  <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
                    <Feather name="x" size={16} color={textTertColor} />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

        {/* Filter Row */}
        <View style={[styles.filterRow, { borderTopColor: borderColor }]}>
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
                  style={[styles.chip, { backgroundColor: chipBg }, isActive && styles.chipActive]}
                  onPress={() =>
                    setExpandedFilter(
                      expandedFilter === filter.key ? null : filter.key,
                    )
                  }
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.chipText,
                      { color: textSecColor },
                      isActive && styles.chipTextActive,
                    ]}>
                    {activeLabel || filter.label}
                  </Text>
                  <Text
                    style={[
                      styles.chipArrow,
                      { color: textTertColor },
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
          <TouchableOpacity onPress={() => setShowSortModal(true)} style={[styles.sortBtn, { backgroundColor: chipBg }]} activeOpacity={0.7}>
            <Text style={[styles.sortBtnText, { color: textSecColor }]}>
              {SORT_OPTIONS.find((s) => s.value === sortBy)?.label || '인기순'}{' ▾'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSearchVisible(!searchVisible)} style={styles.searchToggleSmall}>
            <Feather name="search" size={16} color={searchVisible ? colors.primary : textTertColor} />
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
                      { backgroundColor: chipBg },
                      selected && styles.filterOptionActive,
                    ]}
                    onPress={() => handleFilterChange(expandedFilter, opt.value)}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.filterOptionText,
                        { color: textSecColor },
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
            <View style={[styles.sortModal, { backgroundColor: cardBg }]}>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.sortItem, sortBy === opt.value && styles.sortItemActive]}
                  onPress={() => { setSortBy(opt.value); setShowSortModal(false); }}>
                  <Text style={[styles.sortItemText, { color: textColor }, sortBy === opt.value && { color: colors.primary, fontWeight: '600' }]}>
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

      {/* Content — courses, series, or rankings */}
      {activeTab === 'rankings' ? (
        <RankingsInline />
      ) : activeTab === 'series' ? (
        // Series listing: bigger cards with progress bars. Reuses
        // exactly the same shape the dedicated TrailSeriesListScreen
        // uses, so users see consistent UI whether they enter from
        // home or explore.
        <FlatList
          data={seriesList}
          keyExtractor={(item: any) => `xs-${item.id}`}
          contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 14 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={seriesRefetching}
              onRefresh={refetchSeries}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.loadingCenter}>
              <Text style={{ fontSize: 44, marginBottom: 12 }}>🚶</Text>
              <Text style={[styles.emptyTitle, { color: textColor }]}>아직 시리즈가 없어요</Text>
              <Text style={[styles.emptyDesc, { color: textTertColor }]}>
                곧 새로운 장거리 챌린지를 추가할 예정이에요
              </Text>
            </View>
          }
          renderItem={({ item }: any) => {
            const pct = Math.min(100, item.progress_pct || 0);
            return (
              <TouchableOpacity
                style={[
                  {
                    backgroundColor: cardBg,
                    padding: 16,
                    borderRadius: 18,
                    marginBottom: 4,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 10,
                    elevation: 2,
                  },
                ]}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate('TrailSeriesDetail', { slug: item.slug })
                }>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      backgroundColor: isDark ? '#2a3a2b' : '#F0F7F0',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text style={{ fontSize: 24 }}>{item.accent_emoji || '🚶'}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={{
                        color: textColor,
                        fontSize: 16,
                        fontWeight: '700',
                        marginBottom: 3,
                      }}
                      numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text
                      style={{ color: textSecColor, fontSize: 12, fontWeight: '500' }}
                      numberOfLines={1}>
                      {item.subtitle || item.region || ''}
                    </Text>
                  </View>
                  {item.is_featured && (
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: '#F59E0B',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Feather name="star" size={10} color="#fff" />
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 }}>
                  <View
                    style={{
                      flex: 1,
                      height: 8,
                      borderRadius: 4,
                      overflow: 'hidden',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#EEF1F4',
                    }}>
                    <View
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        backgroundColor: '#2D4A2E',
                      }}
                    />
                  </View>
                  <Text
                    style={{
                      color: textSecColor,
                      fontSize: 12,
                      fontWeight: '700',
                      minWidth: 40,
                      textAlign: 'right',
                    }}>
                    {item.progress_completed}/{item.progress_total}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
      <>
      {/* Result Count */}
      <View style={styles.resultHeader}>
        <Text style={[styles.resultCount, { color: textTertColor }]}>
          {isLoading ? '검색 중...' : `${totalCount}개 코스`}
        </Text>
      </View>

      {/* Trail List */}
      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.loadingCenter}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>⚠️</Text>
          <Text style={[styles.emptyTitle, { color: textColor }]}>네트워크 오류</Text>
          <Text style={[styles.emptyDesc, { color: textTertColor, marginBottom: 16 }]}>
            코스를 불러오지 못했어요
          </Text>
          <TouchableOpacity
            style={styles.emptyResetBtn}
            onPress={() => refetch()}
            activeOpacity={0.85}>
            <Text style={styles.emptyResetText}>다시 시도</Text>
          </TouchableOpacity>
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
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={[styles.pagination, isDark && { borderTopColor: 'rgba(255,255,255,0.08)' }]}>
                <TouchableOpacity
                  style={[styles.pageBtn, currentPage <= 1 && styles.pageBtnDisabled]}
                  disabled={currentPage <= 1}
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  activeOpacity={0.7}>
                  <Feather name="chevron-left" size={18} color={currentPage <= 1 ? (isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB') : (isDark ? '#FFFFFF' : '#191F28')} />
                </TouchableOpacity>
                <Text style={[styles.pageInfo, { color: isDark ? '#FFFFFF' : '#191F28' }]}>
                  {currentPage} / {totalPages}
                </Text>
                <TouchableOpacity
                  style={[styles.pageBtn, currentPage >= totalPages && styles.pageBtnDisabled]}
                  disabled={currentPage >= totalPages}
                  onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  activeOpacity={0.7}>
                  <Feather name="chevron-right" size={18} color={currentPage >= totalPages ? (isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB') : (isDark ? '#FFFFFF' : '#191F28')} />
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={renderTrailCard}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={[styles.emptyTitle, { color: textColor }]}>검색 결과가 없습니다</Text>
              <Text style={[styles.emptyDesc, { color: textTertColor }]}>
                다른 키워드나 필터로 검색해보세요
              </Text>
              <TouchableOpacity
                style={styles.emptyResetBtn}
                onPress={clearAllFilters}
                activeOpacity={0.85}>
                <Text style={styles.emptyResetText}>필터 초기화</Text>
              </TouchableOpacity>

              {/* Popular trail suggestions */}
              {(() => {
                const popularSuggestions = (allData?.results ?? (Array.isArray(allData) ? allData : []))
                  .slice(0, 3) as Trail[];
                if (popularSuggestions.length === 0) return null;
                return (
                  <View style={styles.suggestSection}>
                    <Text style={[styles.suggestTitle, { color: textColor }]}>이런 코스는 어떠세요?</Text>
                    {popularSuggestions.map((trail) => (
                      <TouchableOpacity
                        key={trail.id}
                        style={[styles.suggestCard, { backgroundColor: cardBg, borderColor: borderColor }]}
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('TrailDetail', { id: trail.id })}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.suggestCardTitle, { color: textColor }]} numberOfLines={1}>{trail.title}</Text>
                          <Text style={[styles.suggestCardMeta, { color: textTertColor }]} numberOfLines={1}>
                            {trail.region ? trail.region : ''}{trail.distance_km ? ` · ${(parseFloat(String(trail.distance_km)) || 0).toFixed(1)}km` : ''}
                          </Text>
                        </View>
                        <Feather name="chevron-right" size={16} color={textTertColor} />
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })()}
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
  suggestSection: {
    width: '100%',
    marginTop: 32,
  },
  suggestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#191F28',
    marginBottom: 12,
    textAlign: 'center',
  },
  suggestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F2F4F6',
    marginBottom: 8,
  },
  suggestCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#191F28',
    marginBottom: 2,
  },
  suggestCardMeta: {
    fontSize: 12,
    color: '#B0B8C1',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 80,
    borderTopWidth: 1,
    borderTopColor: '#F2F4F6',
    gap: 20,
  },
  pageBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageInfo: {
    fontSize: 15,
    fontWeight: '600',
  },
});
