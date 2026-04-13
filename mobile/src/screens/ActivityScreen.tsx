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

  const [activityPage, setActivityPage] = useState(1);
  const [pausedWalk, setPausedWalk] = useState<any>(null);

  // Check for paused walk
  React.useEffect(() => {
    AsyncStorage.getItem('walk_paused').then((val) => {
      if (val) {
        try {
          const data = JSON.parse(val);
          // Check expiration (48 hours)
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

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: bg }]}>
        <View style={styles.headerSimple}>
          <Text style={[styles.headerTitle, { color: textColor }]}>{t.activity.title}</Text>
        </View>
        <View style={styles.loginPrompt}>
          <Text style={styles.loginPromptIcon}>{'\uD83E\uDDB6'}</Text>
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

        {/* ===== STATS CARD ===== */}
        <FadeInView delay={50}>
          <View style={[styles.statsCard, { backgroundColor: cardBg }]}>
            <View style={styles.statsMainRow}>
              <View style={styles.statMainItem}>
                <Text style={[styles.statMainValue, { color: textColor }]}>{todayStats.distance.toFixed(1)}</Text>
                <Text style={[styles.statMainUnit, { color: textTertColor }]}>km</Text>
              </View>
              <View style={[styles.statDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
              <View style={styles.statSubItem}>
                <Feather name="trending-up" size={14} color="#60A5FA" />
                <Text style={[styles.statSubValue, { color: textColor }]}>{todayStats.steps.toLocaleString()}</Text>
                <Text style={[styles.statSubLabel, { color: textTertColor }]}>{t.walk.steps}</Text>
              </View>
              <View style={[styles.statDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
              <View style={styles.statSubItem}>
                <Feather name="zap" size={14} color="#F59E0B" />
                <Text style={[styles.statSubValue, { color: textColor }]}>{todayStats.calories}</Text>
                <Text style={[styles.statSubLabel, { color: textTertColor }]}>kcal</Text>
              </View>
            </View>
          </View>
        </FadeInView>


        {/* ===== PAUSED WALK RESUME ===== */}
        {pausedWalk && (
          <FadeInView delay={100}>
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

        {/* ===== CTA ===== */}
        <FadeInView delay={150}>
          <TouchableOpacity
            style={styles.startWalkBtnLarge}
            onPress={() => navigation.navigate('Walk')}
            activeOpacity={0.85}>
            <View style={styles.startWalkIconCircle}>
              <Feather name="play" size={24} color="#fff" />
            </View>
            <Text style={styles.startWalkTextLarge}>{t.activity.startWalk}</Text>
          </TouchableOpacity>
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
          <FadeInView delay={250}>
            <View style={styles.recentHeader}>
              <Text style={[styles.recentTitle, { color: textColor }]}>{t.activity.recentTitle} <Text style={{ color: textTertColor, fontSize: 14, fontWeight: '500' }}>{activities.length}</Text></Text>
            </View>
          </FadeInView>

          {paginatedActivities.length === 0 ? (
            <FadeInView delay={300}>
              <View style={[styles.noRecords, { backgroundColor: cardBg }]}>
                <Text style={styles.noRecordsEmoji}>{'\uD83D\uDEB6'}</Text>
                <Text style={styles.noRecordsText}>
                  {t.activity.noActivities}
                </Text>
                <Text style={styles.noRecordsHint}>
                  {t.activity.startWalk}
                </Text>
              </View>
            </FadeInView>
          ) : (
            paginatedActivities.map((activity, index) => {
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
                ? `${(parseFloat(String(activity.distance_km || '0')) || 0).toFixed(1)}km`
                : '';
              const durationStr = formatDuration(activity.duration_minutes);
              const iconColor = sourceInfo?.color || '#9CA3AF';

              return (
                <FadeInView key={activity.id} delay={300 + index * 50}>
                  <TouchableOpacity
                    style={[styles.activityCard, { backgroundColor: cardBg }]}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('ActivityDetail', {
                      // Strip heavy fields before navigation — ActivityDetail
                      // re-fetches the full record itself. Avoids Android's
                      // Intent bundle size limit (TransactionTooLargeException).
                      activity: {
                        ...activity,
                        track_points: undefined,
                        route_coords: undefined,
                      },
                    })}
                    onLongPress={() => handleDelete(activity)}>
                    <View style={[styles.activityIconWrap, { backgroundColor: iconColor + '18' }]}>
                      <Feather name="map-pin" size={18} color={iconColor} />
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
                      <Feather name="x" size={14} color={colors.textTertiary} />
                    </TouchableOpacity>
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

  // ===== Stats card =====
  statsCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  statsMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statMainItem: {
    flex: 1.2,
    alignItems: 'center',
  },
  statMainValue: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  statMainUnit: {
    fontSize: 13,
    color: colors.textTertiary,
    fontWeight: '500',
    marginTop: -2,
  },
  statSubItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statSubValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statSubLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },

  // ===== CTA =====
  startWalkBtnLarge: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  startWalkIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startWalkTextLarge: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
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

  resumeWalkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
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
