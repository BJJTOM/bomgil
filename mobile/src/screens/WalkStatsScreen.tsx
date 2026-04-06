import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';
import { FadeInView } from '../components/FadeInView';
import { ActivityStats, PaginatedResponse, ActivityTrack } from '../types';

const DAILY_GOAL_KM = 5;
const DAILY_GOAL_STEPS = 10000;
const DAILY_GOAL_CALORIES = 300;

export default function WalkStatsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAuthStore();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['activity-stats'],
    queryFn: async () => {
      const { data } = await api.get('/activities/my_stats/');
      return data as ActivityStats;
    },
    enabled: isAuthenticated,
  });

  const { data: activitiesData } = useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const { data } = await api.get('/activities/');
      return data as PaginatedResponse<ActivityTrack>;
    },
    enabled: isAuthenticated,
  });

  const { data: badges } = useQuery({
    queryKey: ['my-badges'],
    queryFn: async () => {
      const { data } = await api.get('/auth/me/');
      return data.badges || [];
    },
    enabled: isAuthenticated,
  });

  const activities = activitiesData?.results || [];

  // Compute streak
  const computeStreak = (): number => {
    if (!stats?.weekly || stats.weekly.length === 0) return 0;
    let streak = 0;
    const sorted = [...stats.weekly].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    for (const day of sorted) {
      if (parseFloat(day.total_distance_km) > 0) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  // Average pace
  const computeAvgPace = (): string => {
    const withPace = activities.filter((a) => a.avg_pace_min_km);
    if (withPace.length === 0) return '-';
    const total = withPace.reduce(
      (sum, a) => sum + parseFloat(a.avg_pace_min_km || '0'),
      0,
    );
    const avg = total / withPace.length;
    const min = Math.floor(avg);
    const sec = Math.round((avg - min) * 60);
    return `${min}'${sec.toString().padStart(2, '0')}"`;
  };

  // Most walked trail
  const computeMostWalked = (): string => {
    const trailCounts: Record<string, number> = {};
    activities.forEach((a) => {
      const name = a.title || 'Unknown';
      trailCounts[name] = (trailCounts[name] || 0) + 1;
    });
    const sorted = Object.entries(trailCounts).sort(([, a], [, b]) => b - a);
    return sorted.length > 0 ? sorted[0][0] : '-';
  };

  // Today's data
  const today = new Date().toISOString().split('T')[0];
  const todayData = stats?.weekly?.find((d) => d.date === today);
  const todayKm = todayData ? parseFloat(todayData.total_distance_km) : 0;
  const todaySteps = todayData?.total_steps || 0;
  const todayCalories = todayData?.total_calories || 0;

  // Ring progress (0 to 1)
  const distanceProgress = Math.min(todayKm / DAILY_GOAL_KM, 1);
  const stepsProgress = Math.min(todaySteps / DAILY_GOAL_STEPS, 1);
  const caloriesProgress = Math.min(todayCalories / DAILY_GOAL_CALORIES, 1);

  // Monthly distance (this month)
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthlyKm = activities
    .filter((a) => a.started_at && a.started_at.startsWith(thisMonth))
    .reduce((sum, a) => sum + parseFloat(a.distance_km || '0'), 0);

  // Last 6 months data
  const monthlyData: { month: string; km: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const km = activities
      .filter((a) => a.started_at && a.started_at.startsWith(key))
      .reduce((sum, a) => sum + parseFloat(a.distance_km || '0'), 0);
    monthlyData.push({
      month: `${d.getMonth() + 1}월`,
      km,
    });
  }
  const maxMonthlyKm = Math.max(...monthlyData.map((d) => d.km), 1);

  if (statsLoading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>{'<-'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>걷기 통계</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* This Month Big Number */}
        <FadeInView delay={0}>
          <View style={styles.bigCard}>
            <Text style={styles.bigCardLabel}>이번 달 거리</Text>
            <Text style={styles.bigCardValue}>{monthlyKm.toFixed(1)}</Text>
            <Text style={styles.bigCardUnit}>km</Text>
          </View>
        </FadeInView>

        {/* Daily Goal Rings */}
        <FadeInView delay={100}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>오늘의 목표</Text>
            <View style={styles.ringsRow}>
              <View style={styles.ringItem}>
                <View style={styles.ringOuter}>
                  <View
                    style={[
                      styles.ringFill,
                      {
                        backgroundColor: '#2D4A2E',
                        height: `${distanceProgress * 100}%`,
                      },
                    ]}
                  />
                  <View style={styles.ringInner}>
                    <Text style={styles.ringValue}>{todayKm.toFixed(1)}</Text>
                  </View>
                </View>
                <Text style={styles.ringLabel}>km / {DAILY_GOAL_KM}</Text>
              </View>
              <View style={styles.ringItem}>
                <View style={styles.ringOuter}>
                  <View
                    style={[
                      styles.ringFill,
                      {
                        backgroundColor: '#A8E6CF',
                        height: `${stepsProgress * 100}%`,
                      },
                    ]}
                  />
                  <View style={styles.ringInner}>
                    <Text style={styles.ringValue}>
                      {todaySteps > 999
                        ? `${(todaySteps / 1000).toFixed(1)}k`
                        : todaySteps}
                    </Text>
                  </View>
                </View>
                <Text style={styles.ringLabel}>
                  걸음 / {(DAILY_GOAL_STEPS / 1000).toFixed(0)}k
                </Text>
              </View>
              <View style={styles.ringItem}>
                <View style={styles.ringOuter}>
                  <View
                    style={[
                      styles.ringFill,
                      {
                        backgroundColor: '#FF6B6B',
                        height: `${caloriesProgress * 100}%`,
                      },
                    ]}
                  />
                  <View style={styles.ringInner}>
                    <Text style={styles.ringValue}>{todayCalories}</Text>
                  </View>
                </View>
                <Text style={styles.ringLabel}>kcal / {DAILY_GOAL_CALORIES}</Text>
              </View>
            </View>
          </View>
        </FadeInView>

        {/* Weekly Bar Chart */}
        <FadeInView delay={200}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>최근 7일 거리</Text>
            <View style={styles.barChart}>
              {(stats?.weekly || []).map((day) => {
                const km = parseFloat(day.total_distance_km);
                const maxKm = Math.max(
                  ...(stats?.weekly || []).map((d) =>
                    parseFloat(d.total_distance_km),
                  ),
                  1,
                );
                const height = Math.max((km / maxKm) * 120, 4);
                const dayLabel = new Date(day.date).toLocaleDateString('ko-KR', {
                  weekday: 'short',
                });
                const isToday = day.date === today;
                return (
                  <View key={day.date} style={styles.barCol}>
                    <Text style={styles.barValue}>
                      {km > 0 ? km.toFixed(1) : ''}
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height,
                            backgroundColor: isToday ? '#2D4A2E' : 'rgba(45,74,46,0.25)',
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.barLabel,
                        isToday && { color: '#2D4A2E', fontWeight: '700' },
                      ]}>
                      {dayLabel}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </FadeInView>

        {/* Monthly Trend */}
        <FadeInView delay={300}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>월별 거리 추이</Text>
            <View style={styles.barChart}>
              {monthlyData.map((m, idx) => {
                const height = Math.max((m.km / maxMonthlyKm) * 120, 4);
                const isCurrent = idx === monthlyData.length - 1;
                return (
                  <View key={m.month} style={styles.barCol}>
                    <Text style={styles.barValue}>
                      {m.km > 0 ? m.km.toFixed(1) : ''}
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height,
                            backgroundColor: isCurrent
                              ? '#2D4A2E'
                              : 'rgba(45,74,46,0.25)',
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.barLabel,
                        isCurrent && { color: '#2D4A2E', fontWeight: '700' },
                      ]}>
                      {m.month}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </FadeInView>

        {/* Stats Grid */}
        <FadeInView delay={400}>
          <View style={styles.statsGrid}>
            <View style={styles.statsGridItem}>
              <Text style={styles.statsGridIcon}>{'🔥'}</Text>
              <Text style={styles.statsGridValue}>{computeStreak()}</Text>
              <Text style={styles.statsGridLabel}>연속 일수</Text>
            </View>
            <View style={styles.statsGridItem}>
              <Text style={styles.statsGridIcon}>{'⏱️'}</Text>
              <Text style={styles.statsGridValue}>{computeAvgPace()}</Text>
              <Text style={styles.statsGridLabel}>평균 페이스</Text>
            </View>
            <View style={styles.statsGridItem}>
              <Text style={styles.statsGridIcon}>{'🔥'}</Text>
              <Text style={styles.statsGridValue}>
                {stats?.total_calories?.toLocaleString() || 0}
              </Text>
              <Text style={styles.statsGridLabel}>총 칼로리</Text>
            </View>
            <View style={styles.statsGridItem}>
              <Text style={styles.statsGridIcon}>{'🏆'}</Text>
              <Text style={styles.statsGridValue}>{stats?.track_count || 0}</Text>
              <Text style={styles.statsGridLabel}>총 활동</Text>
            </View>
          </View>
        </FadeInView>

        {/* Most Walked */}
        <FadeInView delay={500}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>가장 많이 걸은 코스</Text>
            <Text style={styles.mostWalked}>{computeMostWalked()}</Text>
          </View>
        </FadeInView>

        {/* Badges */}
        {badges && badges.length > 0 && (
          <FadeInView delay={600}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>획득한 배지</Text>
              <View style={styles.badgeRow}>
                {badges.map((badge: any) => (
                  <View key={badge.badge_type} style={styles.badgeItem}>
                    <Text style={styles.badgeIcon}>
                      {badge.badge_type === 'first_walk'
                        ? '🥾'
                        : badge.badge_type === 'trail_creator'
                          ? '🗺️'
                          : badge.badge_type === 'storyteller'
                            ? '📝'
                            : badge.badge_type === 'walker_10km'
                              ? '🚶'
                              : badge.badge_type === 'walker_50km'
                                ? '🏃'
                                : badge.badge_type === 'walker_100km'
                                  ? '🏅'
                                  : badge.badge_type === 'global_walker'
                                    ? '🌍'
                                    : badge.badge_type === 'popular'
                                      ? '⭐'
                                      : '🏷️'}
                    </Text>
                    <Text style={styles.badgeLabel}>{badge.badge_type}</Text>
                  </View>
                ))}
              </View>
            </View>
          </FadeInView>
        )}

        {/* Total Summary */}
        <FadeInView delay={700}>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>총 거리</Text>
            <Text style={styles.totalValue}>
              {stats?.total_distance_km.toFixed(1) || '0.0'} km
            </Text>
            <View style={styles.totalRow}>
              <View style={styles.totalItem}>
                <Text style={styles.totalItemValue}>
                  {stats?.total_steps?.toLocaleString() || 0}
                </Text>
                <Text style={styles.totalItemLabel}>총 걸음</Text>
              </View>
              <View style={styles.totalDivider} />
              <View style={styles.totalItem}>
                <Text style={styles.totalItemValue}>
                  {stats?.total_duration_minutes
                    ? `${Math.floor(stats.total_duration_minutes / 60)}h`
                    : '0h'}
                </Text>
                <Text style={styles.totalItemLabel}>총 시간</Text>
              </View>
            </View>
          </View>
        </FadeInView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  backIcon: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // Big card
  bigCard: {
    marginHorizontal: 20,
    backgroundColor: '#2D4A2E',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  bigCardLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bigCardValue: {
    fontSize: 64,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 68,
  },
  bigCardUnit: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },

  // Card
  card: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F2F4F6',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },

  // Rings
  ringsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ringItem: {
    alignItems: 'center',
  },
  ringOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  ringFill: {
    width: '100%',
    borderRadius: 36,
  },
  ringInner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  ringLabel: {
    fontSize: 10,
    color: colors.textTertiary,
  },

  // Bar chart
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 160,
    gap: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValue: {
    fontSize: 9,
    color: colors.textTertiary,
    marginBottom: 4,
  },
  barTrack: {
    flex: 1,
    width: '80%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 6,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  statsGridItem: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  statsGridIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statsGridValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  statsGridLabel: {
    fontSize: 12,
    color: colors.textTertiary,
  },

  // Most walked
  mostWalked: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // Badges
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeItem: {
    alignItems: 'center',
    width: 64,
  },
  badgeIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  badgeLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Total card
  totalCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F2F4F6',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalItem: {
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  totalDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#F2F4F6',
  },
  totalItemValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  totalItemLabel: {
    fontSize: 11,
    color: colors.textTertiary,
  },
});
