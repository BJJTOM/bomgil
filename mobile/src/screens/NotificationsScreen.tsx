import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useThemeStore } from '../stores/theme';

interface Notification {
  id: number;
  title: string;
  body: string;
  notification_type: 'like' | 'comment' | 'reply' | 'follow' | 'system';
  target_type?: 'post' | 'trail' | 'activity' | null;
  target_id?: number | null;
  is_read: boolean;
  actor_nickname?: string | null;
  actor_profile_image?: string | null;
  created_at: string;
}

const NOTIF_ICON_MAP: Record<string, { name: string; color: string; bg: string }> = {
  like: { name: 'heart', color: '#E74C3C', bg: '#FDECEC' },
  comment: { name: 'message-circle', color: '#3498DB', bg: '#EBF5FB' },
  reply: { name: 'corner-down-right', color: '#8E44AD', bg: '#F4ECF7' },
  follow: { name: 'user-plus', color: '#27AE60', bg: '#EAFAF1' },
  system: { name: 'bell', color: '#F39C12', bg: '#FEF9E7' },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '\uBC29\uAE08 \uC804';
  if (diffMin < 60) return `${diffMin}\uBD84 \uC804`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}\uC2DC\uAC04 \uC804`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}\uC77C \uC804`;
  return date.toLocaleDateString('ko-KR');
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { isDark } = useThemeStore();

  const bg = isDark ? '#0a0a0a' : '#FAFAFA';
  const cardBg = isDark ? '#1e1e1e' : '#fff';
  const textColor = isDark ? '#FFFFFF' : colors.textPrimary;
  const textSecColor = isDark ? 'rgba(255,255,255,0.6)' : colors.textSecondary;
  const textTertColor = isDark ? 'rgba(255,255,255,0.4)' : colors.textTertiary;
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : colors.borderLight;

  const { data: notifications, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/auth/notifications/');
      return (data.results || data) as Notification[];
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await api.post('/auth/notifications/read-all/');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const hasUnread = notifications?.some((n) => !n.is_read);

  const handleNotifPress = (item: Notification) => {
    // Optimistically mark this notification as read in the local cache
    if (!item.is_read) {
      queryClient.setQueryData(['notifications'], (old: Notification[] | undefined) =>
        old ? old.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)) : old,
      );
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    }
    if (item.target_type === 'post' && item.target_id) {
      navigation.navigate('PostDetail', { postId: item.target_id });
    } else if (item.target_type === 'trail' && item.target_id) {
      navigation.navigate('TrailDetail', { trailId: item.target_id });
    } else if (item.target_type === 'activity' && item.target_id) {
      navigation.navigate('ActivityDetail', { activity: { id: item.target_id } });
    } else if (item.notification_type === 'follow' && item.actor_nickname) {
      navigation.navigate('Profile', { nickname: item.actor_nickname });
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const iconInfo = NOTIF_ICON_MAP[item.notification_type] || NOTIF_ICON_MAP.system;

    return (
      <TouchableOpacity
        style={[
          styles.notifItem,
          { backgroundColor: cardBg, borderColor: borderColor },
          !item.is_read && (isDark
            ? { backgroundColor: 'rgba(45,74,46,0.15)', borderColor: 'rgba(45,74,46,0.3)' }
            : styles.notifUnread),
        ]}
        activeOpacity={0.7}
        onPress={() => handleNotifPress(item)}>
        <View style={[styles.notifIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : iconInfo.bg }]}>
          <Feather name={iconInfo.name} size={20} color={iconInfo.color} />
        </View>
        <View style={styles.notifContent}>
          <Text style={[styles.notifTitle, { color: textColor }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.notifBody, { color: textSecColor }]} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={[styles.notifTime, { color: textTertColor }]}>{timeAgo(item.created_at)}</Text>
        </View>
        {!item.is_read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: cardBg, borderColor: borderColor }]} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={18} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>{'\uC54C\uB9BC'}</Text>
        {hasUnread ? (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={() => markAllRead.mutate()}>
            <Text style={styles.markAllText}>{'\uBAA8\uB450 \uC77D\uC74C'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !notifications || notifications.length === 0 ? (
        <View style={styles.center}>
          <Feather name="bell-off" size={48} color={textTertColor} style={{ marginBottom: 16 }} />
          <Text style={[styles.emptyTitle, { color: textColor }]}>{'\uC54C\uB9BC\uC774 \uC5C6\uC2B5\uB2C8\uB2E4'}</Text>
          <Text style={[styles.emptyDesc, { color: textSecColor }]}>{'\uC0C8\uB85C\uC6B4 \uC18C\uC2DD\uC774 \uC788\uC73C\uBA74 \uC54C\uB824\uB4DC\uB9B4\uAC8C\uC694'}</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={renderItem}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary50,
    borderRadius: 10,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  notifUnread: {
    backgroundColor: '#f8fdf8',
    borderColor: 'rgba(45,74,46,0.15)',
  },
  notifIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  notifBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 4,
  },
  notifTime: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
