import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { useThemeStore } from '../../stores/theme';
import { FadeInView } from '../../components/FadeInView';
import { useT } from '../../i18n';

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
  const t = useT();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const { isDark } = useThemeStore();
  // Theme-reactive surface colors. Computed once per render — cheap.
  const containerBg = isDark ? '#0a0a0a' : '#FFFFFF';
  const cardBg = isDark ? '#1c1c1e' : '#FFFFFF';
  const surfaceBg = isDark ? '#1a1a1a' : '#F7F8FA';
  const textColor = isDark ? '#FFFFFF' : colors.textPrimary;
  const textSecColor = isDark ? 'rgba(255,255,255,0.65)' : colors.textSecondary;
  const textTertColor = isDark ? 'rgba(255,255,255,0.42)' : colors.textTertiary;
  const dividerBg = isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F6';
  const [category, setCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const nextUrlRef = useRef<string | null>(null);

  const { data: queryData, isLoading, refetch, isRefetching } = useQuery<{ results: CommunityPost[]; next: string | null }>({
    queryKey: ['community-posts', category, searchQuery],
    queryFn: async () => {
      let params = '?';
      if (category) params += `category=${category}&`;
      // Only send q param if search has content (trim to ignore whitespace-only)
      if (searchQuery.trim()) params += `q=${encodeURIComponent(searchQuery.trim())}&`;
      const { data } = await api.get(`/community/posts/${params}`);
      const results = data.results ?? data;
      return { results: Array.isArray(results) ? results : [], next: data.next || null };
    },
    staleTime: 30000,
  });

  // Sync query data into local paginated list whenever category/search changes
  // or cached data is served. Using a useEffect instead of side-effect in
  // queryFn so that cached results also reset the list.
  useEffect(() => {
    if (queryData) {
      setPosts(queryData.results);
      nextUrlRef.current = queryData.next;
      setHasMore(!!queryData.next);
    }
  }, [queryData]);

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
        style={[styles.postCard, { backgroundColor: cardBg, borderBottomColor: dividerBg }]}
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
          <Text style={[styles.postTitle, { color: textColor }]} numberOfLines={2}>{item.title}</Text>

          {/* Meta */}
          <View style={styles.postMeta}>
            <TouchableOpacity
              style={styles.postAuthor}
              onPress={() => navigation.navigate('Profile', { nickname: item.author_nickname })}
              activeOpacity={0.7}>
              {item.author_image ? (
                <Image source={{ uri: item.author_image }} style={styles.miniAvatar} />
              ) : (
                <View style={[styles.miniAvatarPlaceholder, { backgroundColor: surfaceBg }]}>
                  <Text style={{ fontSize: 8, color: textTertColor }}>U</Text>
                </View>
              )}
              <Text style={[styles.postAuthorName, { color: textSecColor }]}>{item.author_nickname}</Text>
              {item.author_level != null && item.author_level > 0 && (
                <View style={styles.lvBadge}>
                  <Text style={styles.lvBadgeText}>Lv.{item.author_level}</Text>
                </View>
              )}
            </TouchableOpacity>
            <Text style={[styles.postTime, { color: textTertColor }]}>{timeAgo(item.created_at)}</Text>
          </View>

          {/* Stats — 심플 아이콘, 리스트에서도 좋아요 가능 */}
          <View style={styles.postStats}>
            <TouchableOpacity style={styles.statBtn} onPress={() => handleLike(item.id)} activeOpacity={0.6}>
              <Feather name="heart" size={14} color={item.is_liked ? '#FF4B4B' : textTertColor} />
              <Text style={[styles.statText, { color: textTertColor }, item.is_liked && { color: '#FF4B4B' }]}>{item.like_count}</Text>
            </TouchableOpacity>
            <View style={styles.statBtn}>
              <Feather name="message-circle" size={14} color={textTertColor} />
              <Text style={[styles.statText, { color: textTertColor }]}>{item.comment_count}</Text>
            </View>
            <View style={styles.statBtn}>
              <Text style={[styles.statText, { color: textTertColor }]}>조회 {item.view_count}</Text>
            </View>
          </View>
        </View>

        {/* Thumbnail */}
        {item.thumbnail && (
          <Image source={{ uri: item.thumbnail }} style={styles.postThumbnail} resizeMode="cover" />
        )}
      </TouchableOpacity>
    </FadeInView>
  ), [category, searchQuery, isAuthenticated, cardBg, dividerBg, textColor, textSecColor, textTertColor, surfaceBg]);

  return (
    <View style={[styles.container, { backgroundColor: containerBg }]}>
      {/* Search bar — controlled by parent */}
      {searchVisible && (
        <View style={[styles.searchBar, { backgroundColor: containerBg, borderBottomColor: dividerBg }]}>
          <View style={[styles.searchInputWrap, { backgroundColor: surfaceBg }]}>
            <Feather name="search" size={16} color={textTertColor} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: textColor }]}
              placeholder={t.community.searchPlaceholder}
              placeholderTextColor={textTertColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={[styles.searchClear, { color: textTertColor }]}>✕</Text>
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
        style={[styles.categoryBar, { backgroundColor: containerBg, borderBottomColor: dividerBg }]}>
        {CATEGORIES.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.categoryChip,
              { backgroundColor: surfaceBg },
              category === item.key && styles.categoryChipActive,
            ]}
            onPress={() => setCategory(item.key)}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.categoryChipText,
                { color: textSecColor },
                category === item.key && styles.categoryChipTextActive,
              ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Posts */}
      {isLoading ? (
        <View style={styles.loadingContainer}><Text style={styles.loadingText}>{t.common.loading}</Text></View>
      ) : posts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: textColor }]}>
            {searchQuery.trim() ? t.community.noPostsSearch : t.community.noPosts}
          </Text>
          <Text style={[styles.emptyDesc, { color: textTertColor }]}>
            {searchQuery.trim() ? t.community.noPostsSearchHint : t.community.noPostsHint}
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPost}
          contentContainerStyle={styles.postList}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: dividerBg }]} />}
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
