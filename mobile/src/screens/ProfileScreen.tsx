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
import { useT } from '../i18n';

const { width } = Dimensions.get('window');

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
  const t = useT();
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

  const WALKING_STYLE_LABELS: Record<string, string> = {
    fast: t.profile.styleFast,
    slow: t.profile.styleSlow,
    photo: t.profile.stylePhoto,
    food: t.profile.styleFood,
    nature: t.profile.styleNature,
    culture: t.profile.styleCulture,
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'courses', label: t.profile.courses },
    { key: 'activity', label: t.profile.activityTab },
    { key: 'likes', label: t.profile.likes },
    { key: 'reviews', label: t.profile.reviews },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.headerBtnIcon}>{'←'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t.profile.title}</Text>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.headerBtnIcon}>{'⚙'}</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarRing}>
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
            <View style={styles.stylePill}>
              <Text style={styles.stylePillText}>
                {WALKING_STYLE_LABELS[profile.walking_style] || profile.walking_style}
              </Text>
            </View>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.trail_count ?? 0}</Text>
            <Text style={styles.statLabel}>{t.profile.courses}</Text>
          </View>
          <TouchableOpacity style={styles.statItem}>
            <Text style={styles.statValue}>{profile.follower_count ?? 0}</Text>
            <Text style={styles.statLabel}>{t.profile.followers}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem}>
            <Text style={styles.statValue}>{profile.following_count ?? 0}</Text>
            <Text style={styles.statLabel}>{t.profile.following}</Text>
          </TouchableOpacity>
        </View>

        {/* Action Button */}
        {isOwnProfile ? (
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('ProfileEdit')}>
            <Text style={styles.editBtnText}>{t.settings.editProfile}</Text>
          </TouchableOpacity>
        ) : currentUser ? (
          <TouchableOpacity
            style={[
              styles.followBtn,
              profile.is_following && styles.followBtnFollowing,
            ]}
            onPress={() => followMutation.mutate()}
            disabled={followMutation.isPending}>
            <Text
              style={[
                styles.followBtnText,
                profile.is_following && styles.followBtnTextFollowing,
              ]}>
              {profile.is_following ? t.profile.following : t.profile.follow}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Badges */}
        {profile.badges && profile.badges.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgeScroll}>
            {profile.badges.map((badge) => (
              <View key={badge.id} style={styles.badgePill}>
                <Text style={styles.badgePillIcon}>
                  {BADGE_ICONS[badge.badge_type] || '🏷️'}
                </Text>
                <Text style={styles.badgePillLabel}>{badge.badge_type}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Tabs */}
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => setActiveTab(tab.key)}>
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {activeTab === tab.key && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          <Text style={styles.emptyText}>
            {activeTab === 'courses' && t.profile.noCourses}
            {activeTab === 'activity' && t.profile.noActivity}
            {activeTab === 'likes' && t.profile.noLikes}
            {activeTab === 'reviews' && t.profile.noReviews}
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 44,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnIcon: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // Profile
  profileSection: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 4,
  },
  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  avatarPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(168,230,207,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 32,
  },
  nickname: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
    marginBottom: 8,
  },
  stylePill: {
    backgroundColor: colors.primary50,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  stylePillText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: 20,
    marginHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderDefault,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Buttons
  followBtn: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },
  followBtnFollowing: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  followBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  followBtnTextFollowing: {
    color: colors.textSecondary,
  },
  editBtn: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // Badges
  badgeScroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
    gap: 8,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  badgePillIcon: {
    fontSize: 14,
  },
  badgePillLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    marginTop: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderDefault,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  tabTextActive: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: colors.textPrimary,
    borderRadius: 1,
  },

  // Tab Content
  tabContent: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
});
