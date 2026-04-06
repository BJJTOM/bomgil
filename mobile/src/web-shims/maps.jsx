import React from 'react';
import { View, Text } from 'react-native';

const MapView = ({ style, children }) => (
  <View style={[{ backgroundColor: '#f0f9f4', alignItems: 'center', justifyContent: 'center', minHeight: 200, borderRadius: 16 }, style]}>
    <Text style={{ fontSize: 40 }}>🗺️</Text>
    <Text style={{ color: '#999', fontSize: 13, marginTop: 8 }}>Map Preview</Text>
  </View>
);

export const Polyline = () => null;
export const Marker = () => null;
export default MapView;
