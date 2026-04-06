import React from 'react';
import { Text } from 'react-native';

const ICONS = {
  home: '⌂', search: '⌕', 'message-square': '☐', activity: '◇', user: '○',
  'map-pin': '◉', heart: '♡', share: '↗', star: '★', 'chevron-right': '›',
  'arrow-left': '←', plus: '+', bell: '🔔', settings: '⚙', x: '✕',
};

const Icon = ({ name, size = 20, color = '#000', style }) => (
  <Text style={[{ fontSize: size, color, lineHeight: size + 4 }, style]}>
    {ICONS[name] || '•'}
  </Text>
);

export default Icon;
