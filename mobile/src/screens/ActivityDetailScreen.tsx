import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { ActivityTrack } from '../types';

function formatDuration(minutes: number | null) {
  if (!minutes) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}\uC2DC\uAC04 ${m}\uBD84` : `${m}\uBD84`;
}

export default function ActivityDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const activity: ActivityTrack = route.params?.activity;

  if (!activity) return null;

  const dateStr = activity.started_at
    ? new Date(activity.started_at).toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
      })
    : new Date(activity.created_at).toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
      });

  const timeStr = activity.started_at
    ? new Date(activity.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : '';

  const distance = activity.distance_km ? parseFloat(activity.distance_km) : 0;
  const steps = activity.total_steps || 0;
  const calories = activity.calories_burned || 0;
  const elevation = activity.elevation_gain_m || 0;
  const pace = activity.avg_pace_min_km ? parseFloat(activity.avg_pace_min_km) : 0;
  const duration = activity.duration_minutes || 0;

  const formatPace = (p: number) => {
    if (p <= 0 || p > 30) return "--'--\"";
    const min = Math.floor(p);
    const sec = Math.round((p - min) * 60);
    return `${min}'${sec.toString().padStart(2, '0')}"`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{'\uD65C\uB3D9 \uC0C1\uC138'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Title & Date */}
        <View style={styles.titleSection}>
          <Text style={styles.actTitle}>{activity.title || '\uAC78\uAE30 \uAE30\uB85D'}</Text>
          <Text style={styles.actDate}>{dateStr}</Text>
          {timeStr ? <Text style={styles.actTime}>{timeStr} {'\uC2DC\uC791'}</Text> : null}
        </View>

        {/* Big distance */}
        <View style={styles.bigStat}>
          <Text style={styles.bigStatValue}>{distance.toFixed(2)}</Text>
          <Text style={styles.bigStatUnit}>km</Text>
        </View>

        {/* Main stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>{'\u23F1'}</Text>
            <Text style={styles.statVal}>{formatDuration(duration)}</Text>
            <Text style={styles.statLabel}>{'\uC2DC\uAC04'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>{'\uD83D\uDC63'}</Text>
            <Text style={styles.statVal}>{steps.toLocaleString()}</Text>
            <Text style={styles.statLabel}>{'\uAC78\uC74C'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>{'\uD83D\uDD25'}</Text>
            <Text style={styles.statVal}>{calories}</Text>
            <Text style={styles.statLabel}>kcal</Text>
          </View>
        </View>

        {/* Secondary stats */}
        <View style={styles.secondaryGrid}>
          <View style={styles.secItem}>
            <Text style={styles.secLabel}>{'\uD3C9\uADE0 \uD398\uC774\uC2A4'}</Text>
            <Text style={styles.secVal}>{formatPace(pace)}</Text>
          </View>
          <View style={styles.secDivider} />
          <View style={styles.secItem}>
            <Text style={styles.secLabel}>{'\uACE0\uB3C4 \uC0C1\uC2B9'}</Text>
            <Text style={styles.secVal}>{elevation > 0 ? `+${Math.round(elevation)}m` : '-'}</Text>
          </View>
          <View style={styles.secDivider} />
          <View style={styles.secItem}>
            <Text style={styles.secLabel}>{'\uC18C\uC2A4'}</Text>
            <Text style={styles.secVal}>{activity.source === 'phone_gps' ? 'GPS' : activity.source}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.6)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  titleSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  actTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  actDate: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 2,
  },
  actTime: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
  },
  bigStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  bigStatValue: {
    fontSize: 56,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -2,
  },
  bigStatUnit: {
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
    marginLeft: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 8,
  },
  statVal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  secondaryGrid: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secItem: {
    flex: 1,
    alignItems: 'center',
  },
  secLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 4,
  },
  secVal: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  secDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
