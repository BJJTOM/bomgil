import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { CommunityPost, PostComment } from '../types';
import { useAuthStore } from '../stores/auth';

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

function CommentItem({ comment, onReply, onLike }: {
  comment: PostComment;
  onReply: (id: number, nickname: string) => void;
  onLike: (id: number) => void;
}) {
  return (
    <View style={styles.commentItem}>
      <View style={styles.commentAvatar}>
        {comment.author_image ? (
          <Image source={{ uri: comment.author_image }} style={styles.commentAvatarImg} />
        ) : (
          <Text style={{ fontSize: 14 }}>👤</Text>
        )}
      </View>
      <View style={styles.commentBody}>
        <Text style={styles.commentAuthor}>{comment.author_nickname}</Text>
        <Text style={styles.commentContent}>{comment.content}</Text>
        <View style={styles.commentActions}>
          <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
          <TouchableOpacity onPress={() => onLike(comment.id)}>
            <Text style={[styles.commentAction, comment.is_liked && { color: '#ED4956' }]}>
              {comment.is_liked ? '♥' : '♡'} {comment.like_count || ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onReply(comment.id, comment.author_nickname)}>
            <Text style={styles.commentAction}>답글</Text>
          </TouchableOpacity>
        </View>

        {/* Replies */}
        {comment.replies?.map((reply) => (
          <View key={reply.id} style={styles.replyItem}>
            <View style={styles.replyAvatar}>
              {reply.author_image ? (
                <Image source={{ uri: reply.author_image }} style={styles.replyAvatarImg} />
              ) : (
                <Text style={{ fontSize: 10 }}>👤</Text>
              )}
            </View>
            <View style={styles.replyBody}>
              <Text style={styles.replyAuthor}>{reply.author_nickname}</Text>
              <Text style={styles.replyContent}>{reply.content}</Text>
              <Text style={styles.replyTime}>{timeAgo(reply.created_at)}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function PostDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const { postId } = route.params;

  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: number; nickname: string } | null>(null);
  const inputRef = useRef<TextInput>(null);

  const { data: post } = useQuery<CommunityPost>({
    queryKey: ['post-detail', postId],
    queryFn: async () => {
      const { data } = await api.get(`/community/posts/${postId}/`);
      return data;
    },
  });

  const handleLike = async () => {
    if (!isAuthenticated) { navigation.navigate('Login'); return; }
    await api.post(`/community/posts/${postId}/like/`);
    queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
  };

  const handleCommentLike = async (commentId: number) => {
    if (!isAuthenticated) { navigation.navigate('Login'); return; }
    await api.post(`/community/posts/comments/${commentId}/like/`);
    queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
  };

  const handleReply = (id: number, nickname: string) => {
    setReplyTo({ id, nickname });
    inputRef.current?.focus();
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !isAuthenticated) return;
    try {
      if (replyTo) {
        await api.post(`/community/posts/comments/${replyTo.id}/reply/`, { content: commentText.trim() });
      } else {
        await api.post(`/community/posts/${postId}/comments/create/`, { content: commentText.trim() });
      }
      setCommentText('');
      setReplyTo(null);
      Keyboard.dismiss();
      queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
    } catch {}
  };

  if (!post) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>로딩 중...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      {/* Header — 토스 스타일 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>게시글</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Category */}
        <View style={styles.categoryRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{post.category_display}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{post.title}</Text>

        {/* Author */}
        <View style={styles.authorRow}>
          <View style={styles.authorAvatar}>
            {post.author_image ? (
              <Image source={{ uri: post.author_image }} style={styles.authorAvatarImg} />
            ) : (
              <Text style={{ fontSize: 16 }}>👤</Text>
            )}
          </View>
          <View>
            <Text style={styles.authorName}>{post.author_nickname}</Text>
            <View style={styles.authorMeta}>
              <Text style={styles.metaText}>{timeAgo(post.created_at)}</Text>
              <Text style={styles.metaDot}> · </Text>
              <Text style={styles.metaText}>조회 {post.view_count}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Content */}
        <Text style={styles.content}>{post.content}</Text>

        {/* Images */}
        {post.images?.map((img) => (
          <Image key={img.id} source={{ uri: img.image }} style={styles.contentImage} resizeMode="cover" />
        ))}

        {/* Action bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.actionItem} onPress={handleLike}>
            <Text style={[styles.actionText, post.is_liked && { color: '#ED4956' }]}>
              {post.is_liked ? '♥' : '♡'} {post.like_count}
            </Text>
          </TouchableOpacity>
          <View style={styles.actionItem}>
            <Text style={styles.actionText}>💬 {post.comment_count}</Text>
          </View>
        </View>

        <View style={styles.sectionDivider} />

        {/* Comments */}
        <Text style={styles.commentSectionTitle}>댓글 {post.comment_count}</Text>
        {post.comments?.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onReply={handleReply}
            onLike={handleCommentLike}
          />
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Comment input — 당근 스타일 */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
        {replyTo && (
          <View style={styles.replyIndicator}>
            <Text style={styles.replyIndicatorText}>{replyTo.nickname}에게 답글</Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Text style={styles.replyCancel}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="댓글을 입력하세요..."
            placeholderTextColor={colors.textTertiary}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
            onPress={handleSubmitComment}
            disabled={!commentText.trim()}>
            <Text style={[styles.sendBtnText, !commentText.trim() && styles.sendBtnTextDisabled]}>전송</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: colors.textTertiary },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F4F6',
  },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, color: colors.textPrimary },
  headerTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },

  scroll: { flex: 1 },

  categoryRow: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F0F7F0' },
  categoryBadgeText: { fontSize: 12, fontWeight: '600', color: colors.primary },

  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: 20, lineHeight: 28, letterSpacing: -0.3 },

  authorRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 10 },
  authorAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  authorAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  authorName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  authorMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  metaText: { fontSize: 12, color: colors.textTertiary },
  metaDot: { fontSize: 12, color: colors.textTertiary },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F2F4F6', marginHorizontal: 20 },
  sectionDivider: { height: 8, backgroundColor: '#F7F8FA' },

  content: { fontSize: 15, color: colors.textPrimary, lineHeight: 24, paddingHorizontal: 20, paddingVertical: 16 },
  contentImage: { width: '100%', aspectRatio: 4 / 3, marginBottom: 8 },

  // Actions
  actionBar: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 16 },
  actionItem: { flexDirection: 'row', alignItems: 'center' },
  actionText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },

  // Comments
  commentSectionTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  commentItem: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 10, gap: 10 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  commentAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  commentBody: { flex: 1 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  commentContent: { fontSize: 14, color: colors.textPrimary, lineHeight: 20, marginBottom: 6 },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  commentTime: { fontSize: 11, color: colors.textTertiary },
  commentAction: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },

  // Replies
  replyItem: { flexDirection: 'row', marginTop: 10, gap: 8, paddingLeft: 4 },
  replyAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  replyAvatarImg: { width: 24, height: 24, borderRadius: 12 },
  replyBody: { flex: 1 },
  replyAuthor: { fontSize: 12, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  replyContent: { fontSize: 13, color: colors.textPrimary, lineHeight: 18 },
  replyTime: { fontSize: 10, color: colors.textTertiary, marginTop: 4 },

  // Input bar
  inputBar: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F2F4F6', backgroundColor: '#FFFFFF', paddingTop: 8, paddingHorizontal: 16 },
  replyIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 6 },
  replyIndicatorText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  replyCancel: { fontSize: 14, color: colors.textTertiary, padding: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#F7F8FA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    maxHeight: 100,
  },
  sendBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.primary },
  sendBtnDisabled: { backgroundColor: '#F2F4F6' },
  sendBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  sendBtnTextDisabled: { color: colors.textTertiary },
});
