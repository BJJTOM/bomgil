const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './index.web.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  devServer: {
    port: 3600,
    hot: true,
    historyApiFallback: true,
    static: { directory: path.resolve(__dirname, 'public') },
  },
  resolve: {
    alias: {
      'react-native$': 'react-native-web',
      'react-native-maps': path.resolve(__dirname, 'src/web-shims/maps.js'),
      'react-native-vector-icons/Feather': path.resolve(__dirname, 'src/web-shims/feather.js'),
      'react-native-geolocation-service': path.resolve(__dirname, 'src/web-shims/geolocation.js'),
      'react-native-linear-gradient': path.resolve(__dirname, 'src/web-shims/linear-gradient.js'),
      '@react-native-async-storage/async-storage': path.resolve(__dirname, 'src/web-shims/async-storage.js'),
    },
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules\/(?!(react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|@react-navigation)\/).*/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'],
            plugins: ['react-native-web', 'react-native-reanimated/plugin'],
          },
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './public/index.html' }),
  ],
};
