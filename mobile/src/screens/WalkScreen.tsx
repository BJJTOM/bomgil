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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Geolocation from 'react-native-geolocation-service';
import { colors } from '../theme/colors';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';

const { width, height } = Dimensions.get('window');

interface LocationPoint {
  lat: number;
  lng: number;
  ele: number | null;
  time: string;
}

type WalkState = 'ready' | 'walking' | 'paused';

export default function WalkScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isAuthenticated } = useAuthStore();
  const trailId = route.params?.trailId;

  const [state, setState] = useState<WalkState>('ready');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distance, setDistance] = useState(0);
  const [locations, setLocations] = useState<LocationPoint[]>([]);
  const [gpsReady, setGpsReady] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  // Pulse animation for start button
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

  const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

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

  const startWalk = useCallback(() => {
    setState('walking');
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setElapsedSeconds(
        Math.floor((Date.now() - startTimeRef.current + pausedTimeRef.current) / 1000),
      );
    }, 1000);

    watchIdRef.current = Geolocation.watchPosition(
      (position) => {
        const point: LocationPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          ele: position.coords.altitude,
          time: new Date().toISOString(),
        };
        setLocations((prev) => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const d = haversine(last.lat, last.lng, point.lat, point.lng);
            if (d > 0.003) {
              setDistance((prevDist) => prevDist + d);
              return [...prev, point];
            }
            return prev;
          }
          return [...prev, point];
        });
      },
      (error) => console.warn('GPS error:', error),
      { enableHighAccuracy: true, distanceFilter: 10, interval: 5000, fastestInterval: 3000 },
    );
  }, []);

  const pauseWalk = () => {
    setState('paused');
    pausedTimeRef.current += Date.now() - startTimeRef.current;
    if (timerRef.current) clearInterval(timerRef.current);
    if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current);
  };

  const resumeWalk = () => {
    setState('walking');
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(
        Math.floor((Date.now() - startTimeRef.current + pausedTimeRef.current) / 1000),
      );
    }, 1000);
    watchIdRef.current = Geolocation.watchPosition(
      (position) => {
        const point: LocationPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          ele: position.coords.altitude,
          time: new Date().toISOString(),
        };
        setLocations((prev) => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const d = haversine(last.lat, last.lng, point.lat, point.lng);
            if (d > 0.003) {
              setDistance((prevDist) => prevDist + d);
              return [...prev, point];
            }
            return prev;
          }
          return [...prev, point];
        });
      },
      () => {},
      { enableHighAccuracy: true, distanceFilter: 10, interval: 5000, fastestInterval: 3000 },
    );
  };

  const completeWalk = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current);

    const steps = Math.round(distance * 1300);
    const calories = Math.round(distance * 65);

    if (isAuthenticated && locations.length > 0) {
      try {
        const dateLabel = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
        await api.post('/activities/', {
          trail: trailId || null,
          source: 'phone_gps',
          title: `${dateLabel} \uAC77\uAE30`,
          started_at: new Date(Date.now() - elapsedSeconds * 1000).toISOString(),
          finished_at: new Date().toISOString(),
          total_steps: steps,
          distance_km: distance.toFixed(2),
          duration_minutes: Math.round(elapsedSeconds / 60),
          calories_burned: calories,
          track_points: locations,
        });
      } catch (err) {
        console.warn('Failed to save activity:', err);
      }
    }

    navigation.replace('WalkComplete', {
      distance: distance.toFixed(2),
      duration: elapsedSeconds,
      steps,
      calories,
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

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const pace = elapsedSeconds > 0 && distance > 0.01 ? elapsedSeconds / 60 / distance : 0;
  const paceMin = Math.floor(pace);
  const paceSec = Math.round((pace - paceMin) * 60);

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

        {/* Pulse ring effect (static outer ring) */}
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
      <StatusBar barStyle="light-content" backgroundColor="#1a3a1b" />
      {/* Status indicator */}
      <View style={[styles.statusBar, { top: insets.top + 12 }]}>
        <View style={styles.statusPill}>
          <View
            style={[
              styles.statusDot,
              state === 'walking' ? styles.statusDotLive : styles.statusDotPaused,
            ]}
          />
          <Text style={styles.statusText}>
            {state === 'walking' ? '\uAE30\uB85D \uC911' : '\uC77C\uC2DC\uC815\uC9C0'}
          </Text>
        </View>
      </View>

      {/* Main content area (map placeholder) */}
      <View style={styles.walkMapArea}>
        <Text style={styles.walkMapEmoji}>{'\u{1F5FA}\uFE0F'}</Text>
      </View>

      {/* Bottom stats panel */}
      <View style={[styles.statsPanel, { paddingBottom: insets.bottom + 20 }]}>
        {/* Big distance */}
        <View style={styles.distanceRow}>
          <Text style={styles.distanceBig}>{distance.toFixed(2)}</Text>
          <Text style={styles.distanceUnit}>km</Text>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatTime(elapsedSeconds)}</Text>
            <Text style={styles.statLabel}>{'\uC2DC\uAC04'}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.accent }]}>
              {pace > 0
                ? `${paceMin}'${String(paceSec).padStart(2, '0')}"`
                : "--'--\""}
            </Text>
            <Text style={styles.statLabel}>{'\uD398\uC774\uC2A4'}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{Math.round(distance * 65)}</Text>
            <Text style={styles.statLabel}>kcal</Text>
          </View>
        </View>

        {/* Controls */}
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
    // Centered on the start button
    top: '50%',
    marginTop: -86 + 70 - 64 + 20, // rough center offset
  },
  hintText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 48,
  },

  // ---- WALKING / PAUSED STATE ----
  walkContainer: {
    flex: 1,
    backgroundColor: '#111',
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
  statusText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  walkMapArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
  },
  walkMapEmoji: {
    fontSize: 64,
    opacity: 0.2,
  },
  statsPanel: {
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 20,
  },
  distanceBig: {
    fontSize: 56,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
  },
  distanceUnit: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    marginLeft: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
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
});
