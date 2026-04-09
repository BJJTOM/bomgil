/**
 * StreakCard — gamification summary for ActivityScreen
 *
 * Shows three things in one card:
 *   - Current streak (consecutive days with at least one walk)
 *   - Weekly progress bar towards user's goal_km
 *   - Earned badges (small grid)
 *
 * Designed to match Nike Run Club / Apple Activity / Samsung Health
 * "rings + streak" patterns. Pure RN, no extra deps.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { ActivityStats } from '../types';

interface Props {
  stats?: ActivityStats;
  isDark?: boolean;
}

const BADGE_LABELS: Record<string, { label: string; emoji: string }> = {
  first_walk: { label: '첫 걸음', emoji: '🌱' },
  walker_10km: { label: '10km', emoji: '🚶' },
  walker_50km: { label: '50km', emoji: '🏃' },
  walker_100km: { label: '100km', emoji: '🏅' },
  global_walker: { label: '글로벌', emoji: '🌍' },
  trail_creator: { label: '코스 개척자', emoji: '🗺️' },
  storyteller: { label: '스토리텔러', emoji: '📝' },
  verified: { label: '본인 인증', emoji: '✓' },
  trusted: { label: '신뢰', emoji: '🛡️' },
};

export default function StreakCard({ stats, isDark = false }: Props) {
  if (!stats) return null;

  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const textPrimary = isDark ? '#FFFFFF' : colors.textPrimary;
  const textSec = isDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary;
  const textTert = isDark ? 'rgba(255,255,255,0.4)' : colors.textTertiary;
  const trackBg = isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F6';

  // Defensive coercion — backend returns 0 for new users but the field
  // could also be undefined while a stale cache hydrates the query.
  const totalKm = Number(stats.total_distance_km) || 0;
  const trackCount = Number(stats.track_count) || 0;
  const streak = Number(stats.current_streak) || 0;
  const longest = Number(stats.longest_streak) || 0;
  const weeklyDist = Number(stats.weekly_distance_km) || 0;
  const weeklyGoal = Number(stats.weekly_goal_km) || 20;
  const weeklyPct = Number(stats.weekly_progress_pct) || 0;
  const badges = stats.earned_badges || [];

  // Empty-state for users who haven't recorded a single walk yet.
  if (trackCount === 0) {
    return (
      <View style={[styles.container, { backgroundColor: cardBg, alignItems: 'center', paddingVertical: 26 }]}>
        <Text style={{ fontSize: 32, marginBottom: 8 }}>🚶</Text>
        <Text style={[styles.streakLabel, { color: textPrimary, fontSize: 14, marginBottom: 4 }]}>
          첫 걷기를 시작해보세요
        </Text>
        <Text style={[styles.streakSub, { color: textTert, fontSize: 12 }]}>
          기록을 남기면 연속 일수와 뱃지가 쌓여요
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: cardBg }]}>
      {/* Top row: streak + total distance */}
      <View style={styles.topRow}>
        <View style={styles.streakBlock}>
          <Text style={[styles.streakNumber, { color: streak > 0 ? colors.primary : textTert }]}>
            {streak}
          </Text>
          <Text style={[styles.streakLabel, { color: textTert }]}>일 연속 🔥</Text>
          {longest > streak && (
            <Text style={[styles.streakSub, { color: textTert }]}>
              최고 {longest}일
            </Text>
          )}
        </View>
        <View style={styles.totalBlock}>
          <Text style={[styles.totalNumber, { color: textPrimary }]}>
            {totalKm.toFixed(1)}
          </Text>
          <Text style={[styles.totalLabel, { color: textTert }]}>총 km</Text>
        </View>
      </View>

      {/* Weekly progress bar */}
      <View style={styles.weeklyBlock}>
        <View style={styles.weeklyHeader}>
          <Text style={[styles.weeklyLabel, { color: textSec }]}>이번 주 목표</Text>
          <Text style={[styles.weeklyValue, { color: textPrimary }]}>
            {weeklyDist.toFixed(1)} / {weeklyGoal.toFixed(0)} km
          </Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: trackBg }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(100, weeklyPct)}%`,
                backgroundColor: weeklyPct >= 100 ? '#22C55E' : colors.primary,
              },
            ]}
          />
        </View>
        <Text style={[styles.weeklyPct, { color: textTert }]}>
          {weeklyPct >= 100 ? '🎉 목표 달성!' : `${weeklyPct}%`}
        </Text>
      </View>

      {/* Badges grid */}
      {badges.length > 0 && (
        <View style={styles.badgesBlock}>
          <Text style={[styles.badgesLabel, { color: textSec }]}>획득한 뱃지</Text>
          <View style={styles.badgesRow}>
            {badges.slice(0, 6).map((b) => {
              const meta = BADGE_LABELS[b.code] || { label: b.code, emoji: '🏆' };
              return (
                <View key={b.code} style={[styles.badgeItem, { backgroundColor: trackBg }]}>
                  <Text style={styles.badgeEmoji}>{meta.emoji}</Text>
                  <Text style={[styles.badgeText, { color: textSec }]} numberOfLines={1}>
                    {meta.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  streakBlock: {
    flex: 1,
  },
  streakNumber: {
    fontSize: 38,
    fontWeight: '800',
    lineHeight: 42,
    letterSpacing: -1,
  },
  streakLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  streakSub: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  totalBlock: {
    alignItems: 'flex-end',
  },
  totalNumber: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  weeklyBlock: {
    marginBottom: 16,
  },
  weeklyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  weeklyLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  weeklyValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  weeklyPct: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'right',
  },
  badgesBlock: {
    marginTop: 4,
  },
  badgesLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  badgeEmoji: {
    fontSize: 14,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
