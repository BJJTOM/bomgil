import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  StatusBar,
  Modal,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';
import { useLanguageStore, Language, LANGUAGES } from '../stores/language';

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
  const { user, isAuthenticated, logout } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();
  const [showLangModal, setShowLangModal] = useState(false);

  const handleLogout = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
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
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>설정</Text>
        </View>

        {/* User Card */}
        {isAuthenticated && user ? (
          <TouchableOpacity
            style={styles.userCard}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Profile', { nickname: user.nickname })}>
            <View style={styles.avatar}>
              {user.profile_image ? (
                <Image
                  source={{ uri: user.profile_image }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarEmoji}>👤</Text>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.nickname}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ) : null}

        {/* Sections */}
        {sections.map((section) => (
          <View key={section.title} style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
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
                  <Text style={styles.menuChevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout Button */}
        {isAuthenticated && (
          <View style={styles.logoutWrap}>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              activeOpacity={0.7}>
              <Text style={styles.logoutText}>로그아웃</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2026 Roami. All rights reserved.
          </Text>
        </View>
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
                {language === lang.code && <Text style={styles.langCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // User card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(168,230,207,0.3)',
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
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  chevron: {
    fontSize: 22,
    color: colors.textTertiary,
  },

  // Sections
  sectionWrap: {
    marginBottom: 16,
  },
  sectionTitle: {
    paddingHorizontal: 20,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  sectionCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F2F4F6',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  menuValue: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  menuChevron: {
    fontSize: 18,
    color: colors.textTertiary,
  },

  // Logout
  logoutWrap: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  logoutBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.danger,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 11,
    color: colors.textTertiary,
  },

  // Language Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: width - 64,
    maxWidth: 320,
  },
  langModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#191F28',
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
    backgroundColor: '#f0f7f0',
  },
  langFlag: {
    fontSize: 22,
    marginRight: 14,
  },
  langLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#191F28',
    flex: 1,
  },
  langCheck: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D4A2E',
  },
});
