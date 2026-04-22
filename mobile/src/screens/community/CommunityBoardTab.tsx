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
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import api from '../../api/client';
import { colors } from '../../theme/colors';
import { CommunityPost } from '../../types';
import { useAuthStore } from '../../stores/auth';
import { useThemeStore } from '../../stores/theme';
import { FadeInView } from '../../components/FadeInView';
import { useT } from '../../i18n';

// Category definitions with colored pills
const CATEGORY_STYLES: Record<string, { bg: string; darkBg: string; text: string; darkText: string }> = {
  free:      { bg: '#EFF6FF', darkBg: 'rgba(59,130,246,0.15)', text: '#3B82F6', darkText: '#60A5FA' },
  qna:       { bg: '#FEF3C7', darkBg: 'rgba(245,158,11,0.15)', text: '#D97706', darkText: '#FBBF24' },
  recommend: { bg: '#F0FDF4', darkBg: 'rgba(34,197,94,0.15)',  text: '#16A34A', darkText: '#4ADE80' },
  review:    { bg: '#FDF2F8', darkBg: 'rgba(236,72,153,0.15)', text: '#DB2777', darkText: '#F472B6' },
  meetup:    { bg: '#FFF7ED', darkBg: 'rgba(249,115,22,0.15)', text: '#EA580C', darkText: '#FB923C' },
  tip:       { bg: '#F5F3FF', darkBg: 'rgba(139,92,246,0.15)', text: '#7C3AED', darkText: '#A78BFA' },
};

const CATEGORIES = [
  { key: '', label: '전체' },
  { key: 'free', label: '자유' },
  { key: 'qna', label: '질문' },
  { key: 'recommend', label: '코스추천' },
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

// ── Category Badge ──
function CategoryBadge({ category, isDark }: { category: string; isDark: boolean }) {
  const style = CATEGORY_STYLES[category];
  if (!style) return null;
  const label = CATEGORIES.find((c) => c.key === category)?.label ?? category;
  return (
    <View style={[styles.badge, { backgroundColor: isDark ? style.darkBg : style.bg }]}>
      <Text style={[styles.badgeText, { color: isDark ? style.darkText : style.text }]}>{label}</Text>
    </View>
  );
}

// ── Post Card (photo-first) ──
const PostCard = React.memo(function PostCard({
  item,
  index,
  isDark,
  cardBg,
  textColor,
  textSecColor,
  textTertColor,
  surfaceBg,
  textPreviewBg,
  shadowColor,
  onPress,
  onLike,
  onProfilePress,
}: {
  item: CommunityPost;
  index: number;
  isDark: boolean;
  cardBg: string;
  textColor: string;
  textSecColor: string;
  textTertColor: string;
  surfaceBg: string;
  textPreviewBg: string;
  shadowColor: string;
  onPress: () => void;
  onLike: () => void;
  onProfilePress: () => void;
}) {
  const hasPhoto = !!(item.thumbnail || (item.images && item.images.length > 0));
  const photoUri = item.thumbnail || (item.images && item.images.length > 0 ? item.images[0].image : null);

  return (
    <FadeInView delay={Math.min(index * 40, 200)}>
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            shadowColor,
          },
          isDark && styles.cardDark,
        ]}
        activeOpacity={0.7}
        onPress={onPress}>

        {/* Photo area */}
        {hasPhoto && photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={styles.cardPhoto}
            resizeMode="cover"
          />
        ) : (
          /* Text preview when no photo */
          <View style={[styles.cardTextPreview, { backgroundColor: textPreviewBg }]}>
            <Text style={[styles.cardTextPreviewContent, { color: textSecColor }]} numberOfLines={3}>
              {item.content || item.title}
            </Text>
          </View>
        )}

        {/* Card body */}
        <View style={styles.cardBody}>
          {/* Author row (top) */}
          <TouchableOpacity
            style={styles.authorRow}
            activeOpacity={0.7}
            onPress={onProfilePress}>
            {item.author_image ? (
              <Image source={{ uri: item.author_image }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: surfaceBg }]}>
                <Feather name="user" size={14} color={textTertColor} />
              </View>
            )}
            <View style={styles.authorInfo}>
              <View style={styles.authorNameRow}>
                <Text style={[styles.authorName, { color: textColor }]}>{item.author_nickname}</Text>
                {item.author_level != null && item.author_level > 0 && (
                  <View style={[styles.lvBadge, isDark && { backgroundColor: 'rgba(74,222,128,0.12)' }]}>
                    <Text style={[styles.lvBadgeText, isDark && { color: '#4ADE80' }]}>Lv.{item.author_level}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.timeText, { color: textTertColor }]}>{timeAgo(item.created_at)}</Text>
            </View>
            <CategoryBadge category={item.category} isDark={isDark} />
          </TouchableOpacity>

          {/* Title */}
          <Text style={[styles.cardTitle, { color: textColor }]} numberOfLines={2}>
            {item.title}
          </Text>

          {/* Pinned indicator */}
          {item.is_pinned && (
            <View style={[styles.pinnedRow]}>
              <Feather name="bookmark" size={11} color="#C2410C" />
              <Text style={styles.pinnedText}>고정됨</Text>
            </View>
          )}

          {/* Footer: likes + comments */}
          <View style={[styles.cardFooter, isDark && { borderTopColor: 'rgba(255,255,255,0.06)' }]}>
            <TouchableOpacity
              style={styles.footerBtn}
              onPress={onLike}
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather
                name="heart"
                size={16}
                color={item.is_liked ? '#FF4B4B' : textTertColor}
              />
              <Text
                style={[
                  styles.footerCount,
                  { color: textTertColor },
                  item.is_liked && { color: '#FF4B4B' },
                ]}>
                {item.like_count}
              </Text>
            </TouchableOpacity>

            <View style={styles.footerBtn}>
              <Feather name="message-circle" size={16} color={textTertColor} />
              <Text style={[styles.footerCount, { color: textTertColor }]}>
                {item.comment_count}
              </Text>
            </View>

            <View style={styles.footerSpacer} />

            <Text style={[styles.footerViews, { color: textTertColor }]}>
              조회 {item.view_count}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </FadeInView>
  );
});

