import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import auth from '@react-native-firebase/auth';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';

type Step = 'phone' | 'code' | 'nickname';

export default function PhoneAuthScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { setTokens, setUser } = useAuthStore();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const confirmationRef = useRef<any>(null);
  const idTokenRef = useRef<string | null>(null);

  const formatPhone = (raw: string) => {
    // Convert "01012345678" → "+821012345678"
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('0')) {
      return '+82' + digits.substring(1);
    }
    if (digits.startsWith('82')) {
      return '+' + digits;
    }
    return raw.startsWith('+') ? raw : '+' + digits;
  };

  const handleSendCode = async () => {
    if (!phone.trim()) {
      Alert.alert('알림', '전화번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      const formattedPhone = formatPhone(phone);
      const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
      confirmationRef.current = confirmation;
      setStep('code');
    } catch (e: any) {
      Alert.alert('전송 실패', e?.message || '인증번호 전송에 실패했습니다. 전화번호를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim() || code.length !== 6) {
      Alert.alert('알림', '6자리 인증번호를 입력해주세요.');
      return;
    }
    if (!confirmationRef.current) {
      Alert.alert('오류', '인증 세션이 만료되었습니다. 다시 시도해주세요.');
      setStep('phone');
      return;
    }
    setLoading(true);
    try {
      const userCred = await confirmationRef.current.confirm(code);
      const idToken = await userCred.user.getIdToken();
      idTokenRef.current = idToken;

      // Try to login first (existing user)
      const { data } = await api.post('/auth/phone/firebase/', { id_token: idToken });
      if (data.is_new) {
        // New user — ask for nickname
        setStep('nickname');
      } else {
        // Existing user — login complete
        setTokens(data.access, data.refresh);
        setUser(data.user);
        navigation.replace('Main');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || '인증에 실패했습니다.';
      Alert.alert('인증 실패', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSetNickname = async () => {
    if (!nickname.trim() || nickname.length < 2) {
      Alert.alert('알림', '닉네임은 2자 이상이어야 합니다.');
      return;
    }
    if (!idTokenRef.current) {
      Alert.alert('오류', '세션이 만료되었습니다.');
      setStep('phone');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/phone/firebase/', {
        id_token: idTokenRef.current,
        nickname: nickname.trim(),
      });
      setTokens(data.access, data.refresh);
      setUser(data.user);
      navigation.replace('Main');
    } catch (e: any) {
      Alert.alert('오류', e?.response?.data?.error || '가입에 실패했습니다.');
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
            <Text style={styles.title}>전화번호로 시작하기</Text>
            <Text style={styles.desc}>가입 또는 로그인을 위해{'\n'}전화번호를 입력해주세요.</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>전화번호</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="010-1234-5678"
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
                autoFocus
                maxLength={13}
              />
            </View>
            <Text style={styles.legal}>
              계속하면 모루의 서비스 이용약관 및 개인정보처리방침에 동의하는 것으로 간주됩니다.
            </Text>
            <TouchableOpacity
              style={[styles.btn, (!phone || loading) && styles.btnDisabled]}
              onPress={handleSendCode}
              disabled={!phone || loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>인증번호 받기</Text>}
            </TouchableOpacity>
          </>
        )}

        {step === 'code' && (
          <>
            <Text style={styles.title}>인증번호 입력</Text>
            <Text style={styles.desc}>{phone}{'\n'}로 전송된 6자리 인증번호를 입력해주세요.</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>인증번호</Text>
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
              <Text style={styles.resendText}>인증번호 다시 받기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, (code.length !== 6 || loading) && styles.btnDisabled]}
              onPress={handleVerifyCode}
              disabled={code.length !== 6 || loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>확인</Text>}
            </TouchableOpacity>
          </>
        )}

        {step === 'nickname' && (
          <>
            <Text style={styles.title}>닉네임 설정</Text>
            <Text style={styles.desc}>모루에서 사용할 닉네임을 입력해주세요.</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>닉네임</Text>
              <TextInput
                style={styles.input}
                value={nickname}
                onChangeText={setNickname}
                placeholder="2~20자"
                placeholderTextColor={colors.textTertiary}
                maxLength={20}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[styles.btn, (nickname.length < 2 || loading) && styles.btnDisabled]}
              onPress={handleSetNickname}
              disabled={nickname.length < 2 || loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>모루 시작하기</Text>}
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
