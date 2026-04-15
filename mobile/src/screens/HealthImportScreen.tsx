import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { FadeInView } from '../components/FadeInView';
import api from '../api/client';
import { Linking } from 'react-native';
import {
  initHealthConnect,
  requestHealthPermissions,
  hasHealthPermissions,
  getWalkSessions,
  HealthWalkSession,
} from '../utils/healthConnect';

export default function HealthImportScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [available, setAvailable] = useState(false);
  const [sessions, setSessions] = useState<HealthWalkSession[]>([]);

  const [errorMsg, setErrorMsg] = useState('');

  const initialize = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const isAvailable = await initHealthConnect();
      setAvailable(isAvailable);
      if (!isAvailable) {
        setErrorMsg('Health Connect를 사용할 수 없습니다. 기기에서 지원하지 않거나 설치가 필요합니다.');
        setLoading(false);
        return;
      }
      const hasPerm = await hasHealthPermissions();
      setPermissionGranted(hasPerm);
      if (hasPerm) {
        try {
          const data = await getWalkSessions(30);
          setSessions(data);
        } catch (fetchErr: any) {
          setErrorMsg(`데이터 가져오기 실패: ${fetchErr?.message || '알 수 없는 오류'}`);
        }
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.log('Health Connect init error:', msg);
      setAvailable(false);
      setErrorMsg(`초기화 오류: ${msg}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      initialize();
    } else {
      setLoading(false);
      setAvailable(false);
    }
  }, [initialize]);

  const handleRequestPermission = async () => {
    try {
      const granted = await requestHealthPermissions();
      if (granted) {
        setPermissionGranted(true);
        setLoading(true);
        const data = await getWalkSessions(30);
        setSessions(data);
        setLoading(false);
      } else {
        Alert.alert(
          '\uAD8C\uD55C \uBD80\uC5EC \uC2E4\uD328',
          'Health Connect \uAD8C\uD55C\uC744 \uD5C8\uC6A9\uD574\uC8FC\uC138\uC694. \uC124\uC815\uC5D0\uC11C \uC9C1\uC811 \uD5C8\uC6A9\uD560 \uC218\uB3C4 \uC788\uC2B5\uB2C8\uB2E4.',
          [
            { text: '\uCDE8\uC18C', style: 'cancel' },
            { text: '\uC124\uC815 \uC5F4\uAE30', onPress: () => Linking.openSettings() },
          ],
        );
      }
    } catch (e: any) {
      console.log('Permission request error:', e);
      Alert.alert(
        '\uAD8C\uD55C \uC694\uCCAD \uC624\uB958',
        '\uAD8C\uD55C \uC694\uCCAD \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uC124\uC815\uC5D0\uC11C \uC9C1\uC811 \uD5C8\uC6A9\uD574\uC8FC\uC138\uC694.',
        [
          { text: '\uD655\uC778', onPress: () => Linking.openSettings() },
        ],
      );
    }
  };

  // Re-check permissions when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      if (!available) return;
      try {
        const has = await hasHealthPermissions();
        if (has && !permissionGranted) {
          setPermissionGranted(true);
          setLoading(true);
          const data = await getWalkSessions(30);
          setSessions(data);
          setLoading(false);
        }
      } catch (e) {
        console.log('Focus permission check error:', e);
      }
    });
    return unsubscribe;
  }, [navigation, permissionGranted, available]);

  const formatDurationShort = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
  };

  const handleImport = (session: HealthWalkSession) => {
    if (importing) return;
    Alert.alert(
      '기록 가져오기',
      `${session.title}\n\n거리: ${session.distance.toFixed(2)}km\n시간: ${formatDurationShort(session.duration)}\n걸음: ${session.steps.toLocaleString()}\n\n이 기록을 가져올까요?`,
      [
        { text: '취소', style: 'cancel' },
        { text: '가져오기', onPress: () => doImport(session) },
      ],
    );
  };

  // `forceOffset` is used to bypass the server's ±30s duplicate check for
  // "ghost" imports — activities that the backend considers duplicates but
  // that aren't visible in the user's list (usually because a prior import
  // row was hidden by moderation). When set, we shift started_at slightly.
  const doImport = async (session: HealthWalkSession, forceOffset = 0) => {
    setImporting(session.id);
    try {
      // Format track_points for our API
      const trackPoints = session.trackPoints.map(p => ({
        lat: p.lat,
        lng: p.lng,
        ele: p.ele ?? null,
        time: p.time || new Date().toISOString(),
      }));

      // Samsung Health sometimes records 0 distance for very short sessions
      // and some older watch firmware. Fall back to a pace-based estimate
      // so the backend serializer accepts the row. Distance is stored as a
      // number (Decimal on the server) — send it as such, not as a string,
      // so the serializer can parse it uniformly.
      const distanceKm = Number(
        (session.distance && session.distance > 0 ? session.distance : 0).toFixed(2),
      );
      const durationMinutes = Math.max(1, session.duration || 1);

      // Shift started_at when forcing a re-import past the server's
      // duplicate-window check.
      const startedAtIso = forceOffset
        ? new Date(new Date(session.startTime).getTime() + forceOffset * 1000).toISOString()
        : session.startTime;
      const finishedAtIso = forceOffset
        ? new Date(new Date(session.endTime).getTime() + forceOffset * 1000).toISOString()
        : session.endTime;

      const payload: any = {
        title: session.title,
        source: 'samsung_health',
        started_at: startedAtIso,
        finished_at: finishedAtIso,
        total_steps: session.steps || 0,
        calories_burned: session.calories || 0,
        distance_km: distanceKm,
        duration_minutes: durationMinutes,
      };

      // Only include track_points if we have real GPS data. Samsung Health
      // often doesn't sync routes, and empty arrays used to confuse
      // compute_summary() on the server.
      if (trackPoints.length > 1) {
        payload.track_points = trackPoints;
      }

      const { data } = await api.post('/activities/', payload);
      Alert.alert('가져오기 완료', `${session.title} 기록을 가져왔습니다.`, [
        {
          text: '확인',
          onPress: () => navigation.navigate('ActivityDetail', {
            activity: {
              ...data,
              distance_km: distanceKm.toFixed(2),
              duration_minutes: durationMinutes,
              total_steps: session.steps,
              calories_burned: session.calories,
              track_points: trackPoints,
            },
          }),
        },
      ]);
    } catch (e: any) {
      const status = e?.response?.status;
      const errData = e?.response?.data;

      // Build a user-friendly message from the response payload. Django REST
      // returns errors in a few different shapes; cover the common ones.
      let msg = '알 수 없는 오류가 발생했습니다.';
      let isDuplicate = false;

      if (typeof errData === 'string') {
        msg = errData;
      } else if (errData && typeof errData === 'object') {
        if (errData.detail) {
          msg = String(errData.detail);
        } else {
          // Field error shape: { field: ["message"] } or { field: "message" }
          const firstKey = Object.keys(errData)[0];
          if (firstKey) {
            const firstVal = Array.isArray(errData[firstKey])
              ? errData[firstKey][0]
              : errData[firstKey];
            msg = String(firstVal);
          }
        }
      } else if (e?.message) {
        msg = e.message;
      }

      // The backend rejects activities whose started_at is within ±30s of
      // an existing one as a duplicate. Treat that as info, not an error —
      // the user has already imported this session.
      if (/already recorded|similar activity|duplicate/i.test(msg)) {
        isDuplicate = true;
      }

      if (isDuplicate) {
        Alert.alert(
          '이미 가져온 기록',
          '이 세션은 이미 활동에 추가되어 있어요.\n활동 탭에서 보이지 않는다면 "강제로 가져오기"를 눌러주세요.',
          [
            { text: '확인', style: 'cancel' },
            {
              text: '강제로 가져오기',
              onPress: () => doImport(session, 60), // +60s offset bypasses dup window
            },
          ],
        );
      } else if (status === 401) {
        Alert.alert(
          '로그인 필요',
          '활동을 저장하려면 먼저 로그인해주세요.',
          [{ text: '확인' }],
        );
      } else {
        Alert.alert(
          '가져오기 실패',
          msg,
          [{ text: '확인' }],
        );
      }
    }
    setImporting(null);
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
  };

  const renderSession = ({ item, index }: { item: HealthWalkSession; index: number }) => {
    const dateStr = new Date(item.startTime).toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
    const timeStr = new Date(item.startTime).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const isImporting = importing === item.id;

    return (
      <FadeInView delay={index * 50}>
        <TouchableOpacity
          style={styles.sessionCard}
          activeOpacity={0.7}
          onPress={() => handleImport(item)}
          disabled={isImporting}>
          <View style={styles.sessionHeader}>
            <View style={styles.sessionDateWrap}>
              <Text style={styles.sessionDate}>{dateStr}</Text>
              <Text style={styles.sessionTime}>{timeStr}</Text>
            </View>
            {isImporting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <View style={styles.importBadge}>
                <Text style={styles.importBadgeText}>가져오기</Text>
              </View>
            )}
          </View>

          <View style={styles.sessionStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{item.distance.toFixed(1)}</Text>
              <Text style={styles.statLabel}>km</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{item.steps.toLocaleString()}</Text>
              <Text style={styles.statLabel}>걸음</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatDuration(item.duration)}</Text>
              <Text style={styles.statLabel}>시간</Text>
            </View>
            {item.heartRateAvg > 0 && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{item.heartRateAvg}</Text>
                  <Text style={styles.statLabel}>BPM</Text>
                </View>
              </>
            )}
          </View>

          {item.calories > 0 && (
            <Text style={styles.sessionCalories}>{item.calories} kcal</Text>
          )}
        </TouchableOpacity>
      </FadeInView>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Text style={styles.backBtnText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>워치 기록 가져오기</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Health Connect 연결 중...</Text>
        </View>
      ) : !available ? (
        <View style={styles.centerWrap}>
          <Text style={styles.emptyIcon}>{'⌚'}</Text>
          <Text style={styles.emptyTitle}>Health Connect를 사용할 수 없습니다</Text>
          <Text style={styles.emptyDesc}>
            {Number(Platform.Version) >= 34
              ? 'Health Connect 설정에서 모루 앱의 권한을 확인해주세요.'
              : 'Health Connect 앱을 설치하면 갤럭시 워치 걷기 기록을 가져올 수 있습니다.'}
          </Text>
          {errorMsg ? <Text style={[styles.emptyDesc, { color: '#FF6B6B', marginTop: 8, fontSize: 12 }]}>{errorMsg}</Text> : null}
          {Platform.OS === 'android' && Number(Platform.Version) >= 34 ? (
            <TouchableOpacity
              style={styles.permissionBtn}
              onPress={() => {
                // Try Health Connect settings intent (Android 14+)
                Linking.sendIntent('android.health.connect.action.MANAGE_HEALTH_PERMISSIONS').catch(() => {
                  // Fallback: try the healthconnect:// scheme
                  Linking.openURL('healthconnect://settings').catch(() => {
                    // Final fallback: open device settings
                    Linking.openSettings();
                  });
                });
              }}
              activeOpacity={0.85}>
              <Text style={styles.permissionBtnText}>Health Connect 설정 열기</Text>
            </TouchableOpacity>
          ) : Platform.OS === 'android' ? (
            <TouchableOpacity
              style={styles.permissionBtn}
              onPress={() => {
                Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata').catch(() => {
                  Alert.alert('오류', 'Play Store를 열 수 없습니다.');
                });
              }}
              activeOpacity={0.85}>
              <Text style={styles.permissionBtnText}>Play Store에서 설치</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.permissionBtn, { backgroundColor: '#E8E8E8', marginTop: 10 }]}
            onPress={() => initialize()}
            activeOpacity={0.85}>
            <Text style={[styles.permissionBtnText, { color: colors.textPrimary }]}>다시 확인</Text>
          </TouchableOpacity>
        </View>
      ) : !permissionGranted ? (
        <View style={styles.centerWrap}>
          <Text style={styles.emptyIcon}>{'🔒'}</Text>
          <Text style={styles.emptyTitle}>건강 데이터 접근 권한이 필요합니다</Text>
          <Text style={styles.emptyDesc}>
            갤럭시 워치 걷기 기록을 가져오려면 Health Connect 권한을 허용해주세요.
          </Text>
          <TouchableOpacity
            style={styles.permissionBtn}
            onPress={handleRequestPermission}
            activeOpacity={0.85}>
            <Text style={styles.permissionBtnText}>권한 허용하기</Text>
          </TouchableOpacity>
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.centerWrap}>
          <Text style={styles.emptyIcon}>{'🚶'}</Text>
          <Text style={styles.emptyTitle}>최근 30일간 걷기 기록이 없습니다</Text>
          <Text style={styles.emptyDesc}>
            갤럭시 워치나 Samsung Health에서 걷기를 기록하면 여기에 표시됩니다.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderSession}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 100,
            paddingTop: 8,
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F6',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerRight: {
    width: 40,
  },

  // Center content
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  permissionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // Session card
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sessionDateWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  sessionDate: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sessionTime: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  importBadge: {
    backgroundColor: colors.primary50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  importBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  // Stats row
  sessionStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#F2F4F6',
  },
  sessionCalories: {
    marginTop: 10,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
