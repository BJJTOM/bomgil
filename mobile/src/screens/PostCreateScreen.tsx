import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { launchImageLibrary } from 'react-native-image-picker';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';
import { colors } from '../theme/colors';
import { useThemeStore } from '../stores/theme';
import { CommunityPost, PostCategory } from '../types';

const API_URL = 'https://api.moruwalk.com/api/v1';

const CATEGORIES: { key: PostCategory; label: string }[] = [
  { key: 'free', label: '자유' },
  { key: 'qna', label: '질문' },
  { key: 'recommend', label: '추천' },
  { key: 'review', label: '후기' },
  { key: 'meetup', label: '번개' },
  { key: 'tip', label: '꿀팁' },
];

const TITLE_MIN = 2;
const TITLE_MAX = 100;
const CONTENT_MIN = 5;
const CONTENT_MAX = 5000;

interface SelectedImage {
  uri: string;
  type?: string;
  fileName?: string;
}

export default function PostCreateScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { isDark } = useThemeStore();
  const editPost = route.params?.editPost as CommunityPost | undefined;
  const isEdit = !!editPost;

  const bg = isDark ? '#0a0a0a' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : colors.textPrimary;
  const textSecColor = isDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary;
  const textTertColor = isDark ? 'rgba(255,255,255,0.4)' : colors.textTertiary;
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F6';
  const inputBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const chipBg = isDark ? '#1e1e1e' : '#F7F8FA';

  const [category, setCategory] = useState<PostCategory>(editPost?.category || 'free');
  const [title, setTitle] = useState(editPost?.title || '');
  const [content, setContent] = useState(editPost?.content || '');
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [existingImages, setExistingImages] = useState<{ id: number; image: string }[]>(
    editPost?.images || []
  );
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length >= TITLE_MIN && content.trim().length >= CONTENT_MIN;
  const totalImages = images.length + existingImages.length;

  const handlePickImages = async () => {
    if (totalImages >= 10) {
      Alert.alert('알림', '이미지는 최대 10장까지 추가할 수 있어요.');
      return;
    }
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 10 - totalImages,
        quality: 0.8,
        maxWidth: 1200,
        maxHeight: 1200,
      });
      if (result.assets) {
        const newImages = result.assets
          .filter((a) => a.uri)
          .map((a) => ({ uri: a.uri!, type: a.type, fileName: a.fileName }));
        setImages((prev) => [...prev, ...newImages]);
      }
    } catch {}
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = async (imageId: number) => {
    if (editPost) {
      try { await api.delete(`/community/posts/${editPost.id}/images/${imageId}/`); } catch {}
    }
    setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      let postId: number;

      if (isEdit && editPost) {
        await api.patch(`/community/posts/${editPost.id}/update/`, {
          category, title: title.trim(), content: content.trim(),
        });
        postId = editPost.id;
      } else {
        const { data } = await api.post('/community/posts/create/', {
          category, title: title.trim(), content: content.trim(),
        }, { timeout: 15000 });
        postId = data.id;
      }

      // 이미지 업로드 (실패해도 게시글은 저장됨)
      if (images.length > 0 && postId) {
        try {
          const formData = new FormData();
          for (const img of images) {
            formData.append('images', {
              uri: img.uri,
              type: img.type || 'image/jpeg',
              name: img.fileName || `photo_${Date.now()}.jpg`,
            } as any);
          }
          const token = useAuthStore.getState().accessToken;
          const res = await fetch(`${API_URL}/community/posts/${postId}/images/`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`${res.status}: ${errText.slice(0, 200)}`);
          }
        } catch (imgErr: any) {
          const errDetail = imgErr?.response?.data ? JSON.stringify(imgErr.response.data).slice(0, 200) : imgErr?.message || 'unknown';
          Alert.alert('이미지 업로드 실패', errDetail);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['community-posts'] });
      if (postId) queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
      navigation.goBack();
    } catch (e: any) {
      const errData = e?.response?.data;
      const status = e?.response?.status;
      let msg = '게시글 저장에 실패했습니다.';
      if (status === 429) {
        msg = '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.';
      } else if (errData && typeof errData === 'object') {
        const firstKey = Object.keys(errData)[0];
        const firstVal = Array.isArray(errData[firstKey]) ? errData[firstKey][0] : errData[firstKey];
        msg = typeof firstVal === 'string' ? firstVal : JSON.stringify(firstVal);
      } else if (e?.code === 'ECONNABORTED' || e?.message?.includes('timeout')) {
        msg = '서버 응답이 느립니다. 다시 시도해주세요.';
      }
      Alert.alert('오류', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: textSecColor }]}>{'\uCDE8\uC18C'}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>{isEdit ? '\uC218\uC815\uD558\uAE30' : '\uAE00\uC4F0\uAE30'}</Text>
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && [styles.submitBtnDisabled, isDark && { backgroundColor: '#2a2a2a' }]]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={[styles.submitText, !canSubmit && [styles.submitTextDisabled, isDark && { color: 'rgba(255,255,255,0.3)' }]]}>
              {isEdit ? '\uC218\uC815' : '\uC644\uB8CC'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.categoryChip, { backgroundColor: chipBg }, category === cat.key && styles.categoryChipActive]}
              onPress={() => setCategory(cat.key)}
              activeOpacity={0.7}>
              <Text style={[styles.categoryChipText, { color: textSecColor }, category === cat.key && styles.categoryChipTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Title */}
        <View style={styles.fieldWrap}>
          <TextInput
            style={[styles.titleInput, { color: textColor }]}
            placeholder={`\uC81C\uBAA9 (${TITLE_MIN}~${TITLE_MAX}\uC790)`}
            placeholderTextColor={textTertColor}
            value={title}
            onChangeText={setTitle}
            maxLength={TITLE_MAX}
          />
          <Text style={[
            styles.charCount,
            { color: textTertColor },
            title.length > 0 && title.length < TITLE_MIN && styles.charCountWarn,
          ]}>
            {title.length}/{TITLE_MAX}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: borderColor }]} />

        {/* Content */}
        <View style={styles.fieldWrap}>
          <TextInput
            style={[styles.contentInput, { color: textColor }]}
            placeholder={`\uB0B4\uC6A9\uC744 \uC785\uB825\uD558\uC138\uC694 (${CONTENT_MIN}~${CONTENT_MAX}\uC790)`}
            placeholderTextColor={textTertColor}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            maxLength={CONTENT_MAX}
          />
          <Text style={[
            styles.charCountBottom,
            { color: textTertColor },
            content.length > 0 && content.length < CONTENT_MIN && styles.charCountWarn,
          ]}>
            {content.length}/{CONTENT_MAX}
          </Text>
        </View>

        {/* Image upload area */}
        <View style={styles.imageArea}>
          <TouchableOpacity style={[styles.addImageBtn, isDark && { borderColor: 'rgba(255,255,255,0.15)' }]} onPress={handlePickImages} activeOpacity={0.6}>
            <Text style={[styles.addImageIcon, { color: textTertColor }]}>+</Text>
            <Text style={[styles.addImageLabel, { color: textTertColor }]}>{totalImages}/10</Text>
          </TouchableOpacity>

          {existingImages.map((img) => (
            <View key={img.id} style={styles.imageThumb}>
              <Image source={{ uri: img.image }} style={styles.imageThumbImg} resizeMode="cover" />
              <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => removeExistingImage(img.id)}>
                <Text style={styles.imageRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {images.map((img, i) => (
            <View key={`new-${i}`} style={styles.imageThumb}>
              <Image source={{ uri: img.uri }} style={styles.imageThumbImg} resizeMode="cover" />
              <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => removeImage(i)}>
                <Text style={styles.imageRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  // Header
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

  // Category chips — 한 줄 가로 스크롤
  categoryRow: { paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  categoryChip: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20,
    backgroundColor: '#F7F8FA',
  },
  categoryChipActive: { backgroundColor: colors.primary },
  categoryChipText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  categoryChipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  // Title
  fieldWrap: { position: 'relative' },
  titleInput: {
    fontSize: 18, fontWeight: '600', color: colors.textPrimary,
    paddingHorizontal: 20, paddingVertical: 14, paddingRight: 70,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F2F4F6', marginHorizontal: 20 },

  // Content
  contentInput: {
    fontSize: 15, color: colors.textPrimary, lineHeight: 24,
    paddingHorizontal: 20, paddingVertical: 16, minHeight: 200,
  },

  // Char count
  charCount: { position: 'absolute', right: 20, top: 16, fontSize: 11, color: colors.textTertiary },
  charCountBottom: { position: 'absolute', right: 20, bottom: 12, fontSize: 11, color: colors.textTertiary },
  charCountWarn: { color: '#FF4B4B' },

  // Image area — 가로 스크롤 그리드
  imageArea: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 20, paddingVertical: 12, gap: 8,
  },
  addImageBtn: {
    width: 72, height: 72, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E8EB',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
  },
  addImageIcon: { fontSize: 22, fontWeight: '300', color: colors.textTertiary, lineHeight: 24 },
  addImageLabel: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },
  imageThumb: { position: 'relative' },
  imageThumbImg: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#F7F8FA' },
  imageRemoveBtn: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  imageRemoveText: { fontSize: 10, color: '#FFF', fontWeight: '600' },
});
