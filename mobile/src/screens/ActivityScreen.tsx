import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
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
    data: activities,
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

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}\uC2DC\uAC04 ${m}\uBD84` : `${m}\uBD84`;
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{'\uD65C\uB3D9'}</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>{'\uD83E\uDDB6'}</Text>
          <Text style={styles.emptyTitle}>
            {'\uB85C\uADF8\uC778\uD558\uACE0 \uAC77\uAE30 \uAE30\uB85D\uC744 \uC2DC\uC791\uD558\uC138\uC694'}
          </Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginBtnText}>{'\uB85C\uADF8\uC778'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{'\uD65C\uB3D9'}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }>
        {/* Stats Overview */}
        {statsLoading ? (
          <View style={styles.statsRow}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : stats ? (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {stats.total_distance_km.toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>{'km \uCD1D \uAC70\uB9AC'}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {stats.total_steps.toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>{'\uCD1D \uAC78\uC74C'}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {stats.total_calories.toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>{'kcal'}</Text>
            </View>
          </View>
        ) : null}

        {/* Today's Rings */}
        <View style={styles.ringsCard}>
          <Text style={styles.ringsTitle}>{'\uC624\uB298\uC758 \uAC77\uAE30'}</Text>
          <View style={styles.ringsRow}>
            <View style={styles.ring}>
              <View
                style={[styles.ringCircle, { borderColor: colors.primary }]}>
                <Text style={styles.ringValue}>
                  {stats?.weekly?.[stats.weekly.length - 1]?.total_steps || 0}
                </Text>
              </View>
              <Text style={styles.ringLabel}>{'\uAC78\uC74C'}</Text>
            </View>
            <View style={styles.ring}>
              <View
                style={[styles.ringCircle, { borderColor: colors.accent }]}>
                <Text style={styles.ringValue}>
                  {stats?.weekly?.[stats.weekly.length - 1]?.total_distance_km ||
                    '0'}
                </Text>
              </View>
              <Text style={styles.ringLabel}>{'km'}</Text>
            </View>
            <View style={styles.ring}>
              <View
                style={[styles.ringCircle, { borderColor: '#FF9800' }]}>
                <Text style={styles.ringValue}>
                  {stats?.weekly?.[stats.weekly.length - 1]?.total_calories || 0}
                </Text>
              </View>
              <Text style={styles.ringLabel}>{'kcal'}</Text>
            </View>
          </View>
        </View>

        {/* Start Walk Button */}
        <View style={styles.walkSection}>
          <TouchableOpacity
            style={styles.startWalkBtn}
            onPress={() => navigation.navigate('Walk')}>
            <Text style={styles.startWalkIcon}>{'\uD83E\uDDB6'}</Text>
            <Text style={styles.startWalkText}>{'\uAC77\uAE30 \uC2DC\uC791'}</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activities */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>{'\uCD5C\uADFC \uD65C\uB3D9'}</Text>
          {activitiesLoading ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginTop: 20 }}
            />
          ) : (
            activities?.results?.map((track) => (
              <View key={track.id} style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  <Text>{'\uD83D\uDEB6'}</Text>
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>{track.title}</Text>
                  <Text style={styles.activityMeta}>
                    {track.distance_km}km
                    {track.duration_minutes
                      ? ` \u00B7 ${formatDuration(track.duration_minutes)}`
                      : ''}
                  </Text>
                </View>
                <Text style={styles.activityDate}>
                  {new Date(track.created_at).toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
            ))
          )}
          {!activitiesLoading &&
            (!activities?.results || activities.results.length === 0) && (
              <Text style={styles.emptyText}>
                {'\uC544\uC9C1 \uD65C\uB3D9 \uAE30\uB85D\uC774 \uC5C6\uC5B4\uC694'}
              </Text>
            )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  loginBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  ringsCard: {
    marginHorizontal: 16,
    backgroundColor: colors.bgSecondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  ringsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  ringsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ring: {
    alignItems: 'center',
  },
  ringCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  ringValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  ringLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  walkSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  startWalkBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  startWalkIcon: {
    fontSize: 20,
  },
  startWalkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  recentSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
    marginLeft: 12,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  activityMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  activityDate: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 20,
  },
});
