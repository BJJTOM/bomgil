import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  StatusBar,
  Modal,
  Image,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Feather from 'react-native-vector-icons/Feather';
import api from '../api/client';
import { colors } from '../theme/colors';
import { Trail } from '../types';
import TrailCard from '../components/TrailCard';
import { FadeInView } from '../components/FadeInView';
import { useLanguageStore, Language } from '../stores/language';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 40 - 10) / 2;

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------
const TRANSLATIONS: Record<string, Record<Language, string>> = {
  heroTitle: {
    ko: '걸으면 보이는 것들',
    en: 'What you see\nwhen you walk',
    ja: '歩けば見えるもの',
    zh: '走路时看到的风景',
  },
  heroSub: {
    ko: '전 세계 도보여행 코스를 발견하고 나만의 길을 공유하세요',
    en: 'Discover walking trails worldwide and share your path',
    ja: '世界中の散歩コースを発見し自分だけの道を共有しましょう',
    zh: '发现世界各地的步行路线，分享属于你的道路',
  },
  exploreCTA: {
    ko: '코스 둘러보기',
    en: 'Explore Trails',
    ja: 'コースを見る',
    zh: '浏览路线',
  },
  shareCTA: {
    ko: '내 코스 공유하기',
    en: 'Share My Trail',
    ja: 'コースを共有',
    zh: '分享我的路线',
  },
  discoverTitle: {
    ko: '어디를 걸어볼까요?',
    en: 'Where will you walk?',
    ja: 'どこを歩きますか？',
    zh: '你想去哪里走走？',
  },
  // Merged trail section — replaces popularTitle / recommendedTitle / todayTitle
  trailSectionTitle: {
    ko: '추천 코스',
    en: 'Recommended Trails',
    ja: 'おすすめコース',
    zh: '推荐路线',
  },
  trailSectionSub: {
    ko: '에디터 추천 & 인기 코스',
    en: "Editor's picks & popular trails",
    ja: '編集部おすすめ & 人気コース',
    zh: '编辑推荐 & 热门路线',
  },
  viewAll: {
    ko: '전체보기',
    en: 'View All',
    ja: 'すべて見る',
    zh: '查看全部',
  },
  // UGC CTA — upgraded
  ugcTitle: {
    ko: '나만 아는 그 길, 공유해주세요',
    en: 'Share the path only you know',
    ja: 'あなただけが知る道を共有してください',
    zh: '分享只有你知道的那条路',
  },
  ugcSubtitle: {
    ko: '당신이 걸었던 길이 다른 여행자의 지도가 됩니다',
    en: 'The path you walked becomes another traveler\'s map',
    ja: 'あなたが歩いた道が他の旅人の地図になります',
    zh: '你走过的路将成为其他旅行者的地图',
  },
  ugcCreateBtn: {
    ko: '코스 등록',
    en: 'Create Trail',
    ja: 'コース登録',
    zh: '注册路线',
  },
  ugcCommunityBtn: {
    ko: '커뮤니티',
    en: 'Community',
    ja: 'コミュニティ',
    zh: '社区',
  },
  // Stats labels
  registeredCountries: { ko: '등록 국가', en: 'Countries', ja: '登録国', zh: '注册国家' },
  courses: { ko: '코스', en: 'Trails', ja: 'コース', zh: '路线' },
  stories: { ko: '걸은 이야기', en: 'Stories', ja: '歩いた話', zh: '步行故事' },
  travelers: { ko: '여행자', en: 'Travelers', ja: '旅行者', zh: '旅行者' },
  // Stats zero-state texts
  zeroCountries: { ko: '베타', en: 'Beta', ja: 'Beta', zh: 'Beta' },
  zeroTrails: { ko: '등록해주세요', en: 'Add yours', ja: '登録してね', zh: '快来注册' },
  zeroStories: { ko: '첫 이야기', en: 'Be first', ja: '最初の話', zh: '成为第一个' },
  zeroUsers: { ko: '함께해요', en: 'Join us', ja: '一緒に', zh: '一起来' },
  // Empty state for trails section
  emptyTrailsTitle: {
    ko: '아직 코스가 없어요',
    en: 'No trails yet',
    ja: 'まだコースがありません',
    zh: '还没有路线',
  },
  emptyTrailsSub: {
    ko: '첫 번째 코스를 등록해보세요',
    en: 'Be the first to create a trail',
    ja: '最初のコースを登録してみましょう',
    zh: '来注册第一条路线吧',
  },
  emptyTrailsCTA: {
    ko: '코스 등록하기',
    en: 'Create a Trail',
    ja: 'コースを登録する',
    zh: '注册路线',
  },
  // Series section
  seriesTitle: { ko: '시리즈 도전', en: 'Series Challenges', ja: 'シリーズチャレンジ', zh: '系列挑战' },
  seriesSub: { ko: '장거리 코스를 구간별로 완주', en: 'Multi-segment completion', ja: '長距離コースを区間ごとに踏破', zh: '分段完成长距离路线' },
};