// ── Empty State ──
function EmptyState({
  isSearch,
  textColor,
  textTertColor,
  surfaceBg,
  onWrite,
  t,
}: {
  isSearch: boolean;
  textColor: string;
  textTertColor: string;
  surfaceBg: string;
  onWrite: () => void;
  t: any;
}) {
  return (
    <View style={styles.emptyContainer}>
      {/* Illustration area */}
      <View style={[styles.emptyIllustration, { backgroundColor: surfaceBg }]}>
        <Feather
          name={isSearch ? 'search' : 'edit-3'}
          size={40}
          color={textTertColor}
        />
      </View>
      <Text style={[styles.emptyTitle, { color: textColor }]}>
        {isSearch ? t.community.noPostsSearch : '첫 번째 글을 남겨보세요'}
      </Text>
      <Text style={[styles.emptyDesc, { color: textTertColor }]}>
        {isSearch
          ? t.community.noPostsSearchHint
          : '산책 사진, 코스 후기, 걷기 꿀팁을\n자유롭게 공유해보세요'}
      </Text>
      {!isSearch && (
        <TouchableOpacity style={styles.emptyCta} onPress={onWrite} activeOpacity={0.8}>
          <Feather name="plus" size={16} color="#FFFFFF" />
          <Text style={styles.emptyCtaText}>글 작성하기</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main Component ──
export default function CommunityBoardTab({ searchVisible = false }: { searchVisible?: boolean }) {
  const t = useT();
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAuthStore();
  const { isDark } = useThemeStore();

  // Theme colors
  const containerBg = isDark ? '#0a0a0a' : '#F7F8FA';
  const cardBg = isDark ? '#1c1c1e' : '#FFFFFF';
  const surfaceBg = isDark ? '#2a2a2a' : '#F2F4F6';
  const textColor = isDark ? '#FFFFFF' : colors.textPrimary;
  const textSecColor = isDark ? 'rgba(255,255,255,0.65)' : colors.textSecondary;
  const textTertColor = isDark ? 'rgba(255,255,255,0.42)' : colors.textTertiary;
  const textPreviewBg = isDark ? '#1a1a1a' : '#F7F8FA';
  const shadowColor = isDark ? 'transparent' : '#000';
  const chipBg = isDark ? '#1c1c1e' : '#FFFFFF';
  const chipBorder = isDark ? 'rgba(255,255,255,0.08)' : '#E5E8EB';
  const chipActiveBg = colors.primary;
  const searchBarBg = isDark ? '#0a0a0a' : '#F7F8FA';
  const searchInputBg = isDark ? '#1c1c1e' : '#FFFFFF';

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
      if (searchQuery.trim()) params += `q=${encodeURIComponent(searchQuery.trim())}&`;
      const { data } = await api.get(`/community/posts/${params}`);
      const results = data.results ?? data;
      return { results: Array.isArray(results) ? results : [], next: data.next || null };
    },
    staleTime: 30000,
  });

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
      setPosts(prevPosts);
    });
  }, [isAuthenticated, navigation]);

  const handleWrite = useCallback(() => {
    if (!isAuthenticated) { navigation.navigate('Login'); return; }
    navigation.navigate('PostCreate');
  }, [isAuthenticated, navigation]);

  const renderPost = useCallback(({ item, index }: { item: CommunityPost; index: number }) => (
    <PostCard
      item={item}
      index={index}
      isDark={isDark}
      cardBg={cardBg}
      textColor={textColor}
      textSecColor={textSecColor}
      textTertColor={textTertColor}
      surfaceBg={surfaceBg}
      textPreviewBg={textPreviewBg}
      shadowColor={shadowColor}
      onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
      onLike={() => handleLike(item.id)}
      onProfilePress={() => navigation.navigate('Profile', { nickname: item.author_nickname })}
    />
  ), [isDark, cardBg, textColor, textSecColor, textTertColor, surfaceBg, textPreviewBg, shadowColor, handleLike, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: containerBg }]}>
      {/* Search bar */}
      {searchVisible && (
        <View style={[styles.searchBar, { backgroundColor: searchBarBg }]}>
          <View style={[styles.searchInputWrap, { backgroundColor: searchInputBg }, isDark && { borderColor: 'rgba(255,255,255,0.06)', borderWidth: 1 }]}>
            <Feather name="search" size={16} color={textTertColor} style={{ marginRight: 8 }} />
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
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={16} color={textTertColor} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
        style={styles.categoryBar}>
        {CATEGORIES.map((item) => {
          const isActive = category === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.categoryChip,
                { backgroundColor: chipBg, borderColor: chipBorder },
                isActive && { backgroundColor: chipActiveBg, borderColor: chipActiveBg },
              ]}
              onPress={() => setCategory(item.key)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.categoryChipText,
                  { color: textSecColor },
                  isActive && styles.categoryChipTextActive,
                ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: textTertColor, marginTop: 8 }]}>{t.common.loading}</Text>
        </View>
      ) : posts.length === 0 ? (
        <EmptyState
          isSearch={!!searchQuery.trim()}
          textColor={textColor}
          textTertColor={textTertColor}
          surfaceBg={surfaceBg}
          onWrite={handleWrite}
          t={t}
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPost}
          contentContainerStyle={styles.postList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
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

// ── Styles ──
const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14 },

  // Search
  searchBar: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },

  // Category chips
  categoryBar: { flexShrink: 0, flexGrow: 0 },
  categoryList: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center' },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: { fontSize: 13, fontWeight: '500' },
  categoryChipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  // Post list
  postList: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 },

  // Card
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardDark: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  // Card photo
  cardPhoto: {
    width: '100%',
    height: 200,
    backgroundColor: '#F2F4F6',
  },

  // Text preview (no photo)
  cardTextPreview: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 24,
    minHeight: 100,
    justifyContent: 'center',
  },
  cardTextPreviewContent: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },

  // Card body
  cardBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },

  // Author row
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorInfo: {
    flex: 1,
    marginLeft: 10,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
  },
  lvBadge: {
    backgroundColor: colors.primary50,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  lvBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
  },
  timeText: {
    fontSize: 12,
    marginTop: 1,
  },

  // Category badge (colored pill)
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Card title
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 8,
  },

  // Pinned
  pinnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  pinnedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#C2410C',
  },

  // Card footer
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 16,
  },
  footerCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  footerSpacer: { flex: 1 },
  footerViews: {
    fontSize: 12,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIllustration: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyCtaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  loadingMore: { paddingVertical: 20, alignItems: 'center' },
});
