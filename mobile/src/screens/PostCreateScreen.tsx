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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { launchImageLibrary } from 'react-native-image-picker';
import api from '../api/client';
import { colors } from '../theme/colors';
import { CommunityPost, PostCategory } from '../types';

const CATEGORIES: { key: PostCategory; label: string; desc: string }[] = [
  { key: 'free', label: '자유', desc: '자유롭게 이야기' },
  { key: 'qna', label: '질문', desc: '궁금한 것 질문' },
  { key: 'recommend', label: '추천', desc: '코스/장소 추천' },
  { key: 'review', label: '후기', desc: '걷기 후기 공유' },
  { key: 'meetup', label: '번개', desc: '같이 걸을 사람' },
  { key: 'tip', label: '꿀팁', desc: '유용한 팁 공유' },
];

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
  const editPost = route.params?.editPost as CommunityPost | undefined;
  const isEdit = !!editPost;

  const [category, setCategory] = useState<PostCategory>(editPost?.category || 'free');
  const [title, setTitle] = useState(editPost?.title || '');
  const [content, setContent] = useState(editPost?.content || '');
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [existingImages, setExistingImages] = useState<{ id: number; image: string }[]>(
    editPost?.images || []
  );
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length >= 2 && content.trim().length >= 5;
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
      try {
        await api.delete(`/community/posts/${editPost.id}/images/${imageId}/`);
      } catch {}
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
          category,
          title: title.trim(),
          content: content.trim(),
        });
        postId = editPost.id;
      } else {
        const { data } = await api.post('/community/posts/create/', {
          category,
          title: title.trim(),
          content: content.trim(),
        });
        postId = data.id;
      }

      // Upload new images — 게시글 생성 후 별도 요청
      if (images.length > 0) {
        const formData = new FormData();
        images.forEach((img, i) => {
          formData.append('images', {
            uri: img.uri,
            type: img.type || 'image/jpeg',
            name: img.fileName || `photo_${i}_${Date.now()}.jpg`,
          } as any);
        });
        await api.post(`/community/posts/${postId}/images/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      queryClient.invalidateQueries({ queryKey: ['community-posts'] });
      queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data?.title?.[0] || '게시글 저장에 실패했습니다.';
      Alert.alert('오류', msg);
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
        <Text style={styles.headerTitle}>{isEdit ? '수정하기' : '글쓰기'}</Text>
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}>
          <Text style={[styles.submitText, !canSubmit && styles.submitTextDisabled]}>
            {submitting ? '...' : isEdit ? '수정' : '완료'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Category — horizontal scroll */}
        <Text style={styles.sectionLabel}>카테고리</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.categoryChip, category === cat.key && styles.categoryChipActive]}
              onPress={() => setCategory(cat.key)}
              activeOpacity={0.7}>
              <Text style={[styles.categoryChipLabel, category === cat.key && styles.categoryChipLabelActive]}>
                {cat.label}
              </Text>
              <Text style={[styles.categoryChipDesc, category === cat.key && { color: 'rgba(255,255,255,0.8)' }]}>
                {cat.desc}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Title + 글자수 */}
        <View style={styles.inputSection}>
          <TextInput
            style={styles.titleInput}
            placeholder="제목을 입력하세요 (2~100자)"
            placeholderTextColor={colors.textTertiary}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          <Text style={[styles.charCount, title.length < 2 && title.length > 0 && { color: '#FF4B4B' }]}>
            {title.length}/100
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Content + 글자수 */}
        <View style={styles.inputSection}>
          <TextInput
            style={styles.contentInput}
            placeholder={'내용을 입력하세요 (5~5000자)\n\n걷기 경험, 질문, 추천 등 자유롭게 작성해주세요.'}
            placeholderTextColor={colors.textTertiary}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            maxLength={5000}
          />
          <Text style={[styles.charCount, content.length < 5 && content.length > 0 && { color: '#FF4B4B' }]}>
            {content.length}/5000
          </Text>
        </View>

        {/* Images preview */}
        {(existingImages.length > 0 || images.length > 0) && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagePreviewRow}>
            {existingImages.map((img) => (
              <View key={img.id} style={styles.imagePreviewItem}>
                <Image source={{ uri: img.image }} style={styles.imagePreviewImg} resizeMode="cover" />
                <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => removeExistingImage(img.id)}>
                  <Text style={styles.imageRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {images.map((img, i) => (
              <View key={`new-${i}`} style={styles.imagePreviewItem}>
                <Image source={{ uri: img.uri }} style={styles.imagePreviewImg} resizeMode="cover" />
                <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => removeImage(i)}>
                  <Text style={styles.imageRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Bottom toolbar */}
        <TouchableOpacity style={styles.toolbar} onPress={handlePickImages} activeOpacity={0.6}>
          <Text style={styles.toolbarIcon}>+</Text>
          <Text style={styles.toolbarLabel}>사진 추가 {totalImages > 0 ? `(${totalImages}/10)` : ''}</Text>
        </TouchableOpacity>

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
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },

  // Category — horizontal scroll pills
  categoryScroll: { paddingHorizontal: 20, gap: 8, paddingBottom: 16 },
  categoryChip: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: '#F7F8FA', borderWidth: 1.5, borderColor: 'transparent',
    minWidth: 80, alignItems: 'center',
  },
  categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryChipLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  categoryChipLabelActive: { color: '#FFFFFF' },
  categoryChipDesc: { fontSize: 10, color: colors.textTertiary },

  inputSection: { position: 'relative' },
  titleInput: {
    fontSize: 18, fontWeight: '600', color: colors.textPrimary,
    paddingHorizontal: 20, paddingVertical: 12, paddingRight: 60,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F2F4F6', marginHorizontal: 20 },
  contentInput: {
    fontSize: 15, color: colors.textPrimary, lineHeight: 24,
    paddingHorizontal: 20, paddingVertical: 16, minHeight: 200,
  },
  charCount: {
    position: 'absolute', right: 20, bottom: 8,
    fontSize: 11, color: colors.textTertiary,
  },

  // Image preview
  imagePreviewRow: { paddingHorizontal: 20, gap: 8, paddingVertical: 8 },
  imagePreviewItem: { position: 'relative' },
  imagePreviewImg: { width: 80, height: 80, borderRadius: 10, backgroundColor: '#F7F8FA' },
  imageRemoveBtn: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  imageRemoveText: { fontSize: 11, color: '#FFF', fontWeight: '600' },

  // Toolbar
  toolbar: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 8,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: '#F7F8FA', gap: 8,
  },
  toolbarIcon: { fontSize: 18, fontWeight: '300', color: colors.textSecondary },
  toolbarLabel: { fontSize: 14, color: colors.textSecondary },
});
