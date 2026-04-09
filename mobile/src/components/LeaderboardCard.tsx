/**
 * LeaderboardCard — top walkers this week
 *
 * Hits /activities/leaderboard/ and shows the top N users by distance
 * walked over the past 7 days. The current user (if present in the
 * top list) is highlighted in green.
 *
 * Designed to be dropped into ActivityScreen below the streak card.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import api from '../api/client';

interface LeaderEntry {
  rank: number;
  user_id: number;
  nickname: string;
  profile_image: string | null;
  level: number;
  week_distance_km: number;
  week_steps: number;
  is_me: boolean;
}

interface Props {
  isDark?: boolean;
  limit?: number;
}

export default function LeaderboardCard({ isDark = false, limit = 5 }: Props) {
  const [data, setData] = useState<LeaderEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/activities/leaderboard/', { timeout: 10000 });
        if (!cancelled) setData(res.data?.leaderboard || []);
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const textPrimary = isDark ? '#FFFFFF' : colors.textPrimary;
  const textSec = isDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary;
  const textTert = isDark ? 'rgba(255,255,255,0.4)' : colors.textTertiary;
  const rowBg = isDark ? 'rgba(255,255,255,0.04)' : '#F8F9FB';
  const meBg = isDark ? 'rgba(45,74,46,0.25)' : 'rgba(45,74,46,0.08)';

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!data || data.length === 0) {
    return null;
  }

  const top = data.slice(0, limit);
  const me = data.find((r) => r.is_me);
  // If user isn't in top N but exists in the wider list, append separately.
  const showMeAppended = me && me.rank > limit;

  const medal = (rank: number) =>
    rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textPrimary }]}>이번 주 리더보드</Text>
        <Text style={[styles.subtitle, { color: textTert }]}>최근 7일</Text>
      </View>
      {top.map((r) => (
        <View
          key={r.user_id}
          style={[
            styles.row,
            { backgroundColor: r.is_me ? meBg : rowBg },
          ]}>
          <Text style={[styles.rank, { color: r.rank <= 3 ? colors.primary : textSec }]}>
            {medal(r.rank)}
          </Text>
          {r.profile_image ? (
            <Image source={{ uri: r.profile_image }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarEmoji}>👤</Text>
            </View>
          )}
          <View style={styles.userBlock}>
            <Text
              style={[
                styles.nickname,
                { color: textPrimary, fontWeight: r.is_me ? '800' : '600' },
              ]}
              numberOfLines={1}>
              {r.nickname}
              {r.is_me ? '  ・나' : ''}
            </Text>
            <Text style={[styles.steps, { color: textTert }]}>
              {r.week_steps.toLocaleString()} 걸음
            </Text>
          </View>
          <Text style={[styles.distance, { color: textPrimary }]}>
            {r.week_distance_km.toFixed(1)} km
          </Text>
        </View>
      ))}
      {showMeAppended && me && (
        <>
          <View style={styles.spacer} />
          <View style={[styles.row, { backgroundColor: meBg }]}>
            <Text style={[styles.rank, { color: colors.primary }]}>{me.rank}</Text>
            {me.profile_image ? (
              <Image source={{ uri: me.profile_image }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarEmoji}>👤</Text>
              </View>
            )}
            <View style={styles.userBlock}>
              <Text
                style={[styles.nickname, { color: textPrimary, fontWeight: '800' }]}
                numberOfLines={1}>
                {me.nickname} ・나
              </Text>
              <Text style={[styles.steps, { color: textTert }]}>
                {me.week_steps.toLocaleString()} 걸음
              </Text>
            </View>
            <Text style={[styles.distance, { color: textPrimary }]}>
              {me.week_distance_km.toFixed(1)} km
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    gap: 12,
  },
  rank: {
    width: 26,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 16,
  },
  userBlock: {
    flex: 1,
  },
  nickname: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
  steps: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  distance: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  spacer: {
    height: 6,
  },
});
