import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { colors } from '../theme/colors';

const CATEGORIES = [
  { key: 'hiking', label: '🏔 등산' },
  { key: 'walking', label: '🚶 산책' },
  { key: 'running', label: '🏃 러닝' },
  { key: 'trail', label: '🥾 트레일' },
  { key: 'photo', label: '📸 사진' },
  { key: 'social', label: '🤝 친목' },
];

const EMOJIS = ['🥾', '🏔', '🌿', '🌊', '🌸', '🏃', '📸', '☀️', '🍂', '🎒', '⛺', '🦅'];

export default function GroupCreateScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('walking');
  const [emoji, setEmoji] = useState('🥾');
  const [region, setRegion] = useState('');
  const [maxMembers, setMaxMembers] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length >= 2 && description.trim().length >= 5;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await api.post('/community/groups/create/', {
        name: name.trim(),
        description: description.trim(),
        category,
        emoji,
        region: region.trim(),
        max_members: maxMembers ? parseInt(maxMembers, 10) : 50,
        is_public: true,
      });
      queryClient.invalidateQueries({ queryKey: ['community-groups'] });
      navigation.goBack();
    } catch {
      Alert.alert('오류', '모임 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>취소</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>모임 만들기</Text>
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}>
          <Text style={[styles.submitText, !canSubmit && styles.submitTextDisabled]}>
            {submitting ? '...' : '만들기'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Emoji picker */}
        <Text style={styles.sectionLabel}>모임 아이콘</Text>
        <View style={styles.emojiGrid}>
          {EMOJIS.map((e) => (
            <TouchableOpacity
              key={e}
              style={[styles.emojiItem, emoji === e && styles.emojiItemActive]}
              onPress={() => setEmoji(e)}>
              <Text style={styles.emojiItemText}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Name */}
        <Text style={styles.sectionLabel}>모임 이름</Text>
        <TextInput
          style={styles.textInput}
          placeholder="모임 이름을 입력하세요"
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
          maxLength={50}
        />

        {/* Description */}
        <Text style={styles.sectionLabel}>소개</Text>
        <TextInput
          style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
          placeholder="모임에 대해 소개해주세요"
          placeholderTextColor={colors.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={500}
        />

        {/* Category */}
        <Text style={styles.sectionLabel}>카테고리</Text>
        <View style={styles.chipGrid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.chip, category === cat.key && styles.chipActive]}
              onPress={() => setCategory(cat.key)}>
              <Text style={[styles.chipText, category === cat.key && styles.chipTextActive]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Region */}
        <Text style={styles.sectionLabel}>지역 (선택)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="예: 서울, 부산"
          placeholderTextColor={colors.textTertiary}
          value={region}
          onChangeText={setRegion}
          maxLength={50}
        />

        {/* Max members */}
        <Text style={styles.sectionLabel}>정원 (선택)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="최대 인원 (기본 50명)"
          placeholderTextColor={colors.textTertiary}
          value={maxMembers}
          onChangeText={setMaxMembers}
          keyboardType="number-pad"
        />

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F2F4F6',
  },
  cancelBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  cancelText: { fontSize: 15, color: colors.textSecondary },
  headerTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  submitBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.primary },
  submitBtnDisabled: { backgroundColor: '#F2F4F6' },
  submitText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  submitTextDisabled: { color: colors.textTertiary },

  scroll: { flex: 1 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },

  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 8 },
  emojiItem: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center' },
  emojiItemActive: { backgroundColor: '#F0F7F0', borderWidth: 2, borderColor: colors.primary },
  emojiItemText: { fontSize: 22 },

  textInput: {
    marginHorizontal: 20,
    backgroundColor: '#F7F8FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#F2F4F6' },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
});
