import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  lat: number;
  lng: number;
  endLat?: number;
  endLng?: number;
  pathCoordinates?: [number, number][];
  region?: string;
  country?: string;
  height?: number;
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
      <Text style={{ fontSize: 36 }}>{'\u{1F5FA}\uFE0F'}</Text>
      <Text style={styles.placeholderRegion}>
        {region || ''} {country || ''}
      </Text>
      <Text style={styles.placeholderCoords}>
        {lat.toFixed(4)}\u00B0N, {lng.toFixed(4)}\u00B0E
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
          scrollEnabled={false}
          zoomEnabled={false}
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
                    paddingTop: 50,
                    paddingBottom: 50,
                    paddingLeft: 50,
                    paddingRight: 50,
                  },
                }
              : {
                  centerCoordinate: [lng, lat],
                  zoomLevel: 14,
                })}
            animationDuration={0}
          />

          {/* Path lines — double-line effect for premium look */}
          {pathGeoJSON && (
            <ShapeSource id="pathSource" shape={pathGeoJSON}>
              {/* Background border line (white, wider) */}
              <LineLayer
                id="pathLineBorder"
                style={{
                  lineColor: '#FFFFFF',
                  lineWidth: 8,
                  lineOpacity: 0.8,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              {/* Main route line (brand green, narrower) */}
              <LineLayer
                id="pathLine"
                style={{
                  lineColor: '#2D4A2E',
                  lineWidth: 5,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
                aboveLayerID="pathLineBorder"
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

          {/* Start marker — green with pulsing outer ring */}
          <PointAnnotation id="start" coordinate={[lng, lat]}>
            <View style={styles.startMarkerOuter}>
              <View style={styles.startMarkerPulse} />
              <View style={styles.startMarkerInner} />
            </View>
          </PointAnnotation>

          {/* End marker — red with checkmark */}
          {endLat != null && endLng != null && (
            <PointAnnotation id="end" coordinate={[endLng, endLat]}>
              <View style={styles.endMarkerOuter}>
                <View style={styles.endMarkerInner}>
                  <Text style={styles.endMarkerIcon}>{'\u2713'}</Text>
                </View>
              </View>
            </PointAnnotation>
          )}
        </MapView>
      </MapErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F2F4F6',
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

  // Start marker — green circle with white border + pulsing outer ring
  startMarkerOuter: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startMarkerPulse: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(45, 74, 46, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(45, 74, 46, 0.3)',
  },
  startMarkerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2D4A2E',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },

  // End marker — red circle with white border + checkmark
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
