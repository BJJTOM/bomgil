import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { CommunityGroup } from '../types';
import { useAuthStore } from '../stores/auth';

export default function GroupDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const { groupId } = route.params;

  const { data: group } = useQuery<CommunityGroup>({
    queryKey: ['group-detail', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/community/groups/${groupId}/`);
      return data;
    },
  });

  const handleJoin = async () => {
    if (!isAuthenticated) { navigation.navigate('Login'); return; }
    try {
      await api.post(`/community/groups/${groupId}/join/`);
      queryClient.invalidateQueries({ queryKey: ['group-detail', groupId] });
      queryClient.invalidateQueries({ queryKey: ['community-groups'] });
    } catch (e: any) {
      Alert.alert('오류', e.response?.data?.error || '참여에 실패했습니다.');
    }
  };

  const handleLeave = async () => {
    Alert.alert('모임 나가기', '정말 이 모임에서 나가시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '나가기',
        style: 'destructive',
        onPress: async () => {
          await api.post(`/community/groups/${groupId}/leave/`);
          queryClient.invalidateQueries({ queryKey: ['group-detail', groupId] });
          queryClient.invalidateQueries({ queryKey: ['community-groups'] });
        },
      },
    ]);
  };

  if (!group) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}><Text style={styles.loadingText}>로딩 중...</Text></View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{group.name}</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero section — 토스 카드 스타일 */}
        <View style={styles.heroSection}>
          <View style={styles.heroEmoji}>
            <Text style={styles.heroEmojiText}>{group.emoji}</Text>
          </View>
          <Text style={styles.heroName}>{group.name}</Text>
          <Text style={styles.heroDesc}>{group.description}</Text>

          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{group.member_count}</Text>
              <Text style={styles.statLabel}>멤버</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{group.category_display}</Text>
              <Text style={styles.statLabel}>카테고리</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{group.region || '전국'}</Text>
              <Text style={styles.statLabel}>지역</Text>
            </View>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {group.is_member ? (
            <>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => navigation.navigate('GroupChat', { groupId: group.id, groupName: group.name })}>
                <Text style={styles.primaryBtnText}>💬 채팅방</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleLeave}>
                <Text style={styles.secondaryBtnText}>나가기</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleJoin}>
              <Text style={styles.primaryBtnText}>모임 참여하기</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.sectionDivider} />

        {/* Members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>멤버 {group.member_count}</Text>
          <View style={styles.memberGrid}>
            {group.members?.map((member) => (
              <TouchableOpacity
                key={member.id}
                style={styles.memberItem}
                onPress={() => navigation.navigate('Profile', { userId: member.user })}>
                <View style={styles.memberAvatar}>
                  {member.profile_image ? (
                    <Image source={{ uri: member.profile_image }} style={styles.memberAvatarImg} />
                  ) : (
                    <Text style={{ fontSize: 16 }}>👤</Text>
                  )}
                </View>
                <Text style={styles.memberName} numberOfLines={1}>{member.nickname}</Text>
                {member.role === 'owner' && (
                  <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>방장</Text></View>
                )}
                {member.role === 'admin' && (
                  <View style={[styles.roleBadge, { backgroundColor: '#EFF6FF' }]}><Text style={[styles.roleBadgeText, { color: '#1D4ED8' }]}>관리자</Text></View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: colors.textTertiary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F2F4F6',
  },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, color: colors.textPrimary },
  headerTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, flex: 1, textAlign: 'center' },

  // Hero
  heroSection: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  heroEmoji: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroEmojiText: { fontSize: 36 },
  heroName: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.3, marginBottom: 8 },
  heroDesc: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, textAlign: 'center', marginBottom: 20 },

  statRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F8FA', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20, width: '100%' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  statLabel: { fontSize: 11, color: colors.textTertiary },
  statDivider: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: '#E5E8EB' },

  // Actions
  actionRow: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  primaryBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  secondaryBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 14, backgroundColor: '#F7F8FA' },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },

  sectionDivider: { height: 8, backgroundColor: '#F7F8FA' },

  // Section
  section: { paddingHorizontal: 20, paddingVertical: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },

  // Members
  memberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  memberItem: { alignItems: 'center', width: 64 },
  memberAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 6 },
  memberAvatarImg: { width: 48, height: 48, borderRadius: 24 },
  memberName: { fontSize: 12, color: colors.textPrimary, textAlign: 'center' },
  roleBadge: { marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#FFF7ED' },
  roleBadgeText: { fontSize: 9, fontWeight: '600', color: '#C2410C' },
});
