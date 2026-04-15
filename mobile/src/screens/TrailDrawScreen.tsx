import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Mapbox from '@rnmapbox/maps';
import { colors } from '../theme/colors';
import { navParamCache } from '../utils/navParamCache';

const MAPBOX_TOKEN =
  'pk.eyJ1Ijoia2h3IiwiYSI6ImNtbm' +
  '1zeXc4NDFvM2YydnByMmszY3AxbmYifQ.pAUAzt44HHJ-jYdMlwqjXg';

export default function TrailDrawScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const cameraRef = useRef<any>(null);

  const [waypoints, setWaypoints] = useState<[number, number][]>([]); // [lng, lat]
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [totalDistance, setTotalDistance] = useState(0); // km
  const [totalDuration, setTotalDuration] = useState(0); // minutes
  const [loading, setLoading] = useState(false);

  const fetchRoute = useCallback(async (points: [number, number][]) => {
    if (points.length < 2) {
      setRouteCoords([]);
      setTotalDistance(0);
      setTotalDuration(0);
      return;
    }
    setLoading(true);
    try {
      const coordStr = points.map(p => `${p[0]},${p[1]}`).join(';');
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordStr}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full&steps=false`;
      // 10s hard cap — otherwise flaky networks leave the user watching a
      // spinner forever.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();

      if (data.routes?.[0]) {
        const route = data.routes[0];
        setRouteCoords(route.geometry.coordinates);
        setTotalDistance(route.distance / 1000);
        setTotalDuration(Math.round(route.duration / 60));
      }
    } catch (e) {
      console.log('Directions error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMapPress = useCallback(
    async (event: any) => {
      const { geometry } = event;
      if (geometry && geometry.coordinates) {
        const coord: [number, number] = [
          geometry.coordinates[0],
          geometry.coordinates[1],
        ];
        const newWaypoints = [...waypoints, coord];
        setWaypoints(newWaypoints);
        if (newWaypoints.length >= 2) {
          await fetchRoute(newWaypoints);
        }
      }
    },
    [waypoints, fetchRoute],
  );

  const handleUndo = useCallback(() => {
    const newPoints = waypoints.slice(0, -1);
    setWaypoints(newPoints);
    if (newPoints.length >= 2) {
      fetchRoute(newPoints);
    } else {
      setRouteCoords([]);
      setTotalDistance(0);
      setTotalDuration(0);
    }
  }, [waypoints, fetchRoute]);

  const handleClear = useCallback(() => {
    Alert.alert('초기화', '모든 경유지를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          setWaypoints([]);
          setRouteCoords([]);
          setTotalDistance(0);
          setTotalDuration(0);
        },
      },
    ]);
  }, []);

  const handleDone = useCallback(() => {
    if (waypoints.length < 2 || routeCoords.length === 0) {
      Alert.alert('경로 부족', '최소 2개 이상의 경유지가 필요합니다.');
      return;
    }
    // Stash the full path (can be thousands of coordinates) in the in-memory
    // nav cache — passing it via nav params would trigger
    // TransactionTooLargeException for long walks.
    const cacheKey = navParamCache.put({
      pathData: routeCoords,
      spots: [],
    });
    navigation.navigate('TrailPublish', {
      _cacheKey: cacheKey,
      distance: parseFloat(totalDistance.toFixed(2)),
      duration: totalDuration,
      elevationGain: 0,
      startLat: routeCoords[0]?.[1] || 0,
      startLng: routeCoords[0]?.[0] || 0,
      endLat: routeCoords[routeCoords.length - 1]?.[1] || 0,
      endLng: routeCoords[routeCoords.length - 1]?.[0] || 0,
      manualMode: false,
    });
  }, [waypoints, routeCoords, totalDistance, totalDuration, navigation]);

  const routeGeoJSON =
    routeCoords.length >= 2
      ? {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'LineString' as const,
            coordinates: routeCoords,
          },
        }
      : null;

  const formatDistance = (km: number) => {
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
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
          <Text style={styles.backBtnText}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>경로 그리기</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Map */}
      <View style={styles.mapWrap}>
        <Mapbox.MapView
          style={{ flex: 1 }}
          styleURL="mapbox://styles/mapbox/outdoors-v12"
          attributionEnabled={false}
          logoEnabled={false}
          onPress={handleMapPress}>
          <Mapbox.Camera
            ref={cameraRef}
            centerCoordinate={[126.978, 37.566]}
            zoomLevel={14}
            animationDuration={0}
          />

          {/* User location */}
          <Mapbox.UserLocation visible={true} />

          {/* Route border (white background line) */}
          {routeGeoJSON && (
            <Mapbox.ShapeSource id="routeSource" shape={routeGeoJSON}>
              <Mapbox.LineLayer
                id="routeBorder"
                style={{
                  lineColor: '#FFFFFF',
                  lineWidth: 9,
                  lineOpacity: 0.9,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              <Mapbox.LineLayer
                id="routeLine"
                style={{
                  lineColor: '#4ADE80',
                  lineWidth: 5,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
                aboveLayerID="routeBorder"
              />
            </Mapbox.ShapeSource>
          )}

          {/* Waypoint markers */}
          {waypoints.map((coord, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === waypoints.length - 1 && waypoints.length > 1;
            return (
              <Mapbox.PointAnnotation
                key={`wp-${idx}`}
                id={`wp-${idx}`}
                coordinate={coord}>
                <View
                  style={[
                    styles.marker,
                    isFirst && styles.markerFirst,
                    isLast && styles.markerLast,
                  ]}>
                  <Text style={styles.markerText}>{idx + 1}</Text>
                </View>
              </Mapbox.PointAnnotation>
            );
          })}
        </Mapbox.MapView>

        {/* Hint overlay */}
        {waypoints.length === 0 && (
          <View style={styles.hintOverlay} pointerEvents="none">
            <Text style={styles.hintText}>
              지도를 탭하여 경유지를 추가하세요
            </Text>
          </View>
        )}

        {/* Loading indicator */}
        {loading && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color="#4ADE80" />
          </View>
        )}

        {/* Floating action buttons on map */}
        {waypoints.length > 0 && (
          <View style={styles.floatingActions}>
            <TouchableOpacity
              style={styles.floatingBtn}
              onPress={handleUndo}
              activeOpacity={0.7}>
              <Text style={styles.floatingBtnText}>되돌리기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.floatingBtn}
              onPress={handleClear}
              activeOpacity={0.7}>
              <Text style={styles.floatingBtnText}>초기화</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>거리</Text>
            <Text style={styles.statValue}>{formatDistance(totalDistance)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>시간</Text>
            <Text style={styles.statValue}>
              {totalDuration > 0 ? `약 ${totalDuration}분` : '-'}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>경유지</Text>
            <Text style={styles.statValue}>{waypoints.length}개</Text>
          </View>
        </View>
      </View>

      {/* Done button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[
            styles.doneBtn,
            waypoints.length < 2 && styles.doneBtnDisabled,
          ]}
          onPress={handleDone}
          disabled={waypoints.length < 2}
          activeOpacity={0.85}>
          <Text style={styles.doneBtnText}>
            {waypoints.length < 2
              ? '경유지를 2개 이상 추가하세요'
              : '완료 → 코스 등록'}
          </Text>
        </TouchableOpacity>
      </View>
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
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  backBtnText: {
    fontSize: 18,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  mapWrap: {
    flex: 1,
    marginHorizontal: 0,
    overflow: 'hidden',
  },
  hintOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    fontSize: 15,
    color: 'rgba(0,0,0,0.5)',
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  floatingActions: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    gap: 8,
  },
  floatingBtn: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2D4A2E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  markerFirst: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2D4A2E',
  },
  markerLast: {
    backgroundColor: '#EF4444',
  },
  markerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  statsBar: {
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderLight,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: '#FAFAFA',
  },
  doneBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneBtnDisabled: {
    opacity: 0.4,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
