import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';

const { width } = Dimensions.get('window');

export default function WalkCompleteScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const {
    distance = '0',
    duration = 0,
    steps = 0,
    calories = 0,
  } = route.params || {};

  // Duration comes as seconds now
  const totalSeconds = typeof duration === 'number' ? duration : parseInt(duration);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const timeStr = hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Pace
  const distNum = typeof distance === 'string' ? parseFloat(distance) : distance;
  const pace = totalSeconds > 0 && distNum > 0.01 ? totalSeconds / 60 / distNum : 0;
  const paceMin = Math.floor(pace);
  const paceSec = Math.round((pace - paceMin) * 60);
  const paceStr = pace > 0 ? `${paceMin}'${String(paceSec).padStart(2, '0')}"` : '--';

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
        message: `Roami - ${distNum.toFixed(2)}km \uC644\uB8CC!\n${distNum.toFixed(2)}km, ${steps.toLocaleString()} \uAC78\uC74C, ${timeStr}`,
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

          {/* Stats grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{timeStr}</Text>
              <Text style={styles.statLabel}>{'\uC2DC\uAC04'}</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, { color: colors.accent }]}>{paceStr}</Text>
              <Text style={styles.statLabel}>{'\uD398\uC774\uC2A4'}</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{calories}</Text>
              <Text style={styles.statLabel}>kcal</Text>
            </View>
          </View>

          {/* Steps + Date */}
          <View style={styles.stepsDateRow}>
            <Text style={styles.stepsText}>
              {steps.toLocaleString()} {'\uAC78\uC74C'}
            </Text>
            <Text style={styles.dateText}>{dateStr}</Text>
          </View>

          {/* Footer branding */}
          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterText}>roami.app</Text>
            <Text style={styles.cardFooterText}>Walk. Discover. Connect.</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <Text style={styles.shareBtnIcon}>{'\u2B06\uFE0F'}</Text>
            <Text style={styles.shareBtnText}>{'\uACF5\uC720\uD558\uAE30'}</Text>
          </TouchableOpacity>

          <View style={styles.secondaryRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('Activity')}
              activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>{'\uD65C\uB3D9 \uAE30\uB85D \uBCF4\uAE30'}</Text>
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
    marginBottom: 20,
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
  stepsDateRow: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  stepsText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
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
});
