import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Share,
  Animated,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import api from '../../api/client';
import { colors } from '../../theme/colors';
import { WalkStory } from '../../types';
import { useAuthStore } from '../../stores/auth';
import { FadeInView } from '../../components/FadeInView';

const MOOD_MAP: Record<string, { emoji: string; label: string; bg: string; text: string }> = {
  happy: { emoji: '😊', label: '행복해요', bg: '#FFFBEB', text: '#B45309' },
  peaceful: { emoji: '☮️', label: '평화로워요', bg: '#EFF6FF', text: '#1D4ED8' },
  exciting: { emoji: '🤩', label: '신나요', bg: '#FFF7ED', text: '#C2410C' },
  touching: { emoji: '🥹', label: '감동이에요', bg: '#FDF2F8', text: '#BE185D' },
  funny: { emoji: '😄', label: '재밌어요', bg: '#F0FDF4', text: '#15803D' },
};

function ExpandableContent({ content }: { content: string }) {
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
}

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
    <TouchableOpacity style={styles.actionBtn} onPress={handlePress} activeOpacity={0.7}>
      <Animated.Text style={[styles.actionLabel, { transform: [{ scale: scaleAnim }] }, isLiked && { color: '#ED4956' }]}>
        {isLiked ? '♥' : '♡'} 좋아요
      </Animated.Text>
    </TouchableOpacity>
  );
}

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

