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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';

import Geolocation from '@react-native-community/geolocation';

Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'whenInUse',
  enableBackgroundLocationUpdates: false,
});

import Mapbox from '@rnmapbox/maps';
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
  const [spotName, setSpotName] = useState('');
  const [spotType, setSpotType] = useState('맛집');
  const [spotDesc, setSpotDesc] = useState('');
  const fromTrailCreate = route.params?.fromTrailCreate;

  const engineRef = useRef(new WalkEngine());
  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraRef = useRef<any>(null);

  const countdownScale = useRef(new Animated.Value(1)).current;
  const countdownOpacity = useRef(new Animated.Value(1)).current;
  const autoPausePulse = useRef(new Animated.Value(1)).current;

  // ---- COUNTDOWN ----
  useEffect(() => {
    if (state !== 'countdown') return;
    if (Platform.OS === 'android') {
      PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ).catch(() => {});
    }
    Geolocation.getCurrentPosition(
      (pos) => setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 5000 },
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

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setIsBackground(s === 'background'));
    return () => sub.remove();
  }, []);

  const handleTakePhoto = useCallback(async () => {
    if (!currentPos) return;
    try {
      const photo = await takeTaggedPhoto(currentPos.lat, currentPos.lng);
      if (photo) setTaggedPhotos(prev => [...prev, photo]);
    } catch {}
  }, [currentPos]);

  const handleAddSpot = useCallback(() => {
    if (!spotName.trim()) {
      Alert.alert('필수 입력', '장소 이름을 입력해주세요.');
      return;
    }
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
    setSpotName('');
    setSpotType('맛집');
    setSpotDesc('');
    setShowSpotModal(false);
  }, [spotName, spotType, spotDesc, currentPos]);

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
        { enableHighAccuracy: true, distanceFilter: 5, timeout: 15000 },
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
    const finalStats = engineRef.current.getStats();
    const trackPoints = engineRef.current.getTrackPoints();
    if (isAuthenticated) {
      try {
        const dateLabel = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
        await api.post('/activities/', {
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
      } catch (e) { console.log('Save error:', e); }
    }
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

  const handleStop = () => setShowStopModal(true);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (watchIdRef.current !== null) { try { Geolocation.clearWatch(watchIdRef.current); } catch {} }
    };
  }, []);

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
              <Mapbox.LineLayer id="routeLine" style={{
                lineColor: '#4ADE80', lineWidth: 5,
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
            {state === 'walking' ? (stats.isAutoPaused ? '자동 일시정지' : '기록 중') : '일시정지'}
          </Text>
        </View>

        {/* Map top-right: camera button */}
        {state === 'walking' && (
          <TouchableOpacity
            style={[styles.cameraBtn, { top: insets.top + 12 }]}
            onPress={handleTakePhoto} activeOpacity={0.8}>
            <Text style={{ fontSize: 18 }}>{'\uD83D\uDCF7'}</Text>
            {taggedPhotos.length > 0 && (
              <View style={styles.camBadge}>
                <Text style={styles.camBadgeText}>{taggedPhotos.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Map bottom-right: spot button */}
        {state === 'walking' && (
          <TouchableOpacity
            style={[styles.spotBtn, { top: insets.top + 64 }]}
            onPress={() => setShowSpotModal(true)}
            activeOpacity={0.8}>
            <Text style={{ fontSize: 14, color: '#fff', fontWeight: '700' }}>+ 스팟</Text>
            {spots.length > 0 && (
              <View style={styles.spotBadge}>
                <Text style={styles.spotBadgeText}>{spots.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

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
              <Text style={styles.modalIcon}>{'\uD83D\uDEB6'}</Text>
            </View>
            <Text style={styles.modalTitle}>걸기를 종료할까요?</Text>
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
              <Text style={styles.modalStopBtnText}>종료하기</Text>
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

      {/* ====== SPOT CREATION MODAL ====== */}
      <Modal visible={showSpotModal} transparent animationType="slide">
        <View style={styles.spotModalOverlay}>
          <View style={styles.spotModalCard}>
            <View style={styles.spotModalHandle} />
            <Text style={styles.spotModalTitle}>스팟 추가</Text>

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
    marginBottom: 10,
  },
  modalStopBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
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
});
