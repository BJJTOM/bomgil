import React, { useState, useMemo } from 'react';
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

function getPasswordStrength(password: string): {
  level: number;
  label: string;
  color: string;
} {
  if (!password) return { level: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: '\uC57D\uD568', color: '#F87171' };
  if (score <= 2) return { level: 2, label: '\uBCF4\uD1B5', color: '#FBBF24' };
  if (score <= 3) return { level: 3, label: '\uC88B\uC74C', color: '#60A5FA' };
  return { level: 4, label: '\uAC15\uB825', color: '#22C55E' };
}

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { login } = useAuthStore();

  const [form, setForm] = useState({
    email: '',
    nickname: '',
    password1: '',
    password2: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const passwordStrength = useMemo(
    () => getPasswordStrength(form.password1),
    [form.password1],
  );

  const handleRegister = async () => {
    setError('');

    if (!form.nickname.trim()) {
      setError('\uB2C9\uB124\uC784\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694');
      return;
    }
    if (form.password1.length < 8) {
      setError('\uBE44\uBC00\uBC88\uD638\uB294 8\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4');
      return;
    }
    if (form.password1 !== form.password2) {
      setError('\uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4');
      return;
    }

    setLoading(true);
    try {
      const username = form.email.split('@')[0] + '_' + Date.now().toString(36);
      const { data } = await api.post('/auth/register/', { ...form, username });
      const { data: user } = await api.get('/auth/me/', {
        headers: { Authorization: `Bearer ${data.access}` },
      });
      login(user, data.access, data.refresh);
      navigation.popToTop();
    } catch (err: any) {
      const errors = err.response?.data;
      if (errors) {
        const firstError = Object.values(errors).flat()[0] as string;
        setError(firstError || '\uD68C\uC6D0\uAC00\uC785\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4');
      } else {
        setError('\uD68C\uC6D0\uAC00\uC785\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4');
      }
    } finally {
      setLoading(false);
    }
  };

  const isDisabled =
    loading || !form.email || !form.nickname || !form.password1 || !form.password2;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'\u2190'}</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          {/* Brand header */}
          <View style={styles.brandHeader}>
            <View style={styles.brandIcon}>
              <Text style={styles.brandLetter}>R</Text>
            </View>
            <Text style={styles.title}>{'\uD68C\uC6D0\uAC00\uC785'}</Text>
            <Text style={styles.subtitle}>
              {'\uAC77\uAE30 \uC5EC\uD589\uC744 \uD568\uAED8 \uC2DC\uC791\uD574\uBCFC\uAE4C\uC694?'}
            </Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Error message */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Email */}
            <Text style={styles.label}>{'\uC774\uBA54\uC77C'}</Text>
            <TextInput
              style={styles.input}
              placeholder="email@example.com"
              placeholderTextColor={colors.textTertiary}
              value={form.email}
              onChangeText={(v) => updateField('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Nickname */}
            <Text style={styles.label}>
              {'\uB2C9\uB124\uC784'} <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder={'\uB2C9\uB124\uC784 \uC785\uB825'}
              placeholderTextColor={colors.textTertiary}
              value={form.nickname}
              onChangeText={(v) => updateField('nickname', v)}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={50}
            />
            <Text style={styles.hint}>
              {'\uB2E4\uB978 \uC0AC\uC6A9\uC790\uC5D0\uAC8C \uBCF4\uC774\uB294 \uC774\uB984\uC785\uB2C8\uB2E4'}
            </Text>

            {/* Password */}
            <Text style={styles.label}>{'\uBE44\uBC00\uBC88\uD638'}</Text>
            <TextInput
              style={styles.input}
              placeholder={'8\uC790 \uC774\uC0C1 \uC785\uB825'}
              placeholderTextColor={colors.textTertiary}
              value={form.password1}
              onChangeText={(v) => updateField('password1', v)}
              secureTextEntry
              autoCapitalize="none"
            />

            {/* Password strength indicator */}
            {form.password1.length > 0 && (
              <View style={styles.strengthSection}>
                <View style={styles.strengthBars}>
                  {[1, 2, 3, 4].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.strengthBar,
                        {
                          backgroundColor:
                            i <= passwordStrength.level
                              ? passwordStrength.color
                              : colors.borderLight,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text
                  style={[
                    styles.strengthLabel,
                    { color: passwordStrength.color },
                  ]}>
                  {'\uBE44\uBC00\uBC88\uD638 \uAC15\uB3C4'}: {passwordStrength.label}
                </Text>
              </View>
            )}

            {/* Password Confirm */}
            <Text style={styles.label}>{'\uBE44\uBC00\uBC88\uD638 \uD655\uC778'}</Text>
            <TextInput
              style={styles.input}
              placeholder={'\uBE44\uBC00\uBC88\uD638 \uB2E4\uC2DC \uC785\uB825'}
              placeholderTextColor={colors.textTertiary}
              value={form.password2}
              onChangeText={(v) => updateField('password2', v)}
              secureTextEntry
              autoCapitalize="none"
            />
            {form.password2.length > 0 && form.password1 !== form.password2 && (
              <Text style={styles.mismatchText}>
                {'\uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4'}
              </Text>
            )}
            {form.password2.length > 0 && form.password1 === form.password2 && (
              <Text style={styles.matchText}>
                {'\uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD569\uB2C8\uB2E4'}
              </Text>
            )}

            {/* Register Button */}
            <TouchableOpacity
              style={[styles.registerBtn, isDisabled && styles.registerBtnDisabled]}
              onPress={handleRegister}
              disabled={isDisabled}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.registerBtnText}>{'\uD68C\uC6D0\uAC00\uC785'}</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{'\uB610\uB294'}</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Login link */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {'\uC774\uBBF8 \uACC4\uC815\uC774 \uC788\uC73C\uC2E0\uAC00\uC694?'}
              </Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.footerLink}>{'\uB85C\uADF8\uC778'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Terms notice */}
          <Text style={styles.termsText}>
            {'\uD68C\uC6D0\uAC00\uC785 \uC2DC '}
            <Text style={styles.termsLink}>{'\uC774\uC6A9\uC57D\uAD00'}</Text>
            {' \uBC0F '}
            <Text style={styles.termsLink}>{'\uAC1C\uC778\uC815\uBCF4\uCC98\uB9AC\uBC29\uCE68'}</Text>
            {'\uC5D0 \uB3D9\uC758\uD558\uAC8C \uB429\uB2C8\uB2E4'}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.warm,
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
    paddingHorizontal: 20,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brandIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  brandLetter: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  errorBox: {
    backgroundColor: 'rgba(255,75,75,0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 13,
    color: '#FF4B4B',
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 16,
  },
  required: {
    color: '#FF4B4B',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: '#fff',
  },
  hint: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 6,
  },
  strengthSection: {
    marginTop: 10,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  mismatchText: {
    fontSize: 11,
    color: '#FF4B4B',
    marginTop: 6,
  },
  matchText: {
    fontSize: 11,
    color: '#22C55E',
    marginTop: 6,
  },
  registerBtn: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerBtnDisabled: {
    opacity: 0.5,
  },
  registerBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 28,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderLight,
  },
  dividerText: {
    fontSize: 12,
    color: colors.textTertiary,
    paddingHorizontal: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 24,
    marginBottom: 32,
  },
  termsLink: {
    textDecorationLine: 'underline',
  },
});
