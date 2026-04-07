import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
    }
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    if (enabled) {
      const token = await messaging().getToken();
      console.log('[Moru] FCM Token:', token);
      return token;
    }
    return null;
  } catch (e) {
    console.log('[Moru] Notification permission error:', e);
    return null;
  }
}

export function onMessageReceived(callback: (message: any) => void) {
  return messaging().onMessage(callback);
}
