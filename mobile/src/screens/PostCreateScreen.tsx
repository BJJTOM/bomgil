import React, { useState, useEffect } from 'react';
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

const CATEGORIES = [
  { key: 'free', label: '자유', icon: '💭', desc: '자유롭게 이야기' },
  { key: 'qna', label: '질문', icon: '❓', desc: '궁금한 것 질문' },
  { key: 'recommend', label: '추천', icon: '👍', desc: '코스/장소 추천' },
  { key: 'review', label: '후기', icon: '⭐', desc: '걷기 후기 공유' },
  { key: 'meetup', label: '번개', icon: '⚡', desc: '같이 걸을 사람' },
  { key: 'tip', label: '꿀팁', icon: '🍯', desc: '유용한 팁 공유' },
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

      // Upload new images
      if (images.length > 0) {
        const formData = new FormData();
        images.forEach((img) => {
          formData.append('images', {
            uri: img.uri,
            type: img.type || 'image/jpeg',
            name: img.fileName || `image_${Date.now()}.jpg`,
          } as any);
        });
        await api.post(`/community/posts/${postId}/images/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      queryClient.invalidateQueries({ queryKey: ['community-posts'] });
      queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
      navigation.goBack();
    } catch {
      Alert.alert('오류', '게시글 저장에 실패했습니다.');
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
        {/* Category — 토스 스타일 2열 그리드 */}
        <Text style={styles.sectionLabel}>카테고리</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.categoryCard, category === cat.key && styles.categoryCardActive]}
              onPress={() => setCategory(cat.key as PostCategory)}
              activeOpacity={0.7}>
              <Text style={styles.categoryCardIcon}>{cat.icon}</Text>
              <Text style={[styles.categoryCardLabel, category === cat.key && styles.categoryCardLabelActive]}>
                {cat.label}
              </Text>
              <Text style={[styles.categoryCardDesc, category === cat.key && { color: colors.primary }]}>
                {cat.desc}
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
          placeholder="내용을 입력하세요...&#10;&#10;걷기 경험, 질문, 추천 등 자유롭게 작성해주세요."
          placeholderTextColor={colors.textTertiary}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />

        {/* Images preview */}
        {(existingImages.length > 0 || images.length > 0) && (
          <View style={styles.imagePreviewSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagePreviewRow}>
              {existingImages.map((img) => (
                <View key={img.id} style={styles.imagePreviewItem}>
                  <Image source={{ uri: img.image }} style={styles.imagePreviewImg} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.imageRemoveBtn}
                    onPress={() => removeExistingImage(img.id)}>
                    <Text style={styles.imageRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {images.map((img, i) => (
                <View key={`new-${i}`} style={styles.imagePreviewItem}>
                  <Image source={{ uri: img.uri }} style={styles.imagePreviewImg} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.imageRemoveBtn}
                    onPress={() => removeImage(i)}>
                    <Text style={styles.imageRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Bottom toolbar */}
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolbarItem} onPress={handlePickImages}>
            <Text style={styles.toolbarIcon}>📷</Text>
            <Text style={styles.toolbarLabel}>사진 {totalImages > 0 ? `${totalImages}/10` : ''}</Text>
          </TouchableOpacity>
        </View>

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

  // Category grid — 2열
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  categoryCard: {
    width: '31%',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  categoryCardActive: {
    backgroundColor: '#F0F7F0',
    borderColor: colors.primary,
  },
  categoryCardIcon: { fontSize: 20, marginBottom: 4 },
  categoryCardLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  categoryCardLabelActive: { color: colors.primary },
  categoryCardDesc: { fontSize: 10, color: colors.textTertiary, textAlign: 'center' },

  titleInput: {
    fontSize: 18, fontWeight: '600', color: colors.textPrimary,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F2F4F6', marginHorizontal: 20 },
  contentInput: {
    fontSize: 15, color: colors.textPrimary, lineHeight: 24,
    paddingHorizontal: 20, paddingVertical: 16, minHeight: 200,
  },

  // Image preview
  imagePreviewSection: { paddingVertical: 8 },
  imagePreviewRow: { paddingHorizontal: 20, gap: 8 },
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
    flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F2F4F6',
    gap: 16,
  },
  toolbarItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toolbarIcon: { fontSize: 18 },
  toolbarLabel: { fontSize: 13, color: colors.textSecondary },
});
