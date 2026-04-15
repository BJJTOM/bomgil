import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';
import { useT } from '../i18n';

type Step = 'phone' | 'code' | 'nickname';

// Format phone as user types: 01012345678 → 010-1234-5678
function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function isValidKoreanPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return /^01[016789]\d{7,8}$/.test(digits);
}

export default function PhoneAuthScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const login = useAuthStore((s) => s.login);
  const t = useT();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const verificationTokenRef = useRef<string | null>(null);

  // Reset navigation to Main so back button can't return to Login/PhoneAuth
  const goToMain = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      }),
    );
  };

  const handleSendCode = async () => {
    if (!phone.trim()) {
      Alert.alert(t.common.confirm, t.auth.phoneRequired);
      return;
    }
    if (!isValidKoreanPhone(phone)) {
      Alert.alert(t.common.confirm, t.auth.phoneInvalid);
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/phone/otp/send/', { phone_number: phone });
      setCode('');
      setStep('code');
    } catch (e: any) {
      const msg = e?.response?.data?.error || '인증번호 전송에 실패했습니다.';
      Alert.alert(t.auth.sendFailed, msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim() || code.length !== 6) {
      Alert.alert(t.common.confirm, t.auth.codeDesc);
      return;
    }
    setLoading(true);
    try {
      // Step A: verify the OTP and obtain a single-use verification token.
      // The server intentionally does NOT reveal whether the user exists
      // here; we discover that on the /complete/ call below.
      const { data } = await api.post('/auth/phone/otp/verify/', {
        phone_number: phone,
        code,
      });
      verificationTokenRef.current = data.verification_token;

      // Step B: try to complete WITHOUT a nickname.
      // - Existing user → login succeeds.
      // - New user → 400 with code: "nickname_required" → show nickname step.
      try {
        const { data: loginData } = await api.post('/auth/phone/otp/complete/', {
          verification_token: data.verification_token,
        });
        login(loginData.user, loginData.access, loginData.refresh);
        goToMain();
      } catch (completeErr: any) {
        if (completeErr?.response?.data?.code === 'nickname_required') {
          setStep('nickname');
        } else {
          throw completeErr;
        }
      }
    } catch (e: any) {
      Alert.alert(t.auth.verifyFailed, e?.response?.data?.error || t.auth.verifyFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleSetNickname = async () => {
    const trimmed = nickname.trim();
    if (trimmed.length < 2) {
      Alert.alert(t.common.confirm, t.auth.nicknameMinError);
      return;
    }
    if (trimmed.length > 20) {
      Alert.alert(t.common.confirm, t.auth.nicknameMaxError);
      return;
    }
    if (!verificationTokenRef.current) {
      Alert.alert(t.common.error, t.auth.codeExpired);
      setStep('phone');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/phone/otp/complete/', {
        verification_token: verificationTokenRef.current,
        nickname: trimmed,
      });
      login(data.user, data.access, data.refresh);
      goToMain();
    } catch (e: any) {
      Alert.alert(t.common.error, e?.response?.data?.error || t.auth.registerFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step === 'phone' ? navigation.goBack() : setStep('phone')}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {step === 'phone' && (
          <>
            <Text style={styles.title}>{t.auth.phoneTitle}</Text>
            <Text style={styles.desc}>{t.auth.phoneDesc}</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>{t.auth.phoneLabel}</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(v) => setPhone(formatPhoneInput(v))}
                placeholder={t.auth.phonePlaceholder}
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
                autoFocus
                maxLength={13}
              />
            </View>
            <Text style={styles.legal}>
              {t.auth.legalText}
            </Text>
            <TouchableOpacity
              style={[styles.btn, (!phone || loading) && styles.btnDisabled]}
              onPress={handleSendCode}
              disabled={!phone || loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t.auth.sendCode}</Text>}
            </TouchableOpacity>
          </>
        )}

        {step === 'code' && (
          <>
            <Text style={styles.title}>{t.auth.codeTitle}</Text>
            <Text style={styles.desc}>{phone}{'\n'}{t.auth.codeDesc}</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>{t.auth.codeTitle}</Text>
              <TextInput
                style={[styles.input, { fontSize: 24, letterSpacing: 8, textAlign: 'center' }]}
                value={code}
                onChangeText={setCode}
                placeholder="000000"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>
            <TouchableOpacity onPress={handleSendCode} disabled={loading}>
              <Text style={styles.resendText}>{t.auth.resendCode}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, (code.length !== 6 || loading) && styles.btnDisabled]}
              onPress={handleVerifyCode}
              disabled={code.length !== 6 || loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t.common.confirm}</Text>}
            </TouchableOpacity>
          </>
        )}

        {step === 'nickname' && (
          <>
            <Text style={styles.title}>{t.auth.nicknameTitle}</Text>
            <Text style={styles.desc}>{t.auth.nicknameDesc}</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>{t.auth.nicknameTitle}</Text>
              <TextInput
                style={styles.input}
                value={nickname}
                onChangeText={setNickname}
                placeholder={t.auth.nicknamePlaceholder}
                placeholderTextColor={colors.textTertiary}
                maxLength={20}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[styles.btn, (nickname.length < 2 || loading) && styles.btnDisabled]}
              onPress={handleSetNickname}
              disabled={nickname.length < 2 || loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t.auth.startBtn}</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  title: { fontSize: 26, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  desc: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: 32 },
  inputWrap: { marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: colors.textTertiary, marginBottom: 8 },
  input: {
    fontSize: 18, color: colors.textPrimary,
    borderBottomWidth: 1.5, borderBottomColor: '#E5E8EB',
    paddingVertical: 10,
  },
  legal: { fontSize: 11, color: colors.textTertiary, lineHeight: 16, marginTop: 8 },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 24,
  },
  btnDisabled: { backgroundColor: '#D5D9DD' },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  resendText: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: -8, marginBottom: 16 },
});
