import React from 'react';
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

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  const { data: stories, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['stories'],
    queryFn: async () => {
      const { data } = await api.get('/stories/');
      return data.results as WalkStory[];
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/stories/${id}/like/`);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stories'] }),
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}\uBD84 \uC804`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}\uC2DC\uAC04 \uC804`;
    const days = Math.floor(hours / 24);
    return `${days}\uC77C \uC804`;
  };

  const renderStory = ({ item }: { item: WalkStory }) => (
    <View style={styles.storyCard}>
      {/* Author row */}
      <View style={styles.authorRow}>
        <View style={styles.avatar}>
          {item.author.profile_image ? (
            <Image
              source={{ uri: item.author.profile_image }}
              style={styles.avatarImg}
            />
          ) : (
            <Text style={styles.avatarText}>
              {item.author.nickname.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{item.author.nickname}</Text>
          <Text style={styles.storyDate}>{formatDate(item.created_at)}</Text>
        </View>
        {item.trail_title && (
          <TouchableOpacity
            style={styles.trailBadge}
            onPress={() =>
              item.trail_id &&
              navigation.navigate('TrailDetail', { trailId: item.trail_id })
            }>
            <Text style={styles.trailBadgeText} numberOfLines={1}>
              {item.trail_title}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <Text style={styles.storyTitle}>{item.title}</Text>
      <Text style={styles.storyContent} numberOfLines={4}>
        {item.content}
      </Text>

      {/* Photos */}
      {item.photos.length > 0 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={item.photos}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={styles.photosRow}
          renderItem={({ item: photo }) => (
            <Image
              source={{ uri: photo.image }}
              style={styles.storyPhoto}
              resizeMode="cover"
            />
          )}
        />
      )}

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => likeMutation.mutate(item.id)}>
          <Text style={styles.actionIcon}>
            {item.is_liked ? '\u2764\uFE0F' : '\uD83E\uDD0D'}
          </Text>
          <Text style={styles.actionCount}>{item.like_count}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionIcon}>{'\uD83D\uDCAC'}</Text>
          <Text style={styles.actionCount}>{item.comment_count}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{'\uCEE4\uBBA4\uB2C8\uD2F0'}</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={stories}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderStory}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {'\uC544\uC9C1 \uC2A4\uD1A0\uB9AC\uAC00 \uC5C6\uC5B4\uC694'}
              </Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      {isAuthenticated && (
        <TouchableOpacity style={styles.fab}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  storyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 36,
    height: 36,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  authorInfo: {
    flex: 1,
    marginLeft: 10,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  storyDate: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 1,
  },
  trailBadge: {
    backgroundColor: colors.primary50,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: 120,
  },
  trailBadgeText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
  },
  storyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  storyContent: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  photosRow: {
    marginBottom: 12,
    gap: 8,
  },
  storyPhoto: {
    width: 160,
    height: 120,
    borderRadius: 10,
    marginRight: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionIcon: {
    fontSize: 16,
  },
  actionCount: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 15,
    color: colors.textTertiary,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 30,
  },
});
