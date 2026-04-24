import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { colors } from '../theme/colors';

type Category = 'bug' | 'feature' | 'ux' | 'content' | 'other';

const CATEGORIES: { value: Category; label: string; hint: string }[] = [
  { value: 'bug', label: '버그', hint: '작동이 이상해요' },
  { value: 'feature', label: '기능 제안', hint: '있으면 좋겠어요' },
  { value: 'ux', label: '사용성', hint: '헷갈려요' },
  { value: 'content', label: '코스/정보 오류', hint: '정보가 틀려요' },
  { value: 'other', label: '기타', hint: '자유 의견' },
];

export default function FeedbackScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isAuthenticated, user } = useAuthStore();
  const { isDark } = useThemeStore();

  const [category, setCategory] = useState<Category>('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const bg = isDark ? '#121212' : '#F9FAFB';
  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : colors.textPrimary;
  const metaColor = isDark ? 'rgba(255,255,255,0.6)' : colors.textSecondary;
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB';
  const inputBg = isDark ? '#0E0E0E' : '#F3F4F6';

  const submit = async () => {
    if (message.trim().length < 5) {
      Alert.alert('안내', '내용을 5자 이상 작성해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/community/feedback/', {
        category,
        message: message.trim(),
        email: isAuthenticated ? '' : email.trim(),
        url: 'mobile-app',
      });
      setSent(true);
      setMessage('');
      setEmail('');
    } catch (err: any) {
      const detail = err?.response?.data?.detail || '전송에 실패했어요. 잠시 후 다시 시도해 주세요.';
      Alert.alert('오류', detail);
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="chevron-left" size={24} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textColor }]}>의견 보내기</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 52, marginBottom: 12 }}>💌</Text>
          <Text style={[styles.sentTitle, { color: textColor }]}>의견이 전달됐어요</Text>
          <Text style={[styles.sentDesc, { color: metaColor }]}>
            빠르게 확인하고 필요하면{'\n'}이메일로 답장드릴게요.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 24 }}>
            <TouchableOpacity
              onPress={() => setSent(false)}
              style={[styles.primaryBtn, { flex: 1 }]}
            >
              <Text style={styles.primaryBtnText}>추가 의견</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.secondaryBtn, { flex: 1, borderColor }]}
            >
              <Text style={[styles.secondaryBtnText, { color: textColor }]}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>의견 보내기</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.intro, { color: metaColor }]}>
            베타 기간 주시는 의견 하나하나가 큰 도움이 됩니다. 버그·제안 모두 환영해요.
          </Text>

          <Text style={[styles.label, { color: textColor }]}>카테고리</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.map((c) => {
              const active = category === c.value;
              return (
                <TouchableOpacity
                  key={c.value}
                  onPress={() => setCategory(c.value)}
                  style={[
                    styles.catCell,
                    {
                      backgroundColor: active ? 'rgba(45,74,46,0.12)' : cardBg,
                      borderColor: active ? colors.primary : borderColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catLabel,
                      { color: active ? colors.primary : textColor },
                    ]}
                  >
                    {c.label}
                  </Text>
                  <Text style={[styles.catHint, { color: metaColor }]}>{c.hint}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { color: textColor }]}>
            내용{' '}
            <Text style={{ color: metaColor, fontWeight: '400', fontSize: 12 }}>
              ({message.length}/2000)
            </Text>
          </Text>
          <TextInput
            value={message}
            onChangeText={(v) => setMessage(v.slice(0, 2000))}
            placeholder="어떤 점이 불편하셨나요? 스크린샷은 이메일로 이어 보내주셔도 좋아요."
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF'}
            multiline
            numberOfLines={7}
            style={[
              styles.textarea,
              { backgroundColor: inputBg, color: textColor, borderColor },
            ]}
          />

          {!isAuthenticated && (
            <>
              <Text style={[styles.label, { color: textColor }]}>
                이메일{' '}
                <Text style={{ color: metaColor, fontWeight: '400', fontSize: 12 }}>
                  (선택)
                </Text>
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="답장받을 이메일 (비워도 됩니다)"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF'}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[
                  styles.input,
                  { backgroundColor: inputBg, color: textColor, borderColor },
                ]}
              />
            </>
          )}

          {isAuthenticated && user && (
            <Text style={[styles.authedNote, { color: metaColor }]}>
              로그인 상태로 전송돼요 ({user.nickname}) — 별도 이메일 입력 불필요.
            </Text>
          )}

          <TouchableOpacity
            onPress={submit}
            disabled={submitting}
            style={[styles.primaryBtn, { opacity: submitting ? 0.6 : 1 }]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>의견 보내기</Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.disclaimer, { color: metaColor }]}>
            제출 시 현재 페이지 정보와 기기 정보가 함께 저장됩니다.{'\n'}베타 종료 후 모든 데이터는 삭제돼요.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  backBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700',
  },
  intro: { fontSize: 13, lineHeight: 19, marginBottom: 18 },
  label: {
    fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 8,
  },
  catGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  catCell: {
    width: '48%', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1,
  },
  catLabel: { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  catHint: { fontSize: 11, marginTop: 2 },
  textarea: {
    minHeight: 140, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, textAlignVertical: 'top',
  },
  input: {
    height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 14,
  },
  authedNote: { fontSize: 11.5, marginTop: 6 },
  primaryBtn: {
    height: 50, borderRadius: 999, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 20,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14.5 },
  secondaryBtn: {
    height: 50, borderRadius: 999, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { fontWeight: '700', fontSize: 14 },
  disclaimer: {
    fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 16,
  },
  sentTitle: { fontSize: 18, fontWeight: '800' },
  sentDesc: {
    fontSize: 13.5, textAlign: 'center', marginTop: 6, lineHeight: 20,
  },
});
