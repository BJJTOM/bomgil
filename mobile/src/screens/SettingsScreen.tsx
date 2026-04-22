import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
  Modal,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';
import { useT } from '../i18n';
import { useAuthStore } from '../stores/auth';
import { useLanguageStore, Language, LANGUAGES } from '../stores/language';
import { useThemeStore } from '../stores/theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { launchImageLibrary } from 'react-native-image-picker';
import api from '../api/client';
import { pickAndImportGpx } from '../utils/gpxImport';

const { width } = Dimensions.get('window');

interface SectionItem {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
}

interface Section {
  title: string;
  items: SectionItem[];
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, logout, setUser } = useAuthStore();
  const t = useT();

  const handlePickPhoto = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 512, maxHeight: 512 });
      if (result.didCancel || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('profile_image', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || 'profile.jpg',
      } as any);
      const token = useAuthStore.getState().accessToken;
      const res = await fetch('https://api.moruwalk.com/api/v1/auth/me/', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        Alert.alert(t.common.success, t.profile.saveSuccess);
      } else {
        Alert.alert(t.common.error, t.profile.saveFailed);
      }
    } catch {
      Alert.alert(t.common.error, t.profile.saveFailed);
    }
  };

  const handleDeletePhoto = async () => {
    try {
      await api.patch('/auth/me/', { profile_image: null });
      setUser({ ...user, profile_image: null } as any);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      Alert.alert(t.common.success, t.profile.saveSuccess);
    } catch {
      Alert.alert(t.common.error, t.activity.deleteFailed);
    }
  };

  const handleGpxImport = async () => {
    try {
      const result = await pickAndImportGpx();
      Alert.alert(
        t.health.importComplete,
        `${result.title}\n` +
          `${t.walk.distance}: ${result.distance_km.toFixed(2)} km\n` +
          `${result.point_count} points`,
        [
          { text: t.common.confirm },
          { text: t.activity.management, onPress: () => navigation.navigate('MyTrails') },
        ],
      );
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || t.common.error;
      // Don't show an alert if the user simply cancelled the picker
      if (/cancel/i.test(msg) || /취소/.test(msg)) return;
      Alert.alert(t.health.importFailed, msg);
    }
  };

  const handleAvatarPress = () => {
    const options: any[] = [
      { text: t.walk.gallery, onPress: handlePickPhoto },
    ];
    if (user?.profile_image) {
      options.push({ text: t.common.delete, style: 'destructive', onPress: handleDeletePhoto });
    }
    options.push({ text: t.common.cancel, style: 'cancel' });
    Alert.alert(t.settings.profile, t.settings.editProfile, options);
  };

  // Fetch profile data with follower/following counts
  const { data: profileData } = useQuery({
    queryKey: ['profile', user?.nickname],
    queryFn: async () => {
      const { data } = await api.get(`/auth/users/${user?.nickname}/`);
      return data;
    },
    enabled: isAuthenticated && !!user?.nickname,
    staleTime: 10000,
  });

  const isGuestUser = user?.email?.includes('@roami.guest') || user?.nickname?.startsWith('게스트_');

  // XP / Level state
  const [xpData, setXpData] = useState<{
    xp: number; level: number; level_name: string; next_level_xp: number;
  } | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      api.get('/auth/me/xp/').then(({ data }) => setXpData(data)).catch(() => {});
    }
  }, [isAuthenticated]);

  const { language, setLanguage } = useLanguageStore();
  const { mode: themeMode, isDark, setMode: setThemeMode } = useThemeStore();
  const [showLangModal, setShowLangModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const bg = isDark ? '#0a0a0a' : colors.bgSecondary;
  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : colors.textPrimary;
  const textSecColor = isDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary;
  const textTertColor = isDark ? 'rgba(255,255,255,0.4)' : colors.textTertiary;
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : colors.borderLight;

  const themeLabels: Record<string, string> = {
    system: t.settings.system,
    light: t.settings.light,
    dark: t.settings.dark,
  };
  const currentThemeLabel = themeLabels[themeMode];

  const handleLogout = () => setShowLogoutModal(true);

  const confirmLogout = () => {
    setLoggingOut(true);
    setTimeout(() => {
      logout();
      setShowLogoutModal(false);
      setLoggingOut(false);
    }, 800);
  };

  const sections: Section[] = isAuthenticated
    ? [
        {
          title: '내 걷기',
          items: [
            { icon: 'bar-chart-2', label: t.activity.title, onPress: () => navigation.navigate('Main', { screen: 'Activity' }) },
            { icon: 'map', label: t.activity.management, onPress: () => navigation.navigate('MyTrails') },
            { icon: 'heart', label: t.profile.likes, onPress: () => navigation.navigate('LikedTrails') },
            { icon: 'bookmark', label: '저장한 코스', onPress: () => navigation.navigate('BookmarkedTrails') },
          ],
        },
        {
          title: '소셜',
          items: [
            { icon: 'users', label: '동행 찾기', onPress: () => navigation.navigate('Companions') },
            { icon: 'calendar', label: '내 일정', onPress: () => navigation.navigate('MyWalkPlans') },
            { icon: 'flag', label: '시리즈 도전', onPress: () => navigation.navigate('TrailSeriesList') },
            { icon: 'award', label: '내 스탬프', onPress: () => navigation.navigate('MyStamps') },
          ],
        },
        {
          title: t.settings.title,
          items: [
            { icon: 'user', label: t.settings.editProfile, onPress: () => navigation.navigate('ProfileEdit') },
            { icon: 'globe', label: t.settings.language, value: LANGUAGES.find((l) => l.code === language)?.label, onPress: () => setShowLangModal(true) },
            { icon: 'moon', label: t.settings.darkMode, value: currentThemeLabel, onPress: () => setShowThemeModal(true) },
            { icon: 'bell', label: t.settings.notifications, onPress: () => navigation.navigate('Notifications') },
          ],
        },
        {
          title: '도구',
          items: [
            { icon: 'upload', label: 'GPX 가져오기', onPress: handleGpxImport },
            { icon: 'crosshair', label: '보폭 보정', onPress: () => navigation.navigate('StrideCalibration') },
            { icon: 'download', label: '오프라인 저장', onPress: () => navigation.navigate('SavedTrails') },
          ],
        },
        {
          title: '정보',
          items: [
            { icon: 'bell', label: t.settings.notice, onPress: () => navigation.navigate('Notice') },
            { icon: 'file-text', label: t.settings.terms, onPress: () => navigation.navigate('Terms') },
            { icon: 'shield', label: t.settings.privacy, onPress: () => navigation.navigate('Privacy') },
            { icon: 'info', label: t.settings.version, value: '1.0.0' },
          ],
        },
        {
          title: '계정',
          items: [
            ...(!isGuestUser ? [{ icon: 'lock', label: t.password.changeTitle, onPress: () => navigation.navigate('PasswordChange') }] : []),
            { icon: 'user-x', label: t.settings.deleteAccount, onPress: () => {
              Alert.alert(
                t.settings.deleteAccount,
                '정말 탈퇴하시겠습니까?\n탈퇴 후 계정과 모든 데이터는 복구할 수 없습니다.',
                [
                  { text: t.common.cancel, style: 'cancel' },
                  {
                    text: t.settings.deleteAccount,
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await api.delete('/auth/me/delete/');
                        logout();
                        navigation.navigate('Main');
                      } catch {
                        Alert.alert(t.common.error, t.common.retry);
                      }
                    },
                  },
                ],
              );
            }},
          ],
        },
      ]
    : [
        {
          title: '시작하기',
          items: [
            { icon: 'log-in', label: '로그인', onPress: () => navigation.navigate('Login') },
            { icon: 'user-plus', label: '회원가입', onPress: () => navigation.navigate('Register') },
          ],
        },
        {
          title: t.settings.title,
          items: [
            { icon: 'globe', label: t.settings.language, value: LANGUAGES.find((l) => l.code === language)?.label, onPress: () => setShowLangModal(true) },
            { icon: 'moon', label: t.settings.darkMode, value: currentThemeLabel, onPress: () => setShowThemeModal(true) },
          ],
        },
        {
          title: '정보',
          items: [
            { icon: 'bell', label: t.settings.notice, onPress: () => navigation.navigate('Notice') },
            { icon: 'file-text', label: t.settings.terms, onPress: () => navigation.navigate('Terms') },
            { icon: 'shield', label: t.settings.privacy, onPress: () => navigation.navigate('Privacy') },
            { icon: 'info', label: t.settings.version, value: '1.0.0' },
          ],
        },
      ];

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={22} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textColor }]}>{t.settings.title}</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* User Card */}
        {isAuthenticated && user ? (
          <View style={[styles.userCard, { backgroundColor: cardBg }]}>
            <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.7} style={{ position: 'relative' }}>
              <View style={styles.avatar}>
                {user.profile_image ? (
                  <Image
                    source={{ uri: user.profile_image }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Feather name="user" size={28} color={colors.textTertiary} />
                )}
              </View>
              <View style={styles.avatarCameraBadge}>
                <Feather name="camera" size={11} color="#fff" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.userInfo}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Profile', { nickname: user.nickname })}>
              <Text style={[styles.userName, { color: textColor }]}>{user.nickname}</Text>
              <Text style={[styles.userEmail, { color: textTertColor }]}>{user.email}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Profile', { nickname: user.nickname })}>
              <Feather name="chevron-right" size={18} color={textTertColor} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Follower / Following Counts */}
        {isAuthenticated && user && profileData ? (
          <View style={[styles.followStatsRow, { backgroundColor: cardBg }]}>
            <TouchableOpacity
              style={styles.followStatItem}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('FollowList', { nickname: user.nickname, tab: 'followers' })}>
              <Text style={[styles.followStatValue, { color: textColor }]}>{profileData.follower_count ?? 0}</Text>
              <Text style={[styles.followStatLabel, { color: textTertColor }]}>{t.profile.followers}</Text>
            </TouchableOpacity>
            <View style={[styles.followStatDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
            <TouchableOpacity
              style={styles.followStatItem}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('FollowList', { nickname: user.nickname, tab: 'following' })}>
              <Text style={[styles.followStatValue, { color: textColor }]}>{profileData.following_count ?? 0}</Text>
              <Text style={[styles.followStatLabel, { color: textTertColor }]}>{t.profile.following}</Text>
            </TouchableOpacity>
            <View style={[styles.followStatDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
            <TouchableOpacity
              style={styles.followStatItem}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Profile', { nickname: user.nickname })}>
              <Text style={[styles.followStatValue, { color: textColor }]}>{profileData.trail_count ?? 0}</Text>
              <Text style={[styles.followStatLabel, { color: textTertColor }]}>{t.profile.courses}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* XP / Level Card */}
        {isAuthenticated && xpData ? (() => {
          const currentLevelXP = [0, 0, 100, 300, 700, 1500, 3000, 5000, 8000, 12000, 20000][xpData.level] || 0;
          const nextXP = xpData.next_level_xp;
          const isMaxLevel = nextXP === 0;
          const progressRatio = isMaxLevel ? 1 : (nextXP - currentLevelXP) > 0
            ? (xpData.xp - currentLevelXP) / (nextXP - currentLevelXP)
            : 0;
          const progressPercent = Math.min(Math.max(progressRatio, 0), 1);
          return (
            <View style={[styles.xpCard, { backgroundColor: cardBg }]}>
              <View style={styles.xpHeader}>
                <View style={styles.xpLevelBadge}>
                  <Text style={styles.xpLevelBadgeText}>Lv.{xpData.level}</Text>
                </View>
                <Text style={[styles.xpLevelName, { color: textColor }]}>{xpData.level_name}</Text>
                <Text style={[styles.xpAmount, { color: textSecColor }]}>{xpData.xp} XP</Text>
              </View>
              <View style={styles.xpBarBg}>
                <View style={[styles.xpBarFill, { width: `${progressPercent * 100}%` }]} />
              </View>
              <Text style={[styles.xpBarLabel, { color: textTertColor }]}>
                {isMaxLevel ? 'MAX LEVEL' : `${xpData.xp} / ${nextXP} XP`}
              </Text>
            </View>
          );
        })() : null}

        {/* Sections */}
        {sections.map((section) => (
          <View key={section.title} style={styles.sectionWrap}>
            <Text style={[styles.sectionTitle, { color: textTertColor }]}>{section.title.toUpperCase()}</Text>
            <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.menuItem,
                    index < section.items.length - 1 && [styles.menuItemBorder, { borderBottomColor: borderColor }],
                  ]}
                  onPress={item.onPress}
                  activeOpacity={item.onPress ? 0.6 : 1}>
                  <Feather name={item.icon} size={18} color={textTertColor} style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, { color: textColor }]}>{item.label}</Text>
                  {item.value ? (
                    <Text style={[styles.menuValue, { color: textTertColor }]}>{item.value}</Text>
                  ) : null}
                  {item.onPress && <Text style={styles.menuChevron}>{'›'}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        {isAuthenticated && (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.7}>
            <Text style={styles.logoutText}>{t.settings.logout}</Text>
          </TouchableOpacity>
        )}

        {/* Version */}
        <Text style={styles.versionText}>Moru v1.0.0</Text>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal visible={showLangModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowLangModal(false)}
          activeOpacity={1}>
          <View style={[styles.langModal, isDark && { backgroundColor: '#1e1e1e' }]}>
            <Text style={[styles.langModalTitle, isDark && { color: '#FFFFFF' }]}>{t.settings.language}</Text>
            {([
              { code: 'ko' as Language, label: '한국어', flag: '🇰🇷' },
              { code: 'en' as Language, label: 'English', flag: '🇺🇸' },
              { code: 'ja' as Language, label: '日本語', flag: '🇯🇵' },
              { code: 'zh' as Language, label: '中文', flag: '🇨🇳' },
            ]).map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langItem, language === lang.code && styles.langItemActive]}
                onPress={() => { setLanguage(lang.code); setShowLangModal(false); }}>
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text style={styles.langLabel}>{lang.label}</Text>
                {language === lang.code && <Text style={styles.langCheck}>{'✓'}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
      {/* Theme Selection Modal */}
      <Modal visible={showThemeModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowThemeModal(false)}
          activeOpacity={1}>
          <View style={[styles.langModal, isDark && { backgroundColor: '#1e1e1e' }]}>
            <Text style={[styles.langModalTitle, isDark && { color: '#FFFFFF' }]}>{t.settings.theme}</Text>
            {([
              { key: 'system' as const, label: t.settings.system, icon: 'smartphone' },
              { key: 'light' as const, label: t.settings.light, icon: 'sun' },
              { key: 'dark' as const, label: t.settings.dark, icon: 'moon' },
            ]).map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.langItem, themeMode === item.key && (isDark ? { backgroundColor: 'rgba(74,222,128,0.1)' } : styles.langItemActive)]}
                onPress={() => { setThemeMode(item.key); setShowThemeModal(false); }}>
                <Feather name={item.icon} size={18} color={isDark ? '#FFFFFF' : colors.textPrimary} style={{ marginRight: 12 }} />
                <Text style={[styles.langLabel, isDark && { color: '#FFFFFF' }]}>{item.label}</Text>
                {themeMode === item.key && <Feather name="check" size={18} color={isDark ? '#4ADE80' : colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
      {/* Logout Confirmation Modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={styles.logoutOverlay}>
          <View style={[styles.logoutModal, isDark && { backgroundColor: '#1e1e1e' }]}>
            {loggingOut ? (
              <View style={styles.logoutLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.logoutLoadingText}>{t.common.loading}</Text>
              </View>
            ) : (
              <>
                <Feather name="log-out" size={36} color={colors.danger} style={{ marginBottom: 12 }} />
                <Text style={styles.logoutModalTitle}>{t.settings.logout}?</Text>
                <Text style={styles.logoutModalSub}>{t.activity.resumeExpiry}</Text>
                <TouchableOpacity style={styles.logoutConfirmBtn} onPress={confirmLogout} activeOpacity={0.85}>
                  <Text style={styles.logoutConfirmText}>{t.settings.logout}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.logoutCancelBtn} onPress={() => setShowLogoutModal(false)} activeOpacity={0.85}>
                  <Text style={styles.logoutCancelText}>{t.common.cancel}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 44,
    marginBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // User card
  followStatsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: -16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
  },
  followStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  followStatValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#191F28',
  },
  followStatLabel: {
    fontSize: 11,
    color: '#B0B8C1',
    marginTop: 2,
  },
  followStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#F2F4F6',
    alignSelf: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(168,230,207,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 56,
    height: 56,
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarEmoji: {
    fontSize: 24,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  chevron: {
    fontSize: 22,
    color: colors.textTertiary,
  },

  // XP / Level Card
  xpCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  xpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  xpLevelBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  xpLevelBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  xpLevelName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  xpAmount: {
    fontSize: 13,
    fontWeight: '500',
  },
  xpBarBg: {
    height: 8,
    backgroundColor: '#F2F4F6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  xpBarFill: {
    height: 8,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  xpBarLabel: {
    fontSize: 11,
    textAlign: 'right',
  },

  // Sections
  sectionWrap: {
    marginBottom: 20,
  },
  sectionTitle: {
    paddingHorizontal: 36,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 4,
  },
  sectionCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  menuIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: colors.textPrimary,
  },
  menuValue: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  menuChevron: {
    fontSize: 20,
    color: colors.textTertiary,
    fontWeight: '300',
  },

  // Logout
  logoutBtn: {
    marginTop: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.danger,
  },

  // Version
  versionText: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 8,
    paddingBottom: 12,
  },

  // Language Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: width - 64,
    maxWidth: 320,
  },
  langModalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  langItemActive: {
    backgroundColor: colors.primary50,
  },
  langFlag: {
    fontSize: 22,
    marginRight: 14,
  },
  langLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
  },
  langCheck: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },

  // Avatar edit badge
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarEditIcon: {
    fontSize: 10,
  },

  // Logout modal
  logoutOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoutModal: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  logoutLoading: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 16,
  },
  logoutLoadingText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  logoutModalIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  logoutModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  logoutModalSub: {
    fontSize: 13,
    color: colors.textTertiary,
    marginBottom: 24,
  },
  logoutConfirmBtn: {
    width: '100%',
    backgroundColor: colors.danger,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  logoutConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  logoutCancelBtn: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutCancelText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
});
