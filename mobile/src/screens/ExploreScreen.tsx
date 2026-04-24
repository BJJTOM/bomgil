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
import { Trail } from '../types';
import TrailCard from '../components/TrailCard';
import { FadeInView } from '../components/FadeInView';
import { useThemeStore } from '../stores/theme';
import { haptics } from '../utils/haptics';

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
  const [activeTab, setActiveTab] = useState<'all' | 'user' | 'official' | 'rankings'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
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

  // AI Search state
  const [aiMode, setAiMode] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResults, setAiResults] = useState<Trail[]>([]);
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Check if AI search is available on mount
  useEffect(() => {
    api.get('/trails/ai-search/')
      .then((res) => setAiAvailable(res.data?.available === true))
      .catch(() => setAiAvailable(false));
  }, []);

  const handleAiSearch = useCallback(async () => {
    const q = aiQuery.trim();
    if (!q) return;
    setAiLoading(true);
    setAiSummary('');
    setAiResults([]);
    try {
      const { data } = await api.post('/trails/ai-search/', {
        query: q,
        language: 'ko',
      });
      setAiResults(data.results || []);
      setAiSummary(data.search_summary || '');
    } catch {
      setAiSummary('AI 검색에 실패했어요. 다시 시도해주세요.');
      setAiResults([]);
    } finally {
      setAiLoading(false);
    }
  }, [aiQuery]);

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
    // Tab-based is_official filter (matches web)
    if (activeTab === 'user') params.is_official = 'false';
    else if (activeTab === 'official') params.is_official = 'true';
    return params;
  }, [filters, debouncedSearch, sortBy, activeTab]);

  // Pagination state — 백엔드 `TrailPagination` 은 LimitOffsetPagination (기본 21개) 이므로
  // 웹과 동일하게 limit/offset 파라미터를 사용해야 한다. 이전의 page/page_size 는 무시됐음.
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 21;

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
        params: {
          ...queryParams,
          limit: PAGE_SIZE,
          offset: (currentPage - 1) * PAGE_SIZE,
        },
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
        const { data: res } = await api.get('/trails/', { params: { limit: 50 } });
        return res;
      } catch { return { results: [] }; }
    },
    staleTime: 60000,
  });

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
          {([
            { key: 'all' as const, label: '전체 코스' },
            { key: 'user' as const, label: '유저 코스' },
            { key: 'official' as const, label: '공식 코스' },
            { key: 'rankings' as const, label: '랭킹' },
          ]).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
              onPress={() => { setActiveTab(tab.key); setCurrentPage(1); }}>
              <Text style={[styles.tabBtnText, { color: textTertColor }, activeTab === tab.key && { color: textColor }]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filter Row + Search (trails tabs only) */}
        {(activeTab === 'all' || activeTab === 'user' || activeTab === 'official') && (
          <>
            {searchVisible && (
              <View style={[styles.searchBar, { backgroundColor: aiMode ? '#F0F0FF' : chipBg }]}>
                {aiMode ? (
                  <Feather name="zap" size={16} color="#6C5CE7" style={{ marginRight: 8 }} />
                ) : (
                  <Feather name="search" size={16} color={textTertColor} style={{ marginRight: 8 }} />
                )}
                <TextInput
                  style={[styles.searchInput, { color: textColor }]}
                  placeholder={aiMode ? '어떤 코스를 찾고 계세요?' : '코스, 지역, 키워드 검색...'}
                  placeholderTextColor={textTertColor}
                  value={aiMode ? aiQuery : search}
                  onChangeText={aiMode ? setAiQuery : setSearch}
                  returnKeyType="search"
                  onSubmitEditing={aiMode ? handleAiSearch : undefined}
                  autoFocus
                />
                {(aiMode ? aiQuery : search) ? (
                  <TouchableOpacity onPress={() => aiMode ? setAiQuery('') : setSearch('')} style={styles.clearBtn}>
                    <Feather name="x" size={16} color={textTertColor} />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

        {/* Filter Row — sort + all filter chips scroll together; small
            utility toggles stay pinned on the right so search / view
            toggle are always reachable. */}
        <View style={[styles.filterRow, { borderTopColor: borderColor }]}>
          {!aiMode ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              style={{ flex: 1 }}>
              {/* Sort chip (was pinned; now scrolls first) */}
              <TouchableOpacity
                onPress={() => setShowSortModal(true)}
                style={[styles.chip, { backgroundColor: chipBg }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, { color: textSecColor }]}>
                  {SORT_OPTIONS.find((s) => s.value === sortBy)?.label || '인기순'}
                </Text>
                <Text style={[styles.chipArrow, { color: textTertColor }]}>{' \u25BE'}</Text>
              </TouchableOpacity>

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
                    onPress={() => {
                      haptics.light();
                      setExpandedFilter(
                        expandedFilter === filter.key ? null : filter.key,
                      );
                    }}
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
                      {' \u25BE'}
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
          ) : (
            <View style={{ flex: 1, paddingHorizontal: 20 }}>
              <Text style={{ fontSize: 11, color: textTertColor }}>
                예: "서울 근처 가을에 좋은 쉬운 코스", "해안길 3km 이하"
              </Text>
            </View>
          )}
          {/* Pinned right-side utility toggles */}
          {aiAvailable && (
            <TouchableOpacity
              onPress={() => {
                setAiMode(!aiMode);
                setAiResults([]);
                setAiSummary('');
                setAiQuery('');
                if (!searchVisible) setSearchVisible(true);
              }}
              style={[
                styles.aiToggleBtn,
                { backgroundColor: aiMode ? '#6C5CE7' : chipBg },
              ]}
              activeOpacity={0.7}>
              <Feather name="zap" size={12} color={aiMode ? '#FFFFFF' : textSecColor} />
              <Text style={[styles.aiToggleBtnText, { color: aiMode ? '#FFFFFF' : textSecColor }]}>
                AI
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setSearchVisible(!searchVisible)} style={styles.searchToggleSmall}>
            <Feather name="search" size={16} color={searchVisible ? colors.primary : textTertColor} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setViewMode((m) => (m === 'list' ? 'map' : 'list'));
            }}
            style={[styles.searchToggleSmall, viewMode === 'map' && { backgroundColor: colors.primary + '15' }]}
            activeOpacity={0.7}>
            <Feather
              name={viewMode === 'map' ? 'list' : 'map'}
              size={16}
              color={viewMode === 'map' ? colors.primary : textTertColor}
            />
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
                    onPress={() => { haptics.light(); handleFilterChange(expandedFilter, opt.value); }}
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
                  onPress={() => { haptics.light(); setSortBy(opt.value); setShowSortModal(false); }}>
                  <Text style={[styles.sortItemText, { color: textColor }, sortBy === opt.value && { color: colors.primary, fontWeight: '600' }]}>
                    {opt.label}
                  </Text>
                  {sortBy === opt.value && <Feather name="check" size={16} color={colors.primary} />}
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
      ) : aiMode ? (
      <>
        {/* AI Search Results */}
        {aiSummary ? (
          <View style={[styles.aiSummaryBanner, { backgroundColor: isDark ? '#2a2a3e' : '#F0F0FF' }]}>
            <Feather name="zap" size={14} color={isDark ? '#c0bfff' : '#6C5CE7'} style={{ marginRight: 6 }} />
            <Text style={[styles.aiSummaryText, { color: isDark ? '#c0bfff' : '#4A4A6A' }]}>{aiSummary}</Text>
          </View>
        ) : null}

        {aiLoading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color="#6C5CE7" />
            <Text style={[styles.emptyDesc, { color: textTertColor, marginTop: 12 }]}>AI가 코스를 찾고 있어요...</Text>
          </View>
        ) : aiResults.length > 0 ? (
          <>
            <View style={styles.resultHeader}>
              <Text style={[styles.resultCount, { color: textTertColor }]}>
                {`${aiResults.length}개 코스`}
              </Text>
            </View>
            <FlatList
              data={aiResults}
              keyExtractor={(item) => `ai-${item.id}`}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              numColumns={width > 600 ? 2 : 1}
              key={width > 600 ? 'ai-two-col' : 'ai-one-col'}
              renderItem={renderTrailCard}
              ListEmptyComponent={null}
            />
          </>
        ) : aiQuery.trim() && !aiLoading ? (
          <View style={styles.emptyState}>
            <Feather name="zap" size={36} color={isDark ? '#c0bfff' : '#6C5CE7'} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyTitle, { color: textColor }]}>검색 결과가 없어요</Text>
            <Text style={[styles.emptyDesc, { color: textTertColor }]}>
              다른 표현으로 검색해보세요
            </Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="zap" size={40} color={isDark ? '#c0bfff' : '#6C5CE7'} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyTitle, { color: textColor }]}>자연스럽게 말해보세요</Text>
            <Text style={[styles.emptyDesc, { color: textTertColor }]}>
              원하는 코스를 자유롭게 설명해보세요.{'\n'}AI가 맞는 코스를 찾아드려요.
            </Text>
          </View>
        )}
      </>
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
          <Feather name="alert-triangle" size={40} color="#F59E0B" style={{ marginBottom: 12 }} />
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
      ) : viewMode === 'map' ? (
        <ExploreMapView trails={trails} isDark={isDark} />
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
              <Feather name="search" size={36} color={isDark ? 'rgba(255,255,255,0.3)' : '#B0B8C1'} style={{ marginBottom: 16 }} />
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

// ── 지도 뷰 (ExploreScreen 내부 컴포넌트) ───────────────────────
function ExploreMapView({ trails, isDark }: { trails: Trail[]; isDark: boolean }) {
  const navigation = useNavigation<any>();
  const points = React.useMemo(
    () =>
      trails
        .map((t) => {
          const lat = parseFloat(String((t as any).start_lat || 0));
          const lng = parseFloat(String((t as any).start_lng || 0));
          if (!lat || !lng || Number.isNaN(lat) || Number.isNaN(lng)) return null;
          return { id: t.id, title: t.title, lat, lng, trail: t };
        })
        .filter(Boolean) as Array<{ id: number; title: string; lat: number; lng: number; trail: Trail }>,
    [trails],
  );

  let Mapbox: any = null;
  try {
    Mapbox = require('@rnmapbox/maps').default;
  } catch {
    // ignore
  }

  if (!Mapbox || points.length === 0) {
    return (
      <View style={[styles.mapEmpty, isDark && { backgroundColor: '#111' }]}>
        <Feather name="map-pin" size={28} color={colors.textTertiary} />
        <Text style={[styles.mapEmptyText, { color: isDark ? '#fff' : colors.textPrimary }]}>
          표시할 코스 위치가 없습니다
        </Text>
        <Text style={[styles.mapEmptySub, { color: colors.textTertiary }]}>
          필터를 바꾸거나 목록 뷰로 돌아가세요
        </Text>
      </View>
    );
  }

  // 초기 bounds 계산
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const p of points) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  const bounds = {
    ne: [maxLng + 0.02, maxLat + 0.02] as [number, number],
    sw: [minLng - 0.02, minLat - 0.02] as [number, number],
  };

  // Force the enhanced outdoor style everywhere — hillshade + contours
  // are baked into outdoors-v12 and the trail gradient reads best on it.
  const styleURL = 'mapbox://styles/mapbox/outdoors-v12';

  return (
    <View style={{ flex: 1 }}>
      <Mapbox.MapView
        style={{ flex: 1 }}
        styleURL={styleURL}
        localizeLabels={{ locale: 'ko' }}
        attributionEnabled={false}
        logoEnabled={false}
        scaleBarEnabled={false}
        compassEnabled>
        <Mapbox.Camera
          bounds={bounds}
          padding={{ paddingTop: 60, paddingBottom: 80, paddingLeft: 40, paddingRight: 40 }}
          animationDuration={600}
        />
        {points.map((p) => (
          <Mapbox.PointAnnotation
            key={`mkr-${p.id}`}
            id={`mkr-${p.id}`}
            coordinate={[p.lng, p.lat]}
            onSelected={() => navigation.navigate('TrailDetail', { id: p.id })}>
            <View style={styles.mapMarker}>
              <View style={styles.mapMarkerDot} />
            </View>
            <Mapbox.Callout title={p.title} />
          </Mapbox.PointAnnotation>
        ))}
      </Mapbox.MapView>

      {/* 하단 카운트 배지 */}
      <View style={styles.mapBadge}>
        <Feather name="map-pin" size={12} color="#fff" />
        <Text style={styles.mapBadgeText}>{points.length}개 코스</Text>
      </View>
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
    fontSize: 14,
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

  // AI Search styles
  aiToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
    gap: 3,
  },
  aiToggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  aiSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0DFFF',
  },
  aiSummaryText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  // ── 지도 뷰 ────────────────────────────────────────
  mapEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 32,
    backgroundColor: '#FAFAFA',
  },
  mapEmptyText: { fontSize: 15, fontWeight: '600' },
  mapEmptySub: { fontSize: 12 },
  mapMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(45,74,46,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#fff',
  },
  mapBadge: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(25, 31, 40, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  mapBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
