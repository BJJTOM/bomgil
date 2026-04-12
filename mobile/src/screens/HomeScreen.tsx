import React, { useState } from 'react';
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
  popularTitle: {
    ko: '인기 코스',
    en: 'Popular Trails',
    ja: '人気コース',
    zh: '热门路线',
  },
  popularSub: {
    ko: '여행자들이 가장 사랑한 도보 코스',
    en: 'Most loved walking trails by travelers',
    ja: '旅行者に最も愛された散歩コース',
    zh: '旅行者最喜爱的步行路线',
  },
  viewAll: {
    ko: '전체보기',
    en: 'View All',
    ja: 'すべて見る',
    zh: '查看全部',
  },
  ugcCTA: {
    ko: '나만의 길을 공유해보세요',
    en: 'Share your own trail',
    ja: '自分だけの道を共有してください',
    zh: '分享你自己的路线',
  },
  ugcCommunityBtn: {
    ko: '커뮤니티 둘러보기',
    en: 'Browse Community',
    ja: 'コミュニティを見る',
    zh: '浏览社区',
  },
  recommendedTitle: {
    ko: '오늘의 추천 코스',
    en: "Today's Picks",
    ja: '今日のおすすめコース',
    zh: '今日推荐路线',
  },
  recommendedSub: {
    ko: '지금 가장 인기 있는 코스를 걸어보세요',
    en: 'Walk the most popular trails right now',
    ja: '今一番人気のコースを歩いてみましょう',
    zh: '走走现在最受欢迎的路线',
  },
  registeredCountries: { ko: '등록 국가', en: 'Countries', ja: '登録国', zh: '注册国家' },
  courses: { ko: '코스', en: 'Trails', ja: 'コース', zh: '路线' },
  stories: { ko: '걸은 이야기', en: 'Stories', ja: '歩いた話', zh: '步行故事' },
  travelers: { ko: '여행자', en: 'Travelers', ja: '旅行者', zh: '旅行者' },
};

