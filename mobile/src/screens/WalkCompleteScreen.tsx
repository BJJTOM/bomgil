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
        message: `Roami - ${distNum.toFixed(2)}km \uC644\uB8CC!\n${distNum.toFixed(2)}km, ${stepsNum.toLocaleString()} \uAC78\uC74C, ${timeStr}`,
      });
    } catch {}
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.completedBadge}>WALK COMPLETED</Text>
          <Text style={styles.completedTitle}>{'\uAC77\uAE30 \uC644\uB8CC!'}</Text>
        </View>

        {/* Share Card */}
        <View style={styles.shareCard}>
          {/* Brand */}
          <Text style={styles.cardBrand}>ROAMI</Text>

          {/* Big distance */}
          <View style={styles.distanceRow}>
            <Text style={styles.distanceBig}>{distNum.toFixed(2)}</Text>
            <Text style={styles.distanceUnit}>km</Text>
          </View>

          {/* Primary stats grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{timeStr}</Text>
              <Text style={styles.statLabel}>{'\uC2DC\uAC04'}</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, { color: colors.accent }]}>
                {typeof pace === 'string' && pace.includes("'") ? pace : formatPace(pace)}
              </Text>
              <Text style={styles.statLabel}>{'\uD398\uC774\uC2A4'}</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{caloriesNum}</Text>
              <Text style={styles.statLabel}>kcal</Text>
            </View>
          </View>

          {/* Extended stats */}
          <View style={styles.extendedStatsGrid}>
            <View style={styles.extendedStatCell}>
              <Text style={styles.extendedStatValue}>
                {stepsNum.toLocaleString()}
              </Text>
              <Text style={styles.extendedStatLabel}>{'\uAC78\uC74C'}</Text>
            </View>
            <View style={styles.extendedStatCell}>
              <Text style={styles.extendedStatValue}>
                {eleGain > 0 ? `+${eleGain}m` : '0m'}
              </Text>
              <Text style={styles.extendedStatLabel}>{'\uB204\uC801\uC0C1\uC2B9'}</Text>
            </View>
            <View style={styles.extendedStatCell}>
              <Text style={styles.extendedStatValue}>
                {eleLoss > 0 ? `-${eleLoss}m` : '0m'}
              </Text>
              <Text style={styles.extendedStatLabel}>{'\uB204\uC801\uD558\uAC15'}</Text>
            </View>
            <View style={styles.extendedStatCell}>
              <Text style={styles.extendedStatValue}>
                {maxSpeedNum > 0 ? `${maxSpeedNum.toFixed(1)}` : '0'}
              </Text>
              <Text style={styles.extendedStatLabel}>{'\uCD5C\uACE0 km/h'}</Text>
            </View>
          </View>

          {/* Km Splits Table */}
          {splits.length > 0 && (
            <View style={styles.splitsSection}>
              <Text style={styles.splitsSectionTitle}>{'\uAD6C\uAC04 \uAE30\uB85D'}</Text>
              <View style={styles.splitsHeader}>
                <Text style={styles.splitsHeaderText}>{'\uAD6C\uAC04'}</Text>
                <Text style={styles.splitsHeaderText}>{'\uD398\uC774\uC2A4'}</Text>
                <Text style={styles.splitsHeaderText}>{'\uACE0\uB3C4'}</Text>
              </View>
              {splits.map((split: KmSplit) => (
                <View key={split.km} style={styles.splitTableRow}>
                  <Text style={styles.splitTableKm}>{split.km}km</Text>
                  <Text style={styles.splitTablePace}>
                    {formatPace(split.pace)}
                  </Text>
                  <Text style={styles.splitTableEle}>
                    {split.elevationGain > 0
                      ? `\u2191${Math.round(split.elevationGain)}m`
                      : '-'}
                    {split.elevationLoss > 0
                      ? ` \u2193${Math.round(split.elevationLoss)}m`
                      : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Date */}
          <View style={styles.stepsDateRow}>
            <Text style={styles.dateText}>{dateStr}</Text>
          </View>

          {/* Footer branding */}
          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterText}>roami.app</Text>
            <Text style={styles.cardFooterText}>Walk. Discover. Connect.</Text>
          </View>
        </View>

        {/* Tagged Photos */}
        {taggedPhotos.length > 0 && (
          <View style={styles.photosSection}>
            <Text style={styles.photosSectionTitle}>
              {'\u{1F4F7}'} {'\uC0AC\uC9C4'} ({taggedPhotos.length})
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
                  <View style={styles.photoLocationBadge}>
                    <Text style={styles.photoLocationText}>
                      {'\u{1F4CD}'} {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                    </Text>
                  </View>
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
            <Text style={styles.shareBtnIcon}>{'\u2B06\uFE0F'}</Text>
            <Text style={styles.shareBtnText}>{'\uACF5\uC720\uD558\uAE30'}</Text>
          </TouchableOpacity>

          <View style={styles.secondaryRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('Activity')}
              activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>
                {'\uD65C\uB3D9 \uAE30\uB85D \uBCF4\uAE30'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.popToTop()}
              activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>{'\uD648\uC73C\uB85C'}</Text>
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
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 16,
  },
  completedBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 2,
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  shareCard: {
    width: width - 40,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 24,
  },
  cardBrand: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(168,230,207,0.6)',
    letterSpacing: 2,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  distanceBig: {
    fontSize: 64,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -2,
  },
  distanceUnit: {
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    marginLeft: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: 24,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  statCell: {
    flex: 1,
    backgroundColor: '#162416',
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  extendedStatsGrid: {
    flexDirection: 'row',
    marginHorizontal: 24,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    marginTop: 4,
  },
  extendedStatCell: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 1,
  },
  extendedStatValue: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  extendedStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
  },
  splitsSection: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 16,
  },
  splitsSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
    letterSpacing: 1,
  },
  splitsHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: 4,
  },
  splitsHeaderText: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
  },
  splitTableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  splitTableKm: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  splitTablePace: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
  },
  splitTableEle: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'right',
  },
  stepsDateRow: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  dateText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  cardFooterText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
  },
  actionsSection: {
    width: width - 40,
    gap: 12,
    paddingBottom: 20,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
  },
  shareBtnIcon: {
    fontSize: 16,
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  photosSection: {
    width: width - 40,
    marginBottom: 24,
  },
  photosSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
  },
  photosList: {
    gap: 10,
  },
  photoCard: {
    width: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  photoImage: {
    width: 160,
    height: 120,
  },
  photoLocationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  photoLocationText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
  },
});
