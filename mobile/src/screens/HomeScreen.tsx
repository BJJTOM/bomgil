import React from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import api from '../api/client';
import { colors } from '../theme/colors';
import { Trail } from '../types';
import TrailCard from '../components/TrailCard';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 20 * 2 - 12) / 2;

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

const STATS = [
  { value: '8개국', label: '등록 국가' },
  { value: '120+', label: '코스' },
  { value: '850+', label: '걸은 이야기' },
  { value: '2.4K', label: '여행자' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

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
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }>
        {/* Hero Section */}
        <LinearGradient
          colors={['#1a3a1b', '#2D4A2E', '#1e442f']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 16 }]}>
          {/* Top bar */}
          <View style={styles.heroTopBar}>
            <View style={styles.heroLogoRow}>
              <Text style={styles.heroLogoText}>Roami</Text>
            </View>
          </View>

          {/* Community badge */}
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeFlags}>🇰🇷🇯🇵🇺🇸🇬🇧🇫🇷</Text>
            <Text style={styles.heroBadgeText}>전 세계 도보여행자들의 커뮤니티</Text>
          </View>

          {/* Headline */}
          <Text style={styles.heroTitle}>걸으면 보이는 것들</Text>
          <Text style={styles.heroSub}>
            {'전 세계 도보여행 코스를 발견하고, 나만의 길을 공유하세요.\n당신의 발걸음이 누군가의 여행이 됩니다.'}
          </Text>

          {/* CTA Buttons */}
          <View style={styles.heroCTARow}>
            <TouchableOpacity
              style={styles.heroCTAPrimary}
              onPress={() => navigation.navigate('Explore')}
              activeOpacity={0.85}>
              <Text style={styles.heroCTAPrimaryText}>코스 둘러보기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroCTASecondary}
              activeOpacity={0.85}>
              <Text style={styles.heroCTASecondaryText}>내 코스 공유하기</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

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
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>어디를 걸어볼까요?</Text>
            <Text style={styles.sectionSub}>전 세계 도보여행 코스를 탐색하세요</Text>
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

        {/* Popular Trails */}
        <View style={styles.popularSection}>
          <View style={styles.popularHeader}>
            <View>
              <Text style={styles.sectionTitle}>인기 코스</Text>
              <Text style={styles.sectionSub}>
                여행자들이 가장 사랑한 도보 코스
              </Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('Explore', { ordering: '-like_count' })
              }>
              <Text style={styles.viewAllText}>전체보기</Text>
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
                      navigation.navigate('TrailDetail', { trailId: item.id })
                    }
                  />
                </View>
              )}
            />
          )}
        </View>

        {/* UGC CTA */}
        <View style={styles.ugcSection}>
          <View style={styles.ugcCard}>
            <View style={styles.ugcBadge}>
              <Text style={styles.ugcBadgeIcon}>🗺️</Text>
              <Text style={styles.ugcBadgeText}>누구나 코스를 등록할 수 있어요</Text>
            </View>
            <Text style={styles.ugcTitle}>
              {'나만 아는 그 길,\nRoami에 공유해주세요'}
            </Text>
            <Text style={styles.ugcDesc}>
              {'동네 산책로, 여행지 골목길, 해외 숨은 명소까지.\n당신이 걸었던 길이 다른 여행자의 지도가 됩니다.'}
            </Text>
            <View style={styles.ugcButtonRow}>
              <TouchableOpacity style={styles.ugcButtonPrimary} activeOpacity={0.85}>
                <Text style={styles.ugcButtonPrimaryText}>내 코스 공유하기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ugcButtonSecondary} activeOpacity={0.85}>
                <Text style={styles.ugcButtonSecondaryText}>커뮤니티 둘러보기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerMain}>
            Roami는 전 세계 도보여행자들을 위한 코스 공유 & 동행 매칭 플랫폼입니다
          </Text>
          <Text style={styles.footerSub}>
            Roami — A walking travel platform for discovering trails, sharing
            routes, and finding companions.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    gap: 8,
  },
  heroLogoText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 20,
    gap: 8,
  },
  heroBadgeFlags: {
    fontSize: 13,
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

  // Stats Bar
  statsBarOuter: {
    paddingHorizontal: 20,
    marginTop: -28,
    marginBottom: 16,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  statItem: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  statItemBorder: {
    borderRightWidth: 1,
    borderRightColor: '#F2F4F6',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D4A2E',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#B0B8C1',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
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

  // Footer
  footer: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#F2F4F6',
    alignItems: 'center',
  },
  footerMain: {
    fontSize: 13,
    color: '#B0B8C1',
    textAlign: 'center',
    lineHeight: 20,
  },
  footerSub: {
    fontSize: 12,
    color: 'rgba(176,184,193,0.6)',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
