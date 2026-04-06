import React, { useState, useRef, useCallback } from 'react';
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
  Alert,
  Modal,
  Share,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { CommunityPost, PostComment } from '../types';
import { useAuthStore } from '../stores/auth';
import { FadeInView } from '../components/FadeInView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const REPORT_REASONS = [
  { key: 'spam', label: '스팸/광고' },
  { key: 'abuse', label: '욕설/비하' },
  { key: 'sexual', label: '성적 콘텐츠' },
  { key: 'harassment', label: '괴롭힘' },
  { key: 'misinformation', label: '허위정보' },
  { key: 'other', label: '기타' },
];

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR');
};

// ──────────────────────────────────────
// 더보기 바텀시트
// ──────────────────────────────────────
function BottomSheet({ visible, onClose, children }: {
  visible: boolean; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHandle} />
          {children}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function SheetItem({ icon, label, danger, onPress }: {
  icon: string; label: string; danger?: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.sheetItem} onPress={onPress} activeOpacity={0.6}>
      <Text style={styles.sheetItemIcon}>{icon}</Text>
      <Text style={[styles.sheetItemLabel, danger && { color: '#FF4B4B' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ──────────────────────────────────────
// 신고 모달
// ──────────────────────────────────────
function ReportModal({ visible, onClose, onSubmit }: {
  visible: boolean; onClose: () => void;
  onSubmit: (reason: string, detail: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');

  const handleSubmit = () => {
    if (!reason) return;
    onSubmit(reason, detail);
    setReason('');
    setDetail('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.reportBackdrop}>
        <View style={styles.reportContainer}>
          <View style={styles.reportHeader}>
            <Text style={styles.reportTitle}>신고하기</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.reportClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.reportSubtitle}>신고 사유를 선택해주세요</Text>
          {REPORT_REASONS.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.reportReasonItem, reason === r.key && styles.reportReasonActive]}
              onPress={() => setReason(r.key)}>
              <View style={[styles.reportRadio, reason === r.key && styles.reportRadioActive]}>
                {reason === r.key && <View style={styles.reportRadioDot} />}
              </View>
              <Text style={[styles.reportReasonText, reason === r.key && { color: colors.textPrimary, fontWeight: '600' }]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}

          <TextInput
            style={styles.reportDetail}
            placeholder="상세 내용 (선택)"
            placeholderTextColor={colors.textTertiary}
            value={detail}
            onChangeText={setDetail}
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            style={[styles.reportSubmitBtn, !reason && { opacity: 0.4 }]}
            onPress={handleSubmit}
            disabled={!reason}>
            <Text style={styles.reportSubmitText}>신고하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ──────────────────────────────────────
// 이미지 뷰어
// ──────────────────────────────────────
function ImageViewer({ images, initialIndex, visible, onClose }: {
  images: { id: number; image: string }[];
  initialIndex: number; visible: boolean; onClose: () => void;
}) {
  const [current, setCurrent] = useState(initialIndex);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerContainer}>
        <TouchableOpacity style={styles.viewerClose} onPress={onClose}>
          <Text style={styles.viewerCloseText}>✕</Text>
        </TouchableOpacity>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialIndex * SCREEN_WIDTH, y: 0 }}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}>
          {images.map((img) => (
            <Image
              key={img.id}
              source={{ uri: img.image }}
              style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }}
              resizeMode="contain"
            />
          ))}
        </ScrollView>
        {images.length > 1 && (
          <Text style={styles.viewerCounter}>{current + 1} / {images.length}</Text>
        )}
      </View>
    </Modal>
  );
}

// ──────────────────────────────────────
// 댓글 아이템
// ──────────────────────────────────────
function CommentItem({ comment, postId, onReply, depth = 0 }: {
  comment: PostComment; postId: number;
  onReply: (id: number, nickname: string) => void; depth?: number;
}) {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  const [showSheet, setShowSheet] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleLike = async () => {
    if (!isAuthenticated) { navigation.navigate('Login'); return; }
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.3, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    await api.post(`/community/posts/comments/${comment.id}/like/`);
    queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
  };

  const handleDelete = () => {
    Alert.alert('댓글 삭제', '정말 삭제하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          await api.delete(`/community/posts/comments/${comment.id}/delete/`);
          queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
        },
      },
    ]);
  };

  const handleEdit = async () => {
    if (!editText.trim()) return;
    await api.patch(`/community/posts/comments/${comment.id}/update/`, { content: editText.trim() });
    setEditing(false);
    queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
  };

  const handleReport = async (reason: string, detail: string) => {
    await api.post('/community/report/', { target_type: 'comment', target_id: comment.id, reason, detail });
    setShowReport(false);
    Alert.alert('신고 완료', '신고가 접수되었습니다.');
  };

  const handleBlock = () => {
    Alert.alert('사용자 차단', `${comment.author_nickname}님을 차단하시겠어요?\n차단하면 이 사용자의 글과 댓글이 보이지 않습니다.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '차단', style: 'destructive', onPress: async () => {
          await api.post('/community/block/', { user_id: comment.author });
          queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
          Alert.alert('차단 완료', '사용자가 차단되었습니다.');
        },
      },
    ]);
  };

  if (comment.is_deleted) {
    return (
      <View style={[styles.commentItem, { paddingLeft: 20 + depth * 32 }]}>
        <Text style={styles.deletedComment}>삭제된 댓글입니다.</Text>
      </View>
    );
  }

  const isMine = user?.id === comment.author;

  return (
    <>
      <View style={[styles.commentItem, { paddingLeft: 20 + depth * 32 }]}>
        {depth > 0 && <Text style={styles.replyArrow}>┗</Text>}
        <TouchableOpacity
          style={styles.commentAvatar}
          onPress={() => navigation.navigate('Profile', { userId: comment.author })}>
          {comment.author_image ? (
            <Image source={{ uri: comment.author_image }} style={styles.commentAvatarImg} />
          ) : (
            <View style={styles.commentAvatarPlaceholder}><Text style={{ fontSize: 12 }}>👤</Text></View>
          )}
        </TouchableOpacity>

        <View style={styles.commentBody}>
          <View style={styles.commentTopRow}>
            <Text style={styles.commentAuthor}>{comment.author_nickname}</Text>
            <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
            {comment.updated_at !== comment.created_at && <Text style={styles.editedLabel}>(수정됨)</Text>}
            <TouchableOpacity style={styles.commentMoreBtn} onPress={() => setShowSheet(true)}>
              <Text style={styles.commentMoreIcon}>···</Text>
            </TouchableOpacity>
          </View>

          {editing ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.editInput}
                value={editText}
                onChangeText={setEditText}
                multiline
                autoFocus
              />
              <View style={styles.editActions}>
                <TouchableOpacity onPress={() => setEditing(false)}>
                  <Text style={styles.editCancel}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleEdit}>
                  <Text style={styles.editSave}>저장</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.commentContent}>{comment.content}</Text>
          )}

          <View style={styles.commentActions}>
            <TouchableOpacity onPress={handleLike} activeOpacity={0.6}>
              <Animated.Text style={[
                styles.commentActionText,
                comment.is_liked && { color: '#FF4B4B' },
                { transform: [{ scale: scaleAnim }] },
              ]}>
                {comment.is_liked ? '♥' : '♡'} {comment.like_count > 0 ? comment.like_count : ''}
              </Animated.Text>
            </TouchableOpacity>
            {depth === 0 && (
              <TouchableOpacity onPress={() => onReply(comment.id, comment.author_nickname)}>
                <Text style={styles.commentActionText}>답글</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Replies */}
      {comment.replies?.map((reply) => (
        <CommentItem key={reply.id} comment={reply} postId={postId} onReply={onReply} depth={1} />
      ))}

      {/* Comment action sheet */}
      <BottomSheet visible={showSheet} onClose={() => setShowSheet(false)}>
        {isMine && <SheetItem icon="✏️" label="수정" onPress={() => { setShowSheet(false); setEditing(true); setEditText(comment.content); }} />}
        {isMine && <SheetItem icon="🗑" label="삭제" danger onPress={() => { setShowSheet(false); handleDelete(); }} />}
        {!isMine && <SheetItem icon="🚨" label="신고" onPress={() => { setShowSheet(false); setShowReport(true); }} />}
        {!isMine && <SheetItem icon="🚫" label="이 사용자 차단" danger onPress={() => { setShowSheet(false); handleBlock(); }} />}
      </BottomSheet>

      <ReportModal visible={showReport} onClose={() => setShowReport(false)} onSubmit={handleReport} />
    </>
  );
}

// ──────────────────────────────────────
// PostDetailScreen
// ──────────────────────────────────────
export default function PostDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  const { postId } = route.params;

  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: number; nickname: string } | null>(null);
  const [showPostSheet, setShowPostSheet] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [viewerImages, setViewerImages] = useState<{ visible: boolean; index: number }>({ visible: false, index: 0 });
  const inputRef = useRef<TextInput>(null);
  const likeAnim = useRef(new Animated.Value(1)).current;

  const { data: post, isLoading } = useQuery<CommunityPost>({
    queryKey: ['post-detail', postId],
    queryFn: async () => {
      const { data } = await api.get(`/community/posts/${postId}/`);
      return data;
    },
  });

  const isMine = post && user?.id === post.author;

  const handleLike = useCallback(async () => {
    if (!isAuthenticated) { navigation.navigate('Login'); return; }
    Animated.sequence([
      Animated.timing(likeAnim, { toValue: 1.2, duration: 100, useNativeDriver: true }),
      Animated.timing(likeAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    // Optimistic
    queryClient.setQueryData(['post-detail', postId], (old: any) => {
      if (!old) return old;
      return { ...old, is_liked: !old.is_liked, like_count: old.is_liked ? old.like_count - 1 : old.like_count + 1 };
    });
    api.post(`/community/posts/${postId}/like/`).catch(() => {
      queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
    });
  }, [isAuthenticated, postId]);

  const handleBookmark = useCallback(async () => {
    if (!isAuthenticated) { navigation.navigate('Login'); return; }
    queryClient.setQueryData(['post-detail', postId], (old: any) => {
      if (!old) return old;
      return { ...old, is_bookmarked: !old.is_bookmarked };
    });
    api.post(`/community/posts/${postId}/bookmark/`).catch(() => {
      queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
    });
  }, [isAuthenticated, postId]);

  const handleShare = () => {
    if (!post) return;
    Share.share({ message: `${post.title}\n\nRoami 커뮤니티에서 확인하세요!` });
  };

  const handleDelete = () => {
    Alert.alert('게시글 삭제', '정말 삭제하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          await api.delete(`/community/posts/${postId}/delete/`);
          queryClient.invalidateQueries({ queryKey: ['community-posts'] });
          navigation.goBack();
        },
      },
    ]);
  };

  const handleReport = async (reason: string, detail: string) => {
    await api.post('/community/report/', { target_type: 'post', target_id: postId, reason, detail });
    setShowReport(false);
    Alert.alert('신고 완료', '신고가 접수되었습니다.');
  };

  const handleBlock = () => {
    if (!post) return;
    Alert.alert('사용자 차단', `${post.author_nickname}님을 차단하시겠어요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '차단', style: 'destructive', onPress: async () => {
          await api.post('/community/block/', { user_id: post.author });
          queryClient.invalidateQueries({ queryKey: ['community-posts'] });
          navigation.goBack();
        },
      },
    ]);
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

  if (isLoading || !post) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>게시글</Text>
          <View style={{ width: 34 }} />
        </View>
        <View style={styles.loadingContainer}><Text style={styles.loadingText}>로딩 중...</Text></View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>게시글</Text>
        <TouchableOpacity style={styles.moreBtn} onPress={() => setShowPostSheet(true)}>
          <Text style={styles.moreIcon}>···</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Category badge */}
        <View style={styles.categoryRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{post.category_display}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{post.title}</Text>

        {/* Author */}
        <TouchableOpacity
          style={styles.authorRow}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Profile', { userId: post.author })}>
          <View style={styles.authorAvatar}>
            {post.author_image ? (
              <Image source={{ uri: post.author_image }} style={styles.authorAvatarImg} />
            ) : (
              <View style={styles.authorAvatarPlaceholder}><Text style={{ fontSize: 14 }}>👤</Text></View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.authorName}>{post.author_nickname}</Text>
            <View style={styles.authorMeta}>
              <Text style={styles.metaText}>{timeAgo(post.created_at)}</Text>
              <Text style={styles.metaDot}> · </Text>
              <Text style={styles.metaText}>조회 {post.view_count}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Content */}
        <Text style={styles.content}>{post.content}</Text>

        {/* Images — tappable */}
        {post.images && post.images.length > 0 && (
          <View style={styles.imageSection}>
            {post.images.map((img, idx) => (
              <TouchableOpacity
                key={img.id}
                activeOpacity={0.9}
                onPress={() => setViewerImages({ visible: true, index: idx })}>
                <Image source={{ uri: img.image }} style={styles.contentImage} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Action bar — 당근마켓 스타일 */}
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.actionItem} onPress={handleLike} activeOpacity={0.6}>
            <Animated.Text style={[
              styles.actionIcon,
              post.is_liked && { color: '#FF4B4B' },
              { transform: [{ scale: likeAnim }] },
            ]}>
              {post.is_liked ? '♥' : '♡'}
            </Animated.Text>
            <Text style={[styles.actionCount, post.is_liked && { color: '#FF4B4B' }]}>{post.like_count}</Text>
          </TouchableOpacity>

          <View style={styles.actionItem}>
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionCount}>{post.comment_count}</Text>
          </View>

          <TouchableOpacity style={styles.actionItem} onPress={handleBookmark} activeOpacity={0.6}>
            <Text style={[styles.actionIcon, post.is_bookmarked && { color: '#F59E0B' }]}>
              {post.is_bookmarked ? '★' : '☆'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={handleShare} activeOpacity={0.6}>
            <Text style={styles.actionIcon}>↗</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionDivider} />

        {/* Comments */}
        <View style={styles.commentSection}>
          <Text style={styles.commentSectionTitle}>댓글 {post.comment_count}</Text>
          {post.comments && post.comments.length > 0 ? (
            post.comments.map((comment, i) => (
              <FadeInView key={comment.id} delay={i * 30}>
                <CommentItem comment={comment} postId={postId} onReply={handleReply} />
              </FadeInView>
            ))
          ) : (
            <View style={styles.noComments}>
              <Text style={styles.noCommentsText}>아직 댓글이 없어요</Text>
              <Text style={styles.noCommentsHint}>첫 번째 댓글을 남겨보세요</Text>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Comment input */}
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
            placeholder={isAuthenticated ? '댓글을 입력하세요...' : '로그인 후 댓글을 작성할 수 있어요'}
            placeholderTextColor={colors.textTertiary}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={1000}
            editable={isAuthenticated}
            onFocus={() => { if (!isAuthenticated) navigation.navigate('Login'); }}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
            onPress={handleSubmitComment}
            disabled={!commentText.trim()}>
            <Text style={[styles.sendBtnText, !commentText.trim() && styles.sendBtnTextDisabled]}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Post action sheet */}
      <BottomSheet visible={showPostSheet} onClose={() => setShowPostSheet(false)}>
        <SheetItem icon="↗" label="공유하기" onPress={() => { setShowPostSheet(false); handleShare(); }} />
        <SheetItem icon="☆" label={post.is_bookmarked ? '북마크 해제' : '북마크'} onPress={() => { setShowPostSheet(false); handleBookmark(); }} />
        {isMine && <SheetItem icon="✏️" label="수정하기" onPress={() => { setShowPostSheet(false); navigation.navigate('PostCreate', { editPost: post }); }} />}
        {isMine && <SheetItem icon="🗑" label="삭제하기" danger onPress={() => { setShowPostSheet(false); handleDelete(); }} />}
        {!isMine && <SheetItem icon="🚨" label="신고하기" onPress={() => { setShowPostSheet(false); setShowReport(true); }} />}
        {!isMine && <SheetItem icon="🚫" label="이 사용자 차단" danger onPress={() => { setShowPostSheet(false); handleBlock(); }} />}
      </BottomSheet>

      {/* Report modal */}
      <ReportModal visible={showReport} onClose={() => setShowReport(false)} onSubmit={handleReport} />

      {/* Image viewer */}
      {post.images && post.images.length > 0 && (
        <ImageViewer
          images={post.images}
          initialIndex={viewerImages.index}
          visible={viewerImages.visible}
          onClose={() => setViewerImages({ visible: false, index: 0 })}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: colors.textTertiary },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F2F4F6',
  },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, color: colors.textPrimary },
  headerTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  moreBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center' },
  moreIcon: { fontSize: 16, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1 },

  scroll: { flex: 1 },
  categoryRow: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F0F7F0' },
  categoryBadgeText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: 20, lineHeight: 28, letterSpacing: -0.3, marginBottom: 4 },

  // Author
  authorRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 10 },
  authorAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  authorAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  authorAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center' },
  authorName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  authorMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  metaText: { fontSize: 12, color: colors.textTertiary },
  metaDot: { fontSize: 12, color: colors.textTertiary },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F2F4F6', marginHorizontal: 20 },
  sectionDivider: { height: 8, backgroundColor: '#F7F8FA' },
  content: { fontSize: 15, color: colors.textPrimary, lineHeight: 24, paddingHorizontal: 20, paddingVertical: 16 },

  // Images
  imageSection: { paddingHorizontal: 20, gap: 8, paddingBottom: 8 },
  contentImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: '#F7F8FA' },

  // Action bar — 당근 스타일
  actionBar: {
    flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F2F4F6',
    gap: 20,
  },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionIcon: { fontSize: 18 },
  actionCount: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },

  // Comments
  commentSection: { paddingTop: 8 },
  commentSectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: 20, paddingVertical: 12 },
  commentItem: { flexDirection: 'row', paddingRight: 20, paddingVertical: 10, gap: 8 },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, overflow: 'hidden' },
  commentAvatarImg: { width: 30, height: 30, borderRadius: 15 },
  commentAvatarPlaceholder: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center' },
  commentBody: { flex: 1 },
  commentTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  commentTime: { fontSize: 11, color: colors.textTertiary },
  editedLabel: { fontSize: 10, color: colors.textTertiary },
  commentMoreBtn: { marginLeft: 'auto', padding: 4 },
  commentMoreIcon: { fontSize: 12, color: colors.textTertiary, fontWeight: '700', letterSpacing: 1 },
  commentContent: { fontSize: 14, color: colors.textPrimary, lineHeight: 20, marginBottom: 6 },
  commentActions: { flexDirection: 'row', gap: 14 },
  commentActionText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  replyArrow: { fontSize: 12, color: colors.textTertiary, marginRight: 4, marginTop: 4 },
  deletedComment: { fontSize: 13, color: colors.textTertiary, fontStyle: 'italic', paddingVertical: 8 },
  noComments: { alignItems: 'center', paddingVertical: 32 },
  noCommentsText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  noCommentsHint: { fontSize: 12, color: colors.textTertiary, marginTop: 4 },

  // Edit inline
  editRow: { marginBottom: 8 },
  editInput: { backgroundColor: '#F7F8FA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: colors.textPrimary, marginBottom: 6 },
  editActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  editCancel: { fontSize: 13, color: colors.textSecondary },
  editSave: { fontSize: 13, fontWeight: '600', color: colors.primary },

  // Input bar
  inputBar: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F2F4F6', backgroundColor: '#FFFFFF', paddingTop: 8, paddingHorizontal: 16 },
  replyIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 6 },
  replyIndicatorText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  replyCancel: { fontSize: 14, color: colors.textTertiary, padding: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, backgroundColor: '#F7F8FA', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: colors.textPrimary, maxHeight: 100 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#E5E8EB' },
  sendBtnText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', lineHeight: 20 },
  sendBtnTextDisabled: { color: '#B0B8C1' },

  // Bottom sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: 30 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E8EB', alignSelf: 'center', marginBottom: 12 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, gap: 14 },
  sheetItemIcon: { fontSize: 18 },
  sheetItemLabel: { fontSize: 16, fontWeight: '500', color: colors.textPrimary },

  // Report modal
  reportBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  reportContainer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  reportTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  reportClose: { fontSize: 18, color: colors.textTertiary, padding: 4 },
  reportSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
  reportReasonItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  reportReasonActive: {},
  reportRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#E5E8EB', alignItems: 'center', justifyContent: 'center' },
  reportRadioActive: { borderColor: colors.primary },
  reportRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  reportReasonText: { fontSize: 15, color: colors.textSecondary },
  reportDetail: { backgroundColor: '#F7F8FA', borderRadius: 12, padding: 14, fontSize: 14, color: colors.textPrimary, marginTop: 12, marginBottom: 16, minHeight: 60, textAlignVertical: 'top' },
  reportSubmitBtn: { backgroundColor: '#FF4B4B', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  reportSubmitText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },

  // Image viewer
  viewerContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  viewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  viewerCloseText: { fontSize: 18, color: '#FFF', fontWeight: '600' },
  viewerCounter: { position: 'absolute', bottom: 40, alignSelf: 'center', fontSize: 14, color: 'rgba(255,255,255,0.7)' },
});
