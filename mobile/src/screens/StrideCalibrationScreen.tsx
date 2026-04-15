/**
 * StrideCalibrationScreen — walk a known distance to compute actual stride
 *
 * The user walks 50m (a sports track straightaway, or a known path).
 * We count steps via the hardware sensor and compute:
 *   stride = 50m / steps
 *
 * The result is saved to AsyncStorage and loaded by WalkScreen on mount
 * so subsequent walks use the calibrated stride for indoor distance
 * estimation.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';
import { useT } from '../i18n';
import {
  startStepCounter,
  stopStepCounter,
  subscribeToSteps,
} from '../utils/nativeStepCounter';

const CALIBRATION_DISTANCE_M = 50;
export const STRIDE_STORAGE_KEY = '@moru_stride_length_m';

type Phase = 'ready' | 'counting' | 'done';

export default function StrideCalibrationScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const t = useT();
  const [phase, setPhase] = useState<Phase>('ready');
  const [steps, setSteps] = useState(0);
  const [stride, setStride] = useState<number | null>(null);
  const baseStepsRef = useRef<number | null>(null);
  const subRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      try { stopStepCounter(); } catch {}
      if (subRef.current) { try { subRef.current.remove(); } catch {} }
    };
  }, []);

  const handleStart = async () => {
    const ok = await startStepCounter();
    if (!ok) {
      Alert.alert(t.common.error, '걸음 센서를 사용할 수 없습니다.');
      return;
    }
    baseStepsRef.current = null;
    setSteps(0);
    setPhase('counting');
    subRef.current = subscribeToSteps((s: number) => {
      if (baseStepsRef.current === null) {
        baseStepsRef.current = s;
        return;
      }
      setSteps(s - baseStepsRef.current);
    });
  };

  const handleStop = async () => {
    try { stopStepCounter(); } catch {}
    if (subRef.current) { try { subRef.current.remove(); } catch {} subRef.current = null; }

    if (steps < 10) {
      Alert.alert('걸음이 부족해요', '최소 10걸음 이상 걸어야 보정할 수 있어요.');
      setPhase('ready');
      return;
    }

    const computed = CALIBRATION_DISTANCE_M / steps;
    setStride(computed);
    setPhase('done');

    // Persist
    await AsyncStorage.setItem(STRIDE_STORAGE_KEY, String(computed)).catch(() => {});
  };

  const handleSave = () => {
    navigation.goBack();
  };

  const handleReset = async () => {
    await AsyncStorage.removeItem(STRIDE_STORAGE_KEY).catch(() => {});
    setStride(null);
    setSteps(0);
    setPhase('ready');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>보폭 보정</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.content}>
        {phase === 'ready' && (
          <>
            <View style={styles.iconCircle}>
              <Feather name="activity" size={40} color={colors.primary} />
            </View>
            <Text style={styles.title}>실내 걸음 정확도를 높여요</Text>
            <Text style={styles.desc}>
              {`평탄한 곳에서 정확히 ${CALIBRATION_DISTANCE_M}m를 걸으면\n당신의 실제 보폭을 측정합니다.\n\n측정 후 실내 걷기(GPS 없음)에서\n거리 추정이 더 정확해집니다.`}
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleStart} activeOpacity={0.85}>
              <Feather name="play" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>시작 — {CALIBRATION_DISTANCE_M}m 걷기</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === 'counting' && (
          <>
            <Text style={styles.bigNumber}>{steps}</Text>
            <Text style={styles.bigLabel}>걸음</Text>
            <Text style={styles.desc}>
              {`${CALIBRATION_DISTANCE_M}m 지점에 도착하면\n"완료" 버튼을 눌러주세요`}
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleStop} activeOpacity={0.85}>
              <Feather name="check" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>{CALIBRATION_DISTANCE_M}m 도착 — 완료</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === 'done' && stride && (
          <>
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>측정된 보폭</Text>
              <Text style={styles.resultValue}>{(stride * 100).toFixed(1)}cm</Text>
              <Text style={styles.resultSub}>
                {CALIBRATION_DISTANCE_M}m / {steps}걸음 = {(stride * 100).toFixed(1)}cm
              </Text>
            </View>
            <Text style={styles.desc}>
              이제 실내 걷기에서 이 보폭을 사용합니다.{'\n'}
              다시 측정하려면 "초기화"를 눌러주세요.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>{t.common.confirm}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleReset} activeOpacity={0.7}>
              <Text style={styles.secondaryBtnText}>초기화</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(45,74,46,0.08)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 },
  desc: {
    fontSize: 14, color: colors.textSecondary, textAlign: 'center',
    lineHeight: 22, marginBottom: 32,
  },
  bigNumber: { fontSize: 72, fontWeight: '800', color: colors.primary, letterSpacing: -2 },
  bigLabel: { fontSize: 16, color: colors.textSecondary, fontWeight: '600', marginBottom: 24 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 28, paddingVertical: 16,
    borderRadius: 16,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { marginTop: 16, paddingVertical: 12 },
  secondaryBtnText: { color: colors.textTertiary, fontSize: 14, fontWeight: '600' },
  resultCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 28,
    alignItems: 'center', marginBottom: 24, width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  resultLabel: { fontSize: 13, color: colors.textTertiary, fontWeight: '600', marginBottom: 8 },
  resultValue: { fontSize: 48, fontWeight: '800', color: colors.primary, letterSpacing: -1 },
  resultSub: { fontSize: 13, color: colors.textSecondary, marginTop: 8 },
});
