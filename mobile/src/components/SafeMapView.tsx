import React, { useEffect } from 'react';
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
  const pathGeoJSON = pathCoordinates && pathCoordinates.length > 0
    ? {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: pathCoordinates,
        },
      }
    : null;

  // Calculate bounds if path exists
  let bounds: { ne: [number, number]; sw: [number, number] } | null = null;
  if (pathCoordinates && pathCoordinates.length > 1) {
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
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
                    paddingTop: 30,
                    paddingBottom: 30,
                    paddingLeft: 30,
                    paddingRight: 30,
                  },
                }
              : {
                  centerCoordinate: [lng, lat],
                  zoomLevel: 14,
                })}
            animationDuration={0}
          />

          {/* Start marker */}
          <PointAnnotation id="start" coordinate={[lng, lat]}>
            <View style={styles.markerStart}>
              <View style={styles.markerDot} />
            </View>
          </PointAnnotation>

          {/* End marker */}
          {endLat != null && endLng != null && (
            <PointAnnotation id="end" coordinate={[endLng, endLat]}>
              <View style={styles.markerEnd}>
                <View style={styles.markerDotEnd} />
              </View>
            </PointAnnotation>
          )}

          {/* Path line */}
          {pathGeoJSON && (
            <ShapeSource id="pathSource" shape={pathGeoJSON}>
              <LineLayer
                id="pathLine"
                style={{
                  lineColor: colors.primary,
                  lineWidth: 4,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </ShapeSource>
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
  markerStart: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(74,222,128,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerEnd: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDotEnd: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#fff',
  },
});
