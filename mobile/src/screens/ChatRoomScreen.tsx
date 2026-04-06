import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';

interface Message {
  id: number;
  sender: {
    id: number;
    nickname: string;
    profile_image?: string | null;
  };
  content: string;
  created_at: string;
}

export default function ChatRoomScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const flatListRef = useRef<FlatList>(null);

  const roomId = route.params?.roomId;
  const roomName = route.params?.roomName || '채팅';

  const [messageText, setMessageText] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['chatMessages', roomId],
    queryFn: async () => {
      const { data: res } = await api.get(`/chat-rooms/${roomId}/messages/`);
      return (res?.results || res || []) as Message[];
    },
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data: res } = await api.post(`/chat-rooms/${roomId}/messages/send/`, {
        content,
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatMessages', roomId] });
      setMessageText('');
    },
  });

  const messages = data || [];

  const handleSend = useCallback(() => {
    const text = messageText.trim();
    if (!text || sendMutation.isPending) return;
    sendMutation.mutate(text);
  }, [messageText, sendMutation]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? '오후' : '오전';
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${ampm} ${hour}:${m}`;
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = user?.id === item.sender.id;

    return (
      <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
        {!isMine && (
          <View style={styles.msgAvatar}>
            <Text style={styles.msgAvatarText}>
              {item.sender.nickname?.charAt(0) || '?'}
            </Text>
          </View>
        )}
        <View style={[styles.msgBubbleWrap, isMine && styles.msgBubbleWrapMine]}>
          {!isMine && (
            <Text style={styles.msgSender}>{item.sender.nickname}</Text>
          )}
          <View style={[styles.msgBubble, isMine && styles.msgBubbleMine]}>
            <Text style={[styles.msgText, isMine && styles.msgTextMine]}>
              {item.content}
            </Text>
          </View>
          <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{roomName}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Messages */}
      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          inverted
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>첫 메시지를 보내보세요!</Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <View style={[styles.inputRow, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
        <TextInput
          style={styles.input}
          placeholder="메시지를 입력하세요..."
          placeholderTextColor={colors.textTertiary}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={1000}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !messageText.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!messageText.trim() || sendMutation.isPending}
          activeOpacity={0.7}>
          <Text style={styles.sendBtnText}>{'↑'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
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
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  msgRowMine: {
    flexDirection: 'row-reverse',
  },
  msgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  msgAvatarText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  msgBubbleWrap: {
    maxWidth: '75%',
  },
  msgBubbleWrapMine: {
    alignItems: 'flex-end',
  },
  msgSender: {
    fontSize: 11,
    color: colors.textTertiary,
    marginBottom: 2,
    marginLeft: 4,
  },
  msgBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  msgBubbleMine: {
    backgroundColor: colors.primary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
  },
  msgText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  msgTextMine: {
    color: '#FFFFFF',
  },
  msgTime: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
    marginLeft: 4,
  },
  msgTimeMine: {
    marginLeft: 0,
    marginRight: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: {
    backgroundColor: colors.bgSecondary,
  },
  sendBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
});
