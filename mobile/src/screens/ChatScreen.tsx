import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';

interface ChatRoom {
  id: number;
  name: string;
  room_type: 'companion' | 'open';
  last_message?: string;
  last_message_at?: string;
  member_count?: number;
  created_at: string;
}

const TABS = [
  { key: 'companion', label: '동행 채팅' },
  { key: 'open', label: '오픈 채팅' },
];

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'companion' | 'open'>('companion');
  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['chatRooms', activeTab],
    queryFn: async () => {
      const { data: res } = await api.get('/chat-rooms/', {
        params: { room_type: activeTab },
      });
      return (res?.results || res || []) as ChatRoom[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data: res } = await api.post('/chat-rooms/', {
        name,
        room_type: 'open',
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
      setShowCreate(false);
      setNewRoomName('');
    },
    onError: () => {
      Alert.alert('오류', '채팅방 생성에 실패했습니다');
    },
  });

  const rooms = data || [];

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '방금';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    return `${Math.floor(diff / 86400000)}일 전`;
  };

  const renderRoom = ({ item }: { item: ChatRoom }) => (
    <TouchableOpacity
      style={styles.roomItem}
      onPress={() => navigation.navigate('ChatRoom', { roomId: item.id, roomName: item.name })}
      activeOpacity={0.8}>
      <View style={styles.roomIcon}>
        <Text style={styles.roomIconText}>
          {item.room_type === 'companion' ? '\u{1F6B6}' : '\u{1F4AC}'}
        </Text>
      </View>
      <View style={styles.roomContent}>
        <View style={styles.roomHeader}>
          <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>
          {item.member_count != null && (
            <Text style={styles.roomMembers}>{item.member_count}</Text>
          )}
        </View>
        {item.last_message ? (
          <Text style={styles.roomLastMsg} numberOfLines={1}>{item.last_message}</Text>
        ) : (
          <Text style={styles.roomLastMsg}>아직 메시지가 없습니다</Text>
        )}
      </View>
      <Text style={styles.roomTime}>{formatTime(item.last_message_at || item.created_at)}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>채팅</Text>
        {activeTab === 'open' ? (
          <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.addBtn}>
            <Text style={styles.addText}>+</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key as 'companion' | 'open')}>
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Create room modal */}
      {showCreate && (
        <View style={styles.createOverlay}>
          <View style={styles.createModal}>
            <Text style={styles.createTitle}>오픈 채팅방 만들기</Text>
            <TextInput
              style={styles.createInput}
              placeholder="채팅방 이름"
              placeholderTextColor={colors.textTertiary}
              value={newRoomName}
              onChangeText={setNewRoomName}
            />
            <View style={styles.createActions}>
              <TouchableOpacity
                style={styles.createCancel}
                onPress={() => { setShowCreate(false); setNewRoomName(''); }}>
                <Text style={styles.createCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createSubmit, !newRoomName.trim() && { opacity: 0.5 }]}
                onPress={() => {
                  if (newRoomName.trim()) createMutation.mutate(newRoomName.trim());
                }}
                disabled={!newRoomName.trim() || createMutation.isPending}>
                <Text style={styles.createSubmitText}>
                  {createMutation.isPending ? '생성 중...' : '만들기'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRoom}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>{'\u{1F4AC}'}</Text>
              <Text style={styles.emptyText}>채팅방이 없습니다</Text>
              {activeTab === 'open' && (
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => setShowCreate(true)}>
                  <Text style={styles.emptyBtnText}>채팅방 만들기</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  addText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  roomIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roomIconText: {
    fontSize: 20,
  },
  roomContent: {
    flex: 1,
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  roomName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  roomMembers: {
    fontSize: 11,
    color: colors.textTertiary,
    backgroundColor: colors.bgSecondary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  roomLastMsg: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  roomTime: {
    fontSize: 11,
    color: colors.textTertiary,
    marginLeft: 8,
  },
  createOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
  },
  createTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  createInput: {
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  createActions: {
    flexDirection: 'row',
    gap: 10,
  },
  createCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
  },
  createCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  createSubmit: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  createSubmitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textTertiary,
    marginBottom: 16,
  },
  emptyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
