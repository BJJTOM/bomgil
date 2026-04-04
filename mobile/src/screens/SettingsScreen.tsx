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

interface MenuItem {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();

  const handleLogout = () => {
    Alert.alert('\uB85C\uADF8\uC544\uC6C3', '\uB85C\uADF8\uC544\uC6C3 \uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?', [
      { text: '\uCDE8\uC18C', style: 'cancel' },
      {
        text: '\uB85C\uADF8\uC544\uC6C3',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  const handleLanguageChange = () => {
    Alert.alert(
      '\uC5B8\uC5B4 \uC120\uD0DD',
      '',
      LANGUAGES.map((l) => ({
        text: `${l.flag} ${l.label}`,
        onPress: () => setLanguage(l.code),
        style: l.code === language ? ('cancel' as const) : ('default' as const),
      })),
    );
  };

  const menuItems: MenuItem[] = isAuthenticated
    ? [
        {
          icon: '\uD83D\uDC64',
          label: '\uD504\uB85C\uD544',
          onPress: () => {},
        },
        {
          icon: '\uD83D\uDEB6',
          label: '\uB098\uC758 \uD65C\uB3D9',
          onPress: () => navigation.navigate('Activity'),
        },
        {
          icon: '\u2764\uFE0F',
          label: '\uC88B\uC544\uC694 \uBAA9\uB85D',
          onPress: () => {},
        },
        {
          icon: '\uD83C\uDF10',
          label: `\uC5B8\uC5B4 (${LANGUAGES.find((l) => l.code === language)?.label})`,
          onPress: handleLanguageChange,
        },
        {
          icon: '\uD83D\uDCC4',
          label: '\uC774\uC6A9\uC57D\uAD00',
          onPress: () => {},
        },
        {
          icon: '\uD83D\uDD12',
          label: '\uAC1C\uC778\uC815\uBCF4\uCC98\uB9AC\uBC29\uCE68',
          onPress: () => {},
        },
      ]
    : [
        {
          icon: '\uD83C\uDF10',
          label: `\uC5B8\uC5B4 (${LANGUAGES.find((l) => l.code === language)?.label})`,
          onPress: handleLanguageChange,
        },
        {
          icon: '\uD83D\uDCC4',
          label: '\uC774\uC6A9\uC57D\uAD00',
          onPress: () => {},
        },
        {
          icon: '\uD83D\uDD12',
          label: '\uAC1C\uC778\uC815\uBCF4\uCC98\uB9AC\uBC29\uCE68',
          onPress: () => {},
        },
      ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MY</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* User Card */}
        {isAuthenticated && user ? (
          <View style={styles.userCard}>
            <View style={styles.userAvatar}>
              {user.profile_image ? (
                <Image
                  source={{ uri: user.profile_image }}
                  style={styles.userAvatarImg}
                />
              ) : (
                <Text style={styles.userAvatarText}>
                  {user.nickname.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.nickname}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.guestCard}>
            <Text style={styles.guestTitle}>
              {'\uB85C\uADF8\uC778\uD558\uACE0 \uB354 \uB9CE\uC740 \uAE30\uB2A5\uC744 \uC774\uC6A9\uD558\uC138\uC694'}
            </Text>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginButtonText}>{'\uB85C\uADF8\uC778'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Menu */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text
                style={[
                  styles.menuLabel,
                  item.danger && { color: colors.danger },
                ]}>
                {item.label}
              </Text>
              <Text style={styles.menuArrow}>{'\u203A'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        {isAuthenticated && (
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>{'\uB85C\uADF8\uC544\uC6C3'}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: colors.bgSecondary,
    borderRadius: 16,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  userAvatarImg: {
    width: 56,
    height: 56,
  },
  userAvatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  guestCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 24,
    backgroundColor: colors.bgSecondary,
    borderRadius: 16,
    alignItems: 'center',
  },
  guestTitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  menuSection: {
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuIcon: {
    fontSize: 18,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  menuArrow: {
    fontSize: 20,
    color: colors.textTertiary,
  },
  logoutBtn: {
    marginTop: 24,
    marginHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  logoutText: {
    fontSize: 15,
    color: colors.danger,
    fontWeight: '600',
  },
});
