import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import api from '../api/client';
import { colors, darkColors } from '../theme/colors';
import { User } from '../types';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { useT } from '../i18n';

const BADGE_DISPLAY: Record<string, { label: string; icon: string; color: string }> = {
  first_walk: { label: '첫 걸음', icon: 'navigation', color: '#4ADE80' },
  explorer: { label: '탐험가', icon: 'compass', color: '#60A5FA' },
  storyteller: { label: '이야기꾼', icon: 'edit-3', color: '#818CF8' },
  popular: { label: '인기인', icon: 'star', color: '#FBBF24' },
  guide: { label: '가이드', icon: 'award', color: '#FB923C' },
  companion: { label: '동행자', icon: 'users', color: '#F472B6' },
};

const LEVEL_NAMES: Record<number, string> = {
  1: '산책러',
  2: '여행자',
  3: '탐험가',
  4: '길잡이',
  5: '마스터',
};

type TabKey = 'courses' | 'activity' | 'stories';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user: currentUser } = useAuthStore();
  const { isDark } = useThemeStore();
  const t = useT();
  const nickname = route.params?.nickname;
  const [activeTab, setActiveTab] = useState<TabKey>('courses');

  const bg = isDark ? '#0a0a0a' : '#FAFAFA';
  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const textColor = isDark ? darkColors.textPrimary : colors.textPrimary;
  const textSecColor = isDark ? darkColors.textSecondary : colors.textSecondary;
  const textTertColor = isDark ? darkColors.textTertiary : colors.textTertiary;
  const borderColor = isDark ? darkColors.borderDefault : colors.borderDefault;
  const primaryColor = isDark ? darkColors.primary : colors.primary;
  const primary50 = isDark ? darkColors.primary50 : colors.primary50;

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

  const WALKING_STYLE_LABELS: Record<string, string> = {
    fast: t.profile.styleFast,
    slow: t.profile.styleSlow,
    photo: t.profile.stylePhoto,
    food: t.profile.styleFood,
    nature: t.profile.styleNature,
    culture: t.profile.styleCulture,
  };

  if (isLoading || !profile) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top, backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  const level = profile.level ?? 1;
  const levelName = LEVEL_NAMES[level] || LEVEL_NAMES[1];
  const xp = profile.xp ?? 0;

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'courses', label: t.profile.courses, icon: 'map' },
    { key: 'activity', label: t.profile.activityTab, icon: 'activity' },
    { key: 'stories', label: '스토리', icon: 'book-open' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>

        {/* ===== NAV HEADER ===== */}
        <View style={styles.navHeader}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="arrow-left" size={22} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: textColor }]} numberOfLines={1}>
            {profile.nickname || ''}
          </Text>
          {isOwnProfile ? (
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => navigation.navigate('Settings')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="settings" size={20} color={textColor} />
            </TouchableOpacity>
          ) : (
            <View style={styles.navBtn} />
          )}
        </View>

        {/* ===== PROFILE HEADER ===== */}
        <View style={styles.profileHeader}>
          <View style={styles.profileTopRow}>
            {/* Avatar */}
            <View style={[styles.avatarRing, { borderColor: primaryColor }]}>
              {profile.profile_image ? (
                <Image source={{ uri: profile.profile_image }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                  <Feather name="user" size={32} color={textTertColor} />
                </View>
              )}
            </View>

            {/* Stats row beside avatar */}
            <View style={styles.profileStatsRow}>
              <TouchableOpacity style={styles.profileStatItem}>
                <Text style={[styles.profileStatValue, { color: textColor }]}>{profile.trail_count ?? 0}</Text>
                <Text style={[styles.profileStatLabel, { color: textSecColor }]}>{t.profile.courses}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.profileStatItem}>
                <Text style={[styles.profileStatValue, { color: textColor }]}>{profile.follower_count ?? 0}</Text>
                <Text style={[styles.profileStatLabel, { color: textSecColor }]}>{t.profile.followers}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.profileStatItem}>
                <Text style={[styles.profileStatValue, { color: textColor }]}>{profile.following_count ?? 0}</Text>
                <Text style={[styles.profileStatLabel, { color: textSecColor }]}>{t.profile.following}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Name + bio */}
          <View style={styles.profileMeta}>
            <Text style={[styles.nickname, { color: textColor }]}>{profile.nickname || ''}</Text>
            {profile.bio ? (
              <Text style={[styles.bio, { color: textSecColor }]}>{profile.bio}</Text>
            ) : null}
            {profile.walking_style && (
              <View style={[styles.stylePill, { backgroundColor: primary50 }]}>
                <Feather name="wind" size={12} color={primaryColor} />
                <Text style={[styles.stylePillText, { color: primaryColor }]}>
                  {WALKING_STYLE_LABELS[profile.walking_style] || profile.walking_style}
                </Text>
              </View>
            )}
          </View>

          {/* Action button */}
          {isOwnProfile ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.editBtn, { borderColor }]}
              onPress={() => navigation.navigate('ProfileEdit')}
              activeOpacity={0.7}>
              <Feather name="edit-2" size={14} color={textColor} />
              <Text style={[styles.editBtnText, { color: textColor }]}>{t.settings.editProfile}</Text>
            </TouchableOpacity>
          ) : currentUser ? (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                profile.is_following
                  ? [styles.followBtnFollowing, { borderColor }]
                  : { backgroundColor: primaryColor },
              ]}
              onPress={() => followMutation.mutate()}
              disabled={followMutation.isPending}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.followBtnText,
                  profile.is_following && { color: textSecColor },
                ]}>
                {profile.is_following ? t.profile.following : t.profile.follow}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ===== LEVEL + BADGES SECTION ===== */}
        <View style={[styles.levelBadgeSection, { backgroundColor: cardBg }]}>
          {/* Level display */}
          <View style={styles.levelRow}>
            <View style={[styles.levelBadge, { backgroundColor: primaryColor + '18' }]}>
              <Feather name="award" size={16} color={primaryColor} />
              <Text style={[styles.levelText, { color: primaryColor }]}>
                Lv.{level} {levelName}
              </Text>
            </View>
            <Text style={[styles.xpText, { color: textTertColor }]}>{xp.toLocaleString()} XP</Text>
          </View>

          {/* XP progress bar */}
          <View style={[styles.xpBarTrack, isDark && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
            <View
              style={[
                styles.xpBarFill,
                {
                  backgroundColor: primaryColor,
                  width: `${Math.min((xp % 1000) / 10, 100)}%`,
                },
              ]}
            />
          </View>

          {/* Badges horizontal scroll */}
          {profile.badges && profile.badges.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.badgeScroll}
              style={styles.badgeScrollContainer}>
              {profile.badges.map((badge) => {
                const display = BADGE_DISPLAY[badge.badge_type];
                const badgeColor = display?.color || '#9CA3AF';
                const badgeIcon = display?.icon || 'award';
                const badgeLabel = display?.label || badge.badge_type;
                return (
                  <View
                    key={badge.id}
                    style={[styles.badgePill, { backgroundColor: badgeColor + '14' }]}>
                    <Feather name={badgeIcon} size={14} color={badgeColor} />
                    <Text style={[styles.badgePillLabel, { color: badgeColor }]}>
                      {badgeLabel}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* ===== TAB BAR ===== */}
        <View style={[styles.tabBar, { borderBottomColor: borderColor }]}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tab}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}>
                <View style={styles.tabInner}>
                  <Feather
                    name={tab.icon}
                    size={16}
                    color={isActive ? textColor : textTertColor}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      { color: isActive ? textColor : textTertColor },
                      isActive && styles.tabTextActive,
                    ]}>
                    {tab.label}
                  </Text>
                </View>
                {isActive && <View style={[styles.tabIndicator, { backgroundColor: textColor }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ===== TAB CONTENT ===== */}
        <View style={styles.tabContent}>
          {activeTab === 'courses' && (
            <View style={styles.emptyTabContent}>
              <Feather name="map" size={36} color={textTertColor} />
              <Text style={[styles.emptyTabTitle, { color: textSecColor }]}>{t.profile.noCourses}</Text>
            </View>
          )}
          {activeTab === 'activity' && (
            <View style={styles.emptyTabContent}>
              <Feather name="activity" size={36} color={textTertColor} />
              <Text style={[styles.emptyTabTitle, { color: textSecColor }]}>{t.profile.noActivity}</Text>
            </View>
          )}
          {activeTab === 'stories' && (
            <View style={styles.emptyTabContent}>
              <Feather name="book-open" size={36} color={textTertColor} />
              <Text style={[styles.emptyTabTitle, { color: textSecColor }]}>{'아직 스토리가 없습니다'}</Text>
            </View>
          )}
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

  // ===== Nav header =====
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },

  // ===== Profile header =====
  profileHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
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
  profileStatsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  profileStatItem: {
    alignItems: 'center',
  },
  profileStatValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  profileStatLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Name + bio
  profileMeta: {
    marginTop: 16,
  },
  nickname: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  stylePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  stylePillText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Action buttons
  actionBtn: {
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  editBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  followBtnFollowing: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  followBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // ===== Level + Badges section =====
  levelBadgeSection: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  levelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  xpText: {
    fontSize: 12,
    fontWeight: '500',
  },
  xpBarTrack: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: 4,
    borderRadius: 2,
  },
  badgeScrollContainer: {
    marginTop: 14,
  },
  badgeScroll: {
    gap: 8,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    gap: 5,
  },
  badgePillLabel: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ===== Tabs =====
  tabBar: {
    flexDirection: 'row',
    marginTop: 20,
    marginHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 2,
    borderRadius: 1,
  },

  // ===== Tab Content =====
  tabContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  emptyTabContent: {
    alignItems: 'center',
    paddingVertical: 56,
    gap: 12,
  },
  emptyTabTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
});
