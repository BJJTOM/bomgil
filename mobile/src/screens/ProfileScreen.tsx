import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { User } from '../types';
import { useAuthStore } from '../stores/auth';

const { width } = Dimensions.get('window');

const WALKING_STYLE_LABELS: Record<string, string> = {
  fast: '빠른 걸음',
  slow: '느린 산책',
  photo: '사진 여행',
  food: '맛집 탐방',
  nature: '자연 탐험',
  culture: '문화 탐방',
};

const BADGE_ICONS: Record<string, string> = {
  first_walk: '🥾',
  explorer: '🧭',
  storyteller: '📝',
  popular: '⭐',
  guide: '🏅',
  companion: '🤝',
};

type TabKey = 'courses' | 'activity' | 'likes' | 'reviews';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user: currentUser } = useAuthStore();
  const nickname = route.params?.nickname;
  const [activeTab, setActiveTab] = useState<TabKey>('courses');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', nickname],
    queryFn: async () => {
      const { data } = await api.get(`/auth/users/${nickname}/`);
      return data as User;
    },
    enabled: !!nickname,
  });

  const isOwnProfile = currentUser?.nickname === nickname;
  const queryClient = useQueryClient();

  const followMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/auth/users/${nickname}/follow/`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', nickname] });
    },
  });

  if (isLoading || !profile) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'courses', label: '코스' },
    { key: 'activity', label: '활동' },
    { key: 'likes', label: '좋아요' },
    { key: 'reviews', label: '리뷰' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>{'←'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>프로필</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {profile.profile_image ? (
              <Image source={{ uri: profile.profile_image }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarEmoji}>{'👤'}</Text>
              </View>
            )}
          </View>

          <Text style={styles.nickname}>{profile.nickname || ''}</Text>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          {profile.walking_style && (
            <View style={styles.styleBadge}>
              <Text style={styles.styleBadgeText}>
                {WALKING_STYLE_LABELS[profile.walking_style] || profile.walking_style}
              </Text>
            </View>
          )}

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.trail_count ?? 0}</Text>
              <Text style={styles.statLabel}>코스</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.follower_count ?? 0}</Text>
              <Text style={styles.statLabel}>팔로워</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.following_count ?? 0}</Text>
              <Text style={styles.statLabel}>팔로잉</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.review_count ?? 0}</Text>
              <Text style={styles.statLabel}>리뷰</Text>
            </View>
          </View>

          {isOwnProfile ? (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => navigation.navigate('ProfileEdit')}>
              <Text style={styles.editBtnText}>프로필 수정</Text>
            </TouchableOpacity>
          ) : currentUser ? (
            <TouchableOpacity
              style={[
                styles.followBtn,
                profile.is_following && styles.followBtnActive,
              ]}
              onPress={() => followMutation.mutate()}
              disabled={followMutation.isPending}>
              <Text
                style={[
                  styles.followBtnText,
                  profile.is_following && styles.followBtnTextActive,
                ]}>
                {profile.is_following ? '팔로잉' : '팔로우'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Badges */}
        {profile.badges && profile.badges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>배지</Text>
            <View style={styles.badgeGrid}>
              {profile.badges.map((badge) => (
                <View key={badge.id} style={styles.badgeItem}>
                  <Text style={styles.badgeIcon}>
                    {BADGE_ICONS[badge.badge_type] || '🏷️'}
                  </Text>
                  <Text style={styles.badgeLabel}>{badge.badge_type}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabRow}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}>
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content Placeholder */}
        <View style={styles.tabContent}>
          <Text style={styles.emptyText}>
            {activeTab === 'courses' && '등록한 코스가 없습니다'}
            {activeTab === 'activity' && '활동 기록이 없습니다'}
            {activeTab === 'likes' && '좋아요한 코스가 없습니다'}
            {activeTab === 'reviews' && '작성한 리뷰가 없습니다'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
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
  backIcon: {
    fontSize: 18,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  profileCard: {
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 16,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(168,230,207,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 36,
  },
  nickname: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  styleBadge: {
    backgroundColor: colors.primary50,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  styleBadgeText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderLight,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  editBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
  },
  editBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  followBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 14,
  },
  followBtnActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  followBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  followBtnTextActive: {
    color: colors.textSecondary,
  },
  section: {
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 14,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeItem: {
    alignItems: 'center',
    width: 72,
  },
  badgeIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  badgeLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  tabContent: {
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
});
