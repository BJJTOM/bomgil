import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
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

  const { distance, duration, steps, calories } = route.params || {
    distance: '0',
    duration: 0,
    steps: 0,
    calories: 0,
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}\uC2DC\uAC04 ${m}\uBD84`;
    return `${m}\uBD84`;
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Roami\uC640 \uD568\uAED8 ${distance}km \uAC78\uC5C8\uC5B4\uC694! ${formatDuration(duration)} \uB3D9\uC548 ${steps.toLocaleString()}\uAC78\uC74C, ${calories}kcal \uC18C\uBAA8\uD588\uC2B5\uB2C8\uB2E4.`,
      });
    } catch {}
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
      <View style={styles.content}>
        {/* Celebration */}
        <Text style={styles.emoji}>{'\uD83C\uDF89'}</Text>
        <Text style={styles.title}>{'\uAC77\uAE30 \uC644\uB8CC!'}</Text>
        <Text style={styles.subtitle}>
          {'\uC624\uB298\uB3C4 \uBA4B\uC9C4 \uAC78\uC74C\uC774\uC5C8\uC5B4\uC694'}
        </Text>

        {/* Share Card */}
        <View style={styles.shareCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLogo}>Roami</Text>
            <Text style={styles.cardDate}>
              {new Date().toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{distance}</Text>
              <Text style={styles.statUnit}>km</Text>
              <Text style={styles.statLabel}>{'\uAC70\uB9AC'}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{formatDuration(duration)}</Text>
              <Text style={styles.statUnit}> </Text>
              <Text style={styles.statLabel}>{'\uC2DC\uAC04'}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {steps.toLocaleString()}
              </Text>
              <Text style={styles.statUnit}>{'\uAC78\uC74C'}</Text>
              <Text style={styles.statLabel}>{'\uAC78\uC74C \uC218'}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{calories}</Text>
              <Text style={styles.statUnit}>kcal</Text>
              <Text style={styles.statLabel}>{'\uCE7C\uB85C\uB9AC'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>{'\uACF5\uC720\uD558\uAE30'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.popToTop()}>
          <Text style={styles.homeBtnText}>{'\uD648\uC73C\uB85C'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  shareCard: {
    width: width - 48,
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardLogo: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: -0.5,
  },
  cardDate: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statBox: {
    width: '50%',
    marginBottom: 20,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  statUnit: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  buttons: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 10,
  },
  shareBtn: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  homeBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  homeBtnText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
});
