import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  StatusBar,
  Alert,
  Share,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { WalkStory } from '../types';
import { useAuthStore } from '../stores/auth';
import { FadeInView } from '../components/FadeInView';

function LikeButton({ isLiked, onPress }: { isLiked: boolean; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity style={styles.actionBtn} onPress={handlePress}>
      <Animated.Text style={[styles.actionIcon, isLiked && styles.actionIconLiked, { transform: [{ scale: scaleAnim }] }]}>
        {isLiked ? '\u2764\uFE0F' : '\u{1F90D}'}
      </Animated.Text>
      <Text style={[styles.actionLabel, isLiked && styles.actionLabelLiked]}>
        좋아요
      </Text>
    </TouchableOpacity>
  );
}

const MOOD_MAP: Record<string, { emoji: string; label: string; bg: string; text: string }> = {
  happy: { emoji: '\u{1F60A}', label: '행복해요', bg: '#FFFBEB', text: '#B45309' },
  peaceful: { emoji: '\u262E\uFE0F', label: '평화로워요', bg: '#EFF6FF', text: '#1D4ED8' },
  exciting: { emoji: '\u{1F929}', label: '신나요', bg: '#FFF7ED', text: '#C2410C' },
  touching: { emoji: '\u{1F979}', label: '감동이에요', bg: '#FDF2F8', text: '#BE185D' },
  funny: { emoji: '\u{1F604}', label: '재밌어요', bg: '#F0FDF4', text: '#15803D' },
};

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  const { data: stories = [], isLoading, refetch, isRefetching } = useQuery<WalkStory[]>({
    queryKey: ['community-feed'],
    queryFn: async () => {
      const { data } = await api.get('/stories/');
      return data.results ?? data;
    },
  });

  const handleLike = (storyId: number) => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    // Optimistic: update local state immediately
    queryClient.setQueryData(['community-feed'], (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map((s: any) =>
        s.id === storyId
          ? { ...s, is_liked: !s.is_liked, like_count: s.is_liked ? s.like_count - 1 : s.like_count + 1 }
          : s,
      );
    });
    api.post(`/stories/${storyId}/like/`).catch(() => {
      queryClient.invalidateQueries({ queryKey: ['community-feed'] });
    });
  };

  const handleShare = (story: WalkStory) => {
    Share.share({
      message: `${story.title || ''}\n${story.content.slice(0, 100)}...\n\nRoami에서 확인하세요!`,
    });
  };

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

  const ExpandableContent = ({ content, storyId }: { content: string; storyId: number }) => {
    const [expanded, setExpanded] = useState(false);
    const isLong = content.length > 150;

    return (
      <View>
        <Text style={styles.storyContent}>
          {isLong && !expanded ? content.slice(0, 150) + '...' : content}
        </Text>
        {isLong && !expanded && (
          <TouchableOpacity onPress={() => setExpanded(true)}>
            <Text style={styles.showMoreText}>더보기</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderStory = ({ item, index }: { item: WalkStory; index: number }) => {
    const mood = MOOD_MAP[item.mood];
    const photos = item.photos || [];

    return (
    <FadeInView delay={index * 60}>
      <TouchableOpacity
        style={styles.storyCard}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('StoryDetail', { id: item.id })}>
        {/* Author Header */}
        <View style={styles.authorRow}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarInner}>
              {item.author.profile_image ? (
                <Image source={{ uri: item.author.profile_image }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarFallback}>{'\u{1F464}'}</Text>
              )}
            </View>
          </View>
          <View style={styles.authorInfo}>
            <View style={styles.authorNameRow}>
              <Text style={styles.authorName}>{item.author.nickname}</Text>
              {(item.author as any).is_verified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedCheck}>{'\u2713'}</Text>
                </View>
              )}
            </View>
            <View style={styles.authorMeta}>
              {item.trail_id && item.trail_title && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('TrailDetail', { trailId: item.trail_id })}>
                  <Text style={styles.trailLink} numberOfLines={1}>
                    {item.trail_region} · {item.trail_title}
                  </Text>
                </TouchableOpacity>
              )}
              {item.trail_id && <Text style={styles.metaDot}> · </Text>}
              <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentSection}>
          {mood && (
            <View style={[styles.moodTag, { backgroundColor: mood.bg }]}>
              <Text style={[styles.moodText, { color: mood.text }]}>
                {mood.emoji} {mood.label}
              </Text>
            </View>
          )}
          {item.title ? (
            <Text style={styles.storyTitle}>{item.title}</Text>
          ) : null}
          <ExpandableContent content={item.content} storyId={item.id} />
        </View>

        {/* Photo Grid */}
        {photos.length === 1 && (
          <Image
            source={{ uri: photos[0].image }}
            style={styles.singlePhoto}
            resizeMode="cover"
          />
        )}
        {photos.length === 2 && (
          <View style={styles.twoPhotos}>
            {photos.map((p) => (
              <Image
                key={p.id}
                source={{ uri: p.image }}
                style={styles.twoPhotoItem}
                resizeMode="cover"
              />
            ))}
          </View>
        )}
        {photos.length >= 3 && (
          <View style={styles.threePhotos}>
            <Image
              source={{ uri: photos[0].image }}
              style={styles.threePhotoMain}
              resizeMode="cover"
            />
            <View style={styles.threePhotoSide}>
              <Image
                source={{ uri: photos[1].image }}
                style={styles.threePhotoSmall}
                resizeMode="cover"
              />
              <View>
                <Image
                  source={{ uri: photos[2].image }}
                  style={styles.threePhotoSmall}
                  resizeMode="cover"
                />
                {photos.length > 3 && (
                  <View style={styles.moreOverlay}>
                    <Text style={styles.moreText}>+{photos.length - 3}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Engagement Stats */}
        {(item.like_count > 0 || item.comment_count > 0) && (
          <View style={styles.engagementRow}>
            {item.like_count > 0 && (
              <View style={styles.engagementItem}>
                <View style={styles.likeCountBadge}>
                  <Text style={styles.likeCountIcon}>{'\u2764'}</Text>
                </View>
                <Text style={styles.engagementText}>
                  좋아요 {item.like_count}개
                </Text>
              </View>
            )}
            {item.comment_count > 0 && (
              <TouchableOpacity
                style={styles.commentCountBtn}
                onPress={() => navigation.navigate('StoryDetail', { id: item.id })}>
                <Text style={styles.engagementText}>
                  댓글 {item.comment_count}개
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <LikeButton isLiked={item.is_liked} onPress={() => handleLike(item.id)} />

          <View style={styles.actionDivider} />

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('StoryDetail', { id: item.id })}>
            <Text style={styles.actionIcon}>{'\u{1F4AC}'}</Text>
            <Text style={styles.actionLabel}>댓글</Text>
          </TouchableOpacity>

          <View style={styles.actionDivider} />

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleShare(item)}>
            <Text style={styles.actionIcon}>{'\u2B06\uFE0F'}</Text>
            <Text style={styles.actionLabel}>공유</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </FadeInView>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Sticky Header — no write button, just notification + chat */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>커뮤니티</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => Alert.alert('알림', '알림 기능 준비중입니다')}>
            <Text style={styles.iconBtnEmoji}>{'\u{1F514}'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Chat')}>
            <Text style={styles.iconBtnEmoji}>{'\u{1F4AC}'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingDots}>
            <View style={[styles.loadingDot, { opacity: 0.6 }]} />
            <View style={[styles.loadingDot, { opacity: 0.8 }]} />
            <View style={[styles.loadingDot, { opacity: 1 }]} />
          </View>
          <Text style={styles.loadingText}>로딩 중...</Text>
        </View>
      ) : stories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>{'\u{1F4DD}'}</Text>
            </View>
            <Text style={styles.emptyTitle}>아직 스토리가 없어요</Text>
            <Text style={styles.emptyDesc}>
              {'첫 번째 걷기 이야기를\n공유해보세요'}
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('Explore')}>
              <Text style={styles.emptyBtnText}>트레일 탐색하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={stories}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderStory}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* FAB — smaller, positioned to clear tab bar */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate(isAuthenticated ? 'CommunityWrite' : 'Login')
        }>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.warm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnEmoji: {
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  storyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F4F6',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 2,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  avatarInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    fontSize: 18,
  },
  authorInfo: {
    flex: 1,
    minWidth: 0,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedCheck: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
  },
  authorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  trailLink: {
    fontSize: 12,
    color: colors.textTertiary,
    maxWidth: 160,
  },
  metaDot: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  timeText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  contentSection: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  moodTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
  },
  moodText: {
    fontSize: 11,
    fontWeight: '600',
  },
  storyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: 6,
  },
  storyContent: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 24,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textTertiary,
    marginTop: 4,
  },
  singlePhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  twoPhotos: {
    flexDirection: 'row',
    gap: 2,
  },
  twoPhotoItem: {
    flex: 1,
    aspectRatio: 1,
  },
  threePhotos: {
    flexDirection: 'row',
    gap: 2,
    height: 200,
  },
  threePhotoMain: {
    flex: 1,
    height: '100%',
  },
  threePhotoSide: {
    flex: 1,
    gap: 2,
  },
  threePhotoSmall: {
    flex: 1,
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likeCountBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF4B4B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeCountIcon: {
    fontSize: 9,
    color: '#fff',
  },
  engagementText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  commentCountBtn: {
    marginLeft: 'auto',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    marginHorizontal: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  actionDivider: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    backgroundColor: colors.borderDefault,
  },
  actionIcon: {
    fontSize: 16,
  },
  actionIconLiked: {},
  actionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  actionLabelLiked: {
    color: '#FF4B4B',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 24,
  },
  emptyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 24,
  },
});
