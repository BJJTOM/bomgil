import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Mapbox from '@rnmapbox/maps';
import { colors } from '../theme/colors';

const { height: SH } = Dimensions.get('window');

const SPOT_COLORS: Record<string, string> = {
  restaurant: '#D85A30',
  cafe: '#378ADD',
  photo: '#7F77DD',
  rest: '#888780',
  view: '#EF9F27',
};

const SPOT_EMOJI: Record<string, string> = {
  restaurant: '🍴',
  cafe: '☕',
  photo: '📸',
  rest: '💤',
  view: '👀',
};

export default function MapDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const {
    pathCoordinates = [],
    startLat,
    startLng,
    endLat,
    endLng,
    spots = [],
    title = '경로 상세',
    distance,
    duration,
  } = route.params || {};

  const hasPath = pathCoordinates.length >= 2;

  // Calculate bounds
  let bounds: any = null;
  if (hasPath) {
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lo, la] of pathCoordinates) {
      if (lo < minLng) minLng = lo;
      if (lo > maxLng) maxLng = lo;
      if (la < minLat) minLat = la;
      if (la > maxLat) maxLat = la;
    }
    bounds = { ne: [maxLng, maxLat], sw: [minLng, minLat] };
  }

  const routeGeoJSON = hasPath ? {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: pathCoordinates },
  } : null;

  // Route trace animation: reveal the polyline from start → end by
  // setting `lineTrimOffset: [progress, 1]` via @rnmapbox/maps. A walker
  // dot is sampled along the path and updated each frame.
  const [traceProgress, setTraceProgress] = useState(1); // 1 = fully visible
  const [animating, setAnimating] = useState(false);
  const rafRef = useRef<number | null>(null);
  const walkerCoord = hasPath
    ? sampleAlong(pathCoordinates, Math.max(0, Math.min(1, 1 - traceProgress)))
    : null;
  const walkerGeoJSON =
    animating && walkerCoord
      ? {
          type: 'Feature' as const,
          properties: {},
          geometry: { type: 'Point' as const, coordinates: walkerCoord },
        }
      : null;

  const startAnimation = () => {
    if (!hasPath) return;
    cancelAnimation();
    const duration = 5200;
    const started = Date.now();
    setAnimating(true);
    setTraceProgress(1);
    const tick = () => {
      const t = (Date.now() - started) / duration;
      if (t >= 1) {
        setTraceProgress(0);
        // Linger for a beat, then remove the walker so the arrows come back
        setTimeout(() => {
          setAnimating(false);
          setTraceProgress(1);
        }, 700);
        return;
      }
      // easeOutCubic — 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - t, 3);
      setTraceProgress(1 - eased);
      rafRef.current = requestAnimationFrame(tick) as unknown as number;
    };
    rafRef.current = requestAnimationFrame(tick) as unknown as number;
  };

  const cancelAnimation = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setAnimating(false);
    setTraceProgress(1);
  };

  useEffect(() => () => cancelAnimation(), []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />

      {/* Full screen map */}
      <Mapbox.MapView
        style={{ flex: 1 }}
        styleURL="mapbox://styles/mapbox/dark-v11"
        attributionEnabled={false}
        logoEnabled={false}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}>

        <Mapbox.Camera
          {...(bounds ? {
            bounds: {
              ne: bounds.ne,
              sw: bounds.sw,
              paddingTop: 100,
              paddingBottom: 150,
              paddingLeft: 60,
              paddingRight: 60,
            },
          } : {
            centerCoordinate: [startLng || 126.978, startLat || 37.5665],
            zoomLevel: 15,
          })}
          animationDuration={500}
        />

        {/* Route — lineTrimOffset animates 0→1 during trace preview */}
        {routeGeoJSON && (
          <Mapbox.ShapeSource id="route" shape={routeGeoJSON}>
            <Mapbox.LineLayer id="routeGlow" style={{
              lineColor: '#4ADE80', lineWidth: 16, lineOpacity: 0.12,
              lineCap: 'round', lineJoin: 'round', lineBlur: 4,
              lineTrimOffset: [traceProgress, 1],
            }} />
            <Mapbox.LineLayer id="routeBorder" style={{
              lineColor: 'rgba(255,255,255,0.3)', lineWidth: 8,
              lineOpacity: 0.9, lineCap: 'round', lineJoin: 'round',
              lineTrimOffset: [traceProgress, 1],
            }} />
            <Mapbox.LineLayer id="routeLine" style={{
              lineColor: '#4ADE80', lineWidth: 4.5,
              lineCap: 'round', lineJoin: 'round',
              lineTrimOffset: [traceProgress, 1],
            }} />
          </Mapbox.ShapeSource>
        )}

        {/* Walker dot during animation */}
        {walkerGeoJSON && (
          <Mapbox.ShapeSource id="route-walker" shape={walkerGeoJSON as any}>
            <Mapbox.CircleLayer id="route-walker-glow" style={{
              circleColor: '#FFB770',
              circleRadius: 18,
              circleOpacity: 0.35,
              circleBlur: 1,
            }} />
            <Mapbox.CircleLayer id="route-walker-dot" style={{
              circleColor: '#FFFFFF',
              circleRadius: 6,
              circleStrokeColor: '#E8563D',
              circleStrokeWidth: 2.5,
            }} />
          </Mapbox.ShapeSource>
        )}

        {/* Start marker */}
        {startLat && startLng && (
          <Mapbox.PointAnnotation id="start" coordinate={[startLng, startLat]}>
            <View style={styles.startPin}>
              <Text style={styles.pinText}>S</Text>
            </View>
          </Mapbox.PointAnnotation>
        )}

        {/* End marker */}
        {endLat && endLng && (
          <Mapbox.PointAnnotation id="end" coordinate={[endLng, endLat]}>
            <View style={styles.endPin}>
              <Text style={styles.pinText}>E</Text>
            </View>
          </Mapbox.PointAnnotation>
        )}

        {/* Spot markers */}
        {spots.map((spot: any, i: number) => (
          spot.lat && spot.lng && (
            <Mapbox.PointAnnotation key={`spot-${i}`} id={`spot-${i}`} coordinate={[spot.lng, spot.lat]}>
              <View style={[styles.spotPin, { backgroundColor: SPOT_COLORS[spot.type] || '#888780' }]}>
                <Text style={styles.spotEmoji}>{SPOT_EMOJI[spot.type] || '📍'}</Text>
              </View>
            </Mapbox.PointAnnotation>
          )
        ))}
      </Mapbox.MapView>

      {/* Top overlay — back + title */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Bottom stats overlay */}
      {(distance || duration) && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>{typeof distance === 'number' ? distance.toFixed(2) : distance || '0'}</Text>
            <Text style={styles.statLabel}>km</Text>
          </View>
          {duration != null && (
            <View style={styles.statPill}>
              <Text style={styles.statValue}>{typeof duration === 'number' ? (duration >= 60 ? `${Math.floor(duration/60)}h${duration%60}m` : `${duration}m`) : duration}</Text>
              <Text style={styles.statLabel}>시간</Text>
            </View>
          )}
          {spots.length > 0 && (
            <View style={styles.statPill}>
              <Text style={styles.statValue}>{spots.length}</Text>
              <Text style={styles.statLabel}>스팟</Text>
            </View>
          )}
        </View>
      )}

      {/* Route trace animation trigger */}
      {hasPath && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={animating ? cancelAnimation : startAnimation}
          style={[
            styles.traceBtn,
            { bottom: insets.bottom + ((distance || duration) ? 70 : 16) },
            animating && styles.traceBtnActive,
          ]}
        >
          <View style={[styles.traceBtnIcon, animating && styles.traceBtnIconActive]}>
            <Text style={styles.traceBtnIconText}>
              {animating ? '■' : '▶'}
            </Text>
          </View>
          <Text style={[styles.traceBtnText, animating && styles.traceBtnTextActive]}>
            {animating ? '정지' : '코스 따라가기'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 20,
    color: '#fff',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    zIndex: 10,
  },
  statPill: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  startPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2D4A2E',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  endPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  pinText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  spotPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  spotEmoji: {
    fontSize: 14,
  },
  traceBtn: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 10,
    paddingRight: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 11,
  },
  traceBtnActive: {
    backgroundColor: '#FFB770',
  },
  traceBtnIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFB770',
    alignItems: 'center',
    justifyContent: 'center',
  },
  traceBtnIconActive: {
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  traceBtnIconText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
  },
  traceBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  traceBtnTextActive: {
    color: '#000',
  },
});

/** Find the point at a given progress (0..1) along a LineString. */
function sampleAlong(
  coords: [number, number][],
  progress: number,
): [number, number] | null {
  if (!coords || coords.length < 2) return null;
  // Cumulative distances (Euclidean in lng/lat space is fine for a small
  // path — perfect accuracy isn't needed for a visual marker).
  let total = 0;
  const cum: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const dx = coords[i][0] - coords[i - 1][0];
    const dy = coords[i][1] - coords[i - 1][1];
    total += Math.sqrt(dx * dx + dy * dy);
    cum.push(total);
  }
  if (total <= 0) return coords[0];
  const target = Math.max(0, Math.min(1, progress)) * total;
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= target) lo = mid;
    else hi = mid;
  }
  const segLen = cum[lo + 1] - cum[lo] || 1e-9;
  const t = (target - cum[lo]) / segLen;
  return [
    coords[lo][0] + (coords[lo + 1][0] - coords[lo][0]) * t,
    coords[lo][1] + (coords[lo + 1][1] - coords[lo][1]) * t,
  ];
}
