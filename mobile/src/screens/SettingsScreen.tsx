import React, { useState } from 'react';
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
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';
import { useLanguageStore, Language, LANGUAGES } from '../stores/language';
import { launchImageLibrary } from 'react-native-image-picker';
import api from '../api/client';

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
  const { user, isAuthenticated, logout, setUser } = useAuthStore();

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
      const { data } = await api.patch('/auth/me/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser(data);
    } catch {}
  };

  const handleAvatarPress = () => {
    Alert.alert('프로필 사진', '', [
      { text: '사진 변경', onPress: handlePickPhoto },
      { text: '사진 삭제', style: 'destructive', onPress: async () => {
        try {
          await api.patch('/auth/me/', { profile_image: null });
          setUser({ ...user, profile_image: null });
        } catch {}
      }},
      { text: '취소', style: 'cancel' },
    ]);
  };

  const { language, setLanguage } = useLanguageStore();
  const [showLangModal, setShowLangModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => setShowLogoutModal(true);

  const confirmLogout = () => {
    setLoggingOut(true);
    setTimeout(() => {
      logout();
      setShowLogoutModal(false);
      setLoggingOut(false);
    }, 800);
  };

  const sections: Section[] = [
    {
      title: '계정',
      items: isAuthenticated
        ? [
            { icon: '👤', label: '프로필 수정', onPress: () => navigation.navigate('ProfileEdit') },
            {
              icon: '📊',
              label: '내 활동 기록',
              onPress: () => navigation.navigate('Main', { screen: 'Activity' }),
            },
            { icon: '🗺', label: '내 코스 관리', onPress: () => navigation.navigate('MyTrails') },
            { icon: '❤️', label: '좋아요한 코스', onPress: () => navigation.navigate('LikedTrails') },
            { icon: '📥', label: '저장한 코스', onPress: () => navigation.navigate('SavedTrails') },
          ]
        : [
            {
              icon: '🔑',
              label: '로그인',
              onPress: () => navigation.navigate('Login'),
            },
            {
              icon: '✨',
              label: '회원가입',
              onPress: () => navigation.navigate('Register'),
            },
          ],
    },
    {
      title: '앱 설정',
      items: [
        {
          icon: '🌐',
          label: '언어 설정',
          value: LANGUAGES.find((l) => l.code === language)?.label,
          onPress: () => setShowLangModal(true),
        },
        { icon: '🔔', label: '알림 설정', onPress: () => navigation.navigate('Notifications') },
      ],
    },
    {
      title: '정보',
      items: [
        { icon: '📋', label: '서비스 이용약관', onPress: () => navigation.navigate('Terms') },
        { icon: '🔒', label: '개인정보처리방침', onPress: () => navigation.navigate('Privacy') },
        { icon: '📄', label: '오픈소스 라이선스', onPress: () => {} },
        { icon: 'ℹ️', label: '버전 정보', value: '1.0.0' },
      ],
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bgSecondary} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>{'←'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>설정</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* User Card */}
        {isAuthenticated && user ? (
          <View style={styles.userCard}>
            <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.7}>
              <View style={styles.avatar}>
                {user.profile_image ? (
                  <Image
                    source={{ uri: user.profile_image }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarEmoji}>{'\uD83D\uDC64'}</Text>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.userInfo}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Profile', { nickname: user.nickname })}>
              <Text style={styles.userName}>{user.nickname}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Profile', { nickname: user.nickname })}>
              <Text style={styles.chevron}>{'›'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Sections */}
        {sections.map((section) => (
          <View key={section.title} style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.menuItem,
                    index < section.items.length - 1 && styles.menuItemBorder,
                  ]}
                  onPress={item.onPress}
                  activeOpacity={item.onPress ? 0.6 : 1}>
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  {item.value ? (
                    <Text style={styles.menuValue}>{item.value}</Text>
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
            <Text style={styles.logoutText}>로그아웃</Text>
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
          <View style={styles.langModal}>
            <Text style={styles.langModalTitle}>언어 설정</Text>
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
      {/* Logout Confirmation Modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={styles.logoutOverlay}>
          <View style={styles.logoutModal}>
            {loggingOut ? (
              <View style={styles.logoutLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.logoutLoadingText}>{'로그아웃 중...'}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.logoutModalIcon}>{'\uD83D\uDC4B'}</Text>
                <Text style={styles.logoutModalTitle}>{'로그아웃 하시겠습니까?'}</Text>
                <Text style={styles.logoutModalSub}>{'다시 로그인하면 기록을 이어갈 수 있어요'}</Text>
                <TouchableOpacity style={styles.logoutConfirmBtn} onPress={confirmLogout} activeOpacity={0.85}>
                  <Text style={styles.logoutConfirmText}>{'로그아웃'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.logoutCancelBtn} onPress={() => setShowLogoutModal(false)} activeOpacity={0.85}>
                  <Text style={styles.logoutCancelText}>{'취소'}</Text>
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
