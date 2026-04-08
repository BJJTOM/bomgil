import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import api from '../../api/client';
import { colors } from '../../theme/colors';
import { CommunityPost } from '../../types';
import { useAuthStore } from '../../stores/auth';
import { FadeInView } from '../../components/FadeInView';

const CATEGORIES = [
  { key: '', label: '전체' },
  { key: 'free', label: '자유' },
  { key: 'qna', label: '질문' },
  { key: 'recommend', label: '추천' },
  { key: 'review', label: '후기' },
  { key: 'meetup', label: '번개' },
  { key: 'tip', label: '꿀팁' },
];

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR');
};

export default function CommunityBoardTab({ searchVisible = false }: { searchVisible?: boolean }) {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const [category, setCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const nextUrlRef = useRef<string | null>(null);

  const { isLoading, refetch, isRefetching } = useQuery<CommunityPost[]>({
    queryKey: ['community-posts', category, searchQuery],
    queryFn: async () => {
      let params = '?';
      if (category) params += `category=${category}&`;
      if (searchQuery) params += `q=${encodeURIComponent(searchQuery)}&`;
      const { data } = await api.get(`/community/posts/${params}`);
      const results = data.results ?? data;
      setPosts(results);
      nextUrlRef.current = data.next || null;
      setHasMore(!!data.next);
      return results;
    },
    staleTime: 30000,
  });

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !nextUrlRef.current) return;
    setLoadingMore(true);
    try {
      const { data } = await api.get(nextUrlRef.current.replace(/^https?:\/\/[^/]+\/api\/v1/, ''));
      const results = data.results ?? data;
      if (Array.isArray(results) && results.length > 0) {
        setPosts((prev) => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPosts = results.filter((p: CommunityPost) => !existingIds.has(p.id));
          return [...prev, ...newPosts];
        });
        nextUrlRef.current = data.next || null;
        setHasMore(!!data.next);
      } else {
        setHasMore(false);
      }
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, category, searchQuery]);

  const handleLike = useCallback((postId: number) => {
    if (!isAuthenticated) { navigation.navigate('Login'); return; }
    // Snapshot previous state for rollback
    let prevPosts: CommunityPost[] = [];
    setPosts((old) => {
      prevPosts = old;
      return old.map((p) =>
        p.id === postId
          ? { ...p, is_liked: !p.is_liked, like_count: p.is_liked ? Math.max(0, p.like_count - 1) : p.like_count + 1 }
          : p,
      );
    });
    api.post(`/community/posts/${postId}/like/`).catch(() => {
      // Rollback on error
      setPosts(prevPosts);
    });
  }, [isAuthenticated, navigation]);

  const renderPost = useCallback(({ item, index }: { item: CommunityPost; index: number }) => (
    <FadeInView delay={index * 30}>
      <TouchableOpacity
        style={styles.postCard}
        activeOpacity={0.6}
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}>
        <View style={styles.postContent}>
          {/* Header */}
          <View style={styles.postHeader}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{item.category_display}</Text>
            </View>
            {item.is_pinned && (
              <View style={styles.pinnedBadge}><Text style={styles.pinnedBadgeText}>고정</Text></View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>

          {/* Meta */}
          <View style={styles.postMeta}>
            <TouchableOpacity
              style={styles.postAuthor}
              onPress={() => navigation.navigate('Profile', { nickname: item.author_nickname })}
              activeOpacity={0.7}>
              {item.author_image ? (
                <Image source={{ uri: item.author_image }} style={styles.miniAvatar} />
              ) : (
                <View style={styles.miniAvatarPlaceholder}><Text style={{ fontSize: 8, color: colors.textTertiary }}>U</Text></View>
              )}
              <Text style={styles.postAuthorName}>{item.author_nickname}</Text>
              {item.author_level != null && item.author_level > 0 && (
                <View style={styles.lvBadge}>
                  <Text style={styles.lvBadgeText}>Lv.{item.author_level}</Text>
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.postTime}>{timeAgo(item.created_at)}</Text>
          </View>

          {/* Stats — 심플 아이콘, 리스트에서도 좋아요 가능 */}
          <View style={styles.postStats}>
            <TouchableOpacity style={styles.statBtn} onPress={() => handleLike(item.id)} activeOpacity={0.6}>
              <Feather name="heart" size={14} color={item.is_liked ? '#FF4B4B' : colors.textTertiary} />
              <Text style={[styles.statText, item.is_liked && { color: '#FF4B4B' }]}>{item.like_count}</Text>
            </TouchableOpacity>
            <View style={styles.statBtn}>
              <Feather name="message-circle" size={14} color={colors.textTertiary} />
              <Text style={styles.statText}>{item.comment_count}</Text>
            </View>
            <View style={styles.statBtn}>
              <Text style={styles.statText}>조회 {item.view_count}</Text>
            </View>
          </View>
        </View>

        {/* Thumbnail */}
        {item.thumbnail && (
          <Image source={{ uri: item.thumbnail }} style={styles.postThumbnail} resizeMode="cover" />
        )}
      </TouchableOpacity>
    </FadeInView>
  ), [category, searchQuery, isAuthenticated]);

  return (
    <View style={styles.container}>
      {/* Search bar — controlled by parent */}
      {searchVisible && (
        <View style={styles.searchBar}>
          <View style={styles.searchInputWrap}>
            <Feather name="search" size={16} color={colors.textTertiary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="게시글 검색"
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.searchClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Category filter — horizontal scroll, 잘리지 않게 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
        style={styles.categoryBar}>
        {CATEGORIES.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.categoryChip, category === item.key && styles.categoryChipActive]}
            onPress={() => setCategory(item.key)}
            activeOpacity={0.7}>
            <Text style={[styles.categoryChipText, category === item.key && styles.categoryChipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Posts */}
      {isLoading ? (
        <View style={styles.loadingContainer}><Text style={styles.loadingText}>로딩 중...</Text></View>
      ) : posts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>
            {searchQuery ? `'${searchQuery}' 검색 결과가 없어요` : '아직 게시글이 없어요'}
          </Text>
          <Text style={styles.emptyDesc}>
            {searchQuery ? '다른 키워드로 검색해보세요' : '첫 번째 글을 작성해보세요'}
          </Text>
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
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: colors.textTertiary },

  // Search
  searchBar: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4 },
  searchInputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F8FA',
    borderRadius: 12, paddingHorizontal: 12, height: 40,
  },
  searchIcon: { fontSize: 13, fontWeight: '700', color: colors.textTertiary, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, paddingVertical: 0 },
  searchClear: { fontSize: 14, color: colors.textTertiary, padding: 4 },

  // Category — must not clip
  categoryBar: { flexShrink: 0, flexGrow: 0 },
  categoryList: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' },
  categoryChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#F7F8FA',
  },
  categoryChipActive: { backgroundColor: colors.primary },
  categoryChipText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  categoryChipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  // Post list
  postList: { paddingBottom: 100 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#F2F4F6', marginHorizontal: 20 },

  // Post card
  postCard: {
    flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF',
  },
  postContent: { flex: 1, marginRight: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: '#F0F7F0' },
  categoryBadgeText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  pinnedBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#FFF7ED' },
  pinnedBadgeText: { fontSize: 10, fontWeight: '600', color: '#C2410C' },
  postTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, lineHeight: 22, marginBottom: 8 },

  postMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  postAuthor: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniAvatar: { width: 16, height: 16, borderRadius: 8 },
  miniAvatarPlaceholder: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center' },
  postAuthorName: { fontSize: 12, color: colors.textSecondary },
  lvBadge: {
    backgroundColor: colors.primary50,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 2,
  },
  lvBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
  },
  postTime: { fontSize: 11, color: colors.textTertiary },

  // Stats — 심플 아이콘, 사이즈 업
  postStats: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  statBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statIcon: { fontSize: 15, color: colors.textTertiary },
  statText: { fontSize: 12, color: colors.textTertiary },

  postThumbnail: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#F7F8FA' },

  // Empty
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 6, textAlign: 'center' },
  emptyDesc: { fontSize: 13, color: colors.textTertiary, textAlign: 'center' },
  loadingMore: { paddingVertical: 20, alignItems: 'center' },
});
