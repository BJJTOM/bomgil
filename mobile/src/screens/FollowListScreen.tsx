import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Feather from 'react-native-vector-icons/Feather';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';

interface FollowUser {
  id: number;
  nickname: string;
  profile_image: string | null;
  bio: string;
  one_liner: string;
  is_following?: boolean;
}

export default function FollowListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const nickname = route.params?.nickname || user?.nickname;
  const tab = route.params?.tab || 'followers'; // 'followers' | 'following'
  const [activeTab, setActiveTab] = React.useState(tab);

  const { data: followers = [], isLoading: loadingFollowers } = useQuery<FollowUser[]>({
    queryKey: ['followers', nickname],
    queryFn: async () => {
      const { data } = await api.get(`/auth/users/${nickname}/followers/`);
      return data.results ?? data;
    },
    enabled: activeTab === 'followers',
  });

  const { data: following = [], isLoading: loadingFollowing } = useQuery<FollowUser[]>({
    queryKey: ['following', nickname],
    queryFn: async () => {
      const { data } = await api.get(`/auth/users/${nickname}/following/`);
      return data.results ?? data;
    },
    enabled: activeTab === 'following',
  });

  const list = activeTab === 'followers' ? followers : following;
  const isLoading = activeTab === 'followers' ? loadingFollowers : loadingFollowing;
  const isMe = nickname === user?.nickname;

  const handleToggleFollow = async (targetNickname: string) => {
    try {
      await api.post(`/auth/users/${targetNickname}/follow/`);
      queryClient.invalidateQueries({ queryKey: ['followers', nickname] });
      queryClient.invalidateQueries({ queryKey: ['following', nickname] });
      queryClient.invalidateQueries({ queryKey: ['profile', nickname] });
    } catch {
      Alert.alert('오류', '요청에 실패했습니다.');
    }
  };

  const renderUser = ({ item }: { item: FollowUser }) => (
    <TouchableOpacity
      style={styles.userRow}
      activeOpacity={0.7}
      onPress={() => navigation.push('Profile', { nickname: item.nickname })}>
      <View style={styles.userAvatar}>
        {item.profile_image ? (
          <Image source={{ uri: item.profile_image }} style={styles.userAvatarImg} />
        ) : (
          <Feather name="user" size={18} color={colors.textTertiary} />
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userNickname}>{item.nickname}</Text>
        <Text style={styles.userBio} numberOfLines={1}>{item.one_liner || item.bio || ''}</Text>
      </View>
      {isMe && activeTab === 'following' && (
        <TouchableOpacity
          style={styles.unfollowBtn}
          onPress={() => {
            Alert.alert('팔로우 취소', `${item.nickname}님을 언팔로우할까요?`, [
              { text: '취소', style: 'cancel' },
              { text: '언팔로우', style: 'destructive', onPress: () => handleToggleFollow(item.nickname) },
            ]);
          }}>
          <Text style={styles.unfollowBtnText}>팔로잉</Text>
        </TouchableOpacity>
      )}
      {item.id !== user?.id && activeTab === 'followers' && (
        <TouchableOpacity
          style={[styles.followBtn, item.is_following && styles.followBtnActive]}
          onPress={() => handleToggleFollow(item.nickname)}>
          <Text style={[styles.followBtnText, item.is_following && styles.followBtnTextActive]}>
            {item.is_following ? '팔로잉' : '팔로우'}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{nickname}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'followers' && styles.tabActive]}
          onPress={() => setActiveTab('followers')}>
          <Text style={[styles.tabText, activeTab === 'followers' && styles.tabTextActive]}>
            팔로워 {activeTab === 'followers' ? followers.length : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'following' && styles.tabActive]}
          onPress={() => setActiveTab('following')}>
          <Text style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]}>
            팔로잉 {activeTab === 'following' ? following.length : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : list.length === 0 ? (
        <View style={styles.center}>
          <Feather name="users" size={32} color={colors.textTertiary} />
          <Text style={styles.emptyText}>
            {activeTab === 'followers' ? '팔로워가 없습니다' : '팔로잉이 없습니다'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderUser}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  tabRow: {
    flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F2F4F6',
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textTertiary },
  tabTextActive: { color: colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: colors.textTertiary },
  userRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F2F4F6',
  },
  userAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#F7F8FA',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12,
  },
  userAvatarImg: { width: 44, height: 44 },
  userInfo: { flex: 1 },
  userNickname: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  userBio: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  followBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: colors.primary,
  },
  followBtnActive: { backgroundColor: '#F2F4F6' },
  followBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  followBtnTextActive: { color: colors.textSecondary },
  unfollowBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#F2F4F6',
  },
  unfollowBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
});
