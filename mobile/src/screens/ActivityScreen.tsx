import React, { useCallback, useMemo, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import api from '../api/client';
import { useT } from '../i18n';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';
import { navParamCache } from '../utils/navParamCache';
import { useThemeStore } from '../stores/theme';
import { FadeInView } from '../components/FadeInView';
import { ActivityStats, ActivityTrack, PaginatedResponse } from '../types';

// ─── Progress Ring Constants ───
const PROGRESS_RING_SIZE = 120;
const PROGRESS_RING_STROKE_WIDTH = 10;

// ─── Animation Delay Constants (ms) ───
const FADE_DELAY_WEEKLY_CARD = 50;
const FADE_DELAY_QUICK_STATS = 100;
const FADE_DELAY_PAUSED_WALK = 150;
const FADE_DELAY_WATCH_IMPORT = 175;
const FADE_DELAY_RECENT_HEADER = 200;
const FADE_DELAY_EMPTY_STATE = 250;
const FADE_DELAY_ACTIVITY_BASE = 250;
const FADE_DELAY_ACTIVITY_INCREMENT = 40;

const SOURCE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  manual_gpx: { label: 'GPX', icon: 'file', color: '#6B7280' },
  apple_watch: { label: 'Apple Watch', icon: 'watch', color: '#34D399' },
  garmin: { label: 'Garmin', icon: 'watch', color: '#60A5FA' },
  samsung_health: { label: 'Samsung Health', icon: 'smartphone', color: '#818CF8' },
  google_fit: { label: 'Google Fit', icon: 'smartphone', color: '#34D399' },
  cashwalk: { label: 'Cashwalk', icon: 'navigation', color: '#FBBF24' },
  phone_gps: { label: 'GPS', icon: 'map-pin', color: '#F87171' },
  strava: { label: 'Strava', icon: 'activity', color: '#FB923C' },
};

