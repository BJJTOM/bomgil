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
  { key: 'free', label: '자유', icon: '💭' },
  { key: 'qna', label: '질문', icon: '❓' },
  { key: 'recommend', label: '추천', icon: '👍' },
  { key: 'review', label: '후기', icon: '⭐' },
  { key: 'meetup', label: '번개', icon: '⚡' },
  { key: 'tip', label: '꿀팁', icon: '🍯' },
];

export default function PostCreateScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState('free');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length >= 2 && content.trim().length >= 5;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await api.post('/community/posts/create/', {
        category,
        title: title.trim(),
        content: content.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ['community-posts'] });
      navigation.goBack();
    } catch {
      Alert.alert('오류', '게시글 작성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>취소</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>글쓰기</Text>
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}>
          <Text style={[styles.submitText, !canSubmit && styles.submitTextDisabled]}>
            {submitting ? '...' : '완료'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Category selector — 토스 스타일 pills */}
        <Text style={styles.sectionLabel}>카테고리</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.categoryChip, category === cat.key && styles.categoryChipActive]}
              onPress={() => setCategory(cat.key)}
              activeOpacity={0.7}>
              <Text style={[styles.categoryChipText, category === cat.key && styles.categoryChipTextActive]}>
                {cat.icon} {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Title */}
        <TextInput
          style={styles.titleInput}
          placeholder="제목을 입력하세요"
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        <View style={styles.divider} />

        {/* Content */}
        <TextInput
          style={styles.contentInput}
          placeholder="내용을 입력하세요..."
          placeholderTextColor={colors.textTertiary}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F4F6',
  },
  cancelBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  cancelText: { fontSize: 15, color: colors.textSecondary },
  headerTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  submitBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.primary },
  submitBtnDisabled: { backgroundColor: '#F2F4F6' },
  submitText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  submitTextDisabled: { color: colors.textTertiary },

  scroll: { flex: 1 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 8, marginBottom: 20 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryChipText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  categoryChipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  titleInput: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F2F4F6', marginHorizontal: 20 },
  contentInput: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 200,
  },
});
