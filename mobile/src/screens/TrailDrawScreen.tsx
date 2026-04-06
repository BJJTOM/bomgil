import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Mapbox from '@rnmapbox/maps';
import { colors } from '../theme/colors';

const { height: SH } = Dimensions.get('window');

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcTotalDistance(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    total += haversineDistance(lat1, lng1, lat2, lng2);
  }
  return total;
}

export default function TrailDrawScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const cameraRef = useRef<any>(null);

  const [points, setPoints] = useState<[number, number][]>([]);

  const handleMapPress = useCallback((event: any) => {
    const { geometry } = event;
    if (geometry && geometry.coordinates) {
      const coord: [number, number] = [
        geometry.coordinates[0],
        geometry.coordinates[1],
      ];
      setPoints(prev => [...prev, coord]);
    }
  }, []);

  const handleUndo = useCallback(() => {
    setPoints(prev => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    Alert.alert('초기화', '모든 포인트를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => setPoints([]) },
    ]);
  }, []);

  const handleDone = useCallback(() => {
    if (points.length < 2) {
      Alert.alert('경로 부족', '최소 2개 이상의 포인트가 필요합니다.');
      return;
    }
    const distance = calcTotalDistance(points);
    // Estimate duration: average walking speed ~4km/h
    const durationMinutes = Math.round((distance / 4) * 60);
    const [startLng, startLat] = points[0];
    const [endLng, endLat] = points[points.length - 1];

    navigation.navigate('TrailPublish', {
      pathData: points,
      distance: parseFloat(distance.toFixed(2)),
      duration: durationMinutes,
      elevationGain: 0,
      spots: [],
      startLat,
      startLng,
      endLat,
      endLng,
    });
  }, [points, navigation]);

  const routeGeoJSON =
    points.length >= 2
      ? {
          type: 'Feature' as const,
          properties: {},
          geometry: { type: 'LineString' as const, coordinates: points },
        }
      : null;

  const distance = calcTotalDistance(points);

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
        <Text style={styles.headerTitle}>지도에서 그리기</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Info bar */}
      <View style={styles.infoBar}>
        <View style={styles.infoPill}>
          <Text style={styles.infoLabel}>포인트</Text>
          <Text style={styles.infoValue}>{points.length}</Text>
        </View>
        <View style={styles.infoPill}>
          <Text style={styles.infoLabel}>거리</Text>
          <Text style={styles.infoValue}>{distance.toFixed(2)} km</Text>
        </View>
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
          {routeGeoJSON && (
            <Mapbox.ShapeSource id="drawnRoute" shape={routeGeoJSON}>
              <Mapbox.LineLayer
                id="drawnRouteBorder"
                style={{
                  lineColor: '#FFFFFF',
                  lineWidth: 8,
                  lineOpacity: 0.8,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              <Mapbox.LineLayer
                id="drawnRouteLine"
                style={{
                  lineColor: colors.primary,
                  lineWidth: 5,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
                aboveLayerID="drawnRouteBorder"
              />
            </Mapbox.ShapeSource>
          )}
          {points.map((coord, idx) => (
            <Mapbox.PointAnnotation
              key={`pt-${idx}`}
              id={`pt-${idx}`}
              coordinate={coord}>
              <View
                style={[
                  styles.pointMarker,
                  idx === 0 && styles.startPoint,
                  idx === points.length - 1 && points.length > 1 && styles.endPoint,
                ]}>
                {idx === 0 ? (
                  <Text style={styles.pointMarkerText}>S</Text>
                ) : idx === points.length - 1 && points.length > 1 ? (
                  <Text style={styles.pointMarkerText}>E</Text>
                ) : (
                  <View style={styles.pointDot} />
                )}
              </View>
            </Mapbox.PointAnnotation>
          ))}
        </Mapbox.MapView>

        {/* Hint overlay */}
        {points.length === 0 && (
          <View style={styles.hintOverlay} pointerEvents="none">
            <Text style={styles.hintText}>지도를 탭하여 경로를 그려주세요</Text>
          </View>
        )}
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.actionBtn, !points.length && styles.actionBtnDisabled]}
            onPress={handleUndo}
            disabled={points.length === 0}
            activeOpacity={0.7}>
            <Text style={styles.actionBtnText}>되돌리기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, !points.length && styles.actionBtnDisabled]}
            onPress={handleClear}
            disabled={points.length === 0}
            activeOpacity={0.7}>
            <Text style={styles.actionBtnText}>초기화</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.doneBtn, points.length < 2 && styles.doneBtnDisabled]}
          onPress={handleDone}
          disabled={points.length < 2}
          activeOpacity={0.85}>
          <Text style={styles.doneBtnText}>완료</Text>
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
  infoBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  mapWrap: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
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
    color: 'rgba(0,0,0,0.4)',
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  pointMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
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
  startPoint: {
    backgroundColor: colors.primary,
  },
  endPoint: {
    backgroundColor: '#EF4444',
  },
  pointMarkerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  pointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: '#FAFAFA',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
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