function t(key: string, lang: Language): string {
  return TRANSLATIONS[key]?.[lang] || TRANSLATIONS[key]?.ko || key;
}

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

  const { data: platformStats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      const { data } = await api.get('/stats/');
      return data;
    },
    staleTime: 60000,
  });

  const STATS = [
    { value: String(platformStats?.countries || 0), label: t('registeredCountries', language) },
    { value: String(platformStats?.trails || 0), label: t('courses', language) },
    { value: String(platformStats?.stories || 0), label: t('stories', language) },
    { value: String(platformStats?.users || 0), label: t('travelers', language) },
  ];

  const {
    data: popularTrails,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['trails', 'popular'],
    queryFn: async () => {
      const { data } = await api.get('/trails/popular/');
      return data as Trail[];
    },
  });

  const { data: recommendedTrails, isLoading: isLoadingRecommended } = useQuery({
    queryKey: ['trails', 'recommended'],
    queryFn: async () => {
      const { data } = await api.get('/trails/', {
        params: { ordering: '-like_count', page_size: 3 },
      });
      return (data?.results ?? data) as Trail[];
    },
    staleTime: 60000,
  });

  // "오늘의 코스" — curated official trails. Shown at the top of home.
  const { data: todayTrails, isLoading: isLoadingToday } = useQuery({
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

  // Featured series for home screen "시리즈 도전" section.
  const { data: featuredSeries } = useQuery({
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

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle="light-content" translucent={true} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }>
        {/* Hero Section — compact */}
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

        {/* Stats bar — overlapping hero bottom */}
        <View style={[styles.statsBar, isDark && { backgroundColor: '#1e1e1e', borderColor: 'rgba(255,255,255,0.1)' }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, isDark && { color: '#4ADE80' }]}>{STATS[0].value}</Text>
            <Text style={[styles.statLabel, { color: textTertColor }]}>{STATS[0].label}</Text>
          </View>
          <View style={[styles.statDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, isDark && { color: '#4ADE80' }]}>{STATS[1].value}</Text>
            <Text style={[styles.statLabel, { color: textTertColor }]}>{STATS[1].label}</Text>
          </View>
          <View style={[styles.statDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, isDark && { color: '#4ADE80' }]}>{STATS[2].value}</Text>
            <Text style={[styles.statLabel, { color: textTertColor }]}>{STATS[2].label}</Text>
          </View>
          <View style={[styles.statDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, isDark && { color: '#4ADE80' }]}>{STATS[3].value}</Text>
            <Text style={[styles.statLabel, { color: textTertColor }]}>{STATS[3].label}</Text>
          </View>
        </View>

        {/* Discover by Country */}
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
                  <Text style={[styles.countryName, { color: textColor }]}>{country.name}</Text>
                  <Text style={styles.countryDesc} numberOfLines={1}>
                    {country.desc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* Series Challenges — multi-segment progression */}
        {featuredSeries && featuredSeries.length > 0 && (
          <FadeInView delay={140}>
            <View style={styles.trailSection}>
              <View style={styles.trailHeader}>
                <View>
                  <Text style={[styles.sectionTitle, { color: textColor }]}>
                    {language === 'ko' ? '시리즈 도전' : language === 'ja' ? 'シリーズチャレンジ' : language === 'zh' ? '系列挑战' : 'Series Challenges'}
                  </Text>
                  <Text style={[styles.sectionSub, { color: textTertColor }]}>
                    {language === 'ko' ? '장거리 코스를 구간별로 완주' : language === 'ja' ? '長距離コースを区間ごとに踏破' : language === 'zh' ? '分段完成长距离路线' : 'Multi-segment completion'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('TrailSeriesList')}>
                  <Text style={styles.viewAllText}>{t('viewAll', language)}</Text>
                </TouchableOpacity>
              </View>
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
                      <View style={styles.seriesHomeEmojiWrap}>
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
                      <View style={styles.seriesHomeProgressTrack}>
                        <View
                          style={[
                            styles.seriesHomeProgressFill,
                            { width: `${pct}%` },
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
            </View>
          </FadeInView>
        )}

        {/* Today's Courses — curated official trails */}
        {todayTrails && todayTrails.length > 0 && (
          <FadeInView delay={150}>
            <View style={styles.trailSection}>
              <View style={styles.trailHeader}>
                <View>
                  <Text style={[styles.sectionTitle, { color: textColor }]}>
                    {language === 'ko' ? '오늘의 코스' : language === 'ja' ? '今日のコース' : language === 'zh' ? '今日路线' : "Today's Picks"}
                  </Text>
                  <Text style={[styles.sectionSub, { color: textTertColor }]}>
                    {language === 'ko' ? '공식 큐레이션 · 지금 걷기 좋은' : language === 'ja' ? '公式キュレーション' : language === 'zh' ? '官方策划' : 'Official curation'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('Explore', { is_official: 'true' })
                  }>
                  <Text style={styles.viewAllText}>{t('viewAll', language)}</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={todayTrails}
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
            </View>
          </FadeInView>
        )}

        {/* Popular Trails */}
        <FadeInView delay={200}>
          <View style={styles.trailSection}>
            <View style={styles.trailHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: textColor }]}>{t('popularTitle', language)}</Text>
                <Text style={[styles.sectionSub, { color: textTertColor }]}>{t('popularSub', language)}</Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('Explore', { ordering: '-like_count' })
                }>
                <Text style={styles.viewAllText}>{t('viewAll', language)}</Text>
              </TouchableOpacity>
            </View>
            {isLoading ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.trailScroll}>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={styles.skeletonCard} />
                ))}
              </ScrollView>
            ) : (
              <FlatList
                data={popularTrails?.slice(0, 6)}
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
            )}
          </View>
        </FadeInView>

        {/* Recommended Trails */}
        {(isLoadingRecommended || (recommendedTrails && recommendedTrails.length > 0)) && (
          <FadeInView delay={300}>
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Feather name="star" size={18} color={isDark ? '#4ADE80' : '#2D4A2E'} />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: textColor, marginBottom: 0 }]}>
                    {t('recommendedTitle', language)}
                  </Text>
                  <Text style={[styles.sectionSub, { color: textTertColor }]}>
                    {t('recommendedSub', language)}
                  </Text>
                </View>
              </View>
              {isLoadingRecommended ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12, paddingTop: 16, paddingBottom: 12, paddingRight: 20 }}>
                  {[1, 2, 3].map((i) => (
                    <View key={i} style={[styles.recCardSkeleton, { backgroundColor: isDark ? '#1e1e1e' : '#F2F4F6' }]}>
                      <View style={[styles.recCardSkeletonImage, { backgroundColor: isDark ? '#2a2a2a' : '#E5E8EB' }]} />
                      <View style={{ padding: 12 }}>
                        <View style={[styles.skeletonLine, { width: 120, backgroundColor: isDark ? '#2a2a2a' : '#E5E8EB' }]} />
                        <View style={[styles.skeletonLine, { width: 80, marginTop: 8, backgroundColor: isDark ? '#2a2a2a' : '#E5E8EB' }]} />
                      </View>
                    </View>
                  ))}
                </ScrollView>
              ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingTop: 16, paddingBottom: 12, paddingRight: 20 }}>
                {(recommendedTrails || []).slice(0, 3).map((trail) => (
                  <TouchableOpacity
                    key={trail.id}
                    style={[styles.recCard, { backgroundColor: cardBg }]}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('TrailDetail', { id: trail.id })}>
                    {trail.cover_image || trail.thumbnail_url ? (
                      <Image
                        source={{ uri: trail.cover_image || trail.thumbnail_url }}
                        style={styles.recCardImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.recCardImagePlaceholder}>
                        <Feather name="map-pin" size={24} color="#B0B8C1" />
                      </View>
                    )}
                    <View style={styles.recCardBody}>
                      <Text style={[styles.recCardTitle, { color: textColor }]} numberOfLines={1}>
                        {trail.title}
                      </Text>
                      <View style={styles.recCardMeta}>
                        <Feather name="map" size={11} color={textTertColor} />
                        <Text style={[styles.recCardMetaText, { color: textTertColor }]}>
                          {trail.distance_km ? `${parseFloat(trail.distance_km).toFixed(1)}km` : ''}
                          {trail.region ? ` · ${trail.region}` : ''}
                        </Text>
                      </View>
                      <View style={styles.recCardMeta}>
                        <Feather name="heart" size={11} color="#FF4B4B" />
                        <Text style={[styles.recCardMetaText, { color: textTertColor }]}>
                          {trail.like_count ?? 0}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              )}
            </View>
          </FadeInView>
        )}

        {/* Recent Community Posts */}
        {/* UGC CTA — single compact line */}
        <View style={[styles.ugcRow, isDark && { backgroundColor: '#1a1a1a' }]}>
          <Feather name="edit-3" size={16} color="#8B95A1" style={{ marginRight: 8 }} />
          <Text style={[styles.ugcText, { flex: 1 }]}>{t('ugcCTA', language)}</Text>
          <TouchableOpacity
            style={styles.ugcBtn}
            onPress={() => navigation.navigate('Community')}
            activeOpacity={0.85}>
            <Text style={styles.ugcBtnText}>{t('ugcCommunityBtn', language)}</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>&copy; 2026 Moru</Text>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Language Selection Modal */}
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
                style={[styles.langItem, language === lang.code && styles.langItemActive]}
                onPress={() => { setLanguage(lang.code); setShowLangModal(false); }}>
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text style={styles.langLabel}>{lang.label}</Text>
                {language === lang.code && <Text style={styles.langCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  // Hero — shorter, 220px feel
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
  langButtonText: {
    fontSize: 15,
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

  // Stats bar — white card overlapping hero bottom
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
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#F2F4F6',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
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

  // Country Grid — no borders, subtle bg
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
  countryName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#191F28',
  },
  countryDesc: {
    flex: 1,
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
  seriesHomeCard: {
    width: 240,
    padding: 16,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginRight: 12,
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
  skeletonCard: {
    width: 260,
    height: 180,
    borderRadius: 16,
    backgroundColor: '#F7F8FA',
  },
  recCardSkeleton: {
    width: 220,
    borderRadius: 16,
    overflow: 'hidden',
  },
  recCardSkeletonImage: {
    width: '100%',
    height: 120,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
  skeletonCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  // UGC — single compact row
  ugcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#F7F8FA',
    borderRadius: 16,
  },
  ugcText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8B95A1',
    flex: 1,
    marginRight: 12,
  },
  ugcBtn: {
    backgroundColor: '#2D4A2E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  ugcBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Section header with icon
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Recommended trail cards
  recCard: {
    width: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  recCardImage: {
    width: '100%',
    height: 120,
  },
  recCardImagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#F2F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recCardBody: {
    padding: 12,
  },
  recCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#191F28',
    marginBottom: 6,
  },
  recCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  recCardMetaText: {
    fontSize: 11,
    color: '#B0B8C1',
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
