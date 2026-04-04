import { AppRegistry } from 'react-native';
import App from './App.tsx';

AppRegistry.registerComponent('RoamiApp', () => App);
AppRegistry.runApplication('RoamiApp', {
  rootTag: document.getElementById('root'),
});
