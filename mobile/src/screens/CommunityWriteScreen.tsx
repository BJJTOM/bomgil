import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { colors } from '../theme/colors';

const MOODS = [
  { key: 'happy', emoji: '\u{1F60A}', label: '행복해요' },
  { key: 'peaceful', emoji: '☮️', label: '평화로워요' },
  { key: 'exciting', emoji: '\u{1F929}', label: '신나요' },
  { key: 'touching', emoji: '\u{1F979}', label: '감동이에요' },
  { key: 'funny', emoji: '\u{1F604}', label: '재밌어요' },
];

export default function CommunityWriteScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const canSubmit = content.trim().length > 0 && !submitting;

  const handleAiGenerate = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const { data } = await api.post('/stories/ai/generate/', {
        trail_title: title.trim() || '',
        distance_km: 0,
        mood: mood || 'happy',
        user_notes: content.trim(),
        language: 'ko',
        photo_count: 0,
      });
      if (data.content) {
        setContent(data.content);
      }
      if (data.title_suggestion && !title.trim()) {
        setTitle(data.title_suggestion);
      }
    } catch (err: any) {
      const msg =
        err?.response?.status === 429
          ? 'AI 사용 횟수를 초과했어요. 잠시 후 다시 시도해주세요.'
          : 'AI 이야기 생성에 실패했어요. 다시 시도해주세요.';
      Alert.alert('알림', msg);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post('/stories/create/', {
        title: title.trim() || undefined,
        content: content.trim(),
        mood: mood || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['community-feed'] });
      navigation.goBack();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || '글 작성에 실패했습니다. 다시 시도해주세요.';
      Alert.alert('오류', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>취소</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>글쓰기</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          disabled={!canSubmit}>
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[styles.submitBtnText, !canSubmit && styles.submitBtnTextDisabled]}>
              게시
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled">
        {/* Title Input */}
        <TextInput
          style={styles.titleInput}
          placeholder="제목 (선택)"
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        {/* AI Assist Button */}
        <View style={styles.aiRow}>
          <TouchableOpacity
            style={[styles.aiBtn, aiLoading && styles.aiBtnLoading]}
            onPress={handleAiGenerate}
            disabled={aiLoading}
            activeOpacity={0.7}>
            {aiLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.aiBtnIcon}>✨</Text>
            )}
            <Text style={styles.aiBtnText}>
              {aiLoading ? 'AI가 이야기를 작성하고 있어요...' : 'AI 도움받기'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content Input */}
        <TextInput
          style={styles.contentInput}
          placeholder="걷기 이야기를 공유해보세요..."
          placeholderTextColor={colors.textTertiary}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          maxLength={5000}
        />

        {/* Mood Selector */}
        <View style={styles.moodSection}>
          <Text style={styles.moodSectionTitle}>기분</Text>
          <View style={styles.moodRow}>
            {MOODS.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[
                  styles.moodPill,
                  mood === m.key && styles.moodPillActive,
                ]}
                onPress={() => setMood(mood === m.key ? '' : m.key)}>
                <Text style={styles.moodEmoji}>{m.emoji}</Text>
                <Text
                  style={[
                    styles.moodLabel,
                    mood === m.key && styles.moodLabelActive,
                  ]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  headerBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  headerBtnText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: colors.borderDefault,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  submitBtnTextDisabled: {
    color: colors.textTertiary,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  aiRow: {
    flexDirection: 'row',
    paddingTop: 12,
  },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primary50,
    gap: 6,
  },
  aiBtnLoading: {
    opacity: 0.7,
  },
  aiBtnIcon: {
    fontSize: 14,
  },
  aiBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  contentInput: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 24,
    minHeight: 200,
    paddingTop: 16,
    paddingBottom: 16,
  },
  moodSection: {
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  moodSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.bgSecondary,
    gap: 4,
  },
  moodPillActive: {
    backgroundColor: colors.primary50,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  moodEmoji: {
    fontSize: 14,
  },
  moodLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  moodLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});