function t(key: string, lang: Language): string {
  return TRANSLATIONS[key]?.[lang] || TRANSLATIONS[key]?.ko || key;
}

// ---------------------------------------------------------------------------
// Country discover data
// ---------------------------------------------------------------------------
const DISCOVER_COUNTRIES = [
  { code: 'KR', name: '한국', emoji: '🇰🇷', desc: '서울, 제주, 부산...' },
  { code: 'JP', name: '일본', emoji: '🇯🇵', desc: '도쿄, 교토, 오사카...' },
  { code: 'TW', name: '대만', emoji: '🇹🇼', desc: '타이베이, 지우펀...' },
  { code: 'TH', name: '태국', emoji: '🇹🇭', desc: '방콕, 치앙마이...' },
  { code: 'US', name: '미국', emoji: '🇺🇸', desc: 'NYC, LA, 포틀랜드...' },
  { code: 'GB', name: '영국', emoji: '🇬🇧', desc: '런던, 에든버러...' },
  { code: 'FR', name: '프랑스', emoji: '🇫🇷', desc: '파리, 프로방스...' },
  { code: 'ES', name: '스페인', emoji: '🇪🇸', desc: '바르셀로나, 산티아고...' },
];

// ---------------------------------------------------------------------------
// Animated count-up hook (ease-out over ~800ms)
// ---------------------------------------------------------------------------
function useCountUp(target: number, enabled: boolean): number {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!enabled || target <= 0) {
      setDisplay(target);
      return;
    }

    let start = 0;
    const duration = 800;
    const startTime = Date.now();

    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      setDisplay(current);
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [target, enabled]);

  return display;
}

