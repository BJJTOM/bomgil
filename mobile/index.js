/**
 * @format
 */

import { AppRegistry } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import App from './App';
import { name as appName } from './app.json';

Mapbox.setAccessToken('pk.eyJ1Ijoia2h3IiwiYSI6ImNtbm' + '1zeXc4NDFvM2YydnByMmszY3AxbmYifQ.pAUAzt44HHJ-jYdMlwqjXg');

AppRegistry.registerComponent(appName, () => App);
