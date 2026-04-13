import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import api from '../../api/client';
import { colors } from '../../theme/colors';
import { Challenge } from '../../types';
import { FadeInView } from '../../components/FadeInView';
import LeaderboardCard from '../../components/LeaderboardCard';
import { useThemeStore } from '../../stores/theme';
import { useT } from '../../i18n';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  upcoming: { bg: '#EFF6FF', text: '#1D4ED8' },
  active: { bg: '#F0FDF4', text: '#15803D' },
  ended: { bg: '#F7F8FA', text: '#8B95A1' },
};

export default function CommunityChallengeTab() {
  const t = useT();
  const navigation = useNavigation<any>();
  const { isDark } = useThemeStore();
  const cardBg = isDark ? '#1c1c1e' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F6';
  const surfaceBg = isDark ? '#2a2a2a' : '#F7F8FA';
  const textColor = isDark ? '#FFFFFF' : colors.textPrimary;
  const textSecColor = isDark ? 'rgba(255,255,255,0.65)' : colors.textSecondary;
  const textTertColor = isDark ? 'rgba(255,255,255,0.42)' : colors.textTertiary;
  const progressTrackBg = isDark ? '#2a2a2a' : '#F2F4F6';

  const STATUS_LABELS: Record<string, string> = {
    upcoming: t.community.statusUpcoming,
    active: t.community.statusActive,
    ended: t.community.statusEnded,
  };

  const { data: challenges = [], isLoading, refetch, isRefetching } = useQuery<Challenge[]>({
    queryKey: ['community-challenges'],
    queryFn: async () => {
      const { data } = await api.get('/community/challenges/');
      return data.results ?? data;
    },
  });

  const renderChallenge = useCallback(({ item, index }: { item: Challenge; index: number }) => {
    const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.active;
    const statusLabel = STATUS_LABELS[item.status] || STATUS_LABELS.active;
    const daysLeft = Math.ceil((new Date(item.end_date).getTime() - Date.now()) / 86400000);

    return (
      <FadeInView delay={index * 60}>
        <TouchableOpacity
          style={[styles.challengeCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
          activeOpacity={0.6}
          onPress={() => navigation.navigate('ChallengeDetail', { challengeId: item.id })}>
          {/* Top row */}
          <View style={styles.cardTop}>
            <View style={[styles.emojiBox, { backgroundColor: surfaceBg }]}>
              <Text style={styles.emojiText}>{item.emoji}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>{statusLabel}</Text>
            </View>
          </View>

          {/* Title & desc */}
          <Text style={[styles.challengeTitle, { color: textColor }]}>{item.title}</Text>
          <Text style={[styles.challengeDesc, { color: textSecColor }]} numberOfLines={2}>{item.description}</Text>

          {/* Goal bar */}
          <View style={styles.goalSection}>
            <View style={[styles.goalBar, { backgroundColor: progressTrackBg }]}>
              <View style={[styles.goalProgress, { width: `${Math.min(item.my_progress, 100)}%` }]} />
            </View>
            <View style={styles.goalMeta}>
              <Text style={[styles.goalText, { color: textSecColor }]}>
                {t.community.goalLabel} {item.goal_value}{item.goal_unit}
              </Text>
              {item.is_joined && (
                <Text style={styles.progressText}>{item.my_progress}%</Text>
              )}
            </View>
          </View>

          {/* Bottom meta */}
          <View style={styles.cardBottom}>
            <View style={styles.metaRow}>
              <Text style={[styles.metaText, { color: textTertColor }]}>👥 {item.participant_count}{t.community.participants}</Text>
              {item.status === 'active' && daysLeft > 0 && (
                <Text style={[styles.metaText, { color: textTertColor }]}>⏰ {daysLeft}{t.community.daysLeft}</Text>
              )}
            </View>
            {item.is_joined ? (
              <View style={styles.joinedPill}>
                <Text style={styles.joinedPillText}>{t.community.joined}</Text>
              </View>
            ) : item.status === 'active' ? (
              <View style={styles.joinPill}>
                <Text style={styles.joinPillText}>{t.community.joinBtn}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      </FadeInView>
    );
  }, [cardBg, cardBorder, surfaceBg, textColor, textSecColor, textTertColor, progressTrackBg]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { color: textTertColor }]}>{t.community.loadingChallenges}</Text>
      </View>
    );
  }

  if (challenges.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🏆</Text>
        <Text style={[styles.emptyTitle, { color: textColor }]}>{t.community.noChallenges}</Text>
        <Text style={[styles.emptyDesc, { color: textTertColor }]}>{t.community.noChallengesSoon}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={challenges}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderChallenge}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      // Weekly leaderboard at the top of the challenge tab — moved out of
      // ActivityScreen to keep that screen focused on the user's own
      // activity history. Challenges + ranking belong together.
      ListHeaderComponent={
        <View style={{ marginBottom: 16 }}>
          <LeaderboardCard isDark={isDark} limit={5} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: colors.textTertiary },
  list: { padding: 20, paddingBottom: 100 },

  // Challenge card — 토스 카드 스타일
  challengeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  emojiBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 22 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 11, fontWeight: '600' },

  challengeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  challengeDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },

  // Progress bar
  goalSection: { marginBottom: 16 },
  goalBar: {
    height: 8,
    backgroundColor: '#F2F4F6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  goalProgress: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  goalMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalText: { fontSize: 12, color: colors.textTertiary },
  progressText: { fontSize: 12, fontWeight: '600', color: colors.primary },

  // Bottom
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaRow: { flexDirection: 'row', gap: 12 },
  metaText: { fontSize: 12, color: colors.textTertiary },

  joinedPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F0F7F0',
  },
  joinedPillText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  joinPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  joinPillText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: colors.textTertiary, textAlign: 'center' },
});
