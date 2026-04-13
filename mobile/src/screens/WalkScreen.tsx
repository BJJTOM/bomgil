import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  PermissionsAndroid,
  Animated,
  StatusBar,
  AppState,
  Dimensions,
  TextInput,
  Alert,
  BackHandler,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';

import Geolocation from '@react-native-community/geolocation';
import Mapbox from '@rnmapbox/maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';
import { takeTaggedPhoto, TaggedPhoto } from '../utils/photoTagger';
import { WalkEngine, WalkStats, KmSplit } from '../utils/walkEngine';
import { navParamCache } from '../utils/navParamCache';
import { OffRouteDetector } from '../utils/offRouteDetector';
import {
  startBackgroundWalkService,
  stopBackgroundWalkService,
  updateBackgroundWalkNotification,
} from '../utils/backgroundWalkService';
import GpsSignalIndicator from '../components/GpsSignalIndicator';
import {
  startStepCounter,
  stopStepCounter,
  subscribeToSteps,
  StepSubscription,
} from '../utils/nativeStepCounter';
import { WalkAudioFeedback } from '../utils/audioFeedback';
import { fetchWeatherAt, CurrentWeather } from '../utils/weather';
import { startBarometer, stopBarometer, subscribeToBarometer } from '../utils/barometer';

const { width: SW, height: SH } = Dimensions.get('window');

type WalkState = 'countdown' | 'walking' | 'paused';

const SPOT_TYPES = [
  { value: '맛집', color: '#D85A30' },
  { value: '카페', color: '#378ADD' },
  { value: '포토', color: '#7F77DD' },
  { value: '휴식', color: '#888780' },
  { value: '전망', color: '#EF9F27' },
];

interface WalkSpot {
  name: string;
  type: string;
  description: string;
  lat: number;
  lng: number;
}