// ---------------------------------------------------------------------------
// Skeleton pulse placeholder for stats
// ---------------------------------------------------------------------------
function SkeletonPulse({ width: w, height: h, isDark }: { width: number; height: number; isDark: boolean }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width: w,
        height: h,
        borderRadius: h / 2,
        backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#E5E8EB',
        opacity,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Single stat item with loading / zero / count-up states
// ---------------------------------------------------------------------------
function StatItem({
  rawValue,
  isLoading,
  label,
  zeroKey,
  language,
  isDark,
  textTertColor,
}: {
  rawValue: number | undefined;
  isLoading: boolean;
  label: string;
  zeroKey: string;
  language: Language;
  isDark: boolean;
  textTertColor: string;
}) {
  const numericValue = rawValue ?? 0;
  const animatedValue = useCountUp(numericValue, !isLoading && numericValue > 0);

  let content: React.ReactNode;

  if (isLoading) {
    content = <SkeletonPulse width={32} height={16} isDark={isDark} />;
  } else if (numericValue === 0) {
    content = (
      <Text style={[styles.statValueText, isDark && { color: '#4ADE80' }, { fontSize: 13 }]}>
        {t(zeroKey, language)}
      </Text>
    );
  } else {
    content = (
      <Text style={[styles.statValue, isDark && { color: '#4ADE80' }]}>
        {animatedValue}
      </Text>
    );
  }

  return (
    <View style={styles.statItem}>
      {content}
      <Text style={[styles.statLabel, { color: textTertColor }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Horizontal scroll fade hint (right edge)
// ---------------------------------------------------------------------------
function ScrollFadeHint({ isDark }: { isDark: boolean }) {
  return (
    <LinearGradient
      colors={[
        isDark ? 'rgba(10,10,10,0)' : 'rgba(250,250,250,0)',
        isDark ? 'rgba(10,10,10,0.9)' : 'rgba(250,250,250,0.9)',
      ]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      pointerEvents="none"
      style={styles.scrollFade}
    />
  );
}

// ---------------------------------------------------------------------------
// Main HomeScreen
// ---------------------------------------------------------------------------
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { language, setLanguage } = useLanguageStore();
  const { isAuthenticated } = useAuthStore();
  const { isDark } = useThemeStore();
  const [showLangModal, setShowLangModal] = useState(false);
  const bg = isDark ? '#0a0a0a' : '#FAFAFA';
  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#191F28';
  const textTertColor = isDark ? 'rgba(255,255,255,0.4)' : '#B0B8C1';

  // ---- Queries ----

  const {
    data: platformStats,
    isLoading: isLoadingStats,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      const { data } = await api.get('/stats/');
      return data;
    },
    staleTime: 60000,
  });

  const {
    data: popularTrails,
    isLoading: isLoadingPopular,
    refetch: refetchPopular,
    isRefetching,
  } = useQuery({
    queryKey: ['trails', 'popular'],
    queryFn: async () => {
      const { data } = await api.get('/trails/popular/');
      return data as Trail[];
    },
  });

  const {
    data: recommendedTrails,
    isLoading: isLoadingRecommended,
    refetch: refetchRecommended,
  } = useQuery({
    queryKey: ['trails', 'recommended'],
    queryFn: async () => {
      const { data } = await api.get('/trails/', {
        params: { ordering: '-like_count', page_size: 3 },
      });
      return (data?.results ?? data) as Trail[];
    },
    staleTime: 60000,
  });

  const {
    data: todayTrails,
    isLoading: isLoadingToday,
    refetch: refetchToday,
  } = useQuery({
    queryKey: ['trails', 'today'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/trails/today/', { params: { limit: 3 } });
        return (data ?? []) as Trail[];
      } catch {
        return [] as Trail[];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: featuredSeries,
    refetch: refetchSeries,
  } = useQuery({
    queryKey: ['trail-series', 'featured'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/trails/series/featured/');
        return (data ?? []) as any[];
      } catch {
        return [] as any[];
      }
    },
    staleTime: 10 * 60 * 1000,
  });

  // ---- Pull-to-refresh: refetch ALL queries ----
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchPopular(),
        refetchStats(),
        refetchRecommended(),
        refetchToday(),
        refetchSeries(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchPopular, refetchStats, refetchRecommended, refetchToday, refetchSeries]);

  // ---- Merged trails: combine today + popular + recommended, deduplicate, max 8 ----
  const mergedTrails = useMemo(() => {
    const seen = new Set<number>();
    const result: Trail[] = [];

    const addTrails = (trails: Trail[] | undefined) => {
      if (!trails) return;
      for (const trail of trails) {
        if (!seen.has(trail.id) && result.length < 8) {
          seen.add(trail.id);
          result.push(trail);
        }
      }
    };

    addTrails(todayTrails);
    addTrails(popularTrails);
    addTrails(recommendedTrails);

    return result;
  }, [todayTrails, popularTrails, recommendedTrails]);

  const isMergedLoading = isLoadingPopular && isLoadingRecommended && isLoadingToday;
  const hasMergedTrails = mergedTrails.length > 0;

  // ---- Stats data ----
  const statItems = [
    { raw: platformStats?.countries, label: t('registeredCountries', language), zeroKey: 'zeroCountries' },
    { raw: platformStats?.trails, label: t('courses', language), zeroKey: 'zeroTrails' },
    { raw: platformStats?.stories, label: t('stories', language), zeroKey: 'zeroStories' },
    { raw: platformStats?.users, label: t('travelers', language), zeroKey: 'zeroUsers' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle="light-content" translucent={true} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }>
        {/* ============================================================= */}
        {/* Hero Section                                                   */}
        {/* ============================================================= */}
        <FadeInView delay={0}>
          <LinearGradient
            colors={['#1a3a1b', '#2D4A2E', '#1e442f']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { paddingTop: insets.top + 12 }]}>
            {/* Top bar */}
            <View style={styles.heroTopBar}>
              <Text style={styles.heroLogoText}>Moru</Text>
              <TouchableOpacity
                style={styles.langButton}
                onPress={() => setShowLangModal(true)}
                activeOpacity={0.7}>
                <Feather name="globe" size={16} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>

            {/* Headline */}
            <Text style={styles.heroTitle}>{t('heroTitle', language)}</Text>
            <Text style={styles.heroSub}>{t('heroSub', language)}</Text>

            {/* CTA Buttons */}
            <View style={styles.heroCTARow}>
              <TouchableOpacity
                style={styles.heroCTAPrimary}
                onPress={() => navigation.navigate('Explore')}
                activeOpacity={0.85}>
                <Feather name="compass" size={15} color="#2D4A2E" style={{ marginRight: 6 }} />
                <Text style={styles.heroCTAPrimaryText}>{t('exploreCTA', language)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.heroCTASecondary}
                onPress={() => navigation.navigate('TrailCreate')}
                activeOpacity={0.85}>
                <Feather name="plus-circle" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.heroCTASecondaryText}>{t('shareCTA', language)}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </FadeInView>

        {/* ============================================================= */}
        {/* Stats bar — overlapping hero bottom                            */}
        {/* ============================================================= */}
        <View style={[styles.statsBar, isDark && { backgroundColor: '#1e1e1e', borderColor: 'rgba(255,255,255,0.1)' }]}>
          {statItems.map((item, idx) => (
            <React.Fragment key={item.zeroKey}>
              {idx > 0 && (
                <View style={[styles.statDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
              )}
              <StatItem
                rawValue={item.raw}
                isLoading={isLoadingStats}
                label={item.label}
                zeroKey={item.zeroKey}
                language={language}
                isDark={isDark}
                textTertColor={textTertColor}
              />
            </React.Fragment>
          ))}
        </View>

        {/* ============================================================= */}
        {/* Discover by Country                                            */}
        {/* ============================================================= */}
        <FadeInView delay={100}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>{t('discoverTitle', language)}</Text>
            <View style={styles.countryGrid}>
              {DISCOVER_COUNTRIES.map((country) => (
                <TouchableOpacity
                  key={country.code}
                  style={[styles.countryItem, isDark && { backgroundColor: '#1e1e1e', borderColor: 'rgba(255,255,255,0.1)' }]}
                  activeOpacity={0.6}
                  onPress={() =>
                    navigation.navigate('Explore', { country: country.code })
                  }>
                  <Text style={styles.countryEmoji}>{country.emoji}</Text>
                  <View style={styles.countryTextWrap}>
                    <Text style={[styles.countryName, { color: textColor }]}>{country.name}</Text>
                    <Text style={styles.countryDesc} numberOfLines={1}>
                      {country.desc}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* ============================================================= */}
        {/* Series Challenges                                              */}
        {/* ============================================================= */}
        {featuredSeries && featuredSeries.length > 0 && (
          <FadeInView delay={140}>
            <View style={styles.trailSection}>
              <View style={styles.trailHeader}>
                <View>
                  <Text style={[styles.sectionTitle, { color: textColor }]}>
                    {t('seriesTitle', language)}
                  </Text>
                  <Text style={[styles.sectionSub, { color: textTertColor }]}>
                    {t('seriesSub', language)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.viewAllBtn}
                  onPress={() => navigation.navigate('TrailSeriesList')}>
                  <Text style={[styles.viewAllText, isDark && { color: '#4ADE80' }]}>
                    {t('viewAll', language)}
                  </Text>
                  <Feather name="arrow-right" size={12} color={isDark ? '#4ADE80' : '#2D4A2E'} style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              </View>
              <View>
                <FlatList
                  data={featuredSeries}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.trailScroll}
                  keyExtractor={(item: any) => String(item.id)}
                  renderItem={({ item }: any) => {
                    const pct = Math.min(100, item.progress_pct || 0);
                    return (
                      <TouchableOpacity
                        style={[styles.seriesHomeCard, { backgroundColor: cardBg }]}
                        activeOpacity={0.85}
                        onPress={() =>
                          navigation.navigate('TrailSeriesDetail', { slug: item.slug })
                        }>
                        <View style={[styles.seriesHomeEmojiWrap, isDark && { backgroundColor: 'rgba(74,222,128,0.1)' }]}>
                          <Text style={styles.seriesHomeEmoji}>
                            {item.accent_emoji || '🚶'}
                          </Text>
                        </View>
                        <Text
                          style={[styles.seriesHomeTitle, { color: textColor }]}
                          numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text
                          style={[styles.seriesHomeSub, { color: textTertColor }]}
                          numberOfLines={1}>
                          {item.subtitle || item.region || ''}
                        </Text>
                        <View style={[styles.seriesHomeProgressTrack, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                          <View
                            style={[
                              styles.seriesHomeProgressFill,
                              { width: `${pct}%` },
                              isDark && { backgroundColor: '#4ADE80' },
                            ]}
                          />
                        </View>
                        <Text style={[styles.seriesHomeProgressLabel, { color: textTertColor }]}>
                          {item.progress_completed}/{item.progress_total} · {pct}%
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                />
                <ScrollFadeHint isDark={isDark} />
              </View>
            </View>
          </FadeInView>
        )}

        {/* ============================================================= */}
        {/* Merged Trail Section (today + popular + recommended)           */}
        {/* ============================================================= */}
        <FadeInView delay={200}>
          <View style={styles.trailSection}>
            <View style={styles.trailHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: textColor }]}>
                  {t('trailSectionTitle', language)}
                </Text>
                <Text style={[styles.sectionSub, { color: textTertColor }]}>
                  {t('trailSectionSub', language)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={() =>
                  navigation.navigate('Explore', { ordering: '-like_count' })
                }>
                <Text style={[styles.viewAllText, isDark && { color: '#4ADE80' }]}>
                  {t('viewAll', language)}
                </Text>
                <Feather name="arrow-right" size={12} color={isDark ? '#4ADE80' : '#2D4A2E'} style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            </View>

            {isMergedLoading ? (
              /* Skeleton loading */
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.trailScroll}>
                {[1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[styles.skeletonCard, isDark && { backgroundColor: '#1e1e1e' }]}
                  />
                ))}
              </ScrollView>
            ) : hasMergedTrails ? (
              /* Trail cards */
              <View>
                <FlatList
                  data={mergedTrails}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.trailScroll}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <View style={styles.trailCardWrap}>
                      <TrailCard
                        trail={item}
                        compact
                        onPress={() =>
                          navigation.navigate('TrailDetail', { id: item.id })
                        }
                      />
                    </View>
                  )}
                />
                <ScrollFadeHint isDark={isDark} />
              </View>
            ) : (
              /* Empty state */
              <View style={[styles.emptyCard, { backgroundColor: isDark ? '#1a1a1a' : colors.primary50 }]}>
                <Text style={styles.emptyEmoji}>🥾</Text>
                <Text style={[styles.emptyTitle, { color: textColor }]}>
                  {t('emptyTrailsTitle', language)}
                </Text>
                <Text style={[styles.emptySub, { color: textTertColor }]}>
                  {t('emptyTrailsSub', language)}
                </Text>
                <TouchableOpacity
                  style={[styles.emptyCTA, isDark && { backgroundColor: '#4ADE80' }]}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('TrailCreate')}>
                  <Feather name="plus" size={15} color={isDark ? '#0a0a0a' : '#FFFFFF'} style={{ marginRight: 6 }} />
                  <Text style={[styles.emptyCTAText, isDark && { color: '#0a0a0a' }]}>
                    {t('emptyTrailsCTA', language)}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </FadeInView>

        {/* ============================================================= */}
        {/* UGC CTA — compelling conversion card                           */}
        {/* ============================================================= */}
        <FadeInView delay={300}>
          <LinearGradient
            colors={isDark ? ['rgba(74,222,128,0.08)', 'rgba(74,222,128,0.02)'] : [colors.primary50, '#FFFFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[styles.ugcCard, isDark && { borderColor: 'rgba(74,222,128,0.15)' }]}>
            <View style={styles.ugcIconRow}>
              <View style={[styles.ugcIconWrap, isDark && { backgroundColor: 'rgba(74,222,128,0.12)' }]}>
                <Feather name="map" size={22} color={isDark ? '#4ADE80' : '#2D4A2E'} />
              </View>
            </View>
            <Text style={[styles.ugcTitle, { color: textColor }]}>
              {t('ugcTitle', language)}
            </Text>
            <Text style={[styles.ugcSubtitle, { color: textTertColor }]}>
              {t('ugcSubtitle', language)}
            </Text>
            <View style={styles.ugcButtonRow}>
              <TouchableOpacity
                style={[styles.ugcPrimaryBtn, isDark && { backgroundColor: '#4ADE80' }]}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('TrailCreate')}>
                <Feather name="plus-circle" size={14} color={isDark ? '#0a0a0a' : '#FFFFFF'} style={{ marginRight: 6 }} />
                <Text style={[styles.ugcPrimaryBtnText, isDark && { color: '#0a0a0a' }]}>
                  {t('ugcCreateBtn', language)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ugcSecondaryBtn, isDark && { borderColor: 'rgba(255,255,255,0.15)' }]}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Community')}>
                <Feather name="users" size={14} color={isDark ? '#4ADE80' : '#2D4A2E'} style={{ marginRight: 6 }} />
                <Text style={[styles.ugcSecondaryBtnText, isDark && { color: '#4ADE80' }]}>
                  {t('ugcCommunityBtn', language)}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </FadeInView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>&copy; 2026 Moru</Text>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ============================================================= */}
      {/* Language Selection Modal                                        */}
      {/* ============================================================= */}
      <Modal visible={showLangModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowLangModal(false)}
          activeOpacity={1}>
          <View style={[styles.langModal, isDark && { backgroundColor: '#1e1e1e' }]}>
            <Text style={[styles.langModalTitle, isDark && { color: '#FFFFFF' }]}>언어 설정</Text>
            {([
              { code: 'ko' as Language, label: '한국어', flag: '🇰🇷' },
              { code: 'en' as Language, label: 'English', flag: '🇺🇸' },
              { code: 'ja' as Language, label: '日本語', flag: '🇯🇵' },
              { code: 'zh' as Language, label: '中文', flag: '🇨🇳' },
            ]).map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.langItem,
                  language === lang.code && styles.langItemActive,
                  isDark && language === lang.code && { backgroundColor: 'rgba(255,255,255,0.08)' },
                ]}
                onPress={() => { setLanguage(lang.code); setShowLangModal(false); }}>
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text style={[styles.langLabel, isDark && { color: '#FFFFFF' }]}>{lang.label}</Text>
                {language === lang.code && <Text style={[styles.langCheck, isDark && { color: '#4ADE80' }]}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  heroTopBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroLogoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  langButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 36,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  heroCTARow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  heroCTAPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  heroCTAPrimaryText: {
    color: '#2D4A2E',
    fontSize: 14,
    fontWeight: '600',
  },
  heroCTASecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  heroCTASecondaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: -24,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E5E8EB',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#F2F4F6',
    alignSelf: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D4A2E',
  },
  statValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D4A2E',
  },
  statLabel: {
    fontSize: 11,
    color: '#B0B8C1',
    marginTop: 2,
  },

  // Section
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#191F28',
    letterSpacing: -0.3,
  },
  sectionSub: {
    fontSize: 12,
    color: '#B0B8C1',
    marginTop: 2,
  },

  // Country Grid — vertical layout for name/desc
  countryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  countryItem: {
    width: CARD_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E8EB',
  },
  countryEmoji: {
    fontSize: 24,
  },
  countryTextWrap: {
    flex: 1,
  },
  countryName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#191F28',
    marginBottom: 2,
  },
  countryDesc: {
    fontSize: 10,
    color: '#B0B8C1',
  },

  // Trail section
  trailSection: {
    paddingTop: 24,
    paddingBottom: 20,
  },
  trailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 13,
    color: '#2D4A2E',
    fontWeight: '500',
  },
  trailScroll: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  trailCardWrap: {
    width: 260,
  },

  // Scroll fade hint
  scrollFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 12,
    width: 32,
  },

  // Series cards
  seriesHomeCard: {
    width: 240,
    padding: 16,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  seriesHomeEmojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F0F7F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  seriesHomeEmoji: {
    fontSize: 22,
  },
  seriesHomeTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  seriesHomeSub: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 12,
  },
  seriesHomeProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EEF1F4',
    overflow: 'hidden',
    marginBottom: 6,
  },
  seriesHomeProgressFill: {
    height: '100%',
    backgroundColor: '#2D4A2E',
  },
  seriesHomeProgressLabel: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Skeleton
  skeletonCard: {
    width: 260,
    height: 180,
    borderRadius: 16,
    backgroundColor: '#F7F8FA',
  },

  // Empty state for merged trails
  emptyCard: {
    marginHorizontal: 20,
    borderRadius: 18,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D4A2E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyCTAText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // UGC CTA card
  ugcCard: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E8EB',
  },
  ugcIconRow: {
    marginBottom: 14,
  },
  ugcIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ugcTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  ugcSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  ugcButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ugcPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D4A2E',
    paddingVertical: 12,
    borderRadius: 14,
  },
  ugcPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  ugcSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E8EB',
  },
  ugcSecondaryBtnText: {
    color: '#2D4A2E',
    fontSize: 13,
    fontWeight: '600',
  },

  // Section header with icon (kept for compatibility)
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Footer
  footer: {
    paddingTop: 40,
    paddingBottom: 8,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#B0B8C1',
  },

  // Language Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: width - 64,
    maxWidth: 320,
  },
  langModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#191F28',
    marginBottom: 16,
    textAlign: 'center',
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  langItemActive: {
    backgroundColor: '#F7F8FA',
  },
  langFlag: {
    fontSize: 22,
    marginRight: 14,
  },
  langLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#191F28',
    flex: 1,
  },
  langCheck: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D4A2E',
  },
});
