import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { GroupMessage } from '../types';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';

const timeFormat = (dateStr: string) => {
  const d = new Date(dateStr);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${m}`;
};

export default function GroupChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { isDark } = useThemeStore();
  const bg = isDark ? '#0a0a0a' : '#F7F8FA';
  const headerBg = isDark ? '#1c1c1e' : '#FFFFFF';
  const inputBg = isDark ? '#2a2a2a' : '#F7F8FA';
  const bubbleBg = isDark ? '#2a2a2a' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : colors.textPrimary;
  const textSecColor = isDark ? 'rgba(255,255,255,0.65)' : colors.textSecondary;
  const textTertColor = isDark ? 'rgba(255,255,255,0.42)' : colors.textTertiary;
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F6';
  const groupId = route.params?.groupId;
  const groupName = route.params?.groupName ?? '채팅';

  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const { data: messages = [], refetch } = useQuery<GroupMessage[]>({
    queryKey: ['group-messages', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/community/groups/${groupId}/messages/`);
      const msgs = Array.isArray(data) ? data : (data.results ?? []);
      return [...msgs].reverse();
    },
    refetchInterval: 5000,
    enabled: !!groupId,
  });

  const handleSend = async () => {
    if (!text.trim()) return;
    const msg = text.trim();
    setText('');
    Keyboard.dismiss();
    try {
      await api.post(`/community/groups/${groupId}/messages/create/`, { content: msg });
      refetch();
    } catch {
      Alert.alert('오류', '메시지 전송에 실패했습니다.');
      setText(msg);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  const renderMessage = ({ item }: { item: GroupMessage }) => {
    const isMine = item.sender === user?.id;
    return (
      <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
        {!isMine && (
          <View style={[styles.msgAvatar, { backgroundColor: bubbleBg }]}>
            {item.sender_image ? (
              <Image source={{ uri: item.sender_image }} style={styles.msgAvatarImg} />
            ) : (
              <Text style={{ fontSize: 14 }}>👤</Text>
            )}
          </View>
        )}
        <View style={[styles.msgBubbleWrap, isMine && styles.msgBubbleWrapMine]}>
          {!isMine && <Text style={[styles.msgSender, { color: textSecColor }]}>{item.sender_nickname}</Text>}
          <View
            style={[
              styles.msgBubble,
              { backgroundColor: bubbleBg },
              isMine && styles.msgBubbleMine,
            ]}>
            <Text
              style={[
                styles.msgText,
                { color: textColor },
                isMine && styles.msgTextMine,
              ]}>
              {item.content}
            </Text>
          </View>
          <Text style={[styles.msgTime, { color: textTertColor }, isMine && styles.msgTimeMine]}>
            {timeFormat(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: inputBg }]}>
          <Text style={[styles.backIcon, { color: textColor }]}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: textColor }]} numberOfLines={1}>{groupName}</Text>
          <Text style={[styles.headerSub, { color: textTertColor }]}>채팅</Text>
        </View>
        <View style={{ width: 34 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        style={{ backgroundColor: bg }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Input — 당근 채팅 스타일 */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: headerBg,
            borderTopColor: borderColor,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
          },
        ]}>
        <TextInput
          style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
          placeholder="메시지를 입력하세요"
          placeholderTextColor={textTertColor}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}>
          <Text style={[styles.sendBtnText, !text.trim() && styles.sendBtnTextDisabled]}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F2F4F6',
  },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, color: colors.textPrimary },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  headerSub: { fontSize: 11, color: colors.textTertiary },

  messageList: { padding: 16, paddingBottom: 8 },

  // Message bubbles — 카카오/당근 스타일
  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  msgRowMine: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 8 },
  msgAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  msgBubbleWrap: { maxWidth: '70%' },
  msgBubbleWrapMine: { alignItems: 'flex-end' },
  msgSender: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4, marginLeft: 4 },
  msgBubble: { backgroundColor: '#FFFFFF', borderRadius: 18, borderTopLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  msgBubbleMine: { backgroundColor: colors.primary, borderRadius: 18, borderTopRightRadius: 4, borderTopLeftRadius: 18 },
  msgText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  msgTextMine: { color: '#FFFFFF' },
  msgTime: { fontSize: 10, color: colors.textTertiary, marginTop: 4, marginLeft: 4 },
  msgTimeMine: { marginRight: 4, marginLeft: 0 },

  // Input
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingTop: 8, paddingHorizontal: 16, backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F2F4F6',
  },
  input: {
    flex: 1, backgroundColor: '#F7F8FA', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: colors.textPrimary, maxHeight: 100,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#E5E8EB' },
  sendBtnText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', lineHeight: 20 },
  sendBtnTextDisabled: { color: '#B0B8C1' },
});
