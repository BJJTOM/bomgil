import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { Trail } from '../types';
import TrailCard from '../components/TrailCard';

export default function LikedTrailsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const { data: trails, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['liked-trails'],
    queryFn: async () => {
      const { data } = await api.get('/auth/me/likes/');
      return (data.results || data) as Trail[];
    },
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>좋아요한 코스</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !trails || trails.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>{'❤️'}</Text>
          <Text style={styles.emptyTitle}>좋아요한 코스가 없습니다</Text>
          <Text style={styles.emptyDesc}>마음에 드는 코스에 좋아요를 눌러보세요</Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => navigation.navigate('Explore')}>
            <Text style={styles.exploreBtnText}>코스 둘러보기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={trails}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <TrailCard
                trail={item}
                variant="horizontal"
                onPress={() => navigation.navigate('TrailDetail', { trailId: item.id })}
              />
            </View>
          )}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  backIcon: {
    fontSize: 18,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  cardWrap: {
    marginBottom: 12,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  exploreBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  exploreBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
