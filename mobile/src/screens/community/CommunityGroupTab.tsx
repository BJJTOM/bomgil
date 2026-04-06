import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import api from '../../api/client';
import { colors } from '../../theme/colors';
import { CommunityGroup } from '../../types';
import { FadeInView } from '../../components/FadeInView';

const GROUP_CATEGORIES = [
  { key: '', label: '전체' },
  { key: 'hiking', label: '🏔 등산' },
  { key: 'walking', label: '🚶 산책' },
  { key: 'running', label: '🏃 러닝' },
  { key: 'trail', label: '🥾 트레일' },
  { key: 'photo', label: '📸 사진' },
  { key: 'social', label: '🤝 친목' },
];

export default function CommunityGroupTab() {
  const navigation = useNavigation<any>();
  const [category, setCategory] = useState('');

  const { data: groups = [], isLoading, refetch, isRefetching } = useQuery<CommunityGroup[]>({
    queryKey: ['community-groups', category],
    queryFn: async () => {
      const params = category ? `?category=${category}` : '';
      const { data } = await api.get(`/community/groups/${params}`);
      return data.results ?? data;
    },
  });

  const renderGroup = useCallback(({ item, index }: { item: CommunityGroup; index: number }) => (
    <FadeInView delay={index * 50}>
      <TouchableOpacity
        style={styles.groupCard}
        activeOpacity={0.6}
        onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}>
        {/* Emoji avatar — 토스 스타일 */}
        <View style={styles.groupEmoji}>
          <Text style={styles.groupEmojiText}>{item.emoji}</Text>
        </View>

        <View style={styles.groupInfo}>
          <View style={styles.groupNameRow}>
            <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
            {!item.is_public && <Text style={styles.lockIcon}>🔒</Text>}
          </View>
          <Text style={styles.groupDesc} numberOfLines={2}>{item.description}</Text>
          <View style={styles.groupMeta}>
            <View style={styles.groupMetaItem}>
              <Text style={styles.groupMetaIcon}>👥</Text>
              <Text style={styles.groupMetaText}>
                {item.member_count}{item.max_members > 0 ? `/${item.max_members}` : ''}명
              </Text>
            </View>
            {item.region ? (
              <View style={styles.groupMetaItem}>
                <Text style={styles.groupMetaIcon}>📍</Text>
                <Text style={styles.groupMetaText}>{item.region}</Text>
              </View>
            ) : null}
            <View style={styles.groupMetaItem}>
              <Text style={styles.groupMetaText}>{item.category_display}</Text>
            </View>
          </View>
        </View>

        {/* Join status — 당근 스타일 버튼 */}
        {item.is_member ? (
          <View style={styles.joinedBadge}>
            <Text style={styles.joinedBadgeText}>참여중</Text>
          </View>
        ) : (
          <View style={styles.joinBtn}>
            <Text style={styles.joinBtnText}>참여</Text>
          </View>
        )}
      </TouchableOpacity>
    </FadeInView>
  ), []);

  return (
    <View style={styles.container}>
      {/* Category filter */}
      <FlatList
        data={GROUP_CATEGORIES}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.categoryChip, category === item.key && styles.categoryChipActive]}
            onPress={() => setCategory(item.key)}
            activeOpacity={0.7}>
            <Text style={[styles.categoryChipText, category === item.key && styles.categoryChipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
        style={styles.categoryBar}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>모임 불러오는 중...</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>아직 모임이 없어요</Text>
          <Text style={styles.emptyDesc}>첫 번째 모임을 만들어보세요</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderGroup}
          contentContainerStyle={styles.groupList}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: colors.textTertiary },

  categoryBar: { flexGrow: 0 },
  categoryList: { paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryChipText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  categoryChipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  groupList: { paddingBottom: 100 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#F2F4F6', marginHorizontal: 20 },

  // Group card — 토스/당근 스타일
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  groupEmoji: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  groupEmojiText: { fontSize: 24 },

  groupInfo: { flex: 1, marginRight: 12 },
  groupNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  groupName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  lockIcon: { fontSize: 12 },
  groupDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 6 },

  groupMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  groupMetaIcon: { fontSize: 11 },
  groupMetaText: { fontSize: 11, color: colors.textTertiary },

  // Join buttons
  joinedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F0F7F0',
  },
  joinedBadgeText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  joinBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  joinBtnText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: colors.textTertiary, textAlign: 'center' },
});