export default function CommunityFeedTab() {
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

  const handleLike = useCallback((storyId: number) => {
    if (!isAuthenticated) { navigation.navigate('Login'); return; }
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
  }, [isAuthenticated]);

  const renderStory = ({ item, index }: { item: WalkStory; index: number }) => {
    const mood = MOOD_MAP[item.mood];
    const photos = item.photos || [];

    return (
      <FadeInView delay={index * 60}>
        <TouchableOpacity
          style={styles.postContainer}
          activeOpacity={0.95}
          onPress={() => navigation.navigate('StoryDetail', { id: item.id })}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              {item.author.profile_image ? (
                <Image source={{ uri: item.author.profile_image }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarFallback}>👤</Text>
              )}
            </View>
            <View style={styles.authorInfo}>
              <View style={styles.authorNameRow}>
                <Text style={styles.authorName}>{item.author.nickname}</Text>
                {(item.author as any).is_verified && (
                  <View style={styles.verifiedBadge}><Text style={styles.verifiedCheck}>✓</Text></View>
                )}
                {mood && (
                  <View style={[styles.moodPill, { backgroundColor: mood.bg }]}>
                    <Text style={[styles.moodPillText, { color: mood.text }]}>{mood.emoji} {mood.label}</Text>
                  </View>
                )}
              </View>
              <View style={styles.authorMeta}>
                {item.trail_id && item.trail_title && (
                  <TouchableOpacity onPress={() => navigation.navigate('TrailDetail', { trailId: item.trail_id })}>
                    <Text style={styles.trailLink} numberOfLines={1}>{item.trail_region} · {item.trail_title}</Text>
                  </TouchableOpacity>
                )}
                {item.trail_id && <Text style={styles.metaDot}> · </Text>}
                <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.contentSection}>
            {item.title ? <Text style={styles.storyTitle}>{item.title}</Text> : null}
            <ExpandableContent content={item.content} />
          </View>

          {photos.length === 1 && (
            <Image source={{ uri: photos[0].image }} style={styles.singlePhoto} resizeMode="cover" />
          )}
          {photos.length === 2 && (
            <View style={styles.twoPhotos}>
              {photos.map((p) => <Image key={p.id} source={{ uri: p.image }} style={styles.twoPhotoItem} resizeMode="cover" />)}
            </View>
          )}
          {photos.length >= 3 && (
            <View style={styles.threePhotos}>
              <Image source={{ uri: photos[0].image }} style={styles.threePhotoMain} resizeMode="cover" />
              <View style={styles.threePhotoSide}>
                <Image source={{ uri: photos[1].image }} style={styles.threePhotoSmall} resizeMode="cover" />
                <View>
                  <Image source={{ uri: photos[2].image }} style={styles.threePhotoSmall} resizeMode="cover" />
                  {photos.length > 3 && (
                    <View style={styles.moreOverlay}><Text style={styles.moreText}>+{photos.length - 3}</Text></View>
                  )}
                </View>
              </View>
            </View>
          )}

          <View style={styles.actionsRow}>
            <LikeButton isLiked={item.is_liked} onPress={() => handleLike(item.id)} />
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('StoryDetail', { id: item.id })} activeOpacity={0.7}>
              <Text style={styles.actionLabel}>💬 댓글</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => Share.share({ message: `${item.title || ''}\n${item.content.slice(0, 100)}...\n\nMoru에서 확인하세요!` })} activeOpacity={0.7}>
              <Text style={styles.actionLabel}>⤴ 공유</Text>
            </TouchableOpacity>
          </View>

          {(item.like_count > 0 || item.comment_count > 0) && (
            <View style={styles.engagementRow}>
              {item.like_count > 0 && <Text style={styles.engagementText}>좋아요 {item.like_count}개</Text>}
              {item.like_count > 0 && item.comment_count > 0 && <Text style={styles.engagementDot}> · </Text>}
              {item.comment_count > 0 && <Text style={styles.engagementText}>댓글 {item.comment_count}개</Text>}
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.divider} />
      </FadeInView>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingDots}>
          <View style={[styles.loadingDot, { opacity: 0.6 }]} />
          <View style={[styles.loadingDot, { opacity: 0.8 }]} />
          <View style={[styles.loadingDot, { opacity: 1 }]} />
        </View>
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  if (stories.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📝</Text>
        <Text style={styles.emptyTitle}>아직 스토리가 없어요</Text>
        <Text style={styles.emptyDesc}>{'첫 번째 걷기 이야기를\n공유해보세요'}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={stories}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderStory}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingDots: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  loadingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  loadingText: { fontSize: 14, color: colors.textTertiary },
  list: { paddingBottom: 100 },
  postContainer: { backgroundColor: '#FFFFFF' },
  authorRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10, gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { fontSize: 18 },
  authorInfo: { flex: 1, minWidth: 0 },
  authorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  verifiedBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  verifiedCheck: { fontSize: 9, color: '#fff', fontWeight: '700' },
  moodPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  moodPillText: { fontSize: 10, fontWeight: '600' },
  authorMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  trailLink: { fontSize: 12, color: colors.textTertiary, maxWidth: 180 },
  metaDot: { fontSize: 12, color: colors.textTertiary },
  timeText: { fontSize: 12, color: colors.textTertiary },
  contentSection: { paddingHorizontal: 20, paddingBottom: 10 },
  storyTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, lineHeight: 22, marginBottom: 4 },
  storyContent: { fontSize: 14, color: colors.textPrimary, lineHeight: 22 },
  showMoreText: { fontSize: 13, fontWeight: '500', color: colors.textTertiary, marginTop: 4 },
  singlePhoto: { width: '100%', aspectRatio: 4 / 3 },
  twoPhotos: { flexDirection: 'row', gap: 2 },
  twoPhotoItem: { flex: 1, aspectRatio: 1 },
  threePhotos: { flexDirection: 'row', gap: 2, height: 200 },
  threePhotoMain: { flex: 1, height: '100%' },
  threePhotoSide: { flex: 1, gap: 2 },
  threePhotoSmall: { flex: 1 },
  moreOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  actionLabel: { fontSize: 13, fontWeight: '500', color: '#8E8E8E' },
  engagementRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  engagementText: { fontSize: 12, color: colors.textTertiary, fontWeight: '500' },
  engagementDot: { fontSize: 12, color: colors.textTertiary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F2F4F6', marginHorizontal: 20 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: colors.textTertiary, textAlign: 'center', lineHeight: 20 },
});
