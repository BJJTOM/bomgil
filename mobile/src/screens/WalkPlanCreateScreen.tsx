/**
 * WalkPlanCreateScreen — form for registering a new walk plan (date,
 * pace, preferences, message). Mirrors the web /walk-plans/new page.
 *
 * The trail ID is either passed via route.params.trailId (coming from a
 * trail detail "register plan" button, when that wiring lands) or the
 * user can type it manually.
 */
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';
import { PACE_LABELS, useCreateWalkPlan } from '../hooks/useCompanions';

const GENDER_OPTIONS = [
  { value: 'any', label: '상관없음' },
  { value: 'male', label: '남성' },
  { value: 'female', label: '여성' },
];

const AGE_OPTIONS = [
  { value: 'any', label: '상관없음' },
  { value: '20s', label: '20대' },
  { value: '30s', label: '30대' },
  { value: '40s', label: '40대' },
  { value: '50s_plus', label: '50대+' },
];

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export default function WalkPlanCreateScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const createPlan = useCreateWalkPlan();

  const [trailId, setTrailId] = useState<string>(
    route.params?.trailId ? String(route.params.trailId) : '',
  );
  const [date, setDate] = useState<string>(todayIso());
  const [time, setTime] = useState<string>('');
  const [pace, setPace] = useState<'slow' | 'moderate' | 'fast'>('moderate');
  const [maxCompanions, setMaxCompanions] = useState<number>(3);
  const [gender, setGender] = useState<string>('any');
  const [ageRange, setAgeRange] = useState<string>('any');
  const [message, setMessage] = useState<string>('');

  const canSubmit =
    trailId.trim().length > 0 &&
    !!date &&
    !createPlan.isPending;

  const submit = async () => {
    const trailNum = parseInt(trailId, 10);
    if (!trailNum || Number.isNaN(trailNum)) {
      Alert.alert('코스 번호를 확인해주세요', '숫자만 입력해주세요.');
      return;
    }
    try {
      await createPlan.mutateAsync({
        trail: trailNum,
        planned_date: date,
        planned_time: time ? (time.length === 5 ? `${time}:00` : time) : null,
        pace,
        max_companions: maxCompanions,
        preferred_gender: gender,
        preferred_age_range: ageRange,
        message,
      });
      Alert.alert('등록 완료', '동행 일정이 등록되었어요.', [
        {
          text: '확인',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ||
        '등록에 실패했어요. 잠시 후 다시 시도해주세요.';
      Alert.alert('오류', msg);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.iconBtn}>
            <Feather name="arrow-left" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>일정 등록하기</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>코스 번호</Text>
          <TextInput
            value={trailId}
            onChangeText={setTrailId}
            keyboardType="number-pad"
            placeholder="예: 123"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
          />
          <Text style={styles.hint}>
            코스 상세 페이지에서 ID를 확인할 수 있어요.
          </Text>

          <Text style={styles.section}>날짜</Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
          />

          <Text style={styles.section}>출발 시간 (선택)</Text>
          <TextInput
            value={time}
            onChangeText={setTime}
            placeholder="HH:MM"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
          />

          <Text style={styles.section}>걷기 페이스</Text>
          <View style={styles.row}>
            {(['slow', 'moderate', 'fast'] as const).map((p) => {
              const label = PACE_LABELS[p];
              const active = pace === p;
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPace(p)}
                  style={[styles.pacePill, active && styles.pacePillActive]}>
                  <Text style={[styles.paceEmoji]}>{label.emoji}</Text>
                  <Text
                    style={[
                      styles.paceLabel,
                      active && styles.paceLabelActive,
                    ]}>
                    {label.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.section}>최대 동행 인원</Text>
          <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((n) => {
              const active = maxCompanions === n;
              return (
                <TouchableOpacity
                  key={n}
                  onPress={() => setMaxCompanions(n)}
                  style={[
                    styles.numCircle,
                    active && styles.numCircleActive,
                  ]}>
                  <Text
                    style={[styles.numText, active && styles.numTextActive]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.section}>성별 선호</Text>
          <View style={styles.row}>
            {GENDER_OPTIONS.map((o) => {
              const active = gender === o.value;
              return (
                <TouchableOpacity
                  key={o.value}
                  onPress={() => setGender(o.value)}
                  style={[styles.optPill, active && styles.optPillActive]}>
                  <Text
                    style={[
                      styles.optLabel,
                      active && styles.optLabelActive,
                    ]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.section}>나이대 선호</Text>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {AGE_OPTIONS.map((o) => {
              const active = ageRange === o.value;
              return (
                <TouchableOpacity
                  key={o.value}
                  onPress={() => setAgeRange(o.value)}
                  style={[styles.optPill, active && styles.optPillActive]}>
                  <Text
                    style={[
                      styles.optLabel,
                      active && styles.optLabelActive,
                    ]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.section}>한마디</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="어떤 걷기를 기대하나요?"
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={200}
            style={[styles.input, styles.textarea]}
          />

          <TouchableOpacity
            style={[styles.submit, !canSubmit && styles.submitDisabled]}
            disabled={!canSubmit}
            onPress={submit}
            activeOpacity={0.85}>
            <Text style={styles.submitText}>
              {createPlan.isPending ? '등록 중...' : '일정 등록하기'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    height: 52,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: { padding: 18, paddingBottom: 60 },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 20,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  hint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 6,
  },
  row: { flexDirection: 'row', gap: 8 },
  pacePill: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    alignItems: 'center',
  },
  pacePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  paceEmoji: { fontSize: 22, marginBottom: 4 },
  paceLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  paceLabelActive: { color: '#fff' },
  numCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  numText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  numTextActive: { color: '#fff' },
  optPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    marginBottom: 8,
  },
  optPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  optLabelActive: { color: '#fff' },
  submit: {
    marginTop: 28,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
