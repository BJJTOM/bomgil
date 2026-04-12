import React, { useEffect, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';
import { useT } from '../i18n';
import { useThemeStore } from '../stores/theme';
import { KmSplit } from '../utils/walkEngine';
import SplitChart from '../components/SplitChart';
import ElevationChart from '../components/ElevationChart';
import { shareGpxFile } from '../utils/gpxExporter';
import { weatherEmoji } from '../utils/weather';

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

interface StatCardProps {
  icon: string;
  value: string;
  label: string;
  accent?: boolean;
  isDark: boolean;
}

function StatCard({ icon, value, label, accent, isDark }: StatCardProps) {
  const cardBg = isDark ? '#1a1a1a' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : colors.textPrimary;
  const labelColor = isDark ? 'rgba(255,255,255,0.5)' : colors.textTertiary;

  return (
    <View style={[styles.miniStatCard, { backgroundColor: cardBg }]}>
      <View style={[styles.miniStatIconWrap, accent && { backgroundColor: isDark ? 'rgba(45,74,46,0.3)' : 'rgba(45,74,46,0.08)' }]}>
        <Feather name={icon} size={18} color={accent ? colors.primary : (isDark ? 'rgba(255,255,255,0.6)' : colors.textSecondary)} />
      </View>
      <Text style={[styles.miniStatValue, { color: accent ? colors.primary : textColor }]}>{value}</Text>
      <Text style={[styles.miniStatLabel, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

function WalkCompleteInner() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDark } = useThemeStore();
  const t = useT();

  const bg = isDark ? '#0a0a0a' : '#FAFAFA';
  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : colors.textPrimary;
  const textSecColor = isDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary;
  const textTertColor = isDark ? 'rgba(255,255,255,0.4)' : colors.textTertiary;
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F6';

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
    activityId = null,
  } = route.params || {};

  // Large payloads (trackPoints, routeCoords, photos, spots) are loaded from
  // AsyncStorage rather than navigation params to avoid Android's
  // TransactionTooLargeException on long walks.
  const [taggedPhotos, setTaggedPhotos] = useState<any[]>([]);
  const [spots, setSpots] = useState<any[]>([]);
  const [routeCoords, setRouteCoords] = useState<any[]>([]);
  const [trackPoints, setTrackPoints] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('activity_latest_extra');
        if (raw) {
          const extra = JSON.parse(raw);
          if (Array.isArray(extra?.taggedPhotos)) setTaggedPhotos(extra.taggedPhotos);
          if (Array.isArray(extra?.spots)) setSpots(extra.spots);
          if (Array.isArray(extra?.routeCoords)) setRouteCoords(extra.routeCoords);
          if (Array.isArray(extra?.trackPoints)) setTrackPoints(extra.trackPoints);
        }
      } catch {}
    })();
  }, []);

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

  const totalMinutes = Math.round(totalSeconds / 60);
  const statTimeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

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
      const shareText = `\uC624\uB298 \uBAA8\uB8E8\uC5D0\uC11C ${distNum.toFixed(2)}km\uB97C \uAC78\uC5C8\uC5B4\uC694! \uD83D\uDEB6 ${totalMinutes}\uBD84 | ${stepsNum.toLocaleString()}\uAC78\uC74C | ${caloriesNum}kcal #\uBAA8\uB8E8 #\uAC77\uAE30`;
      await Share.share({
        message: shareText,
      });
    } catch {}
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header accent */}
        <View style={styles.completeBadge}>
          <Feather name="check-circle" size={16} color={colors.primary} />
          <Text style={[styles.accentLabel, { color: colors.primary }]}>WALK COMPLETED</Text>
        </View>
        <Text style={[styles.celebrationText, { color: textColor }]}>{t.walkComplete.greatWalk}</Text>

        {/* Main Stat Card */}
        <View style={[styles.statCard, { backgroundColor: cardBg }]}>
          <Text style={[styles.brandText, { color: colors.primary }]}>MORU</Text>

          {/* Big distance */}
          <View style={styles.distanceRow}>
            <Text style={[styles.distanceBig, { color: textColor }]}>{distNum.toFixed(2)}</Text>
            <Text style={[styles.distanceUnit, { color: textTertColor }]}>km</Text>
          </View>

          {/* Primary stats grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Feather name="clock" size={14} color={textTertColor} style={{ marginBottom: 6 }} />
              <Text style={[styles.statCellValue, { color: textColor }]}>{timeStr}</Text>
              <Text style={[styles.statCellLabel, { color: textTertColor }]}>{t.walk.time}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
            <View style={styles.statCell}>
              <Feather name="trending-up" size={14} color={colors.accent} style={{ marginBottom: 6 }} />
              <Text style={[styles.statCellValue, { color: colors.accent }]}>
                {typeof pace === 'string' && pace.includes("'") ? pace : formatPace(pace)}
              </Text>
              <Text style={[styles.statCellLabel, { color: textTertColor }]}>{t.walk.pace}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
            <View style={styles.statCell}>
              <Feather name="zap" size={14} color={textTertColor} style={{ marginBottom: 6 }} />
              <Text style={[styles.statCellValue, { color: textColor }]}>{caloriesNum}</Text>
              <Text style={[styles.statCellLabel, { color: textTertColor }]}>{t.walk.calories}</Text>
            </View>
          </View>

          {/* Steps */}
          <View style={styles.stepsRow}>
            <Feather name="navigation" size={14} color={textSecColor} style={{ marginRight: 6 }} />
            <Text style={[styles.stepsValue, { color: textSecColor }]}>{stepsNum.toLocaleString()}</Text>
            <Text style={[styles.stepsLabel, { color: textTertColor }]}> {t.walk.steps}</Text>
          </View>

          {/* Date */}
          <Text style={[styles.dateText, { color: textTertColor }]}>{dateStr}</Text>

          {/* Footer branding */}
          <View style={[styles.cardFooter, { borderTopColor: borderColor }]}>
            <Text style={[styles.cardFooterText, { color: textTertColor }]}>moruwalk.com</Text>
          </View>
        </View>

        {/* Stats Cards Grid */}
        <View style={styles.statsCardsGrid}>
          <StatCard icon="map-pin" value={`${distNum.toFixed(2)}km`} label={t.walk.distance} accent isDark={isDark} />
          <StatCard icon="clock" value={statTimeStr} label={t.walk.time} isDark={isDark} />
          <StatCard icon="footprints" value={stepsNum.toLocaleString()} label={t.walk.steps} isDark={isDark} />
          <StatCard icon="flame" value={`${caloriesNum}kcal`} label={t.walk.calories} isDark={isDark} />
        </View>

        {/* Splits — interactive pace chart */}
        {splits.length > 0 && (
          <View style={[styles.splitsSection, { backgroundColor: cardBg }]}>
            <View style={styles.splitsTitleRow}>
              <Feather name="bar-chart-2" size={16} color={textSecColor} />
              <Text style={[styles.splitsTitle, { color: textSecColor }]}>{t.walkComplete.segmentRecord}</Text>
            </View>
            <SplitChart splits={splits} isDark={isDark} />
          </View>
        )}

        {/* Elevation profile — only shown when we have actual altitude data */}
        {Array.isArray(trackPoints) &&
          trackPoints.some((p: any) => typeof p?.ele === 'number') && (
          <View style={[styles.splitsSection, { backgroundColor: cardBg }]}>
            <View style={styles.splitsTitleRow}>
              <Feather name="trending-up" size={16} color={textSecColor} />
              <Text style={[styles.splitsTitle, { color: textSecColor }]}>{t.walk.elevation}</Text>
            </View>
            <ElevationChart
              trackPoints={trackPoints}
              isDark={isDark}
              elevationGain={parseFloat(elevationGain) || 0}
              elevationLoss={parseFloat(elevationLoss) || 0}
            />
          </View>
        )}

        {/* Tagged Photos */}
        {taggedPhotos.length > 0 && (
          <View style={styles.photosSection}>
            <View style={styles.photosTitleRow}>
              <Feather name="camera" size={16} color={textSecColor} />
              <Text style={[styles.photosSectionTitle, { color: textSecColor }]}>
                {t.walk.photoInfo} ({taggedPhotos.length})
              </Text>
            </View>
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
            <Feather name="share-2" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.shareBtnText}>{t.walkComplete.share}</Text>
          </TouchableOpacity>

          <View style={styles.secondaryRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: isDark ? '#1e1e1e' : '#F2F4F6' }]}
              onPress={() => navigation.navigate('ActivityDetail', {
                // Pass ONLY metadata — heavy arrays (trackPoints/photos/spots)
                // are already persisted to AsyncStorage under
                // `activity_latest_extra` and ActivityDetail loads them from
                // there. Passing them via nav params triggers Android's
                // TransactionTooLargeException on long walks.
                activity: {
                  id: activityId,
                  title: `${new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ${t.walk.walking}`,
                  distance_km: distance,
                  duration_minutes: Math.round(totalSeconds / 60),
                  total_steps: parseInt(steps) || 0,
                  calories_burned: parseInt(calories) || 0,
                  elevation_gain_m: parseFloat(elevationGain) || 0,
                  source: 'phone_gps',
                  started_at: new Date(Date.now() - totalSeconds * 1000).toISOString(),
                  created_at: new Date().toISOString(),
                },
                fromWalkComplete: true,
              })}
              activeOpacity={0.85}>
              <Feather name="file-text" size={16} color={textSecColor} style={{ marginRight: 6 }} />
              <Text style={[styles.secondaryBtnText, { color: textSecColor }]}>{t.walkComplete.activityDetail}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: isDark ? '#1e1e1e' : '#F2F4F6' }]}
              onPress={() => {
                const pts = Array.isArray(trackPoints) ? trackPoints : [];
                shareGpxFile(pts, {
                  name: `${dateStr} Walk`,
                  startTime: new Date(Date.now() - totalSeconds * 1000).toISOString(),
                  distanceKm: distNum,
                  durationMinutes: totalMinutes,
                });
              }}
              activeOpacity={0.85}>
              <Feather name="download" size={16} color={textSecColor} style={{ marginRight: 6 }} />
              <Text style={[styles.secondaryBtnText, { color: textSecColor }]}>GPX Export</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.secondaryBtn, { backgroundColor: isDark ? '#1e1e1e' : '#F2F4F6', marginTop: 8, alignSelf: 'center', width: '100%' }]}
            onPress={() => navigation.popToTop()}
            activeOpacity={0.85}>
            <Feather name="home" size={16} color={textSecColor} style={{ marginRight: 6 }} />
            <Text style={[styles.secondaryBtnText, { color: textSecColor }]}>{t.walkComplete.goHome}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// Error boundary — if the summary render throws (e.g. corrupted
