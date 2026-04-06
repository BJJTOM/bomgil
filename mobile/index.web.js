import { AppRegistry } from 'react-native';
import App from './App.tsx';

AppRegistry.registerComponent('MoruApp', () => App);
AppRegistry.runApplication('MoruApp', {
  rootTag: document.getElementById('root'),
});
