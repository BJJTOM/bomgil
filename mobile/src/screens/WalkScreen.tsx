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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Geolocation from 'react-native-geolocation-service';
import { colors } from '../theme/colors';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';

const { width } = Dimensions.get('window');

interface LocationPoint {
  lat: number;
  lng: number;
  time: string;
}

export default function WalkScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isAuthenticated } = useAuthStore();
  const trailId = route.params?.trailId;

  const [status, setStatus] = useState<'idle' | 'tracking' | 'paused'>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distance, setDistance] = useState(0);
  const [locations, setLocations] = useState<LocationPoint[]>([]);
  const [steps, setSteps] = useState(0);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<Date | null>(null);

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

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const startTracking = useCallback(async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) {
      Alert.alert(
        '\uC704\uCE58 \uAD8C\uD55C',
        '\uAC77\uAE30 \uCD94\uC801\uC744 \uC704\uD574 \uC704\uCE58 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4',
      );
      return;
    }

    startTimeRef.current = new Date();
    setStatus('tracking');

    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    watchIdRef.current = Geolocation.watchPosition(
      (position) => {
        const newPoint: LocationPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          time: new Date().toISOString(),
        };

        setLocations((prev) => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const d = calculateDistance(
              last.lat,
              last.lng,
              newPoint.lat,
              newPoint.lng,
            );
            setDistance((prevDist) => prevDist + d);
          }
          return [...prev, newPoint];
        });

        // Estimate steps from distance (~1300 steps per km)
        setSteps((prev) => prev + 5);
      },
      (error) => {
        console.warn('Location error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10,
        interval: 5000,
        fastestInterval: 3000,
      },
    );
  }, []);

  const pauseTracking = () => {
    setStatus('paused');
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const resumeTracking = () => {
    setStatus('tracking');
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    watchIdRef.current = Geolocation.watchPosition(
      (position) => {
        const newPoint: LocationPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          time: new Date().toISOString(),
        };
        setLocations((prev) => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const d = calculateDistance(
              last.lat,
              last.lng,
              newPoint.lat,
              newPoint.lng,
            );
            setDistance((prevDist) => prevDist + d);
          }
          return [...prev, newPoint];
        });
        setSteps((prev) => prev + 5);
      },
      () => {},
      {
        enableHighAccuracy: true,
        distanceFilter: 10,
        interval: 5000,
        fastestInterval: 3000,
      },
    );
  };

  const stopTracking = async () => {
    pauseTracking();

    const durationMinutes = Math.round(elapsedSeconds / 60);
    const calories = Math.round(distance * 60);

    if (isAuthenticated && locations.length > 0) {
      try {
        await api.post('/activities/', {
          trail: trailId || null,
          source: 'phone_gps',
          title: trailId
            ? `${route.params?.trail?.title || '\uCF54\uC2A4'} \uAC77\uAE30`
            : '\uC790\uC720 \uAC77\uAE30',
          started_at: startTimeRef.current?.toISOString(),
          finished_at: new Date().toISOString(),
          total_steps: steps,
          distance_km: distance.toFixed(2),
          duration_minutes: durationMinutes,
          calories_burned: calories,
          track_points: locations.map((l) => ({
            lat: l.lat,
            lng: l.lng,
            ele: null,
            time: l.time,
          })),
        });
      } catch (err) {
        console.warn('Failed to save activity:', err);
      }
    }

    navigation.replace('WalkComplete', {
      distance: distance.toFixed(2),
      duration: durationMinutes,
      steps,
      calories,
    });
  };

  const handleStop = () => {
    Alert.alert('\uAC77\uAE30 \uC885\uB8CC', '\uAC77\uAE30\uB97C \uC885\uB8CC\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?', [
      { text: '\uCDE8\uC18C', style: 'cancel' },
      { text: '\uC885\uB8CC', style: 'destructive', onPress: stopTracking },
    ]);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (watchIdRef.current !== null)
        Geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const pace =
    distance > 0.01
      ? (elapsedSeconds / 60 / distance).toFixed(1)
      : '0.0';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerBack}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {status === 'idle' ? '\uAC77\uAE30 \uC900\uBE44' : '\uAC77\uAE30 \uC911'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Map placeholder */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          {locations.length > 0 ? (
            <Text style={styles.mapCoords}>
              {locations[locations.length - 1].lat.toFixed(5)},{' '}
              {locations[locations.length - 1].lng.toFixed(5)}
            </Text>
          ) : (
            <Text style={styles.mapText}>{'\uD83D\uDDFA\uFE0F \uC9C0\uB3C4'}</Text>
          )}
          {status === 'tracking' && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.timerRow}>
          <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{distance.toFixed(2)}</Text>
            <Text style={styles.statLabel}>km</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{pace}</Text>
            <Text style={styles.statLabel}>{'\uBD84/km \uD398\uC774\uC2A4'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {steps.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>{'\uAC78\uC74C'}</Text>
          </View>
        </View>
      </View>

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
        {status === 'idle' && (
          <TouchableOpacity
            style={styles.startBtn}
            onPress={startTracking}>
            <Text style={styles.startBtnText}>{'\uC2DC\uC791'}</Text>
          </TouchableOpacity>
        )}

        {status === 'tracking' && (
          <View style={styles.controlRow}>
            <TouchableOpacity
              style={styles.pauseBtn}
              onPress={pauseTracking}>
              <Text style={styles.pauseBtnText}>{'\u23F8'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
              <Text style={styles.stopBtnText}>{'\u25A0'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'paused' && (
          <View style={styles.controlRow}>
            <TouchableOpacity
              style={styles.resumeBtn}
              onPress={resumeTracking}>
              <Text style={styles.resumeBtnText}>{'\u25B6'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
              <Text style={styles.stopBtnText}>{'\u25A0'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBack: {
    fontSize: 24,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  mapContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapText: {
    fontSize: 48,
  },
  mapCoords: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  liveIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244,67,54,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F44336',
    marginRight: 6,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F44336',
  },
  statsContainer: {
    paddingHorizontal: 20,
  },
  timerRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  timerText: {
    fontSize: 48,
    fontWeight: '200',
    color: colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.bgSecondary,
    borderRadius: 16,
    padding: 20,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.borderDefault,
  },
  controls: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  startBtn: {
    backgroundColor: colors.primary,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  pauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF9800',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseBtnText: {
    fontSize: 24,
    color: '#fff',
  },
  resumeBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeBtnText: {
    fontSize: 24,
    color: '#fff',
  },
  stopBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtnText: {
    fontSize: 24,
    color: '#fff',
  },
});
