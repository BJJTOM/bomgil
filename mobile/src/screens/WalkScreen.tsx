import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  PermissionsAndroid,
  Dimensions,
  Animated,
  StatusBar,
  AppState,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Geolocation from 'react-native-geolocation-service';
import { colors } from '../theme/colors';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';
import { takeTaggedPhoto, TaggedPhoto } from '../utils/photoTagger';
import { WalkEngine, WalkStats, KmSplit } from '../utils/walkEngine';

const { width } = Dimensions.get('window');

type WalkState = 'ready' | 'walking' | 'paused';

// Format pace as min'sec"
function formatPace(pace: number): string {
  if (pace <= 0 || pace > 30) return "--'--\"";
  const min = Math.floor(pace);
  const sec = Math.round((pace - min) * 60);
  return `${min}'${sec.toString().padStart(2, '0')}"`;
}

// Format duration as hh:mm:ss
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function WalkScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isAuthenticated } = useAuthStore();
  const trailId = route.params?.trailId;

  const [state, setState] = useState<WalkState>('ready');
  const [stats, setStats] = useState<WalkStats>({
    distance: 0,
    duration: 0,
    totalTime: 0,
    pace: 0,
    currentPace: 0,
    speed: 0,
    steps: 0,
    cadence: 0,
    calories: 0,
    elevationGain: 0,
    elevationLoss: 0,
    maxElevation: 0,
    minElevation: 0,
    maxSpeed: 0,
    splits: [],
    isAutoPaused: false,
  });
  const [gpsReady, setGpsReady] = useState(false);
  const [taggedPhotos, setTaggedPhotos] = useState<TaggedPhoto[]>([]);
  const [isBackground, setIsBackground] = useState(false);
  const [currentPos, setCurrentPos] = useState<{lat: number; lng: number} | null>(null);

  const engineRef = useRef(new WalkEngine());
  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulse animation for start button
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Auto-pause pulse animation
  const autoPausePulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === 'ready') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [state]);

  // Auto-pause pulse effect
  useEffect(() => {
    if (stats.isAutoPaused) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(autoPausePulse, {
            toValue: 0.5,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(autoPausePulse, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      autoPausePulse.setValue(1);
    }
  }, [stats.isAutoPaused]);

  const requestPermission = async () => {
    if (Platform.OS === 'ios') {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      return auth === 'granted';
    }
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return false;
  };

  // Background/foreground tracking
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        setIsBackground(true);
      } else if (nextState === 'active') {
        setIsBackground(false);
      }
    });
    return () => sub.remove();
  }, []);

  // Take photo with GPS tag
  const handleTakePhoto = useCallback(async () => {
    if (!currentPos) {
      Alert.alert('GPS \uB300\uAE30 \uC911', '\uC704\uCE58 \uC815\uBCF4\uB97C \uC544\uC9C1 \uBC1B\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.');
      return;
    }
    const photo = await takeTaggedPhoto(currentPos.lat, currentPos.lng);
    if (photo) {
      setTaggedPhotos((prev) => [...prev, photo]);
    }
  }, [currentPos]);

  // Request GPS on mount
  useEffect(() => {
    (async () => {
      const hasPermission = await requestPermission();
      if (hasPermission) {
        Geolocation.getCurrentPosition(
          () => setGpsReady(true),
          () => setGpsReady(true),
          { enableHighAccuracy: true, timeout: 5000 },
        );
      } else {
        setGpsReady(true);
      }
    })();
  }, []);

  const startGpsTracking = useCallback(() => {
    watchIdRef.current = Geolocation.watchPosition(
      (pos) => {
        const point = engineRef.current.addPoint(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.altitude,
          pos.coords.accuracy,
          pos.timestamp,
        );
        if (point) {
          setCurrentPos({ lat: point.lat, lng: point.lng });
        }
        setStats(engineRef.current.getStats());
      },
      (err) => console.log('GPS error:', err),
      {
        enableHighAccuracy: true,
        distanceFilter: 3,
        interval: 2000,
        fastestInterval: 1000,
        showsBackgroundLocationIndicator: true,
      },
    );
  }, []);

  const startWalk = useCallback(() => {
    engineRef.current.start();
    setState('walking');

    startGpsTracking();

    // Update stats every second (for timer)
    timerRef.current = setInterval(() => {
      setStats(engineRef.current.getStats());
    }, 1000);
  }, [startGpsTracking]);

  const pauseWalk = () => {
    setState('paused');
    if (timerRef.current) clearInterval(timerRef.current);
    if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current);
  };

  const resumeWalk = () => {
    setState('walking');
    startGpsTracking();
    timerRef.current = setInterval(() => {
      setStats(engineRef.current.getStats());
    }, 1000);
  };

  const completeWalk = async () => {
    // Stop GPS and timer
    if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    const finalStats = engineRef.current.getStats();
    const trackPoints = engineRef.current.getTrackPoints();

    // Save to API
    if (isAuthenticated && trackPoints.length > 0) {
      try {
        const dateLabel = new Date().toLocaleDateString('ko-KR', {
          month: 'long',
          day: 'numeric',
        });
        await api.post('/activities/', {
          trail: trailId || null,
          track_points: trackPoints,
          source: 'phone_gps',
          title: `${dateLabel} \uB3C4\uBCF4`,
          started_at: new Date(
            Date.now() - finalStats.totalTime * 1000,
          ).toISOString(),
          finished_at: new Date().toISOString(),
          total_steps: finalStats.steps,
          calories_burned: finalStats.calories,
          distance_km: finalStats.distance.toFixed(2),
          duration_minutes: Math.round(finalStats.duration / 60),
          elevation_gain_m: finalStats.elevationGain,
        });
      } catch (e) {
        console.log('Save error:', e);
      }
    }

    navigation.replace('WalkComplete', {
      distance: finalStats.distance.toFixed(2),
      duration: String(Math.round(finalStats.duration)),
      steps: String(finalStats.steps),
      calories: String(finalStats.calories),
      pace: formatPace(finalStats.pace),
      elevationGain: String(finalStats.elevationGain),
      elevationLoss: String(finalStats.elevationLoss),
      maxSpeed: finalStats.maxSpeed.toFixed(1),
      splits: JSON.stringify(finalStats.splits),
      taggedPhotos,
    });
  };

  const handleStop = () => {
    Alert.alert('\uAC77\uAE30 \uC885\uB8CC', '\uAC77\uAE30\uB97C \uC885\uB8CC\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?', [
      { text: '\uCDE8\uC18C', style: 'cancel' },
      { text: '\uC885\uB8CC', style: 'destructive', onPress: completeWalk },
    ]);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // ---- READY STATE ----
  if (state === 'ready') {
    return (
      <View style={styles.readyContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#1a3a1b" />
        {/* Back button */}
        <TouchableOpacity
          style={[styles.readyBack, { top: insets.top + 10 }]}
          onPress={() => navigation.goBack()}>
          <Text style={styles.readyBackText}>{'\u2190'} {'\uB3CC\uC544\uAC00\uAE30'}</Text>
        </TouchableOpacity>

        {/* GPS Status */}
        <View style={[styles.gpsStatus, gpsReady && styles.gpsStatusReady]}>
          <View style={[styles.gpsDot, gpsReady && styles.gpsDotReady]} />
          <Text style={[styles.gpsText, gpsReady && styles.gpsTextReady]}>
            {gpsReady ? 'GPS \uC900\uBE44 \uC644\uB8CC' : 'GPS \uAC80\uC0C9 \uC911...'}
          </Text>
        </View>

        {/* Brand */}
        <Text style={styles.brandText}>ROAMI WALK</Text>

        {/* Start Button with pulse */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={startWalk}
            activeOpacity={0.85}>
            <Text style={styles.startBtnText}>{'\uAC77\uAE30 \uC2DC\uC791'}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Pulse ring effect */}
        <View style={styles.pulseRing} />

        {/* Hint */}
        <Text style={styles.hintText}>
          GPS\uB85C \uACBD\uB85C\uAC00 \uC790\uB3D9 \uAE30\uB85D\uB429\uB2C8\uB2E4
        </Text>
      </View>
    );
  }

  // ---- WALKING / PAUSED STATE ----
  return (
    <View style={styles.walkContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0d1a0e" />

      {/* Top status bar */}
      <View style={[styles.statusBar, { top: insets.top + 12 }]}>
        <View style={styles.statusPill}>
          <View
            style={[
              styles.statusDot,
              state === 'walking'
                ? stats.isAutoPaused
                  ? styles.statusDotAutoPaused
                  : styles.statusDotLive
                : styles.statusDotPaused,
            ]}
          />
          <Text style={styles.statusText}>
            {state === 'walking'
              ? stats.isAutoPaused
                ? '\uC790\uB3D9 \uC77C\uC2DC\uC815\uC9C0'
                : '\uAE30\uB85D \uC911'
              : '\uC77C\uC2DC\uC815\uC9C0'}
          </Text>
          <Text style={styles.statusTimer}>{formatTime(stats.duration)}</Text>
        </View>
        {isBackground && (
          <View style={styles.bgTrackingPill}>
            <Text style={styles.bgTrackingText}>{'GPS \uBC31\uADF8\uB77C\uC6B4\uB4DC \uCD94\uC801 \uC911'}</Text>
          </View>
        )}
      </View>

      {/* Camera button - top right */}
      {state === 'walking' && (
        <TouchableOpacity
          style={[styles.cameraBtn, { top: insets.top + 12 }]}
          onPress={handleTakePhoto}
          activeOpacity={0.8}>
          <Text style={styles.cameraBtnIcon}>{'\u{1F4F7}'}</Text>
        </TouchableOpacity>
      )}
      {taggedPhotos.length > 0 && (
        <View style={[styles.photoBadge, { top: insets.top + 10 }]}>
          <Text style={styles.photoBadgeText}>{taggedPhotos.length}</Text>
        </View>
      )}

      {/* Main stats area */}
      <ScrollView
        style={styles.statsScroll}
        contentContainerStyle={styles.statsScrollContent}
        showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.fullScreenStats, { opacity: stats.isAutoPaused ? autoPausePulse : 1 }]}>
          {/* Big distance */}
          <View style={styles.distanceRow}>
            <Text style={styles.distanceBig}>{stats.distance.toFixed(2)}</Text>
            <Text style={styles.distanceUnit}>km</Text>
          </View>

          {/* Current pace - highlighted */}
          <View style={styles.currentPaceContainer}>
            <Text style={styles.currentPaceLabel}>{'\uD604\uC7AC \uD398\uC774\uC2A4'}</Text>
            <Text style={styles.currentPaceValue}>{formatPace(stats.currentPace)}</Text>
            <Text style={styles.currentPaceUnit}>/km</Text>
          </View>

          {/* 4-column stats grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.steps.toLocaleString()}</Text>
              <Text style={styles.statLabel}>{'\uAC78\uC74C'}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.calories}</Text>
              <Text style={styles.statLabel}>{'\uCE7C\uB85C\uB9AC'}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {stats.elevationGain > 0 ? `+${stats.elevationGain}` : '0'}m
              </Text>
              <Text style={styles.statLabel}>{'\uACE0\uB3C4'}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.speed.toFixed(1)}</Text>
              <Text style={styles.statLabel}>km/h</Text>
            </View>
          </View>

          {/* Secondary stats row */}
          <View style={styles.secondaryStatsRow}>
            <View style={styles.secondaryStat}>
              <Text style={styles.secondaryStatValue}>{formatPace(stats.pace)}</Text>
              <Text style={styles.secondaryStatLabel}>{'\uD3C9\uADE0 \uD398\uC774\uC2A4'}</Text>
            </View>
            <View style={styles.secondaryStatDivider} />
            <View style={styles.secondaryStat}>
              <Text style={styles.secondaryStatValue}>{stats.cadence}</Text>
              <Text style={styles.secondaryStatLabel}>{'\uCF00\uC774\uB358\uC2A4'}</Text>
            </View>
            <View style={styles.secondaryStatDivider} />
            <View style={styles.secondaryStat}>
              <Text style={styles.secondaryStatValue}>{stats.maxSpeed.toFixed(1)}</Text>
              <Text style={styles.secondaryStatLabel}>{'\uCD5C\uACE0 km/h'}</Text>
            </View>
          </View>

          {/* Km Splits */}
          {stats.splits.length > 0 && (
            <View style={styles.splitsContainer}>
              <Text style={styles.splitsTitle}>{'\uAD6C\uAC04 \uAE30\uB85D'}</Text>
              {stats.splits.map((split: KmSplit) => (
                <View key={split.km} style={styles.splitRow}>
                  <Text style={styles.splitKm}>{split.km}km</Text>
                  <Text style={styles.splitPace}>{formatPace(split.pace)}</Text>
                  {split.elevationGain > 0 && (
                    <Text style={styles.splitEle}>
                      {'\u2191'}{Math.round(split.elevationGain)}m
                    </Text>
                  )}
                  {split.elevationLoss > 0 && (
                    <Text style={styles.splitEleLoss}>
                      {'\u2193'}{Math.round(split.elevationLoss)}m
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Auto-pause indicator */}
      {stats.isAutoPaused && state === 'walking' && (
        <View style={styles.autoPauseIndicator}>
          <Animated.View style={[styles.autoPauseDot, { opacity: autoPausePulse }]} />
          <Text style={styles.autoPauseText}>{'\uC790\uB3D9 \uC77C\uC2DC\uC815\uC9C0'}</Text>
        </View>
      )}

      {/* Controls at bottom */}
      <View style={[styles.controlsArea, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.controlsRow}>
          {state === 'walking' ? (
            <TouchableOpacity
              style={styles.pauseBtn}
              onPress={pauseWalk}
              activeOpacity={0.85}>
              <View style={styles.pauseIconContainer}>
                <View style={styles.pauseBar} />
                <View style={styles.pauseBar} />
              </View>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.stopBtn}
                onPress={handleStop}
                activeOpacity={0.85}>
                <View style={styles.stopIcon} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resumeBtn}
                onPress={resumeWalk}
                activeOpacity={0.85}>
                <View style={styles.playIcon} />
              </TouchableOpacity>
              <View style={{ width: 60 }} />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ---- READY STATE ----
  readyContainer: {
    flex: 1,
    backgroundColor: '#0d1a0e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyBack: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },
  readyBackText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  gpsStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 40,
    gap: 8,
  },
  gpsStatusReady: {
    backgroundColor: 'rgba(74,222,128,0.2)',
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FACC15',
  },
  gpsDotReady: {
    backgroundColor: '#4ADE80',
  },
  gpsText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  gpsTextReady: {
    color: '#4ADE80',
  },
  brandText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 3,
    marginBottom: 64,
  },
  startBtn: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  startBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  pulseRing: {
    position: 'absolute',
    width: 172,
    height: 172,
    borderRadius: 86,
    borderWidth: 1,
    borderColor: 'rgba(168,230,207,0.15)',
    alignSelf: 'center',
    top: '50%',
    marginTop: -86 + 70 - 64 + 20,
  },
  hintText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 48,
  },

  // ---- WALKING / PAUSED STATE ----
  walkContainer: {
    flex: 1,
    backgroundColor: '#0d1a0e',
  },
  statusBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotLive: {
    backgroundColor: '#4ADE80',
  },
  statusDotPaused: {
    backgroundColor: '#FACC15',
  },
  statusDotAutoPaused: {
    backgroundColor: '#F97316',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  statusTimer: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    fontVariant: ['tabular-nums'],
  },
  statsScroll: {
    flex: 1,
    marginTop: 80,
  },
  statsScrollContent: {
    paddingBottom: 24,
  },
  fullScreenStats: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 4,
  },
  distanceBig: {
    fontSize: 72,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -2,
  },
  distanceUnit: {
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    marginLeft: 6,
  },
  currentPaceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 32,
    gap: 6,
  },
  currentPaceLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginRight: 4,
  },
  currentPaceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.accent,
  },
  currentPaceUnit: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  secondaryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  secondaryStat: {
    flex: 1,
    alignItems: 'center',
  },
  secondaryStatValue: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  secondaryStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
  },
  secondaryStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  splitsContainer: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
  },
  splitsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
    letterSpacing: 1,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  splitKm: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    width: 40,
  },
  splitPace: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accent,
    flex: 1,
  },
  splitEle: {
    fontSize: 12,
    color: '#4ADE80',
  },
  splitEleLoss: {
    fontSize: 12,
    color: '#F97316',
  },
  autoPauseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  autoPauseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F97316',
  },
  autoPauseText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#F97316',
  },
  controlsArea: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  pauseBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseIconContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  pauseBar: {
    width: 6,
    height: 22,
    borderRadius: 3,
    backgroundColor: '#111',
  },
  stopBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIcon: {
    width: 20,
    height: 20,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  resumeBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 18,
    borderTopWidth: 12,
    borderBottomWidth: 12,
    borderLeftColor: '#fff',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 4,
  },
  bgTrackingPill: {
    backgroundColor: 'rgba(74,222,128,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 6,
  },
  bgTrackingText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#4ADE80',
  },
  cameraBtn: {
    position: 'absolute',
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  cameraBtnIcon: {
    fontSize: 20,
  },
  photoBadge: {
    position: 'absolute',
    right: 16,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
  },
  photoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
});
