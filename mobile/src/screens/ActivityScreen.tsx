import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';
import { FadeInView } from '../components/FadeInView';
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
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  const { data: stats } = useQuery({
    queryKey: ['activity-stats'],
    queryFn: async () => {
      const { data } = await api.get('/activities/my_stats/', { timeout: 10000 });
      return data as ActivityStats;
    },
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    placeholderData: (prev: ActivityStats | undefined) => prev,
  });

  const {
    data: activitiesData,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const { data } = await api.get('/activities/', { timeout: 10000 });
      return data as PaginatedResponse<ActivityTrack>;
    },
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    placeholderData: (prev: PaginatedResponse<ActivityTrack> | undefined) => prev,
  });

  const activities = activitiesData?.results || [];

  // Refetch when screen comes into focus (e.g. after completing a walk)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
  };

  // Today's date string
  const now = new Date();
  const todayDateStr = now.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  // Today's stats
  const today = now.toISOString().split('T')[0];
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
          <Text style={styles.headerTitle}>{'활동 기록'}</Text>
        </View>
        <View style={styles.loginPrompt}>
          <Text style={styles.loginPromptIcon}>{'🦶'}</Text>
          <Text style={styles.loginPromptTitle}>
            {'로그인하고 걷기 기록을 시작하세요'}
          </Text>
          <TouchableOpacity
            style={styles.loginPromptBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}>
            <Text style={styles.loginPromptBtnText}>{'로그인'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>

        {/* ===== TOP SECTION: Today's focus ===== */}
        <View style={styles.todaySection}>
          {/* Date */}
          <FadeInView delay={0}>
            <Text style={styles.todayDate}>{todayDateStr}</Text>
          </FadeInView>

          {/* Big distance number */}
          <FadeInView delay={50}>
            <View style={styles.bigDistanceWrap}>
              <Text style={styles.bigDistanceValue}>
                {todayStats.distance.toFixed(1)}
              </Text>
              <Text style={styles.bigDistanceUnit}>km</Text>
            </View>
          </FadeInView>

          {/* Steps + Calories row */}
          <FadeInView delay={100}>
            <View style={styles.subStatsRow}>
              <Text style={styles.subStatText}>
                {todayStats.steps.toLocaleString()} {'걸음'}
              </Text>
              <Text style={styles.subStatDot}>{'·'}</Text>
              <Text style={styles.subStatText}>
                {todayStats.calories} kcal
              </Text>
            </View>
          </FadeInView>
        </View>

        {/* ===== MIDDLE SECTION: CTA buttons ===== */}
        <View style={styles.ctaSection}>
          <FadeInView delay={150}>
            <TouchableOpacity
              style={styles.startWalkBtn}
              onPress={() => navigation.navigate('Walk')}
              activeOpacity={0.85}>
              <Text style={styles.startWalkText}>{'🚶 걷기 시작'}</Text>
            </TouchableOpacity>
          </FadeInView>

          <FadeInView delay={175}>
            <TouchableOpacity
              style={styles.watchImportBtn}
              onPress={() => navigation.navigate('HealthImport')}
              activeOpacity={0.85}>
              <Text style={styles.watchImportText}>{'⌚ 워치 기록 가져오기'}</Text>
            </TouchableOpacity>
          </FadeInView>

          <FadeInView delay={200}>
            <View style={styles.secondaryRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('AddRecord')}>
                <Text style={styles.secondaryBtnText}>{'기록 추가'}</Text>
              </TouchableOpacity>
              <Text style={styles.secondaryDot}>{'·'}</Text>
              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('WalkStats')}>
                <Text style={styles.secondaryBtnText}>{'통계 보기'}</Text>
              </TouchableOpacity>
            </View>
          </FadeInView>
        </View>

        {/* ===== BOTTOM SECTION: Recent activities ===== */}
        <View style={styles.recentSection}>
          <FadeInView delay={250}>
            <Text style={styles.recentTitle}>{'최근 활동'}</Text>
          </FadeInView>

          {activities.length === 0 ? (
            <View style={styles.noRecords}>
              <Text style={styles.noRecordsText}>
                {'아직 활동 기록이 없어요'}
              </Text>
            </View>
          ) : (
            activities.map((activity) => {
              const dateStr = activity.started_at
                ? new Date(activity.started_at).toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                  })
                : new Date(activity.created_at).toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                  });
              const sourceInfo = SOURCE_LABELS[activity.source];
              const distanceStr = activity.distance_km
                ? `${parseFloat(activity.distance_km).toFixed(1)}km`
                : '';
              const durationStr = formatDuration(activity.duration_minutes);

              return (
                <FadeInView key={activity.id} delay={300}>
                  <TouchableOpacity
                    style={styles.activityItem}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('ActivityDetail', { activity })}
                    onLongPress={() => {
                      Alert.alert(
                        '활동 삭제',
                        '이 활동을 삭제하시겠습니까?',
                        [
                          { text: '취소', style: 'cancel' },
                          {
                            text: '삭제',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await api.delete(`/activities/${activity.id}/`);
                                queryClient.invalidateQueries({ queryKey: ['activities'] });
                                queryClient.invalidateQueries({ queryKey: ['activity-stats'] });
                              } catch (err) {
                                Alert.alert('오류', '삭제에 실패했습니다.');
                              }
                            },
                          },
                        ],
                      );
                    }}>
                    <View style={styles.activityIconWrap}>
                      <Text style={styles.activityIcon}>
                        {sourceInfo?.icon || '\uD83D\uDCCD'}
                      </Text>
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityTitleMain} numberOfLines={1}>
                        {activity.title || `${sourceInfo?.label || ''} 기록`}
                      </Text>
                      <View style={styles.activityTopRow}>
                        <Text style={styles.activityDateText}>{dateStr}</Text>
                        <Text style={styles.activityMeta}>
                          {[distanceStr, durationStr].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </FadeInView>
              );
            })
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
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
    borderRadius: 14,
  },
  loginPromptBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // ===== Today section =====
  todaySection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
  todayDate: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 24,
  },
  bigDistanceWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  bigDistanceValue: {
    fontSize: 72,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 80,
    letterSpacing: -2,
  },
  bigDistanceUnit: {
    fontSize: 16,
    color: colors.textTertiary,
    marginTop: 2,
  },
  subStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subStatText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  subStatDot: {
    fontSize: 14,
    color: colors.textTertiary,
  },

  // ===== CTA section =====
  ctaSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  startWalkBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  startWalkText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  watchImportBtn: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  watchImportText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  secondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  secondaryDot: {
    fontSize: 14,
    color: colors.textTertiary,
  },

  // ===== Recent section =====
  recentSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  recentTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F6',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F6',
  },
  activityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  activityIcon: {
    fontSize: 18,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitleMain: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  activityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  activityDateText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  activityTitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  activityMeta: {
    fontSize: 13,
    color: colors.textTertiary,
  },

  // Skeleton
  skeletonItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F6',
  },
  skeletonTitle: {
    height: 14,
    width: '40%',
    backgroundColor: '#F7F8FA',
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonMeta: {
    height: 12,
    width: '55%',
    backgroundColor: '#F7F8FA',
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
