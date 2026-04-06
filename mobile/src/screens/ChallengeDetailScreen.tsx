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
import { Challenge, ChallengeParticipant } from '../types';
import { useAuthStore } from '../stores/auth';
import { FadeInView } from '../components/FadeInView';

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  upcoming: { bg: '#EFF6FF', text: '#1D4ED8' },
  active: { bg: '#F0FDF4', text: '#15803D' },
  ended: { bg: '#F7F8FA', text: '#8B95A1' },
};

export default function ChallengeDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const { challengeId } = route.params;

  const { data: challenge } = useQuery<Challenge>({
    queryKey: ['challenge-detail', challengeId],
    queryFn: async () => {
      const { data } = await api.get(`/community/challenges/${challengeId}/`);
      return data;
    },
  });

  const handleJoin = async () => {
    if (!isAuthenticated) { navigation.navigate('Login'); return; }
    try {
      await api.post(`/community/challenges/${challengeId}/join/`);
      queryClient.invalidateQueries({ queryKey: ['challenge-detail', challengeId] });
      queryClient.invalidateQueries({ queryKey: ['community-challenges'] });
    } catch (e: any) {
      Alert.alert('오류', e.response?.data?.error || '참여에 실패했습니다.');
    }
  };

  if (!challenge) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}><Text style={styles.loadingText}>로딩 중...</Text></View>
      </View>
    );
  }

  const statusStyle = STATUS_STYLE[challenge.status] || STATUS_STYLE.active;
  const daysLeft = Math.ceil((new Date(challenge.end_date).getTime() - Date.now()) / 86400000);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>챌린지</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero — 토스 카드 */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.emojiBox}>
              <Text style={styles.emojiText}>{challenge.emoji}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>{challenge.status_display}</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{challenge.title}</Text>
          <Text style={styles.heroDesc}>{challenge.description}</Text>

          {/* Date */}
          <View style={styles.dateRow}>
            <Text style={styles.dateText}>📅 {challenge.start_date} ~ {challenge.end_date}</Text>
            {challenge.status === 'active' && daysLeft > 0 && (
              <Text style={styles.daysLeft}>{daysLeft}일 남음</Text>
            )}
          </View>

          {/* Goal progress */}
          <View style={styles.goalSection}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalLabel}>목표</Text>
              <Text style={styles.goalValue}>{challenge.goal_value} {challenge.goal_unit}</Text>
            </View>
            <View style={styles.goalBar}>
              <View style={[styles.goalProgress, { width: `${Math.min(challenge.my_progress, 100)}%` }]} />
            </View>
            {challenge.is_joined && (
              <Text style={styles.progressLabel}>{challenge.my_progress}% 달성</Text>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{challenge.participant_count}</Text>
              <Text style={styles.statLabel}>참여자</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{challenge.type_display}</Text>
              <Text style={styles.statLabel}>유형</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{challenge.goal_value}</Text>
              <Text style={styles.statLabel}>{challenge.goal_unit}</Text>
            </View>
          </View>
        </View>

        {/* Join button */}
        {challenge.status === 'active' && !challenge.is_joined && (
          <View style={styles.joinSection}>
            <TouchableOpacity style={styles.joinBtn} onPress={handleJoin}>
              <Text style={styles.joinBtnText}>챌린지 참여하기</Text>
            </TouchableOpacity>
          </View>
        )}
        {challenge.is_joined && (
          <View style={styles.joinSection}>
            <View style={styles.joinedBanner}>
              <Text style={styles.joinedBannerText}>✓ 참여 중인 챌린지입니다</Text>
            </View>
          </View>
        )}

        {/* Leaderboard */}
        <View style={styles.leaderboardSection}>
          <Text style={styles.leaderboardTitle}>🏅 리더보드</Text>
          {challenge.leaderboard?.map((participant, index) => (
            <FadeInView key={participant.id} delay={index * 40}>
              <View style={styles.leaderItem}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>
                    {index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}`}
                  </Text>
                </View>
                <View style={styles.leaderAvatar}>
                  {participant.profile_image ? (
                    <Image source={{ uri: participant.profile_image }} style={styles.leaderAvatarImg} />
                  ) : (
                    <Text style={{ fontSize: 14 }}>👤</Text>
                  )}
                </View>
                <View style={styles.leaderInfo}>
                  <Text style={styles.leaderName}>{participant.nickname}</Text>
                  <Text style={styles.leaderValue}>
                    {participant.current_value} {challenge.goal_unit}
                  </Text>
                </View>
                <View style={styles.leaderProgress}>
                  <View style={styles.miniBar}>
                    <View style={[styles.miniBarFill, { width: `${Math.min(participant.progress, 100)}%` }]} />
                  </View>
                  <Text style={styles.leaderPercent}>{participant.progress}%</Text>
                </View>
                {participant.completed && (
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedText}>✓</Text>
                  </View>
                )}
              </View>
            </FadeInView>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: colors.textTertiary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F2F4F6',
  },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, color: colors.textPrimary },
  headerTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },

  // Hero
  heroCard: { margin: 16, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  emojiBox: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 28 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },

  heroTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.3, marginBottom: 8 },
  heroDesc: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 16 },

  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  dateText: { fontSize: 13, color: colors.textSecondary },
  daysLeft: { fontSize: 13, fontWeight: '600', color: '#C2410C' },

  // Goal
  goalSection: { marginBottom: 20 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  goalLabel: { fontSize: 13, color: colors.textTertiary },
  goalValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  goalBar: { height: 10, backgroundColor: '#F2F4F6', borderRadius: 5, overflow: 'hidden' },
  goalProgress: { height: '100%', backgroundColor: colors.primary, borderRadius: 5 },
  progressLabel: { fontSize: 12, fontWeight: '600', color: colors.primary, marginTop: 6, textAlign: 'right' },

  // Stats
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F8FA', borderRadius: 14, paddingVertical: 14 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  statLabel: { fontSize: 11, color: colors.textTertiary },
  statDivider: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: '#E5E8EB' },

  // Join
  joinSection: { paddingHorizontal: 16 },
  joinBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  joinBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  joinedBanner: { backgroundColor: '#F0F7F0', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  joinedBannerText: { fontSize: 14, fontWeight: '600', color: colors.primary },

  // Leaderboard
  leaderboardSection: { margin: 16, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20 },
  leaderboardTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },
  leaderItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F2F4F6',
  },
  rankBadge: { width: 28, alignItems: 'center' },
  rankText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  leaderAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  leaderAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  leaderInfo: { flex: 1 },
  leaderName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  leaderValue: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  leaderProgress: { alignItems: 'flex-end', width: 60 },
  miniBar: { width: 50, height: 4, backgroundColor: '#F2F4F6', borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  miniBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  leaderPercent: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  completedBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' },
  completedText: { fontSize: 12, fontWeight: '700', color: '#15803D' },
});
