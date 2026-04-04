import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { Trail } from '../types';
import TrailCard from '../components/TrailCard';

const { width } = Dimensions.get('window');

const COUNTRIES = [
  { code: 'KR', name: '\uD55C\uAD6D', flag: '\uD83C\uDDF0\uD83C\uDDF7' },
  { code: 'JP', name: '\uC77C\uBCF8', flag: '\uD83C\uDDEF\uD83C\uDDF5' },
  { code: 'ES', name: '\uC2A4\uD398\uC778', flag: '\uD83C\uDDEA\uD83C\uDDF8' },
  { code: 'PT', name: '\uD3EC\uB974\uD22C\uAC08', flag: '\uD83C\uDDF5\uD83C\uDDF9' },
  { code: 'FR', name: '\uD504\uB791\uC2A4', flag: '\uD83C\uDDEB\uD83C\uDDF7' },
  { code: 'IT', name: '\uC774\uD0C8\uB9AC\uC544', flag: '\uD83C\uDDEE\uD83C\uDDF9' },
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.logo}>Roami</Text>
          <Text style={styles.heroTitle}>
            {'\uAC77\uAE30 \uC5EC\uD589\uC758\n\uBAA8\uB4E0 \uAC83'}
          </Text>
          <Text style={styles.heroSub}>
            {'\uAE38 \uC704\uC758 \uC228\uACA8\uC9C4 \uB9DB\uC9D1, \uCE74\uD398, \uD3EC\uD1A0 \uC2A4\uD31F\uC744 \uBC1C\uACAC\uD558\uC138\uC694'}
          </Text>
        </View>

        {/* Country Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{'\uC5B4\uB514\uB85C \uAC78\uC5B4\uBCFC\uAE4C\uC694?'}</Text>
          <View style={styles.countryGrid}>
            {COUNTRIES.map((c) => (
              <TouchableOpacity
                key={c.code}
                style={styles.countryItem}
                onPress={() =>
                  navigation.navigate('Explore', { country: c.code })
                }>
                <View style={styles.countryFlag}>
                  <Text style={styles.flagEmoji}>{c.flag}</Text>
                </View>
                <Text style={styles.countryName}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Popular Trails */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{'\uC778\uAE30 \uCF54\uC2A4'}</Text>
          {isLoading ? (
            <View style={styles.loadingRow}>
              {[1, 2].map((i) => (
                <View key={i} style={styles.skeletonCard} />
              ))}
            </View>
          ) : (
            <FlatList
              data={popularTrails?.slice(0, 10)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TrailCard
                  trail={item}
                  compact
                  onPress={() =>
                    navigation.navigate('TrailDetail', { trailId: item.id })
                  }
                />
              )}
            />
          )}
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => navigation.navigate('Activity')}>
            <Text style={styles.ctaText}>{'\uAC77\uAE30 \uC2DC\uC791'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  logo: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 40,
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  countryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
  },
  countryItem: {
    width: (width - 48) / 3,
    alignItems: 'center',
    marginBottom: 16,
    marginHorizontal: 4,
  },
  countryFlag: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  flagEmoji: {
    fontSize: 28,
  },
  countryName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  loadingRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  skeletonCard: {
    width: width * 0.7,
    height: 200,
    borderRadius: 16,
    backgroundColor: colors.bgSecondary,
    marginRight: 12,
  },
  ctaSection: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
