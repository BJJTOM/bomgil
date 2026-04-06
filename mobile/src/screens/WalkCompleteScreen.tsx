import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ScrollView,
  Dimensions,
  Image,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { KmSplit } from '../utils/walkEngine';

const { width } = Dimensions.get('window');

// Format pace as min'sec"
function formatPace(pace: string | number): string {
  if (typeof pace === 'string') {
    if (pace.includes("'")) return pace; // already formatted
    const n = parseFloat(pace);
    if (isNaN(n) || n <= 0 || n > 30) return "--'--\"";
    const min = Math.floor(n);
    const sec = Math.round((n - min) * 60);
    return `${min}'${sec.toString().padStart(2, '0')}"`;
  }
  if (pace <= 0 || pace > 30) return "--'--\"";
  const min = Math.floor(pace);
  const sec = Math.round((pace - min) * 60);
  return `${min}'${sec.toString().padStart(2, '0')}"`;
}

export default function WalkCompleteScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const {
    distance = '0',
    duration = '0',
    steps = '0',
    calories = '0',
    pace = '--',
    elevationGain = '0',
    elevationLoss = '0',
    maxSpeed = '0',
    splits: splitsJson = '[]',
    taggedPhotos = [],
    spots = [],
    routeCoords = [],
    trackPoints = [],
    activityId = null,
  } = route.params || {};

  const totalSeconds =
    typeof duration === 'number' ? duration : parseInt(duration) || 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const timeStr =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const distNum =
    typeof distance === 'string' ? parseFloat(distance) : distance;
  const stepsNum = typeof steps === 'string' ? parseInt(steps) : steps;
  const caloriesNum =
    typeof calories === 'string' ? parseInt(calories) : calories;
  const eleGain =
    typeof elevationGain === 'string'
      ? parseInt(elevationGain)
      : elevationGain;
  const eleLoss =
    typeof elevationLoss === 'string'
      ? parseInt(elevationLoss)
      : elevationLoss;
  const maxSpeedNum =
    typeof maxSpeed === 'string' ? parseFloat(maxSpeed) : maxSpeed;

  let splits: KmSplit[] = [];
  try {
    splits = typeof splitsJson === 'string' ? JSON.parse(splitsJson) : splitsJson;
  } catch {
    splits = [];
  }

  // Date
  const dateStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Moru - ${distNum.toFixed(2)}km 완료!\n${distNum.toFixed(2)}km, ${stepsNum.toLocaleString()} 걸음, ${timeStr}`,
      });
    } catch {}
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header accent */}
        <Text style={styles.accentLabel}>WALK COMPLETED</Text>
        <Text style={styles.celebrationText}>오늘도 멋진 걸음!</Text>

        {/* Stat Card */}
        <View style={styles.statCard}>
          <Text style={styles.brandText}>MORU</Text>

          {/* Big distance */}
          <View style={styles.distanceRow}>
            <Text style={styles.distanceBig}>{distNum.toFixed(2)}</Text>
            <Text style={styles.distanceUnit}>km</Text>
          </View>

          {/* Primary stats grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Text style={styles.statCellValue}>{timeStr}</Text>
              <Text style={styles.statCellLabel}>시간</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={[styles.statCellValue, { color: colors.accent }]}>
                {typeof pace === 'string' && pace.includes("'") ? pace : formatPace(pace)}
              </Text>
              <Text style={styles.statCellLabel}>페이스</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statCellValue}>{caloriesNum}</Text>
              <Text style={styles.statCellLabel}>칼로리</Text>
            </View>
          </View>

          {/* Steps */}
          <View style={styles.stepsRow}>
            <Text style={styles.stepsValue}>{stepsNum.toLocaleString()}</Text>
            <Text style={styles.stepsLabel}> 걸음</Text>
          </View>

          {/* Date */}
          <Text style={styles.dateText}>{dateStr}</Text>

          {/* Footer branding */}
          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterText}>moruwalk.com</Text>
          </View>
        </View>

        {/* Splits Table */}
        {splits.length > 0 && (
          <View style={styles.splitsSection}>
            <Text style={styles.splitsTitle}>구간 기록</Text>
            {splits.map((split: KmSplit, index: number) => (
              <View
                key={split.km}
                style={[
                  styles.splitRow,
                  index < splits.length - 1 && styles.splitRowBorder,
                ]}>
                <Text style={styles.splitKm}>{split.km} km</Text>
                <Text style={styles.splitPace}>{formatPace(split.pace)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Tagged Photos */}
        {taggedPhotos.length > 0 && (
          <View style={styles.photosSection}>
            <Text style={styles.photosSectionTitle}>
              사진 ({taggedPhotos.length})
            </Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={taggedPhotos}
              keyExtractor={(_: any, i: number) => String(i)}
              contentContainerStyle={styles.photosList}
              renderItem={({ item }: { item: any }) => (
                <View style={styles.photoCard}>
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                </View>
              )}
            />
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            activeOpacity={0.85}>
            <Text style={styles.shareBtnText}>공유하기</Text>
          </TouchableOpacity>

          <View style={styles.secondaryRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('ActivityDetail', {
                activity: {
                  id: activityId,
                  title: `${new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 도보`,
                  distance_km: distance,
                  duration_minutes: Math.round(totalSeconds / 60),
                  total_steps: parseInt(steps) || 0,
                  calories_burned: parseInt(calories) || 0,
                  elevation_gain_m: parseFloat(elevationGain) || 0,
                  source: 'phone_gps',
                  started_at: new Date(Date.now() - totalSeconds * 1000).toISOString(),
                  created_at: new Date().toISOString(),
                  track_points: trackPoints,
                },
                taggedPhotos,
                spots,
                fromWalkComplete: true,
              })}
              activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>활동 상세</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.popToTop()}
              activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>홈으로</Text>
            </TouchableOpacity>
          </View>
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
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 48,
  },

  // Header
  accentLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 3,
    marginTop: 48,
    marginBottom: 8,
  },
  celebrationText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 32,
  },

  // Stat Card
  statCard: {
    width: width - 48,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  brandText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary, opacity: 0.5,
    letterSpacing: 3,
    marginBottom: 8,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 24,
  },
  distanceBig: {
    fontSize: 56,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -2,
  },
  distanceUnit: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.textTertiary,
    marginLeft: 4,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statCellValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  statCellLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#F2F4F6',
  },

  // Steps
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  stepsValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stepsLabel: {
    fontSize: 13,
    color: colors.textTertiary,
  },

  // Date
  dateText: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 8,
    marginBottom: 20,
  },

  // Card footer
  cardFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEEFF1',
    paddingTop: 12,
    alignItems: 'center',
  },
  cardFooterText: {
    fontSize: 11,
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },

  // Splits
  splitsSection: {
    width: width - 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  splitsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  splitRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F4F6',
  },
  splitKm: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  splitPace: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
  },

  // Photos
  photosSection: {
    width: width - 48,
    marginBottom: 24,
  },
  photosSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  photosList: {
    gap: 10,
  },
  photoCard: {
    width: 140,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },

  // Actions
  actionsSection: {
    width: width - 48,
    gap: 12,
    paddingBottom: 20,
  },
  shareBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: '#F2F4F6',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
});
