import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { WalkStory } from '../types';
import { useAuthStore } from '../stores/auth';

const MOOD_MAP: Record<string, { emoji: string; label: string; bg: string; text: string }> = {
  happy: { emoji: '\u{1F60A}', label: '\uD589\uBCF5\uD574\uC694', bg: '#FFFBEB', text: '#B45309' },
  peaceful: { emoji: '\u262E\uFE0F', label: '\uD3C9\uD654\uB85C\uC6CC\uC694', bg: '#EFF6FF', text: '#1D4ED8' },
  exciting: { emoji: '\u{1F929}', label: '\uC2E0\uB098\uC694', bg: '#FFF7ED', text: '#C2410C' },
  touching: { emoji: '\u{1F979}', label: '\uAC10\uB3D9\uC774\uC5D0\uC694', bg: '#FDF2F8', text: '#BE185D' },
  funny: { emoji: '\u{1F604}', label: '\uC7AC\uBC0C\uC5B4\uC694', bg: '#F0FDF4', text: '#15803D' },
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

  const likeMutation = useMutation({
    mutationFn: async (id: number) => (await api.post(`/stories/${id}/like/`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-feed'] }),
  });

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}\uBD84 \uC804`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}\uC2DC\uAC04 \uC804`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}\uC77C \uC804`;
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  const renderStory = ({ item }: { item: WalkStory }) => {
    const mood = MOOD_MAP[item.mood];
    const photos = item.photos || [];

    return (
      <View style={styles.storyCard}>
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
                    {item.trail_region} \u00B7 {item.trail_title}
                  </Text>
                </TouchableOpacity>
              )}
              {item.trail_id && <Text style={styles.metaDot}> \u00B7 </Text>}
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
          <Text style={styles.storyContent} numberOfLines={4}>
            {item.content}
          </Text>
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
                  {'\uC88B\uC544\uC694'} {item.like_count}\uAC1C
                </Text>
              </View>
            )}
            {item.comment_count > 0 && (
              <TouchableOpacity
                style={styles.commentCountBtn}
                onPress={() => navigation.navigate('CommunityDetail', { storyId: item.id })}>
                <Text style={styles.engagementText}>
                  {'\uB313\uAE00'} {item.comment_count}\uAC1C
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              if (!isAuthenticated) {
                navigation.navigate('Login');
                return;
              }
              likeMutation.mutate(item.id);
            }}>
            <Text style={[styles.actionIcon, item.is_liked && styles.actionIconLiked]}>
              {item.is_liked ? '\u2764\uFE0F' : '\u{1F90D}'}
            </Text>
            <Text style={[styles.actionLabel, item.is_liked && styles.actionLabelLiked]}>
              {'\uC88B\uC544\uC694'}
            </Text>
          </TouchableOpacity>

          <View style={styles.actionDivider} />

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('CommunityDetail', { storyId: item.id })}>
            <Text style={styles.actionIcon}>{'\u{1F4AC}'}</Text>
            <Text style={styles.actionLabel}>{'\uB313\uAE00'}</Text>
          </TouchableOpacity>

          <View style={styles.actionDivider} />

          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionIcon}>{'\u2B06\uFE0F'}</Text>
            <Text style={styles.actionLabel}>{'\uACF5\uC720'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Sticky Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{'\uCEE4\uBBA4\uB2C8\uD2F0'}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.writeBtn}
            onPress={() =>
              navigation.navigate(isAuthenticated ? 'CommunityWrite' : 'Login')
            }>
            <Text style={styles.writeBtnText}>{'\uAE00\uC4F0\uAE30'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Text style={styles.iconBtnEmoji}>{'\u{1F514}'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
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
          <Text style={styles.loadingText}>{'\uB85C\uB529 \uC911...'}</Text>
        </View>
      ) : stories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>{'\u{1F4DD}'}</Text>
            </View>
            <Text style={styles.emptyTitle}>{'\uC544\uC9C1 \uC2A4\uD1A0\uB9AC\uAC00 \uC5C6\uC5B4\uC694'}</Text>
            <Text style={styles.emptyDesc}>
              {'\uCCAB \uBC88\uC9F8 \uAC77\uAE30 \uC774\uC57C\uAE30\uB97C\n\uACF5\uC720\uD574\uBCF4\uC138\uC694'}
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('Explore')}>
              <Text style={styles.emptyBtnText}>{'\uD2B8\uB808\uC77C \uD0D0\uC0C9\uD558\uAE30'}</Text>
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

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 90 }]}
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
  writeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  writeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F2F4F6',
    overflow: 'hidden',
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
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 2,
    backgroundColor: colors.accent,
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
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 24,
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
    marginHorizontal: 20,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  actionDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.borderLight,
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
    width: 56,
    height: 56,
    borderRadius: 28,
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
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 26,
  },
});
