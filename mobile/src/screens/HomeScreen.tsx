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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import api from '../api/client';
import { colors } from '../theme/colors';
import { Trail } from '../types';
import TrailCard from '../components/TrailCard';
import { FadeInView } from '../components/FadeInView';
import { useLanguageStore, Language } from '../stores/language';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 20 * 2 - 12) / 2;

const TRANSLATIONS: Record<string, Record<Language, string>> = {
  communityBadge: {
    ko: '🌏 전 세계 도보여행자들의 커뮤니티',
    en: '🌏 A community of walkers around the world',
    ja: '🌏 世界中の徒歩旅行者のコミュニティ',
    zh: '🌏 全球步行旅行者的社区',
  },
  heroTitle: {
    ko: '걸으면 보이는 것들',
    en: 'What you see\nwhen you walk',
    ja: '歩けば見えるもの',
    zh: '走路时看到的风景',
  },
  heroSub: {
    ko: '전 세계 도보여행 코스를 발견하고\n나만의 길을 공유하세요',
    en: 'Discover walking trails around the world\nand share your own path',
    ja: '世界中の散歩コースを発見し\n自分だけの道を共有しましょう',
    zh: '发现世界各地的步行路线\n分享属于你的道路',
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
  discoverSub: {
    ko: '전 세계 도보여행 코스를 탐색하세요',
    en: 'Explore walking trails around the world',
    ja: '世界中の散歩コースを探索しましょう',
    zh: '探索世界各地的步行路线',
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
  ugcBadge: {
    ko: '누구나 코스를 등록할 수 있어요',
    en: 'Anyone can register a trail',
    ja: '誰でもコースを登録できます',
    zh: '任何人都可以注册路线',
  },
  ugcTitle: {
    ko: '나만 아는 그 길,\nRoami에 공유해주세요',
    en: 'That hidden path you know,\nshare it on Roami',
    ja: '自分だけが知るあの道、\nRoamiで共有してください',
    zh: '你所知道的那条路,\n在Roami上分享吧',
  },
  ugcDesc: {
    ko: '동네 산책로, 여행지 골목길, 해외 숨은 명소까지.\n당신이 걸었던 길이 다른 여행자의 지도가 됩니다.',
    en: 'Neighborhood walks, hidden alleys, secret spots abroad.\nYour path becomes another traveler\'s map.',
    ja: '近所の散歩道、旅先の路地裏、海外の隠れた名所まで。\nあなたが歩いた道が他の旅行者の地図になります。',
    zh: '社区步道、旅行小巷、海外隐藏景点。\n你走过的路将成为其他旅行者的地图。',
  },
  ugcShareBtn: {
    ko: '내 코스 공유하기',
    en: 'Share My Trail',
    ja: 'コースを共有',
    zh: '分享我的路线',
  },
  ugcCommunityBtn: {
    ko: '커뮤니티 둘러보기',
    en: 'Browse Community',
    ja: 'コミュニティを見る',
    zh: '浏览社区',
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
  const [showLangModal, setShowLangModal] = useState(false);

  const STATS = [
    { value: '8개국', label: t('registeredCountries', language) },
    { value: '120+', label: t('courses', language) },
    { value: '850+', label: t('stories', language) },
    { value: '2.4K', label: t('travelers', language) },
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }>
        {/* Hero Section */}
        <FadeInView delay={0}>
        <LinearGradient
          colors={['#1a3a1b', '#2D4A2E', '#1e442f']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 10 }]}>
          {/* Top bar */}
          <View style={styles.heroTopBar}>
            <View style={styles.heroLogoRow}>
              <Text style={styles.heroLogoIcon}>🌿</Text>
              <Text style={styles.heroLogoText}>Roami</Text>
            </View>
            <TouchableOpacity
              style={styles.langButton}
              onPress={() => setShowLangModal(true)}
              activeOpacity={0.7}>
              <Text style={styles.langButtonText}>🌐</Text>
            </TouchableOpacity>
          </View>

          {/* Community badge */}
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{t('communityBadge', language)}</Text>
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
              <Text style={styles.heroCTAPrimaryText}>{t('exploreCTA', language)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroCTASecondary}
              onPress={() => navigation.navigate('TrailCreate')}
              activeOpacity={0.85}>
              <Text style={styles.heroCTASecondaryText}>{t('shareCTA', language)}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
        </FadeInView>

        {/* Stats Bar */}
        <View style={styles.statsBarOuter}>
          <View style={styles.statsBar}>
            {STATS.map((stat, index) => (
              <View
                key={stat.label}
                style={[
                  styles.statItem,
                  index < STATS.length - 1 && styles.statItemBorder,
                ]}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Discover by Country */}
        <FadeInView delay={100}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('discoverTitle', language)}</Text>
            <Text style={styles.sectionSub}>{t('discoverSub', language)}</Text>
          </View>
          <View style={styles.countryGrid}>
            {DISCOVER_COUNTRIES.map((country) => (
              <TouchableOpacity
                key={country.code}
                style={styles.countryCard}
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate('Explore', { country: country.code })
                }>
                <Text style={styles.countryEmoji}>{country.emoji}</Text>
                <View style={styles.countryInfo}>
                  <Text style={styles.countryName}>{country.name}</Text>
                  <Text style={styles.countryDesc} numberOfLines={1}>
                    {country.desc}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        </FadeInView>

        {/* Popular Trails */}
        <FadeInView delay={200}>
        <View style={styles.popularSection}>
          <View style={styles.popularHeader}>
            <View>
              <Text style={styles.sectionTitle}>{t('popularTitle', language)}</Text>
              <Text style={styles.sectionSub}>{t('popularSub', language)}</Text>
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

        {/* UGC CTA */}
        <View style={styles.ugcSection}>
          <View style={styles.ugcCard}>
            <View style={styles.ugcBadge}>
              <Text style={styles.ugcBadgeIcon}>🗺️</Text>
              <Text style={styles.ugcBadgeText}>{t('ugcBadge', language)}</Text>
            </View>
            <Text style={styles.ugcTitle}>{t('ugcTitle', language)}</Text>
            <Text style={styles.ugcDesc}>{t('ugcDesc', language)}</Text>
            <View style={styles.ugcButtonRow}>
              <TouchableOpacity style={styles.ugcButtonPrimary} onPress={() => navigation.navigate('TrailCreate')} activeOpacity={0.85}>
                <Text style={styles.ugcButtonPrimaryText}>{t('ugcShareBtn', language)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ugcButtonSecondary} onPress={() => navigation.navigate('Community')} activeOpacity={0.85}>
                <Text style={styles.ugcButtonSecondaryText}>{t('ugcCommunityBtn', language)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Quick Links */}
        <View style={styles.quickLinksSection}>
          <TouchableOpacity
            style={styles.quickLinkCard}
            onPress={() => navigation.navigate('Rankings')}
            activeOpacity={0.85}>
            <Text style={styles.quickLinkIcon}>{'\u{1F3C6}'}</Text>
            <Text style={styles.quickLinkLabel}>{'랭킹'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickLinkCard}
            onPress={() => navigation.navigate('Chat')}
            activeOpacity={0.85}>
            <Text style={styles.quickLinkIcon}>{'\u{1F4AC}'}</Text>
            <Text style={styles.quickLinkLabel}>{'채팅'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickLinkCard}
            onPress={() => navigation.navigate('TrailCreate')}
            activeOpacity={0.85}>
            <Text style={styles.quickLinkIcon}>{'\u{2795}'}</Text>
            <Text style={styles.quickLinkLabel}>{'코스 등록'}</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerMain}>© 2026 Roami</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal visible={showLangModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowLangModal(false)}
          activeOpacity={1}>
          <View style={styles.langModal}>
            <Text style={styles.langModalTitle}>언어 설정</Text>
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

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    alignItems: 'center',
  },
  heroTopBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  heroLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroLogoIcon: {
    fontSize: 20,
  },
  heroLogoText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  langButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langButtonText: {
    fontSize: 16,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 20,
  },
  heroBadgeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 44,
  },
  heroSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
  },
  heroCTARow: {
    flexDirection: 'row',
    gap: 12,
  },
  heroCTAPrimary: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
  },
  heroCTAPrimaryText: {
    color: '#2D4A2E',
    fontSize: 15,
    fontWeight: '600',
  },
  heroCTASecondary: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
  },
  heroCTASecondaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },

  // Stats Bar (Toss-style)
  statsBarOuter: {
    paddingHorizontal: 20,
    marginTop: -28,
    marginBottom: 16,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F2F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    paddingVertical: 18,
    alignItems: 'center',
  },
  statItemBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#E5E8EB',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#191F28',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    color: '#B0B8C1',
    fontWeight: '400',
  },

  // Section
  section: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#191F28',
    letterSpacing: -0.3,
  },
  sectionSub: {
    fontSize: 13,
    color: '#B0B8C1',
    marginTop: 2,
  },

  // Country Grid (2 columns)
  countryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  countryCard: {
    width: CARD_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  countryEmoji: {
    fontSize: 30,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#191F28',
    marginBottom: 2,
  },
  countryDesc: {
    fontSize: 11,
    color: '#B0B8C1',
  },

  // Popular
  popularSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 28,
    marginTop: 8,
  },
  popularHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  viewAllText: {
    fontSize: 13,
    color: '#2D4A2E',
    fontWeight: '500',
  },
  trailScroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  trailCardWrap: {
    width: 280,
  },
  skeletonCard: {
    width: 280,
    height: 200,
    borderRadius: 20,
    backgroundColor: '#F7F8FA',
  },

  // UGC CTA
  ugcSection: {
    paddingHorizontal: 20,
    paddingVertical: 28,
    backgroundColor: '#FFFFFF',
  },
  ugcCard: {
    backgroundColor: '#f0f7f0',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
  },
  ugcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  ugcBadgeIcon: {
    fontSize: 18,
  },
  ugcBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D4A2E',
  },
  ugcTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#191F28',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
    lineHeight: 30,
  },
  ugcDesc: {
    fontSize: 14,
    color: '#8B95A1',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  ugcButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  ugcButtonPrimary: {
    backgroundColor: '#2D4A2E',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
  },
  ugcButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  ugcButtonSecondary: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E8EB',
  },
  ugcButtonSecondaryText: {
    color: '#191F28',
    fontSize: 14,
    fontWeight: '500',
  },

  // Quick Links
  quickLinksSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginTop: 16,
    marginBottom: 8,
  },
  quickLinkCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F2F4F6',
    gap: 6,
  },
  quickLinkIcon: {
    fontSize: 24,
  },
  quickLinkLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // Footer
  footer: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  footerMain: {
    fontSize: 12,
    color: '#B0B8C1',
    textAlign: 'center',
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
    borderRadius: 20,
    padding: 24,
    width: width - 64,
    maxWidth: 320,
  },
  langModalTitle: {
    fontSize: 18,
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
    backgroundColor: '#f0f7f0',
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
