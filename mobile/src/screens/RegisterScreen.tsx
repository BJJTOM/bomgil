import React, { useState, useMemo, useRef } from 'react';
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

  if (score <= 1) return { level: 1, label: '약함', color: '#F87171' };
  if (score <= 2) return { level: 2, label: '보통', color: '#FBBF24' };
  if (score <= 3) return { level: 3, label: '좋음', color: '#60A5FA' };
  return { level: 4, label: '강력', color: '#22C55E' };
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
    phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw1, setShowPw1] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [phoneStep, setPhoneStep] = useState<'idle' | 'sent' | 'verified'>('idle');
  const [phoneCode, setPhoneCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const verificationTokenRef = useRef<string | null>(null);

  const sendPhoneCode = async () => {
    if (!form.phone.trim()) {
      setError('전화번호를 입력해주세요');
      return;
    }
    setSendingCode(true);
    setError('');
    try {
      await api.post('/auth/phone/otp/send/', { phone_number: form.phone });
      setPhoneStep('sent');
    } catch (e: any) {
      const msg = e?.response?.data?.error || '인증번호 전송에 실패했습니다';
      setError(msg);
    } finally {
      setSendingCode(false);
    }
  };

  const verifyPhoneCode = async () => {
    if (!phoneCode || phoneCode.length !== 6) {
      setError('6자리 인증번호를 입력해주세요');
      return;
    }
    setVerifyingCode(true);
    setError('');
    try {
      const { data } = await api.post('/auth/phone/otp/verify/', {
        phone_number: form.phone,
        code: phoneCode,
      });
      verificationTokenRef.current = data.verification_token;
      setPhoneStep('verified');
    } catch (e: any) {
      setError(e?.response?.data?.error || '인증번호가 일치하지 않습니다');
    } finally {
      setVerifyingCode(false);
    }
  };

  const updateField = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const passwordStrength = useMemo(
    () => getPasswordStrength(form.password1),
    [form.password1],
  );

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email);

  const handleRegister = async () => {
    setError('');

    if (phoneStep !== 'verified') {
      setError('전화번호 인증을 완료해주세요');
      return;
    }
    if (!isValidEmail(form.email)) {
      setError('올바른 이메일 주소를 입력해주세요');
      return;
    }
    if (!form.nickname.trim()) {
      setError('닉네임을 입력해주세요');
      return;
    }
    if (form.password1.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다');
      return;
    }
    if (form.password1 !== form.password2) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/phone/otp/complete/', {
        verification_token: verificationTokenRef.current,
        nickname: form.nickname.trim(),
        email: form.email,
      });
      login(data.user, data.access, data.refresh);
      navigation.replace('Main');
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || '회원가입에 실패했습니다';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const isDisabled =
    loading || phoneStep !== 'verified' || !form.email || !form.nickname || !form.password1 || !form.password2;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'←'}</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          {/* Brand header */}
          <View style={styles.brandHeader}>
            <View style={styles.brandIcon}>
              <Text style={styles.brandLetter}>M</Text>
            </View>
            <Text style={styles.title}>{'회원가입'}</Text>
            <Text style={styles.subtitle}>
              {'걷기 여행을 함께 시작해볼까요?'}
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

            {/* Phone verification */}
            <Text style={styles.label}>
              전화번호 <Text style={styles.required}>*</Text>
              {phoneStep === 'verified' && <Text style={{ color: '#22C55E', fontSize: 12 }}>  ✓ 인증완료</Text>}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }, phoneStep === 'verified' && { backgroundColor: '#F0FDF4' }]}
                placeholder="010-1234-5678"
                placeholderTextColor={colors.textTertiary}
                value={form.phone}
                onChangeText={(v) => updateField('phone', v)}
                keyboardType="phone-pad"
                editable={phoneStep !== 'verified'}
                maxLength={13}
              />
              <TouchableOpacity
                style={{
                  paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10,
                  backgroundColor: phoneStep === 'verified' ? '#E5E8EB' : colors.primary,
                  alignItems: 'center', justifyContent: 'center',
                }}
                onPress={sendPhoneCode}
                disabled={sendingCode || phoneStep === 'verified' || !form.phone}>
                {sendingCode ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: phoneStep === 'verified' ? colors.textTertiary : '#fff', fontSize: 13, fontWeight: '700' }}>
                    {phoneStep === 'idle' ? '인증번호' : '재전송'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {phoneStep === 'sent' && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, fontSize: 18, letterSpacing: 4, textAlign: 'center' }]}
                  placeholder="6자리 인증번호"
                  placeholderTextColor={colors.textTertiary}
                  value={phoneCode}
                  onChangeText={setPhoneCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10,
                    backgroundColor: colors.primary,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                  onPress={verifyPhoneCode}
                  disabled={verifyingCode || phoneCode.length !== 6}>
                  {verifyingCode ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>확인</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: 8 }} />

            {/* Email */}
            <Text style={styles.label}>{'이메일'}</Text>
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
              {'닉네임'} <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder={'닉네임 입력'}
              placeholderTextColor={colors.textTertiary}
              value={form.nickname}
              onChangeText={(v) => updateField('nickname', v)}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={50}
            />
            <Text style={styles.hint}>
              {'다른 사용자에게 보이는 이름입니다'}
            </Text>

            {/* Password */}
            <Text style={styles.label}>{'비밀번호'}</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                placeholder={'8자 이상 입력'}
                placeholderTextColor={colors.textTertiary}
                value={form.password1}
                onChangeText={(v) => updateField('password1', v)}
                secureTextEntry={!showPw1}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw1(!showPw1)}>
                <Text style={styles.eyeIcon}>{showPw1 ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>

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
                  {'비밀번호 강도'}: {passwordStrength.label}
                </Text>
              </View>
            )}

            {/* Password Confirm */}
            <Text style={styles.label}>{'비밀번호 확인'}</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                placeholder={'비밀번호 다시 입력'}
                placeholderTextColor={colors.textTertiary}
                value={form.password2}
                onChangeText={(v) => updateField('password2', v)}
                secureTextEntry={!showPw2}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw2(!showPw2)}>
                <Text style={styles.eyeIcon}>{showPw2 ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
            {form.password2.length > 0 && form.password1 !== form.password2 && (
              <Text style={styles.mismatchText}>
                {'비밀번호가 일치하지 않습니다'}
              </Text>
            )}
            {form.password2.length > 0 && form.password1 === form.password2 && (
              <Text style={styles.matchText}>
                {'비밀번호가 일치합니다'}
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
                <Text style={styles.registerBtnText}>{'회원가입'}</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{'또는'}</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Login link */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {'이미 계정이 있으신가요?'}
              </Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.footerLink}>{'로그인'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Terms notice */}
          <Text style={styles.termsText}>
            {'회원가입 시 '}
            <Text style={styles.termsLink}>{'이용약관'}</Text>
            {' 및 '}
            <Text style={styles.termsLink}>{'개인정보처리방침'}</Text>
            {'에 동의하게 됩니다'}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scroll: {
    flexGrow: 1,
  },
  backBtn: {
    paddingHorizontal: 20,
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
    borderRadius: 16,
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
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
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
    fontWeight: '600',
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
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: '#fff',
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 12,
    backgroundColor: '#fff',
    height: 48,
  },
  passwordInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 14,
    color: colors.textPrimary,
  },
  eyeBtn: {
    paddingHorizontal: 14,
    height: 48,
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 18,
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
    height: 52,
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
    fontSize: 15,
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
