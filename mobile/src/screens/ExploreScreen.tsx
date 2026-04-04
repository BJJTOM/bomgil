import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { Trail, PaginatedResponse } from '../types';
import TrailCard from '../components/TrailCard';

const DIFFICULTIES = [
  { key: '', label: '\uC804\uCCB4' },
  { key: 'easy', label: '\uC27D\uAC8C' },
  { key: 'moderate', label: '\uBCF4\uD1B5' },
  { key: 'hard', label: '\uB3C4\uC804' },
];

const COUNTRIES = [
  { key: '', label: '\uC804\uCCB4' },
  { key: 'KR', label: '\uD55C\uAD6D' },
  { key: 'JP', label: '\uC77C\uBCF8' },
  { key: 'ES', label: '\uC2A4\uD398\uC778' },
  { key: 'PT', label: '\uD3EC\uB974\uD22C\uAC08' },
  { key: 'FR', label: '\uD504\uB791\uC2A4' },
  { key: 'IT', label: '\uC774\uD0C8\uB9AC\uC544' },
];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [country, setCountry] = useState(route.params?.country || '');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['trails', search, difficulty, country],
    queryFn: async () => {
      const params: any = {};
      if (search) params.search = search;
      if (difficulty) params.difficulty = difficulty;
      if (country) params.country = country;
      const { data: res } = await api.get('/trails/', { params });
      return res as PaginatedResponse<Trail>;
    },
  });

  const trails = data?.results || [];

  const renderChips = useCallback(
    (
      items: { key: string; label: string }[],
      selected: string,
      onSelect: (key: string) => void,
    ) => (
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={items}
        contentContainerStyle={styles.chipRow}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.chip,
              selected === item.key && styles.chipActive,
            ]}
            onPress={() => onSelect(item.key)}>
            <Text
              style={[
                styles.chipText,
                selected === item.key && styles.chipTextActive,
              ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />
    ),
    [],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{'\uD0D0\uC0C9'}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder={'\uCF54\uC2A4, \uC9C0\uC5ED, \uD0A4\uC6CC\uB4DC \uAC80\uC0C9...'}
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
      </View>

      {/* Filters */}
      {renderChips(COUNTRIES, country, setCountry)}
      {renderChips(DIFFICULTIES, difficulty, setDifficulty)}

      {/* Results */}
      <View style={styles.resultHeader}>
        <Text style={styles.resultCount}>
          {trails.length}{'\uAC1C \uCF54\uC2A4'}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={trails}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <TrailCard
                trail={item}
                onPress={() =>
                  navigation.navigate('TrailDetail', { trailId: item.id })
                }
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {'\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'}
              </Text>
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
    backgroundColor: colors.surface,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  searchWrap: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchInput: {
    height: 44,
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.textPrimary,
  },
  chipRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.bgSecondary,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
  },
  resultHeader: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  resultCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  cardWrap: {
    marginBottom: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textTertiary,
  },
});
