import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { FadeInView } from '../components/FadeInView';
import { ActivityStats, ActivityTrack, PaginatedResponse } from '../types';

const SOURCE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  manual_gpx: { label: 'GPX', icon: '\uD83D\uDCC1', color: '#6B7280' },
  apple_watch: { label: 'Apple Watch', icon: '⌚', color: '#34D399' },
  garmin: { label: 'Garmin', icon: '⌚', color: '#60A5FA' },
  samsung_health: { label: 'Samsung Health', icon: '\uD83D\uDCF1', color: '#818CF8' },
  google_fit: { label: 'Google Fit', icon: '\uD83D\uDCF1', color: '#34D399' },
  cashwalk: { label: 'Cashwalk', icon: '\uD83D\uDEB6', color: '#FBBF24' },
  phone_gps: { label: 'GPS', icon: '\uD83D\uDCCD', color: '#F87171' },
  strava: { label: 'Strava', icon: '\uD83C\uDFC3', color: '#FB923C' },
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour <= 11) return '좋은 아침이에요! 오늘도 걸어볼까요?';
  if (hour >= 12 && hour <= 17) return '산책하기 좋은 날이에요!';
  if (hour >= 18 && hour <= 23) return '저녁 산책은 어떠세요?';
  return '오늘도 수고했어요!';
}

