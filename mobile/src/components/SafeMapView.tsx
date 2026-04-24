import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface SpotMarker {
  lat: number;
  lng: number;
  name: string;
  type?: string;
}

interface Props {
  lat: number;
  lng: number;
  endLat?: number;
  endLng?: number;
  pathCoordinates?: [number, number][];
  region?: string;
  country?: string;
  height?: number;
  spots?: SpotMarker[];
  theme?: 'light' | 'dark';
}

class MapErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}

function MapPlaceholder({
  region,
  country,
  lat,
  lng,
}: {
  region?: string;
  country?: string;
  lat: number;
  lng: number;
}) {
  return (
    <View style={styles.placeholder}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#E5E8EB', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 18, color: '#8B95A1' }}>M</Text>
      </View>
      <Text style={styles.placeholderRegion}>
        {region || ''} {country || ''}
      </Text>
      <Text style={styles.placeholderCoords}>
        {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
      </Text>
    </View>
  );
}

/**
 * Calculate points at every 1km along a path using haversine distance.
 * Returns array of { coordinate, km } objects.
 */
function getKmPoints(
  coords: [number, number][],
): { coordinate: [number, number]; km: number }[] {
  const points: { coordinate: [number, number]; km: number }[] = [];
  let totalDist = 0;
  let nextKm = 1;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalDist += d;
    if (totalDist >= nextKm) {
      points.push({ coordinate: coords[i], km: nextKm });
      nextKm++;
    }
  }
  return points;
}

