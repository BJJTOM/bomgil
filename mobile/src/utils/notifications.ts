import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';

/**
 * Push the FCM token to the backend so the server can deliver notifications.
 * Silent on failure — retries on next app launch / token refresh.
 */
export async function registerFcmTokenWithBackend(token: string): Promise<void> {
  try {
    if (!useAuthStore.getState().isAuthenticated) return;
    await api.post('/auth/fcm-token/', { token });
  } catch {
    // Best-effort. Will be re-attempted on next launch.
  }
}

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
      // Fire-and-forget upload to backend.
      registerFcmTokenWithBackend(token);
      // Re-register on token rotation (e.g. Play Services refresh).
      messaging().onTokenRefresh((newToken) => {
        console.log('[Moru] FCM Token refreshed');
        registerFcmTokenWithBackend(newToken);
      });
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
