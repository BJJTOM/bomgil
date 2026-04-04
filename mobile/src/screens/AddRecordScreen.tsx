import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { colors } from '../theme/colors';

const SOURCES = [
  { value: 'phone_gps', label: '스마트폰 GPS', icon: '📍' },
  { value: 'apple_watch', label: 'Apple Watch', icon: '⌚' },
  { value: 'garmin', label: 'Garmin', icon: '⌚' },
  { value: 'samsung_health', label: 'Samsung Health', icon: '📱' },
  { value: 'google_fit', label: 'Google Fit', icon: '📱' },
  { value: 'cashwalk', label: '캐시워크', icon: '🚶' },
  { value: 'strava', label: 'Strava', icon: '🏃' },
];

export default function AddRecordScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const [source, setSource] = useState('phone_gps');
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState('');
  const [calories, setCalories] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('오류', '제목을 입력해주세요');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/activities/', {
        source,
        title: title.trim(),
        track_points: [],
        total_steps: steps ? parseInt(steps) : null,
        calories_burned: calories ? parseInt(calories) : null,
      });
      qc.invalidateQueries({ queryKey: ['activities'] });
      qc.invalidateQueries({ queryKey: ['activity-stats'] });
      Alert.alert('완료', '기록이 추가되었습니다', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('오류', '기록 추가에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'\u2190'} 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>기록 추가</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Source */}
      <Text style={styles.label}>데이터 소스</Text>
      <View style={styles.sourceGrid}>
        {SOURCES.map((s) => (
          <TouchableOpacity
            key={s.value}
            style={[styles.sourceItem, source === s.value && styles.sourceActive]}
            onPress={() => setSource(s.value)}
            activeOpacity={0.7}>
            <Text style={styles.sourceIcon}>{s.icon}</Text>
            <Text
              style={[
                styles.sourceLabel,
                source === s.value && styles.sourceLabelActive,
              ]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Fields */}
      <Text style={styles.label}>제목</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="예: 한강 산책"
        placeholderTextColor={colors.textTertiary}
      />

      <Text style={styles.label}>걸음수 (선택)</Text>
      <TextInput
        style={styles.input}
        value={steps}
        onChangeText={setSteps}
        placeholder="8500"
        placeholderTextColor={colors.textTertiary}
        keyboardType="numeric"
      />

      <Text style={styles.label}>칼로리 (선택)</Text>
      <TextInput
        style={styles.input}
        value={calories}
        onChangeText={setCalories}
        placeholder="350"
        placeholderTextColor={colors.textTertiary}
        keyboardType="numeric"
      />

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.85}>
        <Text style={styles.submitText}>
          {submitting ? '저장 중...' : '기록 저장'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backBtnText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 24,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  sourceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sourceActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary50,
  },
  sourceIcon: {
    fontSize: 16,
  },
  sourceLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  sourceLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    marginHorizontal: 20,
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
