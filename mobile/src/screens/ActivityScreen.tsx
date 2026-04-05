import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';
import { FadeInView } from '../components/FadeInView';
import { ActivityStats, ActivityTrack, PaginatedResponse } from '../types';

const SOURCE_LABELS: Record<string, { label: string; icon: string }> = {
  manual_gpx: { label: 'GPX', icon: '\uD83D\uDCC1' },
  apple_watch: { label: 'Apple Watch', icon: '\u231A' },
  garmin: { label: 'Garmin', icon: '\u231A' },
  samsung_health: { label: 'Samsung Health', icon: '\uD83D\uDCF1' },
  google_fit: { label: 'Google Fit', icon: '\uD83D\uDCF1' },
  cashwalk: { label: 'Cashwalk', icon: '\uD83D\uDEB6' },
  phone_gps: { label: 'GPS', icon: '\uD83D\uDCCD' },
  strava: { label: 'Strava', icon: '\uD83C\uDFC3' },
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
    return h > 0 ? `${h}\uC2DC\uAC04 ${m}\uBD84` : `${m}\uBD84`;
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
          <Text style={styles.headerTitle}>{'\uD65C\uB3D9 \uAE30\uB85D'}</Text>
        </View>
        <View style={styles.loginPrompt}>
          <Text style={styles.loginPromptIcon}>{'\uD83E\uDDB6'}</Text>
          <Text style={styles.loginPromptTitle}>
            {'\uB85C\uADF8\uC778\uD558\uACE0 \uAC77\uAE30 \uAE30\uB85D\uC744 \uC2DC\uC791\uD558\uC138\uC694'}
          </Text>
          <TouchableOpacity
            style={styles.loginPromptBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}>
            <Text style={styles.loginPromptBtnText}>{'\uB85C\uADF8\uC778'}</Text>
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
            {statsLoading ? (
              <ActivityIndicator
                color={colors.primary}
                style={{ marginVertical: 32 }}
              />
            ) : (
              <View style={styles.bigDistanceWrap}>
                <Text style={styles.bigDistanceValue}>
                  {todayStats.distance.toFixed(1)}
                </Text>
                <Text style={styles.bigDistanceUnit}>km</Text>
              </View>
            )}
          </FadeInView>

          {/* Steps + Calories row */}
          <FadeInView delay={100}>
            <View style={styles.subStatsRow}>
              <Text style={styles.subStatText}>
                {todayStats.steps.toLocaleString()} {'\uAC78\uC74C'}
              </Text>
              <Text style={styles.subStatDot}>{'\u00B7'}</Text>
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
              <Text style={styles.startWalkText}>{'\uD83D\uDEB6 \uAC77\uAE30 \uC2DC\uC791'}</Text>
            </TouchableOpacity>
          </FadeInView>

          <FadeInView delay={200}>
            <View style={styles.secondaryRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('AddRecord')}>
                <Text style={styles.secondaryBtnText}>{'\uAE30\uB85D \uCD94\uAC00'}</Text>
              </TouchableOpacity>
              <Text style={styles.secondaryDot}>{'\u00B7'}</Text>
              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('WalkStats')}>
                <Text style={styles.secondaryBtnText}>{'\uD1B5\uACC4 \uBCF4\uAE30'}</Text>
              </TouchableOpacity>
            </View>
          </FadeInView>
        </View>

        {/* ===== BOTTOM SECTION: Recent activities ===== */}
        <View style={styles.recentSection}>
          <FadeInView delay={250}>
            <Text style={styles.recentTitle}>{'\uCD5C\uADFC \uD65C\uB3D9'}</Text>
          </FadeInView>

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
                {'\uC544\uC9C1 \uD65C\uB3D9 \uAE30\uB85D\uC774 \uC5C6\uC5B4\uC694'}
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
                    activeOpacity={0.7}>
                    <View style={styles.activityIconWrap}>
                      <Text style={styles.activityIcon}>
                        {sourceInfo?.icon || '\uD83D\uDCCD'}
                      </Text>
                    </View>
                    <View style={styles.activityInfo}>
                      <View style={styles.activityTopRow}>
                        <Text style={styles.activityDateText}>{dateStr}</Text>
                        <Text style={styles.activityTitle}>
                          {activity.title ||
                            `${sourceInfo?.label || ''} \uAE30\uB85D`}
                        </Text>
                      </View>
                      <Text style={styles.activityMeta}>
                        {[distanceStr, durationStr].filter(Boolean).join(' \u00B7 ')}
                      </Text>
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
