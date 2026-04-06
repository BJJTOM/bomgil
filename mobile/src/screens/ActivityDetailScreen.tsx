import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { ActivityTrack } from '../types';
import SafeMapView from '../components/SafeMapView';

const { width: SW } = Dimensions.get('window');

function formatDuration(minutes: number | null) {
  if (!minutes) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

export default function ActivityDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const activity: ActivityTrack = route.params?.activity;
  const taggedPhotos: any[] = route.params?.taggedPhotos || [];

  if (!activity) return null;

  // Extract track points for map
  const trackPoints = activity.track_points || [];
  const pathCoords: [number, number][] = trackPoints.map((p: any) => [p.lng, p.lat]);
  const hasPath = pathCoords.length >= 2;
  const firstPoint = trackPoints[0];
  const lastPoint = trackPoints[trackPoints.length - 1];

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
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{'활동 상세'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Title & Date */}
        <View style={styles.titleSection}>
          <Text style={styles.actTitle}>{activity.title || '걸기 기록'}</Text>
          <Text style={styles.actDate}>{dateStr}</Text>
          {timeStr ? <Text style={styles.actTime}>{timeStr} {'시작'}</Text> : null}
        </View>

        {/* Big distance */}
        <View style={styles.bigStat}>
          <Text style={styles.bigStatValue}>{distance.toFixed(2)}</Text>
          <Text style={styles.bigStatUnit}>km</Text>
        </View>

        {/* Main stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>{'⏱'}</Text>
            <Text style={styles.statVal}>{formatDuration(duration)}</Text>
            <Text style={styles.statLabel}>{'시간'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>{'\uD83D\uDC63'}</Text>
            <Text style={styles.statVal}>{steps.toLocaleString()}</Text>
            <Text style={styles.statLabel}>{'걸음'}</Text>
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
            <Text style={styles.secLabel}>{'평균 페이스'}</Text>
            <Text style={styles.secVal}>{formatPace(pace)}</Text>
          </View>
          <View style={styles.secDivider} />
          <View style={styles.secItem}>
            <Text style={styles.secLabel}>{'고도 상승'}</Text>
            <Text style={styles.secVal}>{elevation > 0 ? `+${Math.round(elevation)}m` : '-'}</Text>
          </View>
          <View style={styles.secDivider} />
          <View style={styles.secItem}>
            <Text style={styles.secLabel}>{'소스'}</Text>
            <Text style={styles.secVal}>{activity.source === 'phone_gps' ? 'GPS' : activity.source}</Text>
          </View>
        </View>

        {/* Route map */}
        {hasPath && (
          <View style={styles.mapSection}>
            <Text style={styles.mapSectionTitle}>경로</Text>
            <SafeMapView
              lat={firstPoint?.lat || 37.5665}
              lng={firstPoint?.lng || 126.978}
              endLat={lastPoint?.lat}
              endLng={lastPoint?.lng}
              pathCoordinates={pathCoords}
              height={200}
            />
          </View>
        )}

        {/* Tagged photos */}
        {taggedPhotos.length > 0 && (
          <View style={styles.photosSection}>
            <Text style={styles.mapSectionTitle}>사진 ({taggedPhotos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {taggedPhotos.map((photo: any, idx: number) => (
                <Image
                  key={idx}
                  source={{ uri: photo.uri }}
                  style={styles.photoThumb}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
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
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 18,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  titleSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  actTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  actDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  actTime: {
    fontSize: 13,
    color: colors.textTertiary,
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
    color: colors.textPrimary,
    letterSpacing: -2,
  },
  bigStatUnit: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.textTertiary,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 8,
  },
  statVal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  secondaryGrid: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  secItem: {
    flex: 1,
    alignItems: 'center',
  },
  secLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    marginBottom: 4,
  },
  secVal: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  secDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#F2F4F6',
  },
  mapSection: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  mapSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  photosSection: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  photoThumb: {
    width: SW * 0.4,
    height: SW * 0.4,
    borderRadius: 12,
    marginRight: 10,
  },
});