// trackPoints, bad JSON in AsyncStorage), push the user to the Activity
// tab instead of crashing the app.
class WalkCompleteBoundary extends React.Component<
  { children: React.ReactNode; navigation: any },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any) {
    console.log('[Moru] WalkComplete render crash:', error);
  }
  componentDidUpdate(_: any, prev: { hasError: boolean }) {
    if (!prev.hasError && this.state.hasError) {
      setTimeout(() => {
        try { this.props.navigation?.replace?.('Main', { screen: 'Activity' }); } catch {}
      }, 100);
    }
  }
  render() {
    if (this.state.hasError) {
      return <View style={{ flex: 1, backgroundColor: '#FAFAFA' }} />;
    }
    return this.props.children;
  }
}

export default function WalkCompleteScreen() {
  const navigation = useNavigation<any>();
  return (
    <WalkCompleteBoundary navigation={navigation}>
      <WalkCompleteInner />
    </WalkCompleteBoundary>
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
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 48,
    marginBottom: 8,
  },
  accentLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
  },
  celebrationText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 32,
    letterSpacing: -0.3,
  },

  // Stat Card
  statCard: {
    width: width - 48,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  brandText: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.5,
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
    alignItems: 'center',
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

  // Stats Cards Grid
  statsCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: width - 48,
    gap: 10,
    marginBottom: 20,
  },
  miniStatCard: {
    width: (width - 48 - 10) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  miniStatIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  miniStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  miniStatLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '500',
  },

  // Splits
  splitsSection: {
    width: width - 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  splitsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  splitsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 1,
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
  photosTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  photosSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  photosList: {
    gap: 10,
  },
  photoCard: {
    width: 140,
    height: 140,
    borderRadius: 16,
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
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F2F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