/* ─── Pure-View progress ring ─── */
function ProgressRing({
  size,
  strokeWidth,
  progress,
  trackColor,
  fillColor,
  children,
}: {
  size: number;
  strokeWidth: number;
  progress: number; // 0..1
  trackColor: string;
  fillColor: string;
  children?: React.ReactNode;
}) {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const radius = size / 2;
  const innerSize = size - strokeWidth * 2;

  // We build the ring from two half-circle clips that rotate to reveal
  // the fill colour arc. This avoids needing react-native-svg.
  const renderHalf = (isRight: boolean) => {
    // Each half covers 0-180 degrees of the ring.
    // For progress 0..0.5  -> only the right half rotates (0..180 deg).
    // For progress 0.5..1  -> right half is fully shown (180 deg),
    //                         left half rotates (0..180 deg).
    let rotation = 0;
    let visible = true;

    if (isRight) {
      if (clampedProgress <= 0) {
        visible = false;
      } else if (clampedProgress <= 0.5) {
        rotation = clampedProgress * 360; // 0..180
      } else {
        rotation = 180;
      }
    } else {
      if (clampedProgress <= 0.5) {
        visible = false;
      } else {
        rotation = (clampedProgress - 0.5) * 360; // 0..180
      }
    }

    if (!visible) return null;

    return (
      <View
        style={{
          position: 'absolute',
          width: radius,
          height: size,
          overflow: 'hidden',
          left: isRight ? radius : 0,
        }}>
        <View
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth: strokeWidth,
            borderColor: fillColor,
            position: 'absolute',
            left: isRight ? -radius : 0,
            transform: [{ rotate: `${isRight ? rotation - 180 : rotation}deg` }],
          }}
        />
      </View>
    );
  };

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Track (background ring) */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: strokeWidth,
          borderColor: trackColor,
          position: 'absolute',
        }}
      />
      {/* Fill arcs */}
      {renderHalf(true)}
      {renderHalf(false)}
      {/* Inner content */}
      <View
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {children}
      </View>
    </View>
  );
}

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const { isDark } = useThemeStore();
  const t = useT();

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour <= 11) return t.activity.greetingMorning;
    if (hour >= 12 && hour <= 17) return t.activity.greetingAfternoon;
    if (hour >= 18 && hour <= 23) return t.activity.greetingEvening;
    return t.activity.greetingNight;
  };

  const bg = isDark ? '#0a0a0a' : '#F8F9FB';
  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : colors.textPrimary;
  const textSecColor = isDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary;
  const textTertColor = isDark ? 'rgba(255,255,255,0.4)' : colors.textTertiary;
  const dividerColor = isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB';

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['activity-stats'],
    queryFn: async () => {
      const { data } = await api.get('/activities/my_stats/', { timeout: 10000 });
      return data as ActivityStats;
    },
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 30000,
    placeholderData: (prev: ActivityStats | undefined) => prev,
  });

  const {
    data: activitiesData,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const { data } = await api.get('/activities/', { params: { page_size: 30 }, timeout: 10000 });
      return data as PaginatedResponse<ActivityTrack>;
    },
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 30000,
    placeholderData: (prev: PaginatedResponse<ActivityTrack> | undefined) => prev,
  });

  const activities = activitiesData?.results || [];

  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchStats();
    }, [refetch, refetchStats]),
  );

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const now = new Date();
  const todayDateStr = now.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const greeting = useMemo(() => getGreeting(), []);

  // Weekly goal data from stats API
  const weeklyGoalKm = stats?.weekly_goal_km ?? 20;
  const weeklyDistanceKm = stats?.weekly_distance_km ?? 0;
  const weeklyProgressPct = stats?.weekly_progress_pct
    ? stats.weekly_progress_pct / 100
    : Math.min(weeklyDistanceKm / weeklyGoalKm, 1);
  const currentStreak = stats?.current_streak ?? 0;
  const longestStreak = stats?.longest_streak ?? 0;
  const totalDistanceKm = stats?.total_distance_km ?? 0;
  const totalWalks = stats?.track_count ?? 0;

  const [activityPage, setActivityPage] = useState(1);
  const [pausedWalk, setPausedWalk] = useState<any>(null);

  // Check for paused walk
  React.useEffect(() => {
    AsyncStorage.getItem('walk_paused').then((val) => {
      if (val) {
        try {
          const data = JSON.parse(val);
          if (new Date(data.expiresAt) > new Date()) {
            setPausedWalk(data);
          } else {
            AsyncStorage.removeItem('walk_paused');
          }
        } catch { AsyncStorage.removeItem('walk_paused'); }
      }
    }).catch(() => {});
  }, []);

  const PAGE_SIZE = 10;
  const paginatedActivities = activities.slice(0, activityPage * PAGE_SIZE);
  const hasMoreActivities = activities.length > activityPage * PAGE_SIZE;

  const handleDelete = (activity: ActivityTrack) => {
    Alert.alert(
      t.activity.deleteTitle,
      t.activity.deleteConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/activities/${activity.id}/`);
              queryClient.invalidateQueries({ queryKey: ['activities'] });
              queryClient.invalidateQueries({ queryKey: ['activity-stats'] });
              Alert.alert(t.common.success, t.activity.deleteSuccess);
            } catch (err: any) {
              const msg = err?.response?.data?.detail || err?.response?.status || t.activity.deleteFailed;
              Alert.alert(t.common.error, String(msg));
            }
          },
        },
      ],
    );
  };

  // Determine progress ring color — green gradient based on progress
  // >= 90% uses a warm amber to signal "almost there!"
  const ringFillColor = weeklyProgressPct >= 1
    ? '#22C55E'
    : weeklyProgressPct >= 0.9
      ? '#F59E0B'
      : weeklyProgressPct >= 0.5
        ? '#4ADE80'
        : colors.primary;

  const ringTrackColor = isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB';

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: bg }]}>
        <View style={styles.headerSimple}>
          <Text style={[styles.headerTitle, { color: textColor }]}>{t.activity.title}</Text>
        </View>
        <View style={styles.loginPrompt}>
          <Feather name="activity" size={48} color={textTertColor} />
          <Text style={[styles.loginPromptTitle, { color: textSecColor }]}>
            {t.activity.loginPrompt}
          </Text>
          <TouchableOpacity
            style={styles.loginPromptBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}>
            <Text style={styles.loginPromptBtnText}>{t.activity.login}</Text>
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

        {/* ===== WEEKLY SUMMARY CARD ===== */}
        <FadeInView delay={FADE_DELAY_WEEKLY_CARD}>
          <View style={[styles.weeklyCard, { backgroundColor: cardBg }]}>
            <View style={styles.weeklyRow}>
              <ProgressRing
                size={PROGRESS_RING_SIZE}
                strokeWidth={PROGRESS_RING_STROKE_WIDTH}
                progress={weeklyProgressPct}
                trackColor={ringTrackColor}
                fillColor={ringFillColor}>
                <Text style={[styles.ringPercent, { color: textColor }]}>
                  {Math.round(weeklyProgressPct * 100)}%
                </Text>
                <Text style={[styles.ringLabel, { color: textTertColor }]}>
                  {weeklyProgressPct >= 1 ? 'DONE' : ''}
                </Text>
              </ProgressRing>

              <View style={styles.weeklyInfo}>
                <Text style={[styles.weeklyDistLabel, { color: textTertColor }]}>
                  {'이번 주'}
                </Text>
                <Text style={[styles.weeklyDistValue, { color: textColor }]}>
                  {weeklyDistanceKm.toFixed(1)}
                  <Text style={[styles.weeklyDistUnit, { color: textTertColor }]}> / {weeklyGoalKm}km</Text>
                </Text>

                {currentStreak > 0 && (
                  <View style={styles.streakRow}>
                    <Feather name="zap" size={14} color="#F59E0B" />
                    <Text style={[styles.streakText, { color: textColor }]}>
                      {currentStreak}{'일 연속'}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.startWalkBtnSmall}
                  onPress={() => navigation.navigate('Walk')}
                  activeOpacity={0.85}>
                  <Feather name="play" size={14} color="#fff" />
                  <Text style={styles.startWalkBtnSmallText}>{t.activity.startWalk}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </FadeInView>

        {/* ===== QUICK STATS ROW ===== */}
        <FadeInView delay={FADE_DELAY_QUICK_STATS}>
          <View style={styles.quickStatsRow}>
            <View style={[styles.quickStatCard, { backgroundColor: cardBg }]}>
              <Feather name="map" size={16} color="#60A5FA" />
              <Text style={[styles.quickStatValue, { color: textColor }]}>
                {totalDistanceKm.toFixed(1)}
                <Text style={[styles.quickStatUnit, { color: textTertColor }]}> km</Text>
              </Text>
              <Text style={[styles.quickStatLabel, { color: textTertColor }]}>{'총 거리'}</Text>
            </View>
            <View style={[styles.quickStatCard, { backgroundColor: cardBg }]}>
              <Feather name="navigation" size={16} color="#4ADE80" />
              <Text style={[styles.quickStatValue, { color: textColor }]}>
                {totalWalks}
              </Text>
              <Text style={[styles.quickStatLabel, { color: textTertColor }]}>{'총 걸음기록'}</Text>
            </View>
            <View style={[styles.quickStatCard, { backgroundColor: cardBg }]}>
              <Feather name="award" size={16} color="#F59E0B" />
              <Text style={[styles.quickStatValue, { color: textColor }]}>
                {longestStreak}
                <Text style={[styles.quickStatUnit, { color: textTertColor }]}> {'일'}</Text>
              </Text>
              <Text style={[styles.quickStatLabel, { color: textTertColor }]}>{'최장 연속'}</Text>
            </View>
          </View>
        </FadeInView>

        {/* ===== PAUSED WALK RESUME ===== */}
        {pausedWalk && (
          <FadeInView delay={FADE_DELAY_PAUSED_WALK}>
            <TouchableOpacity
              style={[styles.resumeWalkCard, { backgroundColor: cardBg }]}
              onPress={() => {
                const cacheKey = navParamCache.put({ resumeData: pausedWalk });
                navigation.navigate('Walk', { _resumeCacheKey: cacheKey });
              }}
              activeOpacity={0.8}>
              <View style={styles.resumeIconCircle}>
                <Feather name="play" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.resumeTitle, { color: textColor }]}>{t.activity.resumeWalk}</Text>
                <Text style={[styles.resumeMeta, { color: textTertColor }]}>
                  {pausedWalk.segments?.reduce((s: number, seg: any) => s + (seg.distance || 0), 0).toFixed(1)}km · {(() => { const mins = Math.round(pausedWalk.segments?.reduce((s: number, seg: any) => s + (seg.duration || 0), 0) / 60); const h = Math.floor(mins / 60); return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`; })()} · {pausedWalk.spots?.length || 0} spots
                </Text>
                <Text style={[styles.resumeExpiry, { color: textTertColor }]}>
                  {new Date(pausedWalk.savedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} {t.activity.resumeExpiry}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(t.activity.deleteSavedWalk, t.activity.deleteSavedWalkConfirm, [
                    { text: t.common.cancel, style: 'cancel' },
                    { text: t.common.delete, style: 'destructive', onPress: () => { AsyncStorage.removeItem('walk_paused'); setPausedWalk(null); } },
                  ]);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={16} color={textTertColor} />
              </TouchableOpacity>
            </TouchableOpacity>
          </FadeInView>
        )}

        {/* ===== IMPORT WATCH LINK ===== */}
        <FadeInView delay={FADE_DELAY_WATCH_IMPORT}>
          <TouchableOpacity
            style={[styles.watchImportLink, isDark && { borderColor: 'rgba(255,255,255,0.1)' }]}
            onPress={() => navigation.navigate('HealthImport')}
            activeOpacity={0.7}>
            <Feather name="watch" size={14} color={isDark ? 'rgba(255,255,255,0.5)' : colors.textTertiary} />
            <Text style={[styles.watchImportLinkText, isDark && { color: 'rgba(255,255,255,0.5)' }]}>{t.activity.importWatch}</Text>
            <Feather name="chevron-right" size={14} color={isDark ? 'rgba(255,255,255,0.3)' : colors.textTertiary} />
          </TouchableOpacity>
        </FadeInView>

        {/* ===== RECENT ACTIVITIES ===== */}
        <View style={styles.recentSection}>
          <FadeInView delay={FADE_DELAY_RECENT_HEADER}>
            <View style={styles.recentHeader}>
              <Text style={[styles.recentTitle, { color: textColor }]}>
                {t.activity.recentTitle}{' '}
                <Text style={{ color: textTertColor, fontSize: 14, fontWeight: '500' }}>
                  {activities.length}
                </Text>
              </Text>
            </View>
          </FadeInView>

          {paginatedActivities.length === 0 ? (
            <FadeInView delay={FADE_DELAY_EMPTY_STATE}>
              <View style={[styles.emptyState, { backgroundColor: cardBg }]}>
                <View style={[styles.emptyIconCircle, isDark && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                  <Feather name="sunrise" size={32} color={textTertColor} />
                </View>
                <Text style={[styles.emptyTitle, { color: textSecColor }]}>
                  {'아직 걸은 기록이 없어요'}
                </Text>
                <Text style={[styles.emptyHint, { color: textTertColor }]}>
                  {'첫 걸음을 기록해보세요'}
                </Text>
                <TouchableOpacity
                  style={styles.emptyCTA}
                  onPress={() => navigation.navigate('Walk')}
                  activeOpacity={0.85}>
                  <Feather name="play" size={14} color="#fff" />
                  <Text style={styles.emptyCTAText}>{'걷기 시작하기'}</Text>
                </TouchableOpacity>
              </View>
            </FadeInView>
          ) : (
            paginatedActivities.map((activity, index) => {
              const dateObj = activity.started_at
                ? new Date(activity.started_at)
                : new Date(activity.created_at);
              const dateStr = dateObj.toLocaleDateString('ko-KR', {
                month: 'long',
                day: 'numeric',
              });
              const timeStr = dateObj.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              });
              const sourceInfo = SOURCE_LABELS[activity.source];
              const distanceVal = parseFloat(String(activity.distance_km || '0')) || 0;
              const distanceStr = distanceVal > 0 ? `${distanceVal.toFixed(1)}km` : '';
              const durationStr = formatDuration(activity.duration_minutes);
              const iconColor = sourceInfo?.color || '#9CA3AF';
              const featherIcon = sourceInfo?.icon || 'map-pin';

              return (
                <FadeInView key={activity.id} delay={FADE_DELAY_ACTIVITY_BASE + index * FADE_DELAY_ACTIVITY_INCREMENT}>
                  <TouchableOpacity
                    style={[styles.activityCard, { backgroundColor: cardBg }]}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('ActivityDetail', {
                      activity: {
                        ...activity,
                        track_points: undefined,
                        route_coords: undefined,
                      },
                    })}
                    onLongPress={() => handleDelete(activity)}>
                    <View style={[styles.activityIconWrap, { backgroundColor: iconColor + '18' }]}>
                      <Feather name={featherIcon} size={18} color={iconColor} />
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={[styles.activityTitleMain, { color: textColor }]} numberOfLines={1}>
                        {activity.title || `${sourceInfo?.label || ''} 기록`}
                      </Text>
                      <Text style={[styles.activityMeta, { color: textTertColor }]}>
                        {dateStr} {timeStr}
                        {distanceStr || durationStr ? '  ·  ' : ''}
                        {[distanceStr, durationStr].filter(Boolean).join(' · ')}
                      </Text>
                      {activity.trail && (
                        <View style={styles.trailTag}>
                          <Feather name="map" size={10} color={colors.primary} />
                          <Text style={[styles.trailTagText, { color: colors.primary }]}>{'코스 연결됨'}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.activityRight}>
                      {distanceVal > 0 && (
                        <Text style={[styles.activityDistBig, { color: textColor }]}>
                          {distanceVal.toFixed(1)}
                          <Text style={{ fontSize: 11, fontWeight: '500', color: textTertColor }}> km</Text>
                        </Text>
                      )}
                      <TouchableOpacity
                        style={[styles.deleteBtn, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={() => handleDelete(activity)}>
                        <Feather name="trash-2" size={12} color={isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF'} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </FadeInView>
              );
            })
          )}
          {hasMoreActivities && (
            <TouchableOpacity
              style={[styles.loadMoreBtn, { backgroundColor: cardBg }]}
              onPress={() => setActivityPage(p => p + 1)}
              activeOpacity={0.7}>
              <Text style={styles.loadMoreText}>{t.home.viewAll}</Text>
              <Feather name="chevron-down" size={16} color={colors.primary} />
            </TouchableOpacity>
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
    gap: 16,
  },
  loginPromptTitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
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

  // ===== Weekly summary card =====
  weeklyCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  weeklyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  ringPercent: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  ringLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: -2,
  },
  weeklyInfo: {
    flex: 1,
    gap: 6,
  },
  weeklyDistLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  weeklyDistValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  weeklyDistUnit: {
    fontSize: 14,
    fontWeight: '500',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '600',
  },
  startWalkBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  startWalkBtnSmallText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // ===== Quick stats =====
  quickStatsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    gap: 8,
  },
  quickStatCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  quickStatUnit: {
    fontSize: 12,
    fontWeight: '500',
  },
  quickStatLabel: {
    fontSize: 11,
    fontWeight: '500',
  },

  // ===== Watch import =====
  watchImportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginHorizontal: 20,
  },
  watchImportLinkText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textTertiary,
  },

  // ===== Recent section =====
  recentSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  recentTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // ===== Activity card =====
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
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
    marginRight: 12,
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
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '400',
  },
  trailTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  trailTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  activityRight: {
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 8,
  },
  activityDistBig: {
    fontSize: 16,
    fontWeight: '700',
  },
  deleteBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ===== Resume walk =====
  resumeWalkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.primary + '40',
    gap: 12,
  },
  resumeIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  resumeMeta: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  resumeExpiry: {
    fontSize: 11,
    marginTop: 3,
  },

  // ===== Load more =====
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  // ===== Empty state =====
  emptyState: {
    paddingVertical: 48,
    paddingHorizontal: 24,
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
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyHint: {
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 20,
  },
  emptyCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  emptyCTAText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
