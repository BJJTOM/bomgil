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
import { Linking, NativeModules } from 'react-native';
import {
  initHealthConnect,
  requestHealthPermissions,
  hasHealthPermissions,
  getWalkSessions,
  HealthWalkSession,
} from '../utils/healthConnect';

const { HealthConnectModule } = NativeModules;

export default function HealthImportScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [available, setAvailable] = useState(false);
  const [sessions, setSessions] = useState<HealthWalkSession[]>([]);

  const initialize = useCallback(async () => {
    setLoading(true);
    try {
      const isAvailable = await initHealthConnect();
      setAvailable(isAvailable);
      if (!isAvailable) {
        setLoading(false);
        return;
      }
      const hasPerm = await hasHealthPermissions();
      setPermissionGranted(hasPerm);
      if (hasPerm) {
        const data = await getWalkSessions(30);
        setSessions(data);
      }
    } catch (e) {
      console.log('Health Connect init error:', e);
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

  const handleRequestPermission = () => {
    // Open Health Connect permission management via native module
    try {
      HealthConnectModule?.openPermissions();
    } catch {
      Linking.openSettings();
    }
  };

  // Re-check permissions when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      const has = await hasHealthPermissions();
      if (has && !permissionGranted) {
        setPermissionGranted(true);
        setLoading(true);
        const data = await getWalkSessions(30);
        setSessions(data);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [navigation, permissionGranted]);

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

  const doImport = async (session: HealthWalkSession) => {
    setImporting(session.id);
    try {
      // Format track_points for our API
      const trackPoints = session.trackPoints.map(p => ({
        lat: p.lat,
        lng: p.lng,
        ele: p.ele || null,
        time: p.time || new Date().toISOString(),
      }));

      const payload: any = {
        title: session.title,
        source: 'samsung_health',
        started_at: session.startTime,
        finished_at: session.endTime,
        total_steps: session.steps || 0,
        calories_burned: session.calories || 0,
      };

      // Only include track_points if we have them
      if (trackPoints.length > 0) {
        payload.track_points = trackPoints;
      }

      const { data } = await api.post('/activities/', payload);
      Alert.alert('가져오기 완료', `${session.title} 기록을 가져왔습니다.`, [
        {
          text: '확인',
          onPress: () => navigation.navigate('ActivityDetail', {
            activity: {
              ...data,
              distance_km: session.distance.toFixed(2),
              duration_minutes: session.duration,
              total_steps: session.steps,
              calories_burned: session.calories,
              track_points: trackPoints,
            },
          }),
        },
      ]);
    } catch (e: any) {
      const errData = e?.response?.data;
      let msg = '가져오기에 실패했습니다.';
      if (errData && typeof errData === 'object') {
        const firstKey = Object.keys(errData)[0];
        const firstVal = Array.isArray(errData[firstKey]) ? errData[firstKey][0] : errData[firstKey];
        msg = `${firstKey}: ${firstVal}`;
      } else if (errData?.detail) {
        msg = errData.detail;
      }
      Alert.alert('오류', msg);
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
            Android 기기에서 Health Connect 앱을 설치해주세요.
          </Text>
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