// Pulse animation for CTA button
function PulseButton({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  const scale = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.02, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity style={styles.startWalkBtn} onPress={onPress} activeOpacity={0.85}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const { isDark } = useThemeStore();
  const bg = isDark ? '#0a0a0a' : '#F8F9FB';
  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : colors.textPrimary;
  const textSecColor = isDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary;
  const textTertColor = isDark ? 'rgba(255,255,255,0.4)' : colors.textTertiary;

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

  const now = new Date();
  const todayDateStr = now.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const greeting = useMemo(() => getGreeting(), []);

  const today = now.toISOString().split('T')[0];
  const todayActivities = activities.filter(
    (a) => a.started_at && a.started_at.startsWith(today),
  );
  const allSteps = activities.reduce((s, a) => s + (a.total_steps || 0), 0);
  const allDistance = activities.reduce((s, a) => s + parseFloat(a.distance_km || '0'), 0);
  const allCalories = activities.reduce((s, a) => s + (a.calories_burned || 0), 0);

  const todaySteps = todayActivities.reduce((s, a) => s + (a.total_steps || 0), 0);
  const todayDistance = todayActivities.reduce((s, a) => s + parseFloat(a.distance_km || '0'), 0);
  const todayCalories = todayActivities.reduce((s, a) => s + (a.calories_burned || 0), 0);

  const todayStats = {
    steps: allSteps,
    distance: allDistance,
    calories: allCalories,
  };

  const recentActivities = activities.slice(0, 5);

  const handleDelete = (activity: ActivityTrack) => {
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
              Alert.alert('완료', '활동이 삭제되었습니다.');
            } catch (err: any) {
              const msg = err?.response?.data?.detail || err?.response?.status || '삭제에 실패했습니다.';
              Alert.alert('오류', String(msg));
            }
          },
        },
      ],
    );
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: bg }]}>
        <View style={styles.headerSimple}>
          <Text style={[styles.headerTitle, { color: textColor }]}>{'활동 기록'}</Text>
        </View>
        <View style={styles.loginPrompt}>
          <Text style={styles.loginPromptIcon}>{'\uD83E\uDDB6'}</Text>
          <Text style={[styles.loginPromptTitle, { color: textSecColor }]}>
            {'로그인하고 걸기 기록을 시작하세요'}
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
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>

        {/* ===== HEADER with greeting ===== */}
        <View style={styles.headerSection}>
          <FadeInView delay={0}>
            <Text style={[styles.dateText, { color: textTertColor }]}>{todayDateStr}</Text>
            <Text style={[styles.greetingText, { color: textColor }]}>{greeting}</Text>
          </FadeInView>
        </View>

        {/* ===== BIG STAT CARD with progress ring ===== */}
        <FadeInView delay={50}>
          <View style={[styles.bigStatCard, { backgroundColor: cardBg }]}>
            <View style={styles.progressRingOuter}>
              <View style={styles.progressRingInner}>
                <Text style={[styles.bigDistanceValue, { color: textColor }]}>
                  {todayStats.distance.toFixed(1)}
                </Text>
                <Text style={[styles.bigDistanceUnit, { color: textTertColor }]}>km</Text>
              </View>
            </View>

            {/* Stats row with icons */}
            <View style={styles.statsIconRow}>
              <View style={styles.statIconItem}>
                <Text style={styles.statIcon}>{'\uD83C\uDFC3'}</Text>
                <Text style={[styles.statIconValue, { color: textColor }]}>{todayStats.steps.toLocaleString()}</Text>
                <Text style={[styles.statIconLabel, { color: textTertColor }]}>{'걸음'}</Text>
              </View>
              <View style={[styles.statDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
              <View style={styles.statIconItem}>
                <Text style={styles.statIcon}>{'\uD83D\uDD25'}</Text>
                <Text style={[styles.statIconValue, { color: textColor }]}>{todayStats.calories}</Text>
                <Text style={styles.statIconLabel}>kcal</Text>
              </View>
            </View>
          </View>
        </FadeInView>

        {/* ===== CTA SECTION ===== */}
        <View style={styles.ctaSection}>
          <FadeInView delay={150}>
            <PulseButton onPress={() => navigation.navigate('Walk')}>
              <Text style={styles.startWalkEmoji}>{'\uD83D\uDEB6'}</Text>
              <Text style={styles.startWalkText}>{'걸기 시작'}</Text>
            </PulseButton>
          </FadeInView>

          <FadeInView delay={175}>
            <TouchableOpacity
              style={[styles.watchImportBtn, isDark && { backgroundColor: '#1e1e1e', borderColor: 'rgba(255,255,255,0.1)' }]}
              onPress={() => navigation.navigate('HealthImport')}
              activeOpacity={0.85}>
              <Text style={[styles.watchImportText, isDark && { color: 'rgba(255,255,255,0.7)' }]}>{'⌚ 워치 기록 가져오기'}</Text>
            </TouchableOpacity>
          </FadeInView>
        </View>

        {/* ===== RECENT ACTIVITIES ===== */}
        <View style={styles.recentSection}>
          <FadeInView delay={250}>
            <View style={styles.recentHeader}>
              <Text style={[styles.recentTitle, { color: textColor }]}>{'최근 활동'}</Text>
              {activities.length > 5 && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('WalkStats')}
                  activeOpacity={0.7}>
                  <Text style={styles.seeAllText}>{'모두 보기'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </FadeInView>

          {recentActivities.length === 0 ? (
            <FadeInView delay={300}>
              <View style={[styles.noRecords, { backgroundColor: cardBg }]}>
                <Text style={styles.noRecordsEmoji}>{'\uD83D\uDEB6'}</Text>
                <Text style={styles.noRecordsText}>
                  {'아직 활동 기록이 없어요'}
                </Text>
                <Text style={styles.noRecordsHint}>
                  {'첫 번째 걸기를 시작해 보세요!'}
                </Text>
              </View>
            </FadeInView>
          ) : (
            recentActivities.map((activity, index) => {
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
              const iconColor = sourceInfo?.color || '#9CA3AF';

              return (
                <FadeInView key={activity.id} delay={300 + index * 50}>
                  <TouchableOpacity
                    style={[styles.activityCard, { backgroundColor: cardBg }]}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('ActivityDetail', { activity })}
                    onLongPress={() => handleDelete(activity)}>
                    <View style={[styles.activityIconWrap, { backgroundColor: iconColor + '18' }]}>
                      <Text style={styles.activityIcon}>
                        {sourceInfo?.icon || '\uD83D\uDCCD'}
                      </Text>
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={[styles.activityTitleMain, { color: textColor }]} numberOfLines={1}>
                        {activity.title || `${sourceInfo?.label || ''} 기록`}
                      </Text>
                      <Text style={[styles.activityMeta, { color: textTertColor }]}>
                        {dateStr}  {'·'}  {[distanceStr, durationStr].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.deleteBtn, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => handleDelete(activity)}>
                      <Text style={styles.deleteBtnText}>{'✕'}</Text>
                    </TouchableOpacity>
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
    backgroundColor: '#F8F9FB',
  },

  // Login prompt
  headerSimple: {
    paddingHorizontal: 24,
    paddingTop: 16,
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
    borderRadius: 20,
  },
  loginPromptBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // ===== Header section =====
  headerSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textTertiary,
    marginBottom: 4,
  },
  greetingText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 28,
  },

  // ===== Big stat card =====
  bigStatCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  progressRingOuter: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 6,
    borderColor: colors.primary + '25',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  progressRingInner: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 6,
    borderColor: colors.primary,
    borderTopColor: colors.primary,
    borderRightColor: colors.primary,
    borderBottomColor: colors.primary + '30',
    borderLeftColor: colors.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFBFC',
  },
  bigDistanceValue: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 54,
    letterSpacing: -1.5,
  },
  bigDistanceUnit: {
    fontSize: 15,
    color: colors.textTertiary,
    fontWeight: '500',
    marginTop: 2,
  },
  statsIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  statIconItem: {
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  statIconValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statIconLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '500',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },

  // ===== CTA section =====
  ctaSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  startWalkBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  startWalkEmoji: {
    fontSize: 22,
  },
  startWalkText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  watchImportBtn: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  watchImportText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // ===== Recent section =====
  recentSection: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  recentTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  activityIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  activityIcon: {
    fontSize: 20,
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
  activityMeta: {
    fontSize: 13,
    color: colors.textTertiary,
    fontWeight: '400',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  deleteBtnText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },

  // Empty
  noRecords: {
    paddingVertical: 48,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  noRecordsEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  noRecordsText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  noRecordsHint: {
    fontSize: 13,
    color: colors.textTertiary,
  },
});
