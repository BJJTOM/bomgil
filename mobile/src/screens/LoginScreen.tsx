import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('\uC624\uB958', '\uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/email-login/', { email, password });
      login(data.user, data.tokens.access, data.tokens.refresh);
      navigation.goBack();
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        '\uB85C\uADF8\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4';
      Alert.alert('\uB85C\uADF8\uC778 \uC2E4\uD328', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setGuestLoading(true);
    try {
      const { data } = await api.post('/auth/guest-login/');
      login(data.user, data.tokens.access, data.tokens.refresh);
      navigation.goBack();
    } catch {
      Alert.alert('\uC624\uB958', '\uAC8C\uC2A4\uD2B8 \uB85C\uADF8\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4');
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'\u2190'}</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.logo}>Roami</Text>
          <Text style={styles.title}>{'\uB85C\uADF8\uC778'}</Text>
          <Text style={styles.subtitle}>
            {'\uAC77\uAE30 \uC5EC\uD589\uC758 \uBAA8\uB4E0 \uAC83\uC744 \uAE30\uB85D\uD558\uC138\uC694'}
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>{'\uC774\uBA54\uC77C'}</Text>
            <TextInput
              style={styles.input}
              placeholder="email@example.com"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>{'\uBE44\uBC00\uBC88\uD638'}</Text>
            <TextInput
              style={styles.input}
              placeholder={'\uBE44\uBC00\uBC88\uD638 \uC785\uB825'}
              placeholderTextColor={colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginBtnText}>{'\uB85C\uADF8\uC778'}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.guestBtn, guestLoading && styles.btnDisabled]}
              onPress={handleGuestLogin}
              disabled={guestLoading}>
              {guestLoading ? (
                <ActivityIndicator color={colors.textSecondary} />
              ) : (
                <Text style={styles.guestBtnText}>
                  {'\uAC8C\uC2A4\uD2B8\uB85C \uC2DC\uC791\uD558\uAE30'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {'\uACC4\uC815\uC774 \uC5C6\uC73C\uC2E0\uAC00\uC694?'}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}>
              <Text style={styles.footerLink}>{'\uD68C\uC6D0\uAC00\uC785'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    flexGrow: 1,
  },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backText: {
    fontSize: 24,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  logo: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  form: {},
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  loginBtn: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  guestBtn: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  guestBtnText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    gap: 6,
  },
  footerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
});
