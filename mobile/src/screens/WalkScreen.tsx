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

Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'always',
  enableBackgroundLocationUpdates: true,
  locationProvider: 'auto',
});

import Mapbox from '@rnmapbox/maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';
import { takeTaggedPhoto, TaggedPhoto } from '../utils/photoTagger';
import { WalkEngine, WalkStats, KmSplit } from '../utils/walkEngine';

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

export default function WalkScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isAuthenticated } = useAuthStore();
  const trailId = route.params?.trailId;

  const [state, setState] = useState<WalkState>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [stats, setStats] = useState<WalkStats>({
    distance: 0, duration: 0, totalTime: 0, pace: 0, currentPace: 0,
    speed: 0, steps: 0, cadence: 0, calories: 0,
    elevationGain: 0, elevationLoss: 0, maxElevation: 0, minElevation: 0,
    maxSpeed: 0, splits: [], isAutoPaused: false,
  });
  const [taggedPhotos, setTaggedPhotos] = useState<TaggedPhoto[]>([]);
  const [isBackground, setIsBackground] = useState(false);
  const [currentPos, setCurrentPos] = useState<{lat: number; lng: number} | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [showStopModal, setShowStopModal] = useState(false);
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
  const resumeData = route.params?.resumeData; // from ActivityScreen "이어서 걷기"

  const engineRef = useRef(new WalkEngine());
  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraRef = useRef<any>(null);

  const periodicSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bgSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      let prevDistance = 0, prevSteps = 0, prevCalories = 0, prevDuration = 0, prevElevation = 0;
      for (const seg of segments) {
        if (seg.routeCoords) prevCoords.push(...seg.routeCoords);
        prevDistance += seg.distance || 0;
        prevSteps += seg.steps || 0;
        prevCalories += seg.calories || 0;
        prevDuration += seg.duration || 0;
        prevElevation += seg.elevationGain || 0;
      }
      setRouteCoords(prevCoords);
      setSpots(resumeData.spots || []);
      setTaggedPhotos(resumeData.taggedPhotos || []);

      // Set initial map position from last known coord
      if (prevCoords.length > 0) {
        const lastCoord = prevCoords[prevCoords.length - 1];
        setCurrentPos({ lat: lastCoord[1], lng: lastCoord[0] });
      }

      // Set engine offset for cumulative stats
      engineRef.current.setOffset(prevDistance, prevSteps, prevCalories, prevDuration, prevElevation);

      // Skip countdown, start immediately
      setState('walking');
      engineRef.current.start();
      timerRef.current = setInterval(() => setStats(engineRef.current.getStats()), 1000);
      startGps();

      // Clean up paused data
      AsyncStorage.removeItem('walk_paused').catch(() => {});
    };

    doResume();
  }, []); // eslint-disable-line

  // ---- COUNTDOWN ----
  useEffect(() => {
    if (state !== 'countdown') return;
    if (resumeData) return; // skip countdown if resuming
    if (Platform.OS === 'android') {
      PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ).catch(() => {});
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

  // Save current walk state to AsyncStorage for crash protection
  const saveWalkState = useCallback(async () => {
    try {
      const currentStats = engineRef.current.getStats();
      const data = JSON.stringify({
        stats: currentStats,
        routeCoords,
        trackPoints: engineRef.current.getTrackPoints(),
        spots,
        taggedPhotos,
        timestamp: Date.now(),
      });
      await AsyncStorage.setItem('walk_in_progress', data);
    } catch {}
  }, [routeCoords, spots, taggedPhotos]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      setIsBackground(s === 'background');
      if (s === 'background' && state === 'walking') {
        // Save immediately when going to background
        saveWalkState();
        // Then save every 30 seconds while in background
        bgSaveRef.current = setInterval(() => saveWalkState(), 30000);
      }
      if (s === 'active') {
        // Clear background save timer
        if (bgSaveRef.current) {
          clearInterval(bgSaveRef.current);
          bgSaveRef.current = null;
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
      periodicSaveRef.current = setInterval(() => saveWalkState(), 60000);
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
          // Only offer recovery if data is less than 2 hours old
          if (ageMinutes < 120 && data.stats?.distance > 0.05) {
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
    try {
      const photo = await takeTaggedPhoto(currentPos.lat, currentPos.lng);
      if (photo) {
        setPendingPhoto(photo);
        setPhotoTitle('');
        setPhotoDesc('');
        setShowPhotoModal(true);
      }
    } catch {}
  }, [currentPos]);

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

  const startGps = useCallback(() => {
    try {
      watchIdRef.current = Geolocation.watchPosition(
        (pos) => {
          const point = engineRef.current.addPoint(
            pos.coords.latitude, pos.coords.longitude,
            pos.coords.altitude, pos.coords.accuracy,
            pos.timestamp || Date.now(),
          );
          if (point) {
            setCurrentPos({ lat: point.lat, lng: point.lng });
            setRouteCoords(prev => [...prev, [point.lng, point.lat]]);
          }
          setStats(engineRef.current.getStats());
        },
        () => {},
        {
          enableHighAccuracy: true,
          distanceFilter: 3,
          timeout: 15000,
          maximumAge: 0,
          interval: 2000,
          fastestInterval: 1000,
        } as any,
      );
    } catch {}
  }, []);

  const startWalk = () => {
    engineRef.current.start();
    setState('walking');
    timerRef.current = setInterval(() => setStats(engineRef.current.getStats()), 1000);
    startGps();
  };

  const pauseWalk = () => {
    setState('paused');
    if (timerRef.current) clearInterval(timerRef.current);
    if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current);
  };

  const resumeWalk = () => {
    setState('walking');
    timerRef.current = setInterval(() => setStats(engineRef.current.getStats()), 1000);
    startGps();
  };

  const completeWalk = async () => {
    if (watchIdRef.current !== null) { try { Geolocation.clearWatch(watchIdRef.current); } catch {} }
    if (timerRef.current) clearInterval(timerRef.current);
    if (periodicSaveRef.current) clearInterval(periodicSaveRef.current);
    if (bgSaveRef.current) clearInterval(bgSaveRef.current);
    // Clear crash recovery data — walk completed successfully
    AsyncStorage.removeItem('walk_in_progress').catch(() => {});
    const finalStats = engineRef.current.getStats();
    const trackPoints = engineRef.current.getTrackPoints();

    // Always save locally first (before API call), including trackPoints
    console.log(`[Moru] Saving extra: spots=${spots.length}, photos=${taggedPhotos.length}, route=${routeCoords.length}, trackPts=${trackPoints.length}`);
    const extraData = JSON.stringify({
      spots,
      taggedPhotos,
      routeCoords,
      trackPoints,
    });
    const localKey = `activity_${Date.now()}_extra`;
    // Save locally and to server in parallel
    const localSave = Promise.all([
      AsyncStorage.setItem(localKey, extraData).catch(() => {}),
      AsyncStorage.setItem('activity_latest_extra', extraData).catch(() => {}),
    ]);

    let activityId: string | number | null = null;
    const apiSave = isAuthenticated ? (async () => {
      try {
        const dateLabel = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
        const actRes = await api.post('/activities/', {
          trail: trailId || null,
          track_points: trackPoints.length > 0 ? trackPoints : [],
          source: 'phone_gps',
          title: `${dateLabel} 도보`,
          started_at: new Date(Date.now() - finalStats.totalTime * 1000).toISOString(),
          finished_at: new Date().toISOString(),
          total_steps: finalStats.steps, calories_burned: finalStats.calories,
          distance_km: finalStats.distance.toFixed(2),
          duration_minutes: Math.max(1, Math.round(finalStats.duration / 60)),
          elevation_gain_m: finalStats.elevationGain,
        });
        activityId = actRes?.data?.id;
        if (activityId) {
          AsyncStorage.setItem(`activity_${activityId}_extra`, extraData).catch(() => {});
        }
      } catch (e) { console.log('Save error:', e); }
    })() : Promise.resolve();

    await Promise.all([localSave, apiSave]);
    const goToComplete = () => {
      navigation.replace('WalkComplete', {
        distance: finalStats.distance.toFixed(2),
        duration: String(Math.round(finalStats.duration)),
        steps: String(finalStats.steps), calories: String(finalStats.calories),
        pace: formatPace(finalStats.pace),
        elevationGain: String(finalStats.elevationGain),
        elevationLoss: String(finalStats.elevationLoss),
        maxSpeed: finalStats.maxSpeed.toFixed(1),
        splits: JSON.stringify(finalStats.splits), taggedPhotos,
        spots,
        routeCoords,
        trackPoints: engineRef.current.getTrackPoints(),
        activityId,
      });
    };

    // If came from TrailCreate, offer to share as course
    if (fromTrailCreate && routeCoords.length >= 2) {
      Alert.alert(
        '코스로 공유하시겠어요?',
        '걸은 경로를 코스로 등록할 수 있어요.',
        [
          {
            text: '아니요',
            style: 'cancel',
            onPress: goToComplete,
          },
          {
            text: '코스 등록',
            onPress: () => {
              const startCoord = routeCoords[0];
              const endCoord = routeCoords[routeCoords.length - 1];
              navigation.replace('TrailPublish', {
                pathData: routeCoords,
                distance: parseFloat(finalStats.distance.toFixed(2)),
                duration: Math.max(1, Math.round(finalStats.duration / 60)),
                elevationGain: finalStats.elevationGain,
                spots,
                startLat: startCoord[1],
                startLng: startCoord[0],
                endLat: endCoord[1],
                endLng: endCoord[0],
                manualMode: false,
              });
            },
          },
        ],
      );
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

    const finalStats = engineRef.current.getStats();
    const trackPoints = engineRef.current.getTrackPoints();

    const savedWalk = {
      savedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours
      segments: [{
        startedAt: new Date(Date.now() - finalStats.totalTime * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        routeCoords,
        trackPoints,
        distance: finalStats.distance,
        duration: finalStats.duration,
        steps: finalStats.steps,
        calories: finalStats.calories,
        elevationGain: finalStats.elevationGain,
      }],
      spots,
      taggedPhotos,
      trailId: trailId || null,
    };

    await AsyncStorage.setItem('walk_paused', JSON.stringify(savedWalk)).catch(() => {});
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
      if (timerRef.current) clearInterval(timerRef.current);
      if (watchIdRef.current !== null) { try { Geolocation.clearWatch(watchIdRef.current); } catch {} }
      if (periodicSaveRef.current) clearInterval(periodicSaveRef.current);
      if (bgSaveRef.current) clearInterval(bgSaveRef.current);
    };
  }, []);

  // Prevent accidental back navigation during walk
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (state === 'walking' || state === 'paused') {
        Alert.alert(
          '걸기 종료',
          '걸기를 종료하고 나가시겠습니까?\n기록된 데이터가 저장되지 않을 수 있습니다.',
          [
            { text: '계속 걸기', style: 'cancel' },
            { text: '종료', style: 'destructive', onPress: () => {
              if (watchIdRef.current !== null) { try { Geolocation.clearWatch(watchIdRef.current); } catch {} }
              if (timerRef.current) clearInterval(timerRef.current);
              navigation.goBack();
            }},
          ],
        );
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
      <View style={[styles.mapWrap, { paddingTop: insets.top }]}>
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

        {/* Map top-left: status pill */}
        <View style={[styles.mapStatusPill, { top: insets.top + 12 }]}>
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

        {/* Map overlay buttons removed — using bottom quick actions instead */}

        {/* Map bottom gradient fade */}
        <View style={styles.mapFade} />
      </View>

      {/* ====== STATS PANEL (bottom) ====== */}
      <Animated.View style={[styles.statsPanel, { opacity: stats.isAutoPaused ? autoPausePulse : 1 }]}>

        {/* Time */}
        <Text style={styles.timeLabel}>시간</Text>
        <Text style={styles.timeValue}>{formatTime(stats.duration)}</Text>

        {/* Distance */}
        <View style={styles.distRow}>
          <Text style={styles.distValue}>{stats.distance.toFixed(2)}</Text>
          <Text style={styles.distUnit}>km</Text>
        </View>

        {/* Pace */}
        <View style={styles.paceRow}>
          <Text style={styles.paceLabel}>현재 페이스</Text>
          <Text style={styles.paceValue}>{formatPace(stats.currentPace)}</Text>
          <Text style={styles.paceUnit}>/km</Text>
        </View>

        {/* 4-stat grid */}
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.gridVal}>{stats.steps.toLocaleString()}</Text>
            <Text style={styles.gridLabel}>걸음</Text>
          </View>
          <View style={styles.gridDivider} />
          <View style={styles.gridItem}>
            <Text style={styles.gridVal}>{stats.calories}</Text>
            <Text style={styles.gridLabel}>kcal</Text>
          </View>
          <View style={styles.gridDivider} />
          <View style={styles.gridItem}>
            <Text style={styles.gridVal}>{stats.speed.toFixed(1)}</Text>
            <Text style={styles.gridLabel}>km/h</Text>
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
            <Feather name="camera" size={16} color="#fff" />
            <Text style={styles.quickBtnLabel}>사진</Text>
            {taggedPhotos.length > 0 && <View style={styles.quickBadge}><Text style={styles.quickBadgeText}>{taggedPhotos.length}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => setShowSpotModal(true)} activeOpacity={0.8}>
            <Feather name="map-pin" size={16} color="#fff" />
            <Text style={styles.quickBtnLabel}>스팟</Text>
            {spots.length > 0 && <View style={styles.quickBadge}><Text style={styles.quickBadgeText}>{spots.length}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => setShowRecordSummary(true)} activeOpacity={0.8}>
            <Feather name="list" size={16} color="#fff" />
            <Text style={styles.quickBtnLabel}>기록</Text>
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
            <TouchableOpacity
              style={styles.modalStopBtn}
              onPress={() => { setShowStopModal(false); completeWalk(); }}
              activeOpacity={0.85}>
              <Feather name="check-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.modalStopBtnText}>완전 종료</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalPauseBtn}
              onPress={() => { setShowStopModal(false); handlePauseSave(); }}
              activeOpacity={0.85}>
              <Feather name="pause-circle" size={18} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.modalPauseBtnText}>일시 저장 (나중에 이어하기)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowStopModal(false)}
              activeOpacity={0.85}>
              <Text style={styles.modalCancelBtnText}>계속 걷기</Text>
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
                              { text: '저장', onPress: (val) => setTaggedPhotos(prev => prev.map((ph, idx) => idx === i ? { ...ph, title: val || '' } : ph)) },
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
  mapStatusPill: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 8,
    zIndex: 10,
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
    paddingTop: 16,
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    fontVariant: ['tabular-nums'],
    marginBottom: 4,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  distValue: {
    fontSize: 52,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -2,
  },
  distUnit: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
    marginLeft: 6,
    marginBottom: 6,
  },
  paceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
    gap: 5,
  },
  paceLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },
  paceValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4ADE80',
  },
  paceUnit: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
  },
  grid: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 14,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 3,
  },
  gridLabel: {
    fontSize: 10,
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
  modalPauseBtn: {
    width: '100%',
    backgroundColor: colors.primary + '12',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: colors.primary + '30',
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
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
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