function formatPace(pace: number): string {
  if (pace <= 0 || pace > 30) return "--'--\"";
  const min = Math.floor(pace);
  const sec = Math.round((pace - min) * 60);
  return `${min}'${sec.toString().padStart(2, '0')}"`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function WalkScreenInner() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isAuthenticated } = useAuthStore();
  const trailId = route.params?.trailId;

  // Configure Geolocation on mount (not at module import time).
  // Setting `enableBackgroundLocationUpdates: true` at module scope runs
  // every time WalkScreen is imported — including fast refresh — which can
  // register a background location listener before the user grants
  // permission and wastes battery.
  useEffect(() => {
    try {
      Geolocation.setRNConfiguration({
        skipPermissionRequests: false,
        authorizationLevel: 'always',
        enableBackgroundLocationUpdates: true,
        locationProvider: 'auto',
      });
    } catch {}
  }, []);

  const [state, setState] = useState<WalkState>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [stats, setStats] = useState<WalkStats>({
    distance: 0, duration: 0, totalTime: 0, pace: 0, currentPace: 0,
    speed: 0, steps: 0, cadence: 0, calories: 0,
    elevationGain: 0, elevationLoss: 0, maxElevation: 0, minElevation: 0,
    maxSpeed: 0, splits: [], isAutoPaused: false,
    gpsHealthy: true, usingSensorFallback: false, barometerActive: false,
  });
  // GPS signal tracking — latest accuracy (meters) + staleness timestamp.
  // Used to render the top-of-map signal bars. gpsStartedAt marks when
  // the GPS subscription was kicked off so the indicator can show a
  // blue "찾는 중" pulse during the initial cold-start grace window
  // instead of jumping straight to red "GPS 없음".
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsLastFixAt, setGpsLastFixAt] = useState<number>(0);
  const [gpsStartedAt, setGpsStartedAt] = useState<number>(0);
  const [taggedPhotos, setTaggedPhotos] = useState<TaggedPhoto[]>([]);
  const [isBackground, setIsBackground] = useState(false);
  const [currentPos, setCurrentPos] = useState<{lat: number; lng: number} | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [showStopModal, setShowStopModal] = useState(false);
  // When true, the Mapbox MapView is dropped from the tree so its native
  // view releases cleanly BEFORE we navigate away. Without this, Android
  // 15 can crash in the Mapbox native layer during screen transition on
  // some Samsung devices.
  const [isCompleting, setIsCompleting] = useState(false);
  const [spots, setSpots] = useState<WalkSpot[]>([]);
  const [showSpotModal, setShowSpotModal] = useState(false);
  const [showRecordSummary, setShowRecordSummary] = useState(false);
  const [editingSpotIdx, setEditingSpotIdx] = useState<number | null>(null);
  const [recordPhotoViewer, setRecordPhotoViewer] = useState<{ visible: boolean; index: number }>({ visible: false, index: 0 });
  const [spotName, setSpotName] = useState('');
  const [spotType, setSpotType] = useState('맛집');
  const [spotDesc, setSpotDesc] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState<any>(null);
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoDesc, setPhotoDesc] = useState('');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const fromTrailCreate = route.params?.fromTrailCreate;
  // resumeData can come either directly (legacy paused-walk flow) or via
  // an in-memory nav cache key (new: avoids TransactionTooLargeException
  // when the previous walk had a lot of track points).
  const resumeData = React.useMemo(() => {
    const direct = route.params?.resumeData;
    if (direct) return direct;
    const cacheKey = route.params?._resumeCacheKey;
    if (cacheKey) {
      const cached = navParamCache.take<{ resumeData: any }>(cacheKey);
      return cached?.resumeData;
    }
    return undefined;
  }, [route.params]);

  // Previous segment totals (for resume display)
  const [prevSegment, setPrevSegment] = useState<{ distance: number; duration: number; steps: number; calories: number } | null>(null);
  // Previous segments' trackPoints saved during resume so they can be merged on completion
  const prevTrackPointsRef = useRef<any[]>([]);

  // Off-route detector — lazily initialized the first time we see
  // the followed trail's path_data arrive. Non-null when a trail is
  // being followed and its path_data has been parsed.
  const offRouteRef = useRef<OffRouteDetector | null>(null);
  const [offRoute, setOffRoute] = useState(false);

  // Build the detector if route.params.trail.path_data is available.
  // Also handles the case where only trailId was passed — in that case
  // we skip off-route detection (no path to compare against).
  useEffect(() => {
    const trail = route.params?.trail;
    const pathData = trail?.path_data;
    if (!pathData || !Array.isArray(pathData?.coordinates)) return;
    if (pathData.coordinates.length < 2) return;
    offRouteRef.current = new OffRouteDetector(pathData.coordinates);
  }, [route.params?.trail]);

  const engineRef = useRef(new WalkEngine());
  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraRef = useRef<any>(null);

  const periodicSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bgSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepSubRef = useRef<StepSubscription | null>(null);
  const baroSubRef = useRef<{ remove: () => void } | null>(null);
  const audioFeedbackRef = useRef(new WalkAudioFeedback('ko'));
  const lastAnnouncedKmRef = useRef(0);
  const weatherRef = useRef<CurrentWeather | null>(null);
  // Set true once we successfully kick off the weather fetch so the
  // GPS watch callback below knows not to fire it again.
  const weatherFetchedRef = useRef(false);
  // Refs that mirror state for any background timers / async tasks that
  // need the latest GPS fix without re-triggering React re-renders.
  const currentPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const gpsAccuracyRef = useRef<number | null>(null);
  const photoBusyRef = useRef(false);
  const spotBusyRef = useRef(false);

  const countdownScale = useRef(new Animated.Value(1)).current;
  const countdownOpacity = useRef(new Animated.Value(1)).current;
  const autoPausePulse = useRef(new Animated.Value(1)).current;

  // ---- RESUME from paused walk ----
  useEffect(() => {
    if (!resumeData) return;

    const doResume = async () => {
      // Request GPS permission first
      if (Platform.OS === 'android') {
        try {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        } catch {}
      }

      // Restore previous data
      const segments = resumeData.segments || [];
      const prevCoords: [number, number][] = [];
      const prevTp: any[] = [];
      let prevDistance = 0, prevSteps = 0, prevCalories = 0, prevDuration = 0, prevElevation = 0;
      for (const seg of segments) {
        if (seg.routeCoords) prevCoords.push(...seg.routeCoords);
        if (seg.trackPoints) prevTp.push(...seg.trackPoints);
        prevDistance += seg.distance || 0;
        prevSteps += seg.steps || 0;
        prevCalories += seg.calories || 0;
        prevDuration += seg.duration || 0;
        prevElevation += seg.elevationGain || 0;
      }
      prevTrackPointsRef.current = prevTp;
      console.log(`[Moru] Resume: ${prevCoords.length} routeCoords, ${prevTp.length} trackPoints, ${segments.length} segments`);
      setRouteCoords(prevCoords);
      setSpots(resumeData.spots || []);
      setTaggedPhotos(resumeData.taggedPhotos || []);

      // Set initial map position from last known coord
      if (prevCoords.length > 0) {
        const lastCoord = prevCoords[prevCoords.length - 1];
        setCurrentPos({ lat: lastCoord[1], lng: lastCoord[0] });
      }

      // Save previous segment for display
      setPrevSegment({ distance: prevDistance, duration: prevDuration, steps: prevSteps, calories: prevCalories });

      // Set engine offset for cumulative stats
      engineRef.current.setOffset(prevDistance, prevSteps, prevCalories, prevDuration, prevElevation);

      // Skip countdown, start immediately
      setState('walking');
      engineRef.current.start();
      timerRef.current = setInterval(() => {
        const s = engineRef.current.getStats();
        if (!isBackgroundRef.current) setStats(s);
        updateBackgroundWalkNotification({
          distance: s.distance, duration: s.duration,
          steps: s.steps, pace: s.pace, isAutoPaused: s.isAutoPaused,
        });
      }, 1000);
      // Start FGS before GPS so background tracking works on the resumed segment too
      startBackgroundWalkService().catch(() => {});
      startGps();
      // Step counter for indoor fallback
      startStepCounter().then((ok) => {
        if (ok) {
          stepSubRef.current = subscribeToSteps((steps) => {
            engineRef.current.updateFromSensorSteps(steps);
          });
        }
      }).catch(() => {});

      // Clean up paused data
      AsyncStorage.removeItem('walk_paused').catch(() => {});
    };

    doResume();
    // Resume effect intentionally runs exactly once per screen mount.
    // resumeData is captured from the first render and never changes
    // during the lifetime of this screen — re-running would reset the
    // engine offsets and double-count distance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- COUNTDOWN ----
  useEffect(() => {
    if (state !== 'countdown') return;
    if (resumeData) return; // skip countdown if resuming
    if (Platform.OS === 'android') {
      (async () => {
        try {
          // Step 1: foreground fine location (blocking request)
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
          // Step 2: background location. Android 11+ surfaces a separate
          // system dialog ("Allow all the time") that the user has to
          // accept for FGS location tracking to continue while the screen
          // is off. Without this the foreground service starts fine but
          // GPS updates go silent the moment the user locks the phone.
          const bgPerm = (PermissionsAndroid.PERMISSIONS as any)
            .ACCESS_BACKGROUND_LOCATION;
          if (bgPerm) {
            const already = await PermissionsAndroid.check(bgPerm);
            if (!already) {
              await PermissionsAndroid.request(bgPerm);
            }
          }
        } catch {}
      })();
    }
    Geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentPos(p);
        // Record start position as first route point
        setRouteCoords([[p.lng, p.lat]]);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 },
    );
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); startWalk(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [state]);

  useEffect(() => {
    if (state !== 'countdown') return;
    countdownScale.setValue(0.3);
    countdownOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(countdownScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 10 }),
      Animated.timing(countdownOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [countdown]);

  useEffect(() => {
    if (stats.isAutoPaused) {
      const pulse = Animated.loop(Animated.sequence([
        Animated.timing(autoPausePulse, { toValue: 0.5, duration: 800, useNativeDriver: true }),
        Animated.timing(autoPausePulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]));
      pulse.start();
      return () => pulse.stop();
    } else { autoPausePulse.setValue(1); }
  }, [stats.isAutoPaused]);

  // Save current walk state to AsyncStorage for crash protection.
  //
  // CRITICAL for 10+ hour / 50+ km walks:
  // At 1 GPS fix/second × 10 hours = 36,000 trackPoints × ~80 bytes
  // = ~2.9 MB. Android AsyncStorage has a ~2 MB per-entry limit.
  // Exceeding this SILENTLY FAILS → all data lost on crash.
  //
  // Fix: Save only routeCoords (lightweight [lng,lat] pairs ~16 bytes each)
  // + stats summary + spots/photos. Full trackPoints are NOT saved in
  // periodic recovery — they're only saved on walk completion via
  // `activity_latest_extra` (which downsamples to 5000 points).
  //
  // This keeps the recovery blob under 800 KB even for 50 km walks.
  // On crash recovery, the user gets: distance, time, steps, calories,
  // route line on map, spots, photos — everything except the per-second
  // track points (which are only used for elevation chart + GPX export).
  const saveWalkState = useCallback(async () => {
    try {
      const currentStats = engineRef.current.getStats();
      // Downsample routeCoords if too large (>10,000 points → keep every Nth)
      let safeRouteCoords = routeCoords;
      if (safeRouteCoords.length > 10000) {
        const stride = Math.ceil(safeRouteCoords.length / 10000);
        safeRouteCoords = safeRouteCoords.filter((_, i) => i % stride === 0);
      }
      const data = JSON.stringify({
        version: 2, // schema version for forward compatibility
        stats: currentStats,
        routeCoords: safeRouteCoords,
        // trackPoints intentionally OMITTED — too large for AsyncStorage.
        // Full track saved only on completion via activity_latest_extra.
        spots,
        taggedPhotos,
        timestamp: Date.now(),
      });
      await AsyncStorage.setItem('walk_in_progress', data);
    } catch (e) {
      // Log instead of silently swallowing — helps diagnose save failures
      console.log('[Moru] saveWalkState failed:', e);
    }
  }, [routeCoords, spots, taggedPhotos]);

  // Track background state via ref (for GPS callback to read without re-render)
  const isBackgroundRef = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      const bg = s === 'background';
      setIsBackground(bg);
      isBackgroundRef.current = bg;

      if (bg && state === 'walking') {
        // Save immediately when going to background
        saveWalkState();
        // Then save every 30 seconds while in background
        bgSaveRef.current = setInterval(() => saveWalkState(), 30000);

        // Battery optimization: reduce GPS when screen off.
        // BUT: if user enabled high-accuracy mode, keep 1Hz always.
        // High-accuracy mode is stored in a ref set from settings.
        if (gpsModeRef.current === 'fast' && !highAccuracyRef.current) {
          gpsModeRef.current = 'slow';
          try { if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current); } catch {}
          createGpsWatchRef.current?.('slow');
        }
      }
      if (s === 'active') {
        // Clear background save timer
        if (bgSaveRef.current) {
          clearInterval(bgSaveRef.current);
          bgSaveRef.current = null;
        }
        // --- BATTERY OPTIMIZATION: Restore fast GPS when screen on ---
        if (state === 'walking' && !engineRef.current.getStats().isAutoPaused) {
          gpsModeRef.current = 'fast';
          try { if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current); } catch {}
          createGpsWatchRef.current?.('fast');
        }
        // Force stats and route update
        setStats(engineRef.current.getStats());
      }
    });
    return () => {
      sub.remove();
      if (bgSaveRef.current) clearInterval(bgSaveRef.current);
    };
  }, [state, saveWalkState]);

  // Periodic crash protection save every 60 seconds during walk
  useEffect(() => {
    if (state === 'walking') {
      // Save every 30s (was 60s). For a 10-hour walk, worst case data
      // loss on crash is 30 seconds instead of 60. The save is lightweight
      // (~500KB) so 30s interval is safe for flash wear.
      periodicSaveRef.current = setInterval(() => saveWalkState(), 30000);
    } else {
      if (periodicSaveRef.current) {
        clearInterval(periodicSaveRef.current);
        periodicSaveRef.current = null;
      }
    }
    return () => {
      if (periodicSaveRef.current) clearInterval(periodicSaveRef.current);
    };
  }, [state, saveWalkState]);

  // Check for unsaved walk data on mount (crash recovery)
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('walk_in_progress');
        if (saved) {
          const data = JSON.parse(saved);
          const ageMinutes = (Date.now() - data.timestamp) / 60000;
          // Offer recovery for up to 24 hours. Previously 2 hours — but
          // long walks (10hr+) or overnight pauses would lose all data.
          // For a trip walker doing 50km/day, 24h is essential.
          if (ageMinutes < 1440 && data.stats?.distance > 0.05) {
            Alert.alert(
              '이전 걷기 기록 발견',
              `${data.stats.distance.toFixed(2)}km, ${Math.round(data.stats.duration / 60)}분 기록이 있습니다.\n복구하시겠습니까?`,
              [
                {
                  text: '삭제',
                  style: 'destructive',
                  onPress: () => AsyncStorage.removeItem('walk_in_progress').catch(() => {}),
                },
                {
                  text: '복구',
                  onPress: () => {
                    if (data.routeCoords?.length > 0) {
                      setRouteCoords(data.routeCoords);
                    }
                    if (data.spots?.length > 0) {
                      setSpots(data.spots);
                    }
                    if (data.taggedPhotos?.length > 0) {
                      setTaggedPhotos(data.taggedPhotos);
                    }
                    AsyncStorage.removeItem('walk_in_progress').catch(() => {});
                  },
                },
              ],
            );
          } else {
            // Data too old, clean up
            await AsyncStorage.removeItem('walk_in_progress');
          }
        }
      } catch {}
    })();
  }, []);

  const handleTakePhoto = useCallback(async () => {
    if (!currentPos) return;
    if (photoBusyRef.current) return; // prevent rapid double-tap
    photoBusyRef.current = true;
    try {
      const photo = await takeTaggedPhoto(currentPos.lat, currentPos.lng);
      if (photo) {
        setPendingPhoto(photo);
        setPhotoTitle('');
        setPhotoDesc('');
        setShowPhotoModal(true);
      }
    } catch {} finally {
      photoBusyRef.current = false;
    }
  }, [currentPos]);

  const openSpotModal = useCallback(() => {
    if (spotBusyRef.current) return;
    spotBusyRef.current = true;
    setShowSpotModal(true);
    setTimeout(() => { spotBusyRef.current = false; }, 400);
  }, []);

  const openRecordSummary = useCallback(() => {
    setShowRecordSummary(true);
  }, []);

  const confirmPhoto = useCallback(() => {
    if (pendingPhoto) {
      setTaggedPhotos(prev => [...prev, {
        ...pendingPhoto,
        title: photoTitle.trim(),
        description: photoDesc.trim(),
      }]);
    }
    setPendingPhoto(null);
    setPhotoTitle('');
    setPhotoDesc('');
    setShowPhotoModal(false);
  }, [pendingPhoto, photoTitle, photoDesc]);

  const handleAddSpot = useCallback(() => {
    if (!spotName.trim()) {
      Alert.alert('필수 입력', '장소 이름을 입력해주세요.');
      return;
    }
    if (editingSpotIdx !== null) {
      // Edit existing spot
      setSpots(prev => prev.map((s, i) => i === editingSpotIdx ? {
        ...s, name: spotName.trim(), type: spotType, description: spotDesc.trim(),
      } : s));
      setEditingSpotIdx(null);
    } else {
      if (!currentPos) {
        Alert.alert('위치 오류', 'GPS 위치를 가져올 수 없습니다.');
        return;
      }
      setSpots(prev => [...prev, {
        name: spotName.trim(),
        type: spotType,
        description: spotDesc.trim(),
        lat: currentPos.lat,
        lng: currentPos.lng,
      }]);
    }
    setSpotName('');
    setSpotType('맛집');
    setSpotDesc('');
    setEditingSpotIdx(null);
    setShowSpotModal(false);
  }, [spotName, spotType, spotDesc, currentPos, editingSpotIdx]);

  // GPS mode: 'fast' = 1 Hz (walking), 'slow' = 2s bg (auto-paused, saves battery)
  const gpsModeRef = useRef<'fast' | 'slow'>('fast');
  const createGpsWatchRef = useRef<((mode: 'fast' | 'slow') => void) | null>(null);
  // High-accuracy mode: keep 1Hz GPS even when screen off. Uses more battery
  // but gives maximum recording detail. User can toggle this.
  const highAccuracyRef = useRef(false);
  const [highAccuracy, setHighAccuracy] = useState(false);

  // Use a ref for the GPS callback to break the circular dependency between
  // gpsCallback → createGpsWatch → gpsCallback. The ref always points to
  // the latest callback without causing useCallback identity changes.
  const gpsCallbackRef = useRef<(pos: any) => void>(() => {});
  gpsCallbackRef.current = (pos: any) => {
    gpsAccuracyRef.current = pos.coords.accuracy ?? null;

    // Engine ALWAYS processes the point (distance, steps, calories accumulate)
    const point = engineRef.current.addPoint(
      pos.coords.latitude, pos.coords.longitude,
      pos.coords.altitude, pos.coords.accuracy,
      pos.timestamp || Date.now(),
    );
    if (point) {
      currentPosRef.current = { lat: point.lat, lng: point.lng };
      // Weather fetch only needs to run once
      if (!weatherFetchedRef.current) {
        weatherFetchedRef.current = true;
        fetchWeatherAt(point.lat, point.lng, 'ko')
          .then((w) => { weatherRef.current = w; })
          .catch(() => {});
      }
    }

    // --- BATTERY OPTIMIZATION: Skip React state updates when in background ---
    // setState triggers re-render → React reconciliation → layout → paint.
    // When the screen is off, nobody sees the UI, so these are wasted CPU cycles.
    // The engine keeps accumulating data regardless; UI catches up on resume.
    // Notification updates still fire (handled below).
    if (!isBackgroundRef.current) {
      setGpsAccuracy(pos.coords.accuracy ?? null);
      setGpsLastFixAt(Date.now());
      if (point) {
        setCurrentPos({ lat: point.lat, lng: point.lng });
        setRouteCoords(prev => [...prev, [point.lng, point.lat]]);
      }
      setStats(engineRef.current.getStats());
    } else if (point) {
      // In background: still accumulate routeCoords for the final save,
      // but via ref to avoid re-renders.
      setRouteCoords(prev => [...prev, [point.lng, point.lat]]);
    }

    // Off-route detection: only runs when a trail is being followed
    // and its path_data has been loaded. Fires a one-shot haptic + TTS
    // warning when the user wanders > 60m for 3+ consecutive fixes.
    if (point && offRouteRef.current) {
      const result = offRouteRef.current.update({ lat: point.lat, lng: point.lng });
      if (result.alert) {
        try {
          // @ts-ignore — Vibration is imported at top (RN core)
          const { Vibration } = require('react-native');
          Vibration.vibrate([0, 300, 150, 300]);
        } catch {}
        try {
          audioFeedbackRef.current?.announce?.(
            '경로를 벗어났습니다. 원래 길로 돌아가세요.',
          );
        } catch {}
      }
      if (!isBackgroundRef.current) {
        setOffRoute(result.state === 'off');
      }
    }

    // Always update notification (visible on lockscreen)
    const currentStats = engineRef.current.getStats();
    updateBackgroundWalkNotification({
      distance: currentStats.distance,
      duration: currentStats.duration,
      steps: currentStats.steps,
      pace: currentStats.pace,
      isAutoPaused: currentStats.isAutoPaused,
    });

    // Adaptive GPS: switch to slow polling when auto-paused for battery
    // savings (~40% less GPS power). Switch back when movement resumes.
    const wantedMode = currentStats.isAutoPaused ? 'slow' : 'fast';
    if (wantedMode !== gpsModeRef.current) {
      gpsModeRef.current = wantedMode;
      try {
        if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current);
      } catch {}
      createGpsWatch(wantedMode);
    }
  };

  const createGpsWatch = useCallback((mode: 'fast' | 'slow'): void => {
    const interval = mode === 'fast' ? 1000 : 3000;
    const fastest = mode === 'fast' ? 500 : 2000;
    try {
      watchIdRef.current = Geolocation.watchPosition(
        (pos: any) => gpsCallbackRef.current(pos),
        (err: any) => {
          console.log('[Moru] GPS watch error:', err?.code, err?.message || String(err));
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 0,
          timeout: 30000,
          maximumAge: mode === 'fast' ? 0 : 2000,
          interval,
          fastestInterval: fastest,
        } as any,
      );
    } catch (e) {
      console.log('[Moru] GPS watch create failed:', e);
    }
  }, []);

  createGpsWatchRef.current = createGpsWatch;

  const startGps = useCallback(() => {
    setGpsStartedAt(Date.now());
    gpsModeRef.current = 'fast';
    createGpsWatch('fast');
  }, [createGpsWatch]);

  const startWalk = async () => {
    // Apply the user's body profile to the engine BEFORE start() so all
    // calorie and stride-based calculations use real numbers instead of
    // the "average adult" defaults (65 kg, 0.75 m stride).
    const profile = useAuthStore.getState().user as any;
    // Load calibrated stride length if user ran the StrideCalibration flow
    let calibratedStride: number | null = null;
    try {
      const raw = await AsyncStorage.getItem('@moru_stride_length_m');
      if (raw) {
        const v = parseFloat(raw);
        if (v > 0.3 && v < 1.5) calibratedStride = v;
      }
    } catch {}
    if (profile || calibratedStride) {
      engineRef.current.setUserProfile({
        weightKg: profile?.weight_kg ?? null,
        heightCm: profile?.height_cm ?? null,
        strideLengthM: calibratedStride,
      });
    }
    engineRef.current.start();
    lastAnnouncedKmRef.current = 0;
    setState('walking');
    timerRef.current = setInterval(() => {
      const s = engineRef.current.getStats();
      if (!isBackgroundRef.current) setStats(s);
      updateBackgroundWalkNotification({
        distance: s.distance, duration: s.duration,
        steps: s.steps, pace: s.pace, isAutoPaused: s.isAutoPaused,
      });
      // Detect new km split and announce with TTS + haptic vibration.
      // This gives the NRC/Strava "km alert" that users rely on when
      // the phone is in their pocket.
      const currentKm = Math.floor(s.distance);
      if (currentKm > lastAnnouncedKmRef.current && s.splits.length > 0) {
        const latestSplit = s.splits[s.splits.length - 1];
        lastAnnouncedKmRef.current = currentKm;
        audioFeedbackRef.current.announceSplit(
          currentKm,
          latestSplit.avgPace || latestSplit.pace,
          s.distance,
          s.duration,
        );
      }
    }, 1000);
    startBackgroundWalkService().catch(() => {});
    startGps();
    // Start the hardware step counter in parallel with GPS.
    // When GPS is available, step counter provides accurate step count.
    // When GPS is unavailable (indoors), step counter drives distance
    // via stride × steps — matching Galaxy Watch / Nike Run behavior.
    startStepCounter().then((ok) => {
      if (ok) {
        stepSubRef.current = subscribeToSteps((steps) => {
          engineRef.current.updateFromSensorSteps(steps);
        });
      }
    }).catch(() => {});

    // Start barometric pressure sensor for ±1m altitude accuracy.
    // This runs on the sensor hub (<1mW) and continues in background/lockscreen.
    // GPS altitude (±10-30m) is used as fallback when barometer is unavailable.
    startBarometer().then((ok) => {
      if (ok) {
        baroSubRef.current = subscribeToBarometer(({ altitude }) => {
          engineRef.current.updateBarometerAltitude(altitude);
        });
        console.log('[Moru] Barometer started — altitude precision: ±1m');
      } else {
        console.log('[Moru] Barometer unavailable — using GPS altitude (±10-30m)');
      }
    }).catch(() => {});

    // Capture weather conditions at the start of the walk. We try
    // immediately if we already have a fix (countdown's getCurrentPosition
    // succeeded), otherwise the GPS watch callback below will trigger
    // the fetch on first fix via weatherFetchedRef. Without this fallback
    // weather was silently dropped on cold-start indoor walks.
    weatherFetchedRef.current = false;
    if (currentPosRef.current || currentPos) {
      const pos = currentPosRef.current || currentPos!;
      weatherFetchedRef.current = true;
      fetchWeatherAt(pos.lat, pos.lng, 'ko')
        .then((w) => { weatherRef.current = w; })
        .catch(() => {});
    }
  };

  const pauseWalk = () => {
    setState('paused');
    engineRef.current.pause();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (watchIdRef.current !== null) { try { Geolocation.clearWatch(watchIdRef.current); } catch {} watchIdRef.current = null; }
    setStats(engineRef.current.getStats()); // update stats with paused time
    // Keep the foreground service running so the user can resume without
    // losing GPS lock — we just stop charging distance while paused.
    const pauseStats = engineRef.current.getStats();
    updateBackgroundWalkNotification({
      distance: pauseStats.distance,
      duration: pauseStats.duration,
      steps: pauseStats.steps,
      pace: pauseStats.pace,
      isAutoPaused: true,
    });
  };

  const resumeWalk = () => {
    setState('walking');
    engineRef.current.resume();
    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        const s = engineRef.current.getStats();
        if (!isBackgroundRef.current) setStats(s);
        updateBackgroundWalkNotification({
          distance: s.distance, duration: s.duration,
          steps: s.steps, pace: s.pace, isAutoPaused: s.isAutoPaused,
        });
      }, 1000);
    }
    if (watchIdRef.current === null) {
      startGps();
    }
    // Make sure the foreground service is alive — re-entering the screen
    // after a long pause sometimes finds it stopped.
    startBackgroundWalkService().catch(() => {});
  };

  const completeWalk = async () => {
    // This function MUST NOT crash. Any throw here = lost walk + bad UX.
    // Strategy:
    //   1. Set isCompleting to unmount Mapbox first (native cleanup)
    //   2. Cleanup timers/GPS/services fire-and-forget (no awaits)
    //   3. Snapshot stats synchronously from engine ref
    //   4. Save extra data to AsyncStorage in background (detached promise)
    //   5. Fire API save in background (detached — don't block nav)
    //   6. Navigate on next tick so Mapbox unmount completes first

    // --- Phase 0: Drop Mapbox first ---
    try { setIsCompleting(true); } catch {}

    // --- Phase 1: Cleanup (each wrapped, one failure never cascades) ---
    try { if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current); } catch {}
    try { if (timerRef.current) clearInterval(timerRef.current); } catch {}
    try { if (periodicSaveRef.current) clearInterval(periodicSaveRef.current); } catch {}
    try { if (bgSaveRef.current) clearInterval(bgSaveRef.current); } catch {}
    try { if (stepSubRef.current) { stepSubRef.current.remove(); stepSubRef.current = null; } } catch {}
    try { stopStepCounter(); } catch {}
    try { stopBarometer(); } catch {}
    try { if (baroSubRef.current) { baroSubRef.current.remove(); baroSubRef.current = null; } } catch {}
    try { stopBackgroundWalkService().catch(() => {}); } catch {}
    // Clear recovery flags — never block on these
    AsyncStorage.removeItem('walk_in_progress').catch(() => {});
    AsyncStorage.removeItem('walk_paused').catch(() => {});

    // --- Phase 2: Snapshot stats ---
    let finalStats: any = null;
    let trackPoints: any[] = [];
    try {
      finalStats = engineRef.current?.getStats?.() || null;
      // Merge previous segments' trackPoints (from resume) with current segment
      const newTp = engineRef.current?.getTrackPoints?.() || [];
      trackPoints = [...prevTrackPointsRef.current, ...newTp];
    } catch (e) { console.log('[Moru] engine snapshot failed:', e); }
    if (!finalStats) {
      // Engine not ready — bail safely to Activity tab without crashing
      try { navigation.replace('Main', { screen: 'Activity' }); } catch {}
      return;
    }

    // --- Phase 3: Fire TTS (fire-and-forget, never awaited) ---
    try {
      audioFeedbackRef.current?.announceFinish(
        finalStats.distance || 0, finalStats.duration || 0,
        finalStats.steps || 0, finalStats.calories || 0,
      );
    } catch (e) { console.log('[Moru] TTS failed:', e); }

    // --- Phase 4: Save locally BEFORE navigation ---
    // This is the CRITICAL save — if it fails, the user loses their walk
    // data. We AWAIT this (with timeout) so it's confirmed before nav.
    // For 50km walks: 5000 downsampled points × ~80 bytes = ~400 KB (safe).
    const saveExtras = async () => {
      try {
        // Downsample to keep under AsyncStorage's ~2 MB limit
        let safeTrackPoints = trackPoints;
        if (safeTrackPoints.length > 5000) {
          const stride = Math.ceil(safeTrackPoints.length / 5000);
          safeTrackPoints = safeTrackPoints.filter((_: any, i: number) => i % stride === 0);
        }
        let safeRouteCoords = routeCoords || [];
        if (safeRouteCoords.length > 10000) {
          const stride = Math.ceil(safeRouteCoords.length / 10000);
          safeRouteCoords = safeRouteCoords.filter((_: any, i: number) => i % stride === 0);
        }
        const extraData = JSON.stringify({
          spots: spots || [],
          taggedPhotos: taggedPhotos || [],
          routeCoords: safeRouteCoords,
          trackPoints: safeTrackPoints,
        });
        // Save to TWO keys for redundancy:
        // 1. Primary: used by WalkCompleteScreen
        // 2. Backup: timestamped, survives if primary is overwritten
        await AsyncStorage.setItem('activity_latest_extra', extraData);
        await AsyncStorage.setItem(`activity_${Date.now()}_extra`, extraData);
        console.log(`[Moru] Walk data saved: ${(extraData.length / 1024).toFixed(0)} KB, ` +
          `${safeTrackPoints.length} points, ${safeRouteCoords.length} route coords`);
      } catch (e) {
        console.log('[Moru] saveExtras FAILED:', e);
        // Even if AsyncStorage fails, the data is still in memory and
        // will be sent to the API. Alert the user.
        try {
          Alert.alert('저장 주의', '로컬 저장이 실패했습니다. 네트워크 연결을 확인하세요.');
        } catch {}
      }
    };
    // Await with 5s timeout — don't hang forever but do wait for the save
    await Promise.race([
      saveExtras(),
      new Promise<void>(r => setTimeout(r, 5000)),
    ]);

    // API save — also detached. If it succeeds, we'll update the local
    // activity extra key. If it fails, we still have local data.
    if (isAuthenticated) {
      (async () => {
        try {
          const dateLabel = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
          const weather = weatherRef.current;
          // Downsample track_points sent to API too — big uploads on cellular
          // are slow and risk timeouts.
          let apiTrackPoints = trackPoints;
          if (apiTrackPoints.length > 3000) {
            const stride = Math.ceil(apiTrackPoints.length / 3000);
            apiTrackPoints = apiTrackPoints.filter((_, i) => i % stride === 0);
          }
          const actRes = await api.post('/activities/', {
            trail: trailId || null,
            track_points: apiTrackPoints.length > 0 ? apiTrackPoints : [],
            source: 'phone_gps',
            title: `${dateLabel} 도보`,
            started_at: new Date(Date.now() - (finalStats.totalTime || 0) * 1000).toISOString(),
            finished_at: new Date().toISOString(),
            total_steps: finalStats.steps || 0,
            calories_burned: finalStats.calories || 0,
            distance_km: (finalStats.distance || 0).toFixed(2),
            duration_minutes: Math.max(1, Math.round((finalStats.duration || 0) / 60)),
            elevation_gain_m: finalStats.elevationGain || 0,
            elevation_loss_m: finalStats.elevationLoss || 0,
            weather_temp_c: weather ? weather.tempC : null,
            weather_condition: weather ? weather.condition : '',
            weather_icon: weather ? weather.icon : '',
          }, { timeout: 30000 }); // 30s hard cap — never hang forever
          const aid = actRes?.data?.id;
          if (aid) {
            try {
              const raw = await AsyncStorage.getItem('activity_latest_extra');
              if (raw) await AsyncStorage.setItem(`activity_${aid}_extra`, raw);
            } catch {}
          }
          // Stash matched trails for WalkCompleteScreen to show a
          // "코스 완주!" card. Only written on success — if the API
          // call fails, completion detection isn't possible anyway.
          try {
            const matched = actRes?.data?.matched_trails || [];
            await AsyncStorage.setItem(
              'walk_matched_trails',
              JSON.stringify(matched),
            );
          } catch {}
        } catch (e) { console.log('[Moru] API save failed:', e); }
      })();
    }

    // --- Phase 5: Navigate immediately ---
    // Build nav params with primitive/small values only.
    const navParams = {
      distance: (finalStats.distance || 0).toFixed(2),
      duration: String(Math.round(finalStats.duration || 0)),
      steps: String(finalStats.steps || 0),
      calories: String(finalStats.calories || 0),
      pace: formatPace(finalStats.pace || 0),
      elevationGain: String(finalStats.elevationGain || 0),
      elevationLoss: String(finalStats.elevationLoss || 0),
      maxSpeed: (finalStats.maxSpeed || 0).toFixed(1),
      splits: (() => { try { return JSON.stringify(finalStats.splits || []); } catch { return '[]'; } })(),
      activityId: null as any,
    };
    const goToComplete = () => {
      // Defer so React has a chance to commit setIsCompleting(true) and
      // Mapbox's native view has a chance to release before we navigate.
      // 150ms is empirically enough for Mapbox teardown on Android 15.
      setTimeout(() => {
        try {
          navigation.replace('WalkComplete', navParams);
        } catch (e) {
          console.log('[Moru] nav to WalkComplete failed:', e);
          // Last-resort fallback
          try { navigation.replace('Main', { screen: 'Activity' }); } catch {}
        }
      }, 150);
    };

    // If came from TrailCreate, offer to share as course
    if (fromTrailCreate && routeCoords.length >= 2) {
      try {
        Alert.alert(
          '코스로 공유하시겠어요?',
          '걸은 경로를 코스로 등록할 수 있어요.',
          [
            { text: '아니요', style: 'cancel', onPress: goToComplete },
            {
              text: '코스 등록',
              onPress: () => {
                setTimeout(() => {
                  try {
                    const startCoord = routeCoords[0];
                    const endCoord = routeCoords[routeCoords.length - 1];
                    // Stash large arrays in the nav-param cache (in-memory key)
                    // so the Android Intent bundle stays under 1 MB.
                    const cacheKey = navParamCache.put({
                      pathData: routeCoords,
                      spots,
                    });
                    navigation.replace('TrailPublish', {
                      _cacheKey: cacheKey,
                      distance: parseFloat((finalStats.distance || 0).toFixed(2)),
                      duration: Math.max(1, Math.round((finalStats.duration || 0) / 60)),
                      elevationGain: finalStats.elevationGain || 0,
                      startLat: startCoord[1],
                      startLng: startCoord[0],
                      endLat: endCoord[1],
                      endLng: endCoord[0],
                      manualMode: false,
                    });
                  } catch (e) {
                    console.log('[Moru] nav to TrailPublish failed:', e);
                    goToComplete();
                  }
                }, 150);
              },
            },
          ],
        );
      } catch (e) {
        console.log('[Moru] alert failed:', e);
        goToComplete();
      }
    } else {
      goToComplete();
    }
  };

  const handlePauseSave = async () => {
    // Stop GPS and timer but keep data
    if (watchIdRef.current !== null) { try { Geolocation.clearWatch(watchIdRef.current); } catch {} }
    if (timerRef.current) clearInterval(timerRef.current);
    if (periodicSaveRef.current) clearInterval(periodicSaveRef.current);
    if (bgSaveRef.current) clearInterval(bgSaveRef.current);
    // Release the foreground service — the walk is being stored, not active.
    stopBackgroundWalkService().catch(() => {});

    const finalStats = engineRef.current.getStats();
    // Merge previous segments' trackPoints with current segment
    let tp = [...prevTrackPointsRef.current, ...engineRef.current.getTrackPoints()];
    // Downsample for AsyncStorage safety (50km walk = 36,000 points → 5,000)
    if (tp.length > 5000) {
      const stride = Math.ceil(tp.length / 5000);
      tp = tp.filter((_: any, i: number) => i % stride === 0);
    }
    let rc = routeCoords;
    if (rc.length > 10000) {
      const stride = Math.ceil(rc.length / 10000);
      rc = rc.filter((_: any, i: number) => i % stride === 0);
    }

    const savedWalk = {
      savedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours
      segments: [{
        startedAt: new Date(Date.now() - finalStats.totalTime * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        routeCoords: rc,
        trackPoints: tp,
        distance: finalStats.distance,
        duration: finalStats.duration,
        steps: finalStats.steps,
        calories: finalStats.calories,
        elevationGain: finalStats.elevationGain,
        elevationLoss: finalStats.elevationLoss,
      }],
      spots,
      taggedPhotos,
      trailId: trailId || null,
    };

    try {
      await AsyncStorage.setItem('walk_paused', JSON.stringify(savedWalk));
      console.log(`[Moru] Walk paused: ${tp.length} trackPoints, ${rc.length} routeCoords saved`);
    } catch (e) {
      console.log('[Moru] walk_paused save FAILED:', e);
      Alert.alert('저장 주의', '일시 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
      return; // Don't navigate away if save failed
    }
    AsyncStorage.removeItem('walk_in_progress').catch(() => {});

    Alert.alert(
      '일시 저장 완료',
      '48시간 내에 이어서 걸을 수 있어요.\n활동 탭에서 "이어서 걷기"를 눌러주세요.',
      [{ text: '확인', onPress: () => navigation.replace('Main', { screen: 'Activity' }) }],
    );
  };

  const handleStop = () => setShowStopModal(true);

  useEffect(() => {
    return () => {
      // Unmount cleanup — each call wrapped so one failure doesn't cascade
      try { if (timerRef.current) clearInterval(timerRef.current); } catch {}
      try { if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current); } catch {}
      try { if (periodicSaveRef.current) clearInterval(periodicSaveRef.current); } catch {}
      try { if (bgSaveRef.current) clearInterval(bgSaveRef.current); } catch {}
      try { if (stepSubRef.current) { stepSubRef.current.remove(); stepSubRef.current = null; } } catch {}
      try { stopStepCounter(); } catch {}
    try { stopBarometer(); } catch {}
    try { if (baroSubRef.current) { baroSubRef.current.remove(); baroSubRef.current = null; } } catch {}
      try { stopBackgroundWalkService().catch(() => {}); } catch {}
      try { audioFeedbackRef.current?.destroy?.(); } catch {}
    };
  }, []);

  // Prevent accidental back navigation during walk — show the unified stop
  // modal instead of a separate system Alert. This way the user always sees
  // the same three choices (종료 / 일시 저장 / 계속 걷기) regardless of
  // whether they tap "stop" or the hardware back button.
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (state === 'walking' || state === 'paused') {
        setShowStopModal(true);
        return true;
      }
      if (state === 'countdown') {
        if (timerRef.current) clearInterval(timerRef.current);
        navigation.goBack();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [state, navigation]);

  const routeGeoJSON = routeCoords.length >= 2 ? {
    type: 'Feature' as const, properties: {},
    geometry: { type: 'LineString' as const, coordinates: routeCoords },
  } : null;

  // ---- COUNTDOWN ----
  if (state === 'countdown') {
    return (
      <View style={styles.countdownContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 12 }]}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>{'←'}</Text>
        </TouchableOpacity>

        <View style={styles.countdownContent}>
          <Text style={styles.countdownLabel}>MORU</Text>
          <Animated.View style={{ transform: [{ scale: countdownScale }], opacity: countdownOpacity }}>
            <View style={styles.countdownCircle}>
              <Text style={styles.countdownNumber}>{countdown}</Text>
            </View>
          </Animated.View>
          <Text style={styles.countdownHint}>경로 자동 기록</Text>
        </View>
      </View>
    );
  }

  // ---- WALKING / PAUSED ----
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ====== MAP (large, top area) ====== */}
      {/* isCompleting: unmount Mapbox one frame before we navigate, so
          the native layer gets a chance to release resources cleanly.
          This prevents a native-side crash observed during screen
          transition on Android 15 Samsung devices. */}
      <View style={[styles.mapWrap, { paddingTop: insets.top }]}>
        {isCompleting ? (
          <View style={{ flex: 1, backgroundColor: '#0a0a0a' }} />
        ) : (
        <Mapbox.MapView
          style={{ flex: 1 }}
          styleURL="mapbox://styles/mapbox/dark-v11"
          attributionEnabled={false}
          logoEnabled={false}
          scrollEnabled={true}
          zoomEnabled={true}
          pitchEnabled={false}
          rotateEnabled={false}>
          <Mapbox.Camera
            ref={cameraRef}
            centerCoordinate={currentPos ? [currentPos.lng, currentPos.lat] : [126.978, 37.566]}
            zoomLevel={16}
            animationDuration={1000}
          />
          {routeGeoJSON && (
            <Mapbox.ShapeSource id="route" shape={routeGeoJSON}>
              <Mapbox.LineLayer id="routeGlow" style={{
                lineColor: '#4ADE80', lineWidth: 14,
                lineOpacity: 0.15, lineCap: 'round', lineJoin: 'round',
                lineBlur: 3,
              }} />
              <Mapbox.LineLayer id="routeBorder" style={{
                lineColor: '#FFFFFF', lineWidth: 8,
                lineOpacity: 0.8, lineCap: 'round', lineJoin: 'round',
              }} />
              <Mapbox.LineLayer id="routeLine" style={{
                lineColor: '#4ADE80', lineWidth: 4.5,
                lineCap: 'round', lineJoin: 'round',
              }} />
            </Mapbox.ShapeSource>
          )}
          {currentPos && (
            <Mapbox.PointAnnotation id="me" coordinate={[currentPos.lng, currentPos.lat]}>
              <View style={styles.meMarkerOuter}>
                <View style={styles.meMarkerInner} />
              </View>
            </Mapbox.PointAnnotation>
          )}
          {taggedPhotos.map((p, i) => (
            <Mapbox.PointAnnotation key={`ph-${i}`} id={`ph-${i}`} coordinate={[p.lng, p.lat]}>
              <View style={styles.photoPin}>
                <Text style={{ fontSize: 14 }}>{'\uD83D\uDCF7'}</Text>
              </View>
            </Mapbox.PointAnnotation>
          ))}
          {spots.map((s, i) => {
            const spotColor = SPOT_TYPES.find(t => t.value === s.type)?.color || '#888';
            return (
              <Mapbox.PointAnnotation key={`spot-${i}`} id={`spot-${i}`} coordinate={[s.lng, s.lat]}>
                <View style={[styles.spotMarker, { backgroundColor: spotColor }]}>
                  <Text style={styles.spotMarkerText}>{s.type.charAt(0)}</Text>
                </View>
              </Mapbox.PointAnnotation>
            );
          })}
        </Mapbox.MapView>
        )}

        {/* Off-route warning banner — only shown when the user is
            following a trail and has drifted > 60 m from its path. */}
        {offRoute && (
          <View style={[styles.offRouteBanner, { top: insets.top + 70 }]}>
            <Text style={styles.offRouteEmoji}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.offRouteTitle}>경로를 벗어났어요</Text>
              <Text style={styles.offRouteSub}>원래 길로 돌아가세요</Text>
            </View>
          </View>
        )}

        {/* Map top-left: status pill + GPS signal indicator */}
        <View style={[styles.mapTopBar, { top: insets.top + 12 }]}>
          <View style={styles.mapStatusPill}>
            <View style={[styles.dot, state === 'walking'
              ? (stats.isAutoPaused ? styles.dotOrange : styles.dotGreen)
              : styles.dotYellow
            ]} />
            <Text style={styles.mapStatusText}>
              {resumeData
                ? (state === 'walking' ? '이어서 기록 중' : '이어하기 일시정지')
                : (state === 'walking' ? (stats.isAutoPaused ? '자동 일시정지' : '기록 중') : '일시정지')
              }
            </Text>
          </View>
          <GpsSignalIndicator
            accuracy={gpsAccuracy}
            lastFixAt={gpsLastFixAt}
            startedAt={gpsStartedAt}
          />
          {/* High-accuracy toggle — keeps 1Hz GPS even with screen off */}
          <TouchableOpacity
            style={[styles.accuracyToggle, highAccuracy && styles.accuracyToggleOn]}
            onPress={() => {
              const next = !highAccuracy;
              setHighAccuracy(next);
              highAccuracyRef.current = next;
            }}
            activeOpacity={0.7}>
            <Text style={styles.accuracyToggleText}>
              {highAccuracy ? 'HD' : 'HD'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Map overlay buttons removed — using bottom quick actions instead */}

        {/* Map bottom gradient fade */}
        <View style={styles.mapFade} />
      </View>

      {/* ====== STATS PANEL (bottom) ====== */}
      <Animated.View style={[styles.statsPanel, { opacity: stats.isAutoPaused ? autoPausePulse : 1 }]}>

        {/* Resume: previous segment banner */}
        {prevSegment && (
          <View style={styles.prevBanner}>
            <Text style={styles.prevBannerText}>
              이전 {prevSegment.distance.toFixed(1)}km · {formatTime(prevSegment.duration)}  |  총 {stats.distance.toFixed(1)}km · {formatTime(stats.duration)}
            </Text>
          </View>
        )}

        {/* Time */}
        <Text style={styles.timeLabel}>{prevSegment ? '현재 구간' : '시간'}</Text>
        <Text style={styles.timeValue}>
          {prevSegment
            ? formatTime(Math.max(0, stats.duration - prevSegment.duration))
            : formatTime(stats.duration)
          }
        </Text>

        {/* Distance */}
        <View style={styles.distRow}>
          <Text style={styles.distValue}>{stats.distance.toFixed(2)}</Text>
          <Text style={styles.distUnit}>km</Text>
        </View>

        {/* Pace — centered current pace, avg + delta in a row below */}
        <View style={styles.paceRow}>
          <Text style={styles.paceLabel}>현재 페이스</Text>
          <View style={styles.paceValueRow}>
            <Text style={styles.paceValue}>{formatPace(stats.currentPace)}</Text>
            <Text style={styles.paceUnit}>/km</Text>
          </View>
          {stats.distance > 0.1 && stats.pace > 0 && (
            <View style={styles.paceAvgRow}>
              <Text style={styles.paceAvgLabel}>평균 {formatPace(stats.pace)}</Text>
              {stats.currentPace > 0 && (
                <Text
                  style={[
                    styles.paceDelta,
                    {
                      color:
                        stats.currentPace < stats.pace - 0.1
                          ? '#22C55E'
                          : stats.currentPace > stats.pace + 0.1
                          ? '#EF4444'
                          : 'rgba(255,255,255,0.4)',
                    },
                  ]}>
                  {stats.currentPace < stats.pace - 0.1
                    ? '▲ 빨라짐'
                    : stats.currentPace > stats.pace + 0.1
                    ? '▼ 느려짐'
                    : '— 평균'}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Primary 4-stat grid */}
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.gridVal}>{stats.steps.toLocaleString()}</Text>
            <Text style={styles.gridLabel}>걸음</Text>
          </View>
          <View style={styles.gridDivider} />
          <View style={styles.gridItem}>
            <Text style={styles.gridVal}>{stats.cadence > 0 ? stats.cadence : '—'}</Text>
            <Text style={styles.gridLabel}>spm</Text>
          </View>
          <View style={styles.gridDivider} />
          <View style={styles.gridItem}>
            <Text style={styles.gridVal}>{stats.calories}</Text>
            <Text style={styles.gridLabel}>kcal</Text>
          </View>
          <View style={styles.gridDivider} />
          <View style={styles.gridItem}>
            <Text style={styles.gridVal}>{stats.elevationGain > 0 ? `+${stats.elevationGain}` : '0'}m</Text>
            <Text style={styles.gridLabel}>고도</Text>
          </View>
        </View>
      </Animated.View>

      {/* ====== QUICK ACTIONS (spot/camera above controls) ====== */}
      {state === 'walking' && (
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickBtn} onPress={handleTakePhoto} activeOpacity={0.8}>
            <Feather name="camera" size={18} color="#fff" />
            {taggedPhotos.length > 0 && <View style={styles.quickBadge}><Text style={styles.quickBadgeText}>{taggedPhotos.length}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={openSpotModal} activeOpacity={0.8}>
            <Feather name="map-pin" size={18} color="#fff" />
            {spots.length > 0 && <View style={styles.quickBadge}><Text style={styles.quickBadgeText}>{spots.length}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => setShowRecordSummary(true)} activeOpacity={0.8}>
            <Feather name="list" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* ====== CONTROLS ====== */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 20 }]}>
        {state === 'walking' ? (
          <TouchableOpacity style={styles.pauseBtn} onPress={pauseWalk} activeOpacity={0.85}>
            <View style={styles.pauseIconWrap}>
              <View style={styles.pauseBar} />
              <View style={styles.pauseBar} />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.pausedControls}>
            <TouchableOpacity style={styles.stopBtn} onPress={handleStop} activeOpacity={0.85}>
              <View style={styles.stopIcon} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.resumeBtn} onPress={resumeWalk} activeOpacity={0.85}>
              <View style={styles.playIcon} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ====== STOP CONFIRMATION MODAL ====== */}
      <Modal visible={showStopModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Feather name="flag" size={28} color="#fff" />
            </View>
            <Text style={styles.modalTitle}>걷기를 종료할까요?</Text>
            <View style={styles.modalStats}>
              <View style={styles.modalStatItem}>
                <Text style={styles.modalStatVal}>{stats.distance.toFixed(2)}</Text>
                <Text style={styles.modalStatLabel}>km</Text>
              </View>
              <View style={styles.modalStatDivider} />
              <View style={styles.modalStatItem}>
                <Text style={styles.modalStatVal}>{formatTime(stats.duration)}</Text>
                <Text style={styles.modalStatLabel}>시간</Text>
              </View>
              <View style={styles.modalStatDivider} />
              <View style={styles.modalStatItem}>
                <Text style={styles.modalStatVal}>{stats.steps.toLocaleString()}</Text>
                <Text style={styles.modalStatLabel}>걸음</Text>
              </View>
            </View>
            {/* 3 buttons in unified pill style — primary action on top */}
            <TouchableOpacity
              style={styles.modalBtnPrimary}
              onPress={() => { setShowStopModal(false); completeWalk(); }}
              activeOpacity={0.85}>
              <Feather name="flag" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.modalBtnPrimaryText}>걷기 종료</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalBtnSecondary}
              onPress={() => { setShowStopModal(false); handlePauseSave(); }}
              activeOpacity={0.85}>
              <Feather name="save" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.modalBtnSecondaryText}>일시 저장</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalBtnGhost}
              onPress={() => setShowStopModal(false)}
              activeOpacity={0.85}>
              <Text style={styles.modalBtnGhostText}>계속 걷기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ====== RECORD SUMMARY POPUP ====== */}
      <Modal visible={showRecordSummary} transparent animationType="slide" onRequestClose={() => setShowRecordSummary(false)}>
        <TouchableOpacity style={styles.spotModalOverlay} activeOpacity={1} onPress={() => setShowRecordSummary(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.recordSummaryCard}>
            <View style={styles.spotModalHandle} />
            <Text style={[styles.spotModalTitle, { color: '#fff' }]}>기록 현황</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 450 }}>
              {/* Spots list */}
              <View style={styles.recordSection}>
                <View style={styles.recordSectionHeader}>
                  <Feather name="map-pin" size={14} color={colors.primary} />
                  <Text style={styles.recordSectionLabel}>스팟 {spots.length}</Text>
                </View>
                {spots.length === 0 ? (
                  <Text style={styles.recordEmpty}>스팟을 추가하면 코스에 기록돼요</Text>
                ) : (
                  spots.map((s, i) => (
                    <View key={i} style={styles.recordSpotCard}>
                      <View style={styles.recordSpotInfo}>
                        <View style={[styles.recordSpotTypeBadge, { backgroundColor: SPOT_TYPES.find(t => t.value === s.type)?.color || '#888' }]}>
                          <Text style={styles.recordSpotTypeText}>{s.type}</Text>
                        </View>
                        <Text style={styles.recordSpotName} numberOfLines={1}>{s.name}</Text>
                        {s.description ? <Text style={styles.recordSpotDesc} numberOfLines={1}>{s.description}</Text> : null}
                        <Text style={styles.recordSpotCoord}>
                          <Feather name="navigation" size={10} color="rgba(255,255,255,0.3)" />{' '}
                          {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                        </Text>
                      </View>
                      <View style={styles.recordSpotActions}>
                        <TouchableOpacity
                          style={styles.recordSpotActionBtn}
                          onPress={() => {
                            setEditingSpotIdx(i);
                            setSpotName(s.name);
                            setSpotType(s.type);
                            setSpotDesc(s.description);
                            setShowRecordSummary(false);
                            setShowSpotModal(true);
                          }}>
                          <Feather name="edit-2" size={13} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.recordSpotActionBtn}
                          onPress={() => {
                            Alert.alert('스팟 삭제', `"${s.name}"을 삭제할까요?`, [
                              { text: '취소', style: 'cancel' },
                              { text: '삭제', style: 'destructive', onPress: () => setSpots(prev => prev.filter((_, idx) => idx !== i)) },
                            ]);
                          }}>
                          <Feather name="trash-2" size={13} color="#FF6B6B" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* Photos list */}
              <View style={[styles.recordSection, { marginTop: 20 }]}>
                <View style={styles.recordSectionHeader}>
                  <Feather name="camera" size={14} color="#60A5FA" />
                  <Text style={styles.recordSectionLabel}>사진 {taggedPhotos.length}</Text>
                </View>
                {taggedPhotos.length === 0 ? (
                  <Text style={styles.recordEmpty}>사진을 찍으면 위치와 함께 저장돼요</Text>
                ) : (
                  taggedPhotos.map((p, i) => (
                    <View key={i} style={styles.recordSpotCard}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setRecordPhotoViewer({ visible: true, index: i })}
                        style={styles.recordPhotoThumb}>
                        <Image source={{ uri: p.uri }} style={styles.recordPhotoThumbImg} />
                      </TouchableOpacity>
                      <View style={styles.recordSpotInfo}>
                        <Text style={styles.recordSpotName} numberOfLines={1}>
                          {p.title || `사진 ${i + 1}`}
                        </Text>
                        {p.description ? <Text style={styles.recordSpotDesc} numberOfLines={1}>{p.description}</Text> : null}
                        <Text style={styles.recordSpotCoord}>
                          {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                        </Text>
                        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>
                          {new Date(p.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      <View style={styles.recordSpotActions}>
                        <TouchableOpacity
                          style={styles.recordSpotActionBtn}
                          onPress={() => {
                            Alert.prompt ? Alert.prompt('제목 수정', '', [
                              { text: '취소', style: 'cancel' },
                              { text: '저장', onPress: (val?: string) => setTaggedPhotos(prev => prev.map((ph, idx) => idx === i ? { ...ph, title: val || '' } : ph)) },
                            ], 'plain-text', p.title || '') : (() => {
                              // Android fallback — just use simple title edit
                              setTaggedPhotos(prev => prev.map((ph, idx) => idx === i ? { ...ph, title: `사진 ${i + 1}` } : ph));
                            })();
                          }}>
                          <Feather name="edit-2" size={13} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.recordSpotActionBtn}
                          onPress={() => {
                            Alert.alert('사진 삭제', '이 사진을 삭제할까요?', [
                              { text: '취소', style: 'cancel' },
                              { text: '삭제', style: 'destructive', onPress: () => setTaggedPhotos(prev => prev.filter((_, idx) => idx !== i)) },
                            ]);
                          }}>
                          <Feather name="trash-2" size={13} color="#FF6B6B" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.recordCloseBtn} onPress={() => setShowRecordSummary(false)}>
              <Text style={styles.recordCloseBtnText}>닫기</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ====== RECORD PHOTO VIEWER ====== */}
      <Modal visible={recordPhotoViewer.visible} transparent animationType="fade" onRequestClose={() => setRecordPhotoViewer({ visible: false, index: 0 })}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: insets.top + 10, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
            onPress={() => setRecordPhotoViewer({ visible: false, index: 0 })}>
            <Feather name="x" size={20} color="#fff" />
          </TouchableOpacity>
          {taggedPhotos.length > 1 && (
            <Text style={{ position: 'absolute', top: insets.top + 16, alignSelf: 'center', zIndex: 10, fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>
              {recordPhotoViewer.index + 1} / {taggedPhotos.length}
            </Text>
          )}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: recordPhotoViewer.index * Dimensions.get('window').width, y: 0 }}
            onMomentumScrollEnd={(e) => setRecordPhotoViewer(prev => ({ ...prev, index: Math.round(e.nativeEvent.contentOffset.x / Dimensions.get('window').width) }))}>
            {taggedPhotos.map((p, i) => (
              <View key={i} style={{ width: Dimensions.get('window').width, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Image source={{ uri: p.uri }} style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').width }} resizeMode="contain" />
                <View style={{ position: 'absolute', bottom: insets.bottom + 40, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                    <Feather name="navigation" size={11} color="rgba(255,255,255,0.5)" /> {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
                    {new Date(p.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* ====== SPOT CREATION MODAL ====== */}
      <Modal visible={showSpotModal} transparent animationType="slide">
        <View style={styles.spotModalOverlay}>
          <View style={styles.spotModalCard}>
            <View style={styles.spotModalHandle} />
            <Text style={styles.spotModalTitle}>{editingSpotIdx !== null ? '스팟 수정' : '스팟 추가'}</Text>

            <Text style={styles.spotFieldLabel}>장소 이름 *</Text>
            <TextInput
              style={styles.spotInput}
              placeholder="예: 전망 좋은 카페"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={spotName}
              onChangeText={setSpotName}
              maxLength={30}
            />

            <Text style={styles.spotFieldLabel}>유형</Text>
            <View style={styles.spotTypeRow}>
              {SPOT_TYPES.map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    styles.spotTypeChip,
                    spotType === t.value && { backgroundColor: t.color },
                  ]}
                  onPress={() => setSpotType(t.value)}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.spotTypeChipText,
                      spotType === t.value && { color: '#fff' },
                    ]}>
                    {t.value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.spotFieldLabel}>한줄 설명</Text>
            <TextInput
              style={styles.spotInput}
              placeholder="선택사항"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={spotDesc}
              onChangeText={setSpotDesc}
              maxLength={50}
            />

            {currentPos && (
              <Text style={styles.spotGpsText}>
                GPS: {currentPos.lat.toFixed(5)}, {currentPos.lng.toFixed(5)}
              </Text>
            )}

            <TouchableOpacity
              style={styles.spotAddBtn}
              onPress={handleAddSpot}
              activeOpacity={0.85}>
              <Text style={styles.spotAddBtnText}>추가</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.spotCancelBtn}
              onPress={() => {
                setShowSpotModal(false);
                setSpotName('');
                setSpotDesc('');
              }}
              activeOpacity={0.85}>
              <Text style={styles.spotCancelBtnText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ====== PHOTO TITLE/DESC MODAL ====== */}
      <Modal visible={showPhotoModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{'사진 정보'}</Text>
            <TextInput
              style={styles.photoModalInput}
              placeholder="사진 제목 (선택)"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={photoTitle}
              onChangeText={setPhotoTitle}
              maxLength={40}
              autoFocus
            />
            <TextInput
              style={[styles.photoModalInput, { marginTop: 10 }]}
              placeholder="사진 설명 (선택)"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={photoDesc}
              onChangeText={setPhotoDesc}
              maxLength={100}
              multiline
            />
            <TouchableOpacity
              style={styles.modalStopBtn}
              onPress={confirmPhoto}
              activeOpacity={0.85}>
              <Text style={styles.modalStopBtnText}>{'추가'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => {
                // Skip title/desc, add photo without them
                if (pendingPhoto) {
                  setTaggedPhotos(prev => [...prev, pendingPhoto]);
                }
                setPendingPhoto(null);
                setShowPhotoModal(false);
              }}
              activeOpacity={0.85}>
              <Text style={styles.modalCancelBtnText}>{'건너뛰기'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Error boundary — if ANY render inside WalkScreen throws, catch it and
// push the user back to the Activity tab instead of letting the JS bridge
// tear down the app. This is the last line of defense for the walk flow.
class WalkScreenBoundary extends React.Component<
  { children: React.ReactNode; navigation: any },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, info: any) {
    console.log('[Moru] WalkScreen render crash:', error, info);
  }
  componentDidUpdate(_: any, prev: { hasError: boolean }) {
    if (!prev.hasError && this.state.hasError) {
      // Defer navigation so React finishes the commit first
      setTimeout(() => {
        try { this.props.navigation?.replace?.('Main', { screen: 'Activity' }); } catch {}
      }, 100);
    }
  }
  render() {
    if (this.state.hasError) {
      return <View style={{ flex: 1, backgroundColor: '#0a0a0a' }} />;
    }
    return this.props.children;
  }
}

export default function WalkScreen() {
  const navigation = useNavigation<any>();
  return (
    <WalkScreenBoundary navigation={navigation}>
      <WalkScreenInner />
    </WalkScreenBoundary>
  );
}

const styles = StyleSheet.create({
  // ---- COUNTDOWN ----
  countdownContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
  },
  countdownContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.15)',
    letterSpacing: 6,
    marginBottom: 48,
  },
  countdownCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 10,
  },
  countdownNumber: {
    fontSize: 64,
    fontWeight: '800',
    color: '#fff',
  },
  countdownHint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.2)',
    marginTop: 48,
    letterSpacing: 1,
  },

  // ---- MAIN CONTAINER ----
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },

  // ---- MAP ----
  mapWrap: {
    height: SH * 0.48,
    overflow: 'hidden',
  },
  mapFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'transparent',
  },
  mapTopBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
    gap: 10,
  },
  offRouteBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  offRouteEmoji: { fontSize: 28 },
  offRouteTitle: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '800',
  },
  offRouteSub: {
    color: '#B91C1C',
    fontSize: 12,
    marginTop: 1,
  },
  accuracyToggle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginLeft: 8,
  },
  accuracyToggleOn: {
    backgroundColor: '#4ADE80',
  },
  accuracyToggleText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  mapStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 8,
  },
  mapStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: '#4ADE80' },
  dotYellow: { backgroundColor: '#FACC15' },
  dotOrange: { backgroundColor: '#F97316' },
  meMarkerOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(74,222,128,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(74,222,128,0.4)',
  },
  meMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4ADE80',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  photoPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cameraBtn: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  camBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },

  // ---- STATS PANEL ----
  statsPanel: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 2,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  prevBanner: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 4,
    alignSelf: 'center',
  },
  prevBannerText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  compactStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    flexWrap: 'wrap',
    gap: 2,
  },
  compactStatItem: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  compactStatDot: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    marginHorizontal: 3,
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 1,
  },
  timeValue: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    fontVariant: ['tabular-nums'],
    marginBottom: 2,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  distValue: {
    fontSize: 44,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -2,
  },
  distUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
    marginLeft: 6,
    marginBottom: 4,
  },
  paceRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    width: '100%',
  },
  paceLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  paceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  paceValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: '#4ADE80',
  },
  paceUnit: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginLeft: 3,
  },
  paceAvgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 3,
  },
  paceAvgLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  paceDelta: {
    fontSize: 10,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  gridItem: {
    flex: 1,
    alignItems: 'center',
  },
  gridDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  gridVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  gridLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ---- CONTROLS ----
  controls: {
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'center',
  },
  pauseBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseIconWrap: {
    flexDirection: 'row',
    gap: 6,
  },
  pauseBar: {
    width: 5,
    height: 20,
    borderRadius: 2.5,
    backgroundColor: '#111',
  },
  pausedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  stopBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIcon: {
    width: 18,
    height: 18,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  resumeBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 16,
    borderTopWidth: 11,
    borderBottomWidth: 11,
    borderLeftColor: '#fff',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 3,
  },

  // ---- STOP MODAL ----
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalIcon: {
    fontSize: 28,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
  },
  modalStats: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  modalStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  modalStatVal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  modalStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  modalStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  // Unified stop-modal button styles (primary / secondary / ghost).
  // Also reused by photo modal for its CTA.
  modalStopBtn: {
    width: '100%',
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalStopBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  modalBtnPrimary: {
    width: '100%',
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalBtnPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  modalBtnSecondary: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  modalBtnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalBtnGhost: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalBtnGhostText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  // Keep legacy names for photo modal that still references them
  modalPauseBtn: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modalPauseBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  modalCancelBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },

  // ---- SPOT BUTTON ----
  spotBtn: {
    position: 'absolute',
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  spotBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF9F27',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },

  // ---- SPOT MARKERS ----
  spotMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  spotMarkerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },

  // ---- QUICK ACTIONS ----
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    paddingTop: 8,
    paddingBottom: 2,
  },
  quickBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  quickBadge: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  quickBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },

  // ---- RECORD SUMMARY ----
  recordSummaryCard: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 12,
  },
  recordSection: {},
  recordSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  recordSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
  recordEmpty: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    paddingVertical: 12,
    paddingLeft: 4,
  },
  recordSpotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  recordSpotInfo: {
    flex: 1,
    gap: 3,
  },
  recordSpotTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 2,
  },
  recordSpotTypeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  recordSpotName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  recordSpotDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },
  recordSpotCoord: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 2,
  },
  recordSpotActions: {
    flexDirection: 'column',
    gap: 8,
    marginLeft: 8,
  },
  recordSpotActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordPhotoThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
  },
  recordPhotoThumbImg: {
    width: '100%',
    height: '100%',
  },
  recordCloseBtn: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  recordCloseBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },

  // ---- SPOT MODAL ----
  spotModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  spotModalCard: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  spotModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  spotModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  spotFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
    marginTop: 12,
  },
  spotInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#fff',
  },
  spotTypeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  spotTypeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  spotTypeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  spotGpsText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 12,
    textAlign: 'center',
  },
  spotAddBtn: {
    backgroundColor: '#4ADE80',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  spotAddBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  spotCancelBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  spotCancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },

  // ---- PHOTO MODAL ----
  photoModalInput: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#fff',
    marginTop: 16,
  },
});