export default function SafeMapView({
  lat,
  lng,
  endLat,
  endLng,
  pathCoordinates,
  region,
  country,
  height = 220,
  spots = [],
  theme = 'light',
}: Props) {
  const fallback = (
    <MapPlaceholder region={region} country={country} lat={lat} lng={lng} />
  );

  let Mapbox: any = null;
  try {
    Mapbox = require('@rnmapbox/maps').default;
  } catch {
    return <View style={[styles.container, { height }]}>{fallback}</View>;
  }

  if (!Mapbox) {
    return <View style={[styles.container, { height }]}>{fallback}</View>;
  }

  const MapView = Mapbox.MapView;
  const Camera = Mapbox.Camera;
  const PointAnnotation = Mapbox.PointAnnotation;
  const ShapeSource = Mapbox.ShapeSource;
  const LineLayer = Mapbox.LineLayer;

  // Build path GeoJSON
  const pathGeoJSON =
    pathCoordinates && pathCoordinates.length > 0
      ? {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'LineString' as const,
            coordinates: pathCoordinates,
          },
        }
      : null;

  // Calculate km marker points along the route
  const kmPoints = useMemo(() => {
    if (!pathCoordinates || pathCoordinates.length < 2) return [];
    return getKmPoints(pathCoordinates);
  }, [pathCoordinates]);

  // Calculate bounds if path exists
  let bounds: { ne: [number, number]; sw: [number, number] } | null = null;
  if (pathCoordinates && pathCoordinates.length > 1) {
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    for (const [lo, la] of pathCoordinates) {
      if (lo < minLng) minLng = lo;
      if (lo > maxLng) maxLng = lo;
      if (la < minLat) minLat = la;
      if (la > maxLat) maxLat = la;
    }
    bounds = { ne: [maxLng, maxLat], sw: [minLng, minLat] };
  }

  return (
    <View style={[styles.container, { height }]}>
      <MapErrorBoundary fallback={fallback}>
        <MapView
          style={{ flex: 1 }}
          styleURL="mapbox://styles/mapbox/outdoors-v12"
          localizeLabels={{ locale: 'ko' }}
          scrollEnabled={true}
          zoomEnabled={true}
          pitchEnabled={false}
          rotateEnabled={false}
          attributionEnabled={false}
          logoEnabled={false}>
          <Camera
            {...(bounds
              ? {
                  bounds: {
                    ne: bounds.ne,
                    sw: bounds.sw,
                    // Tighter padding so the path actually fills the
                    // card without microscopic lines at the centre.
                    paddingTop: 28,
                    paddingBottom: 28,
                    paddingLeft: 28,
                    paddingRight: 28,
                  },
                }
              : {
                  centerCoordinate: [lng, lat],
                  zoomLevel: 14,
                })}
            animationDuration={0}
          />

          {/* Path lines — Moru premium 3-layer stack with lineGradient.
              Uses lineMetrics on the source so the gradient expression
              below actually renders. High-contrast palette reads well
              on the outdoors-v12 base. */}
          {pathGeoJSON && (
            <ShapeSource id="pathSource" shape={pathGeoJSON} lineMetrics>
              {/* Dark outline for separation against light terrain */}
              <LineLayer
                id="pathLineOutline"
                style={{
                  lineColor: 'rgba(20, 30, 25, 0.55)',
                  lineWidth: 6.5,
                  lineOpacity: 0.82,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              {/* Warm glow */}
              <LineLayer
                id="pathLineGlow"
                style={{
                  lineColor: '#FFB770',
                  lineWidth: 9,
                  lineOpacity: 0.25,
                  lineCap: 'round',
                  lineJoin: 'round',
                  lineBlur: 3,
                }}
                aboveLayerID="pathLineOutline"
              />
              {/* Main route line with gradient — green start → red end */}
              <LineLayer
                id="pathLine"
                style={{
                  lineWidth: 3.8,
                  lineOpacity: 0.97,
                  lineCap: 'round',
                  lineJoin: 'round',
                  lineGradient: [
                    'interpolate',
                    ['linear'],
                    ['line-progress'],
                    0, '#34C759',
                    0.35, '#E8563D',
                    0.65, '#FFB347',
                    1, '#FF3B30',
                  ] as any,
                }}
                aboveLayerID="pathLineGlow"
              />
            </ShapeSource>
          )}

          {/* Km markers along the route */}
          {kmPoints.map((point) => (
            <PointAnnotation
              key={`km-${point.km}`}
              id={`km-${point.km}`}
              coordinate={point.coordinate}
              anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.kmPill}>
                <Text style={styles.kmText}>{point.km}km</Text>
              </View>
            </PointAnnotation>
          ))}

          {/* Start marker — labeled green pin */}
          <PointAnnotation id="start" coordinate={[lng, lat]}>
            <View style={styles.startMarkerOuter}>
              <View style={styles.startMarkerPulse} />
              <View style={styles.startPin}>
                <Text style={styles.startPinText}>S</Text>
              </View>
            </View>
          </PointAnnotation>

          {/* End marker — labeled red pin */}
          {endLat != null && endLng != null && (
            <PointAnnotation id="end" coordinate={[endLng, endLat]}>
              <View style={styles.endPin}>
                <Text style={styles.endPinText}>E</Text>
              </View>
            </PointAnnotation>
          )}

          {/* Spot markers — small colored dots, no emoji */}
          {spots.map((spot, i) => (
            <PointAnnotation
              key={`spot-${i}`}
              id={`spot-${i}`}
              coordinate={[spot.lng, spot.lat]}
              anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.spotDotMarker}>
                <View style={[styles.spotDotMarkerInner, {
                  backgroundColor: spot.type === 'restaurant' ? '#D85A30' :
                    spot.type === 'cafe' ? '#378ADD' :
                    spot.type === 'photo' ? '#7F77DD' :
                    spot.type === 'viewpoint' ? '#EF9F27' :
                    spot.type === 'danger' ? '#DC2626' : '#6B7280'
                }]} />
              </View>
            </PointAnnotation>
          ))}
        </MapView>
      </MapErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9f4',
    borderRadius: 16,
  },
  placeholderRegion: {
    fontSize: 14,
    color: '#8B95A1',
    fontWeight: '500',
    marginTop: 8,
  },
  placeholderCoords: {
    fontSize: 12,
    color: '#B0B8C1',
    marginTop: 4,
  },

  // Start marker — labeled green pin
  startMarkerOuter: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startMarkerPulse: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(45, 74, 46, 0.15)',
  },
  startPin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2D4A2E',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  startPinText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  endPin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EF4444',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  endPinText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },

  spotPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  spotPinText: {
    fontSize: 13,
  },
  spotDotMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  spotDotMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Legacy end marker (keep for compat)
  endMarkerOuter: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endMarkerInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  endMarkerIcon: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
    marginTop: -1,
  },

  // Km marker pills
  kmPill: {
    backgroundColor: '#1B3A1C',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  kmText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
