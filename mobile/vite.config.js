import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      'react-native-maps': path.resolve(__dirname, 'src/web-shims/maps.jsx'),
      'react-native-vector-icons/Feather': path.resolve(__dirname, 'src/web-shims/feather.jsx'),
      'react-native-geolocation-service': path.resolve(__dirname, 'src/web-shims/geolocation.js'),
      'react-native-linear-gradient': path.resolve(__dirname, 'src/web-shims/linear-gradient.jsx'),
      '@react-native-async-storage/async-storage': path.resolve(__dirname, 'src/web-shims/async-storage.js'),
    },
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
  },
  server: {
    port: 3600,
  },
});
