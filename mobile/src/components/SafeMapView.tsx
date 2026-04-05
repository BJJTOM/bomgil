import React from 'react';
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

  let MapViewComponent: any = null;
  let MarkerComponent: any = null;
  let PolylineComponent: any = null;

  try {
    const maps = require('react-native-maps');
    MapViewComponent = maps.default;
    MarkerComponent = maps.Marker;
    PolylineComponent = maps.Polyline;
  } catch {
    return <View style={[styles.container, { height }]}>{fallback}</View>;
  }

  if (!MapViewComponent) {
    return <View style={[styles.container, { height }]}>{fallback}</View>;
  }

  return (
    <View style={[styles.container, { height }]}>
      <MapErrorBoundary fallback={fallback}>
        <MapViewComponent
          style={{ flex: 1 }}
          initialRegion={{
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          scrollEnabled={false}
          zoomEnabled={false}>
          <MarkerComponent
            coordinate={{ latitude: lat, longitude: lng }}
            title={'\uCD9C\uBC1C'}
          />
          {endLat != null && endLng != null && (
            <MarkerComponent
              coordinate={{ latitude: endLat, longitude: endLng }}
              title={'\uB3C4\uCC29'}
              pinColor="red"
            />
          )}
          {pathCoordinates && pathCoordinates.length > 0 && (
            <PolylineComponent
              coordinates={pathCoordinates.map(([lo, la]: [number, number]) => ({
                latitude: la,
                longitude: lo,
              }))}
              strokeColor={colors.primary}
              strokeWidth={4}
            />
          )}
        </MapViewComponent>
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
});
