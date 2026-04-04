import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';
import { useLanguageStore, LANGUAGES } from '../stores/language';

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

  const handleLanguageChange = () => {
    Alert.alert(
      '언어 선택',
      '',
      LANGUAGES.map((l) => ({
        text: `${l.flag} ${l.label}`,
        onPress: () => setLanguage(l.code),
        style: l.code === language ? ('cancel' as const) : ('default' as const),
      })),
    );
  };

  const sections: Section[] = [
    {
      title: '계정',
      items: isAuthenticated
        ? [
            { icon: '👤', label: '프로필 수정', onPress: () => {} },
            {
              icon: '📊',
              label: '내 활동 기록',
              onPress: () => navigation.navigate('Activity'),
            },
            { icon: '❤️', label: '좋아요한 코스', onPress: () => {} },
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
          onPress: handleLanguageChange,
        },
        { icon: '🔔', label: '알림 설정', onPress: () => {} },
      ],
    },
    {
      title: '정보',
      items: [
        { icon: '📋', label: '서비스 이용약관', onPress: () => {} },
        { icon: '🔒', label: '개인정보처리방침', onPress: () => {} },
        { icon: '📄', label: '오픈소스 라이선스', onPress: () => {} },
        { icon: 'ℹ️', label: '버전 정보', value: '1.0.0' },
      ],
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>설정</Text>
        </View>

        {/* User Card */}
        {isAuthenticated && user ? (
          <TouchableOpacity style={styles.userCard} activeOpacity={0.7}>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
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
});
