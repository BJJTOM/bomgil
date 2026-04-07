import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';
import AppNavigator from './src/navigation/AppNavigator';
import PermissionsScreen from './src/screens/PermissionsScreen';
import SplashScreen from './src/components/SplashScreen';
import { requestNotificationPermission } from './src/utils/notifications';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60000, retry: 1 } },
});

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [showPermissions, setShowPermissions] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('permissions_shown').then((val) => {
      setShowPermissions(val !== 'true');
    });
  }, []);

  useEffect(() => {
    // Initialize Firebase services on first launch
    crashlytics().setCrashlyticsCollectionEnabled(true);
    analytics().logEvent('app_open');
    requestNotificationPermission();
  }, []);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (showPermissions === null) return null; // Loading

  if (showPermissions) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PermissionsScreen onComplete={() => setShowPermissions(false)} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
