import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';
import { Trail } from '../types';

export default function MyTrailsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: trails = [], isLoading, refetch } = useQuery<Trail[]>({
    queryKey: ['my-trails'],
    queryFn: async () => {
      const { data } = await api.get('/trails/', { params: { page_size: 50, ordering: '-created_at' } });
      const results = data.results ?? data;
      return results.filter((t: any) => t.author?.id === user?.id);
    },
    enabled: !!user,
  });

  const handleDelete = (trail: Trail) => {
    Alert.alert(
      '코스 삭제',
      `"${trail.title}"을(를) 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/trails/${trail.id}/`);
              queryClient.invalidateQueries({ queryKey: ['my-trails'] });
              queryClient.invalidateQueries({ queryKey: ['trails'] });
            } catch {
              Alert.alert('오류', '삭제에 실패했습니다.');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: Trail }) => {
    const distStr = item.distance_km ? `${(parseFloat(String(item.distance_km)) || 0).toFixed(1)}km` : '';
    const diffLabel = item.difficulty === 'easy' ? '쉬움' : item.difficulty === 'moderate' ? '보통' : '어려움';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('TrailDetail', { trailId: item.id })}>
        <View style={styles.cardHeader}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {item.status === 'approved' ? '공개' : item.status === 'pending' ? '검토 중' : item.status}
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>삭제</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {item.region || ''} · {distStr} · {diffLabel}
        </Text>
        <Text style={styles.cardDate}>
          {new Date(item.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>내 코스 관리</Text>
        <TouchableOpacity onPress={() => navigation.navigate('TrailCreate')} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ 새 코스</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : trails.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🗺</Text>
          <Text style={styles.emptyTitle}>아직 등록한 코스가 없어요</Text>
          <Text style={styles.emptyDesc}>걸으면서 또는 직접 코스를 만들어보세요!</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => navigation.navigate('TrailCreate')}>
            <Text style={styles.emptyBtnText}>코스 만들기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={trails}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
          onRefresh={refetch}
          refreshing={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  backText: {
    fontSize: 18,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteBtnText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
