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
import { CommunityPost } from '../../types';
import { FadeInView } from '../../components/FadeInView';

const CATEGORIES = [
  { key: '', label: '전체', icon: '📋' },
  { key: 'free', label: '자유', icon: '💭' },
  { key: 'qna', label: '질문', icon: '❓' },
  { key: 'recommend', label: '추천', icon: '👍' },
  { key: 'review', label: '후기', icon: '⭐' },
  { key: 'meetup', label: '번개', icon: '⚡' },
  { key: 'tip', label: '꿀팁', icon: '🍯' },
];

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR');
};

export default function CommunityBoardTab() {
  const navigation = useNavigation<any>();
  const [category, setCategory] = useState('');

  const { data: posts = [], isLoading, refetch, isRefetching } = useQuery<CommunityPost[]>({
    queryKey: ['community-posts', category],
    queryFn: async () => {
      const params = category ? `?category=${category}` : '';
      const { data } = await api.get(`/community/posts/${params}`);
      return data.results ?? data;
    },
  });

  const renderCategory = useCallback(({ item }: { item: typeof CATEGORIES[0] }) => (
    <TouchableOpacity
      style={[styles.categoryChip, category === item.key && styles.categoryChipActive]}
      onPress={() => setCategory(item.key)}
      activeOpacity={0.7}>
      <Text style={[styles.categoryChipText, category === item.key && styles.categoryChipTextActive]}>
        {item.icon} {item.label}
      </Text>
    </TouchableOpacity>
  ), [category]);

  const renderPost = useCallback(({ item, index }: { item: CommunityPost; index: number }) => (
    <FadeInView delay={index * 40}>
      <TouchableOpacity
        style={styles.postCard}
        activeOpacity={0.6}
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}>
        <View style={styles.postContent}>
          {/* Category badge */}
          <View style={styles.postHeader}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{item.category_display}</Text>
            </View>
            {item.is_pinned && (
              <View style={styles.pinnedBadge}>
                <Text style={styles.pinnedBadgeText}>📌 고정</Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>

          {/* Meta */}
          <View style={styles.postMeta}>
            <View style={styles.postAuthor}>
              {item.author_image ? (
                <Image source={{ uri: item.author_image }} style={styles.miniAvatar} />
              ) : (
                <View style={styles.miniAvatarPlaceholder}>
                  <Text style={{ fontSize: 10 }}>👤</Text>
                </View>
              )}
              <Text style={styles.postAuthorName}>{item.author_nickname}</Text>
            </View>
            <Text style={styles.postTime}>{timeAgo(item.created_at)}</Text>
          </View>

          {/* Stats */}
          <View style={styles.postStats}>
            <Text style={styles.postStat}>♡ {item.like_count}</Text>
            <Text style={styles.postStat}>💬 {item.comment_count}</Text>
            <Text style={styles.postStat}>👁 {item.view_count}</Text>
          </View>
        </View>

        {/* Thumbnail */}
        {item.thumbnail && (
          <Image source={{ uri: item.thumbnail }} style={styles.postThumbnail} resizeMode="cover" />
        )}
      </TouchableOpacity>
    </FadeInView>
  ), []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Category filter — 당근 스타일 horizontal pills */}
      <FlatList
        data={CATEGORIES}
        keyExtractor={(item) => item.key}
        renderItem={renderCategory}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
        style={styles.categoryBar}
      />

      {/* Posts */}
      {posts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>아직 게시글이 없어요</Text>
          <Text style={styles.emptyDesc}>첫 번째 글을 작성해보세요</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPost}
          contentContainerStyle={styles.postList}
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

  // Category pills
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
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Post list
  postList: { paddingBottom: 100 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#F2F4F6', marginHorizontal: 20 },

  // Post card — 당근마켓 스타일 (리스트 아이템)
  postCard: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  postContent: { flex: 1, marginRight: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#F0F7F0',
  },
  categoryBadgeText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  pinnedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#FFF7ED',
  },
  pinnedBadgeText: { fontSize: 10, color: '#C2410C' },

  postTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: 8,
  },

  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  postAuthor: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniAvatar: { width: 18, height: 18, borderRadius: 9 },
  miniAvatarPlaceholder: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center' },
  postAuthorName: { fontSize: 12, color: colors.textSecondary },
  postTime: { fontSize: 11, color: colors.textTertiary },

  postStats: { flexDirection: 'row', gap: 10 },
  postStat: { fontSize: 11, color: colors.textTertiary },

  postThumbnail: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#F7F8FA',
  },

  // Empty
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: colors.textTertiary, textAlign: 'center' },
});
