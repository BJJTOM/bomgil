import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';
import { ActivityStats, ActivityTrack, PaginatedResponse } from '../types';

const SOURCE_LABELS: Record<string, { label: string; icon: string }> = {
  manual_gpx: { label: 'GPX', icon: '📁' },
  apple_watch: { label: 'Apple Watch', icon: '⌚' },
  garmin: { label: 'Garmin', icon: '⌚' },
  samsung_health: { label: 'Samsung Health', icon: '📱' },
  google_fit: { label: 'Google Fit', icon: '📱' },
  cashwalk: { label: 'Cashwalk', icon: '🚶' },
  phone_gps: { label: 'GPS', icon: '📍' },
  strava: { label: 'Strava', icon: '🏃' },
};

export default function ActivityScreen() {
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

  const {
    data: activitiesData,
    isLoading: activitiesLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const { data } = await api.get('/activities/');
      return data as PaginatedResponse<ActivityTrack>;
    },
    enabled: isAuthenticated,
  });

  const activities = activitiesData?.results || [];

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
  };

  const formatPace = (pace: string | null) => {
    if (!pace) return '-';
    const p = parseFloat(pace);
    const min = Math.floor(p);
    const sec = Math.round((p - min) * 60);
    return `${min}'${sec.toString().padStart(2, '0')}"`;
  };

  // Today's stats
  const today = new Date().toISOString().split('T')[0];
  const todayWeekly = stats?.weekly?.find((d) => d.date === today);
  const todayActivities = activities.filter(
    (a) => a.started_at && a.started_at.startsWith(today),
  );
  const todayStats = todayWeekly
    ? {
        steps: todayWeekly.total_steps,
        distance: parseFloat(todayWeekly.total_distance_km),
        calories: todayWeekly.total_calories,
      }
    : {
        steps: todayActivities.reduce((s, a) => s + (a.total_steps || 0), 0),
        distance: todayActivities.reduce(
          (s, a) => s + parseFloat(a.distance_km || '0'),
          0,
        ),
        calories: todayActivities.reduce(
          (s, a) => s + (a.calories_burned || 0),
          0,
        ),
      };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.headerSimple}>
          <Text style={styles.headerTitle}>활동 기록</Text>
        </View>
        <View style={styles.loginPrompt}>
          <Text style={styles.loginPromptIcon}>🦶</Text>
          <Text style={styles.loginPromptTitle}>
            로그인하고 걷기 기록을 시작하세요
          </Text>
          <TouchableOpacity
            style={styles.loginPromptBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}>
            <Text style={styles.loginPromptBtnText}>로그인</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {/* Header */}
        <View style={styles.headerSection}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>활동 기록</Text>
              <Text style={styles.headerSub}>나의 걷기 활동을 기록해보세요</Text>
            </View>
            <TouchableOpacity style={styles.addRecordBtn} activeOpacity={0.7}>
              <Text style={styles.addRecordText}>+ 기록 추가</Text>
            </TouchableOpacity>
          </View>

          {/* Big Total Distance */}
          {statsLoading ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginVertical: 24 }}
            />
          ) : (
            <View style={styles.totalDistanceWrap}>
              <Text style={styles.totalDistanceLabel}>총 거리</Text>
              <Text style={styles.totalDistanceValue}>
                {stats?.total_distance_km.toFixed(1) || '0.0'}
              </Text>
              <Text style={styles.totalDistanceUnit}>km</Text>
            </View>
          )}

          {/* Today's Rings */}
          <View style={styles.ringsRow}>
            <View style={styles.ringItem}>
              <View style={[styles.ringCircle, styles.ringSteps]}>
                <Text style={styles.ringValue}>
                  {todayStats.steps.toLocaleString()}
                </Text>
              </View>
              <Text style={styles.ringLabel}>걸음</Text>
            </View>
            <View style={styles.ringItem}>
              <View style={[styles.ringCircle, styles.ringDistance]}>
                <Text style={styles.ringValue}>
                  {todayStats.distance.toFixed(1)}
                </Text>
              </View>
              <Text style={styles.ringLabel}>km</Text>
            </View>
            <View style={styles.ringItem}>
              <View style={[styles.ringCircle, styles.ringCalories]}>
                <Text style={styles.ringValue}>{todayStats.calories}</Text>
              </View>
              <Text style={styles.ringLabel}>kcal</Text>
            </View>
          </View>

          {/* Start Walking CTA */}
          <TouchableOpacity
            style={styles.startWalkBtn}
            onPress={() => navigation.navigate('Walk')}
            activeOpacity={0.85}>
            <Text style={styles.startWalkText}>🚶 걷기 시작</Text>
          </TouchableOpacity>

          {/* Weekly Chart */}
          {stats && stats.weekly && stats.weekly.length > 0 && (
            <View style={styles.weeklyCard}>
              <Text style={styles.weeklyTitle}>이번 주 거리</Text>
              <View style={styles.weeklyBars}>
                {stats.weekly.map((day) => {
                  const km = parseFloat(day.total_distance_km);
                  const maxKm = Math.max(
                    ...stats.weekly.map((d) =>
                      parseFloat(d.total_distance_km),
                    ),
                    1,
                  );
                  const height = Math.max((km / maxKm) * 100, 4);
                  const dayLabel = new Date(day.date).toLocaleDateString(
                    'ko-KR',
                    { weekday: 'short' },
                  );
                  return (
                    <View key={day.date} style={styles.weeklyBarCol}>
                      <View style={styles.weeklyBarTrack}>
                        <View
                          style={[
                            styles.weeklyBar,
                            { height: `${height}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.weeklyBarLabel}>{dayLabel}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Recent Activities */}
        <View style={styles.recentSection}>
          <Text style={styles.recentTitle}>최근 활동</Text>
          {activitiesLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <View key={i} style={styles.skeletonItem}>
                  <View style={styles.skeletonTitle} />
                  <View style={styles.skeletonMeta} />
                </View>
              ))}
            </>
          ) : activities.length === 0 ? (
            <View style={styles.noRecords}>
              <Text style={styles.noRecordsText}>
                아직 활동 기록이 없어요
              </Text>
            </View>
          ) : (
            activities.map((activity) => (
              <TouchableOpacity
                key={activity.id}
                style={styles.activityCard}
                activeOpacity={0.7}>
                <View style={styles.activityHeader}>
                  <View style={styles.activityTitleRow}>
                    <Text style={styles.activityIcon}>
                      {SOURCE_LABELS[activity.source]?.icon || '📍'}
                    </Text>
                    <View style={styles.activityTitleInfo}>
                      <Text style={styles.activityTitle}>
                        {activity.title ||
                          `${SOURCE_LABELS[activity.source]?.label || ''} 기록`}
                      </Text>
                      <Text style={styles.activityDate}>
                        {activity.started_at
                          ? new Date(activity.started_at).toLocaleDateString(
                              'ko-KR',
                              {
                                month: 'long',
                                day: 'numeric',
                                weekday: 'short',
                              },
                            )
                          : new Date(activity.created_at).toLocaleDateString(
                              'ko-KR',
                              {
                                month: 'long',
                                day: 'numeric',
                                weekday: 'short',
                              },
                            )}
                        {' · '}
                        {SOURCE_LABELS[activity.source]?.label || ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceBadgeText}>
                      {activity.distance_km
                        ? `${parseFloat(activity.distance_km).toFixed(1)}km`
                        : '-'}
                    </Text>
                  </View>
                </View>

                <View style={styles.activityStats}>
                  <View style={styles.activityStatItem}>
                    <Text style={styles.activityStatLabel}>거리</Text>
                    <Text style={styles.activityStatValue}>
                      {activity.distance_km
                        ? `${parseFloat(activity.distance_km).toFixed(1)}km`
                        : '-'}
                    </Text>
                  </View>
                  <View style={styles.activityStatItem}>
                    <Text style={styles.activityStatLabel}>시간</Text>
                    <Text style={styles.activityStatValue}>
                      {formatDuration(activity.duration_minutes)}
                    </Text>
                  </View>
                  <View style={styles.activityStatItem}>
                    <Text style={styles.activityStatLabel}>걸음</Text>
                    <Text style={styles.activityStatValue}>
                      {activity.total_steps?.toLocaleString() || '-'}
                    </Text>
                  </View>
                  <View style={styles.activityStatItem}>
                    <Text style={styles.activityStatLabel}>페이스</Text>
                    <Text style={styles.activityStatValue}>
                      {formatPace(activity.avg_pace_min_km)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  // Login prompt
  headerSimple: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  loginPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  loginPromptIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  loginPromptTitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  loginPromptBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 16,
  },
  loginPromptBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // Header section (light gradient feel)
  headerSection: {
    backgroundColor: colors.primary50,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSub: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 2,
  },
  addRecordBtn: {
    backgroundColor: 'rgba(45,74,46,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  addRecordText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary,
  },

  // Total distance
  totalDistanceWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  totalDistanceLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  totalDistanceValue: {
    fontSize: 56,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 60,
  },
  totalDistanceUnit: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 4,
  },

  // Today's rings
  ringsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 24,
  },
  ringItem: {
    alignItems: 'center',
  },
  ringCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ringSteps: {
    borderColor: '#2D4A2E',
  },
  ringDistance: {
    borderColor: '#A8E6CF',
  },
  ringCalories: {
    borderColor: '#FF6B6B',
  },
  ringValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  ringLabel: {
    fontSize: 10,
    color: colors.textTertiary,
  },

  // Start walk
  startWalkBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  startWalkText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // Weekly chart
  weeklyCard: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  weeklyTitle: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 12,
  },
  weeklyBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 60,
    gap: 6,
  },
  weeklyBarCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  weeklyBarTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  weeklyBar: {
    width: '100%',
    backgroundColor: 'rgba(45,74,46,0.3)',
    borderRadius: 2,
  },
  weeklyBarLabel: {
    fontSize: 9,
    color: colors.textTertiary,
    marginTop: 4,
  },

  // Recent activities
  recentSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },

  // Activity card
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  activityIcon: {
    fontSize: 18,
  },
  activityTitleInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  activityDate: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  distanceBadge: {
    backgroundColor: '#111111',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  distanceBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  activityStats: {
    flexDirection: 'row',
    gap: 8,
  },
  activityStatItem: {
    flex: 1,
  },
  activityStatLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  activityStatValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // Skeleton
  skeletonItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    marginBottom: 12,
  },
  skeletonTitle: {
    height: 16,
    width: '40%',
    backgroundColor: colors.bgSecondary,
    borderRadius: 4,
    marginBottom: 12,
  },
  skeletonMeta: {
    height: 12,
    width: '65%',
    backgroundColor: colors.bgSecondary,
    borderRadius: 4,
  },

  // Empty
  noRecords: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  noRecordsText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
});
