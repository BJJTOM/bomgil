import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  Share,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { colors } from '../theme/colors';
import { WalkStory, StoryComment } from '../types';
import { useAuthStore } from '../stores/auth';

const MOOD_MAP: Record<string, { emoji: string; label: string; bg: string; text: string }> = {
  happy: { emoji: '\u{1F60A}', label: '행복해요', bg: '#FFFBEB', text: '#B45309' },
  peaceful: { emoji: '☮️', label: '평화로워요', bg: '#EFF6FF', text: '#1D4ED8' },
  exciting: { emoji: '\u{1F929}', label: '신나요', bg: '#FFF7ED', text: '#C2410C' },
  touching: { emoji: '\u{1F979}', label: '감동이에요', bg: '#FDF2F8', text: '#BE185D' },
  funny: { emoji: '\u{1F604}', label: '재밌어요', bg: '#F0FDF4', text: '#15803D' },
};

export default function StoryDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const storyId = route.params?.id;

  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{id: number; nickname: string} | null>(null);

  const { data: story, isLoading } = useQuery<WalkStory>({
    queryKey: ['story', storyId],
    queryFn: async () => {
      const { data } = await api.get(`/stories/${storyId}/`);
      return data;
    },
    enabled: !!storyId,
  });

  const { data: comments = [], refetch: refetchComments } = useQuery<StoryComment[]>({
    queryKey: ['story-comments', storyId],
    queryFn: async () => {
      const { data } = await api.get(`/stories/${storyId}/comments/`);
      return data.results ?? data;
    },
    enabled: !!storyId,
  });

  const handleLike = () => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    if (!story) return;
    // Optimistic update for detail view
    queryClient.setQueryData(['story', storyId], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        is_liked: !old.is_liked,
        like_count: old.is_liked ? old.like_count - 1 : old.like_count + 1,
      };
    });
    // Also update feed cache
    queryClient.setQueryData(['community-feed'], (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map((s: any) =>
        s.id === storyId
          ? { ...s, is_liked: !s.is_liked, like_count: s.is_liked ? s.like_count - 1 : s.like_count + 1 }
          : s,
      );
    });
    api.post(`/stories/${storyId}/like/`).catch(() => {
      queryClient.invalidateQueries({ queryKey: ['story', storyId] });
      queryClient.invalidateQueries({ queryKey: ['community-feed'] });
    });
  };

  const handleShare = () => {
    if (!story) return;
    Share.share({
      message: `${story.title || ''}\n${story.content.slice(0, 100)}...\n\nRoami에서 확인하세요!`,
    });
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || submittingComment) return;
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    setSubmittingComment(true);
    try {
      await api.post(`/stories/${storyId}/comments/create/`, {
        content: commentText.trim(),
        parent: replyingTo?.id,
      });
      setCommentText('');
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ['story-comments', storyId] });
      queryClient.invalidateQueries({ queryKey: ['story', storyId] });
      Keyboard.dismiss();
      // Update comment count in feed
      queryClient.setQueryData(['community-feed'], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((s: any) =>
          s.id === storyId ? { ...s, comment_count: s.comment_count + 1 } : s,
        );
      });
    } catch (err: any) {
      Alert.alert('오류', '댓글 작성에 실패했습니다');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  if (isLoading || !story) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{'←'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>스토리</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const mood = MOOD_MAP[story.mood];
  const photos = story.photos || [];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>스토리</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled">
        {/* Author */}
        <View style={styles.authorRow}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarInner}>
              {story.author.profile_image ? (
                <Image source={{ uri: story.author.profile_image }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarFallback}>{'\u{1F464}'}</Text>
              )}
            </View>
          </View>
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{story.author.nickname}</Text>
            <Text style={styles.timeText}>{timeAgo(story.created_at)}</Text>
          </View>
        </View>

        {/* Mood */}
        {mood && (
          <View style={[styles.moodTag, { backgroundColor: mood.bg }]}>
            <Text style={[styles.moodText, { color: mood.text }]}>
              {mood.emoji} {mood.label}
            </Text>
          </View>
        )}

        {/* Title */}
        {story.title ? <Text style={styles.storyTitle}>{story.title}</Text> : null}

        {/* Content */}
        <Text style={styles.storyContent}>{story.content}</Text>

        {/* Photos */}
        {photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
            {photos.map((p) => (
              <Image
                key={p.id}
                source={{ uri: p.image }}
                style={styles.photoItem}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
            <Text style={styles.actionIcon}>
              {story.is_liked ? '❤️' : '\u{1F90D}'}
            </Text>
            <Text style={[styles.actionLabel, story.is_liked && { color: '#FF4B4B' }]}>
              좋아요 {story.like_count > 0 ? story.like_count : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
            <Text style={styles.actionIcon}>{'⬆️'}</Text>
            <Text style={styles.actionLabel}>공유</Text>
          </TouchableOpacity>
        </View>

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsSectionTitle}>
            댓글 {story.comment_count > 0 ? story.comment_count : 0}개
          </Text>
          {comments.length === 0 ? (
            <Text style={styles.noComments}>아직 댓글이 없어요. 첫 댓글을 남겨보세요!</Text>
          ) : (
            comments.map((comment) => (
              <View key={comment.id} style={styles.commentItem}>
                <View style={styles.commentAvatar}>
                  {comment.author.profile_image ? (
                    <Image source={{ uri: comment.author.profile_image }} style={styles.commentAvatarImg} />
                  ) : (
                    <Text style={styles.commentAvatarFallback}>{'\u{1F464}'}</Text>
                  )}
                </View>
                <View style={styles.commentBody}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>{comment.author.nickname}</Text>
                    <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
                  </View>
                  <Text style={styles.commentContent}>{comment.content}</Text>
                  <TouchableOpacity
                    style={styles.replyBtn}
                    onPress={() => setReplyingTo({ id: comment.id, nickname: comment.author.nickname })}>
                    <Text style={styles.replyBtnText}>답글</Text>
                  </TouchableOpacity>
                  {comment.replies && comment.replies.length > 0 && (
                    <View style={styles.repliesWrap}>
                      {comment.replies.map((reply) => (
                        <View key={reply.id} style={styles.replyItem}>
                          <View style={styles.replyAvatar}>
                            <Text style={{fontSize: 10}}>{'\u{1F464}'}</Text>
                          </View>
                          <View style={styles.replyContentWrap}>
                            <Text style={styles.replyAuthor}>{reply.author?.nickname}</Text>
                            <Text style={styles.replyContent}>{reply.content}</Text>
                            <Text style={styles.replyTime}>{timeAgo(reply.created_at)}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Comment Input */}
      <View style={[styles.commentInputBar, { paddingBottom: insets.bottom + 8 }]}>
        {replyingTo && (
          <View style={styles.replyingBanner}>
            <Text style={styles.replyingText}>@{replyingTo.nickname}에게 답글 작성 중</Text>
            <TouchableOpacity onPress={handleCancelReply}>
              <Text style={styles.replyingCancel}>취소</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.commentInputRow}>
        <TextInput
          style={styles.commentInput}
          placeholder={replyingTo ? `@${replyingTo.nickname}에게 답글` : '댓글을 입력하세요...'}
          placeholderTextColor={colors.textTertiary}
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.commentSendBtn, !commentText.trim() && styles.commentSendBtnDisabled]}
          onPress={handleSubmitComment}
          disabled={!commentText.trim() || submittingComment}>
          {submittingComment ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.commentSendText}>{'↑'}</Text>
          )}
        </TouchableOpacity>
        </View>
      </View>
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
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 22,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    gap: 12,
  },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 2,
    backgroundColor: colors.accent,
  },
  avatarInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    fontSize: 18,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  timeText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  moodTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  moodText: {
    fontSize: 12,
    fontWeight: '600',
  },
  storyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 28,
    marginBottom: 8,
  },
  storyContent: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 26,
    marginBottom: 16,
  },
  photosRow: {
    marginBottom: 16,
  },
  photoItem: {
    width: 240,
    height: 180,
    borderRadius: 12,
    marginRight: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  commentsSection: {
    paddingTop: 20,
  },
  commentsSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  noComments: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 24,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  commentAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentAvatarFallback: {
    fontSize: 14,
  },
  commentBody: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  commentTime: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  commentContent: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  replyBtn: {
    marginTop: 4,
    paddingVertical: 2,
  },
  replyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  repliesWrap: {
    marginTop: 10,
    paddingLeft: 4,
    borderLeftWidth: 2,
    borderLeftColor: colors.borderLight,
  },
  replyItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    paddingLeft: 8,
  },
  replyAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyContentWrap: {
    flex: 1,
  },
  replyAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 1,
  },
  replyContent: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  replyTime: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },
  replyingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 6,
    width: '100%',
  },
  replyingText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  replyingCancel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
  commentInputBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    backgroundColor: '#fff',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    maxHeight: 80,
  },
  commentSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentSendBtnDisabled: {
    backgroundColor: colors.borderDefault,
  },
  commentSendText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
});
