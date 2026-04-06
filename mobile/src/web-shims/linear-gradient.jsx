import React from 'react';
import { View } from 'react-native';

const LinearGradient = ({ colors, style, children, ...props }) => (
  <View style={[style, { backgroundColor: colors ? colors[0] : '#2D4A2E' }]} {...props}>
    {children}
  </View>
);

export default LinearGradient;
