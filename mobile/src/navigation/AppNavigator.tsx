import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

import HomeScreen from '../screens/HomeScreen';
import ExploreScreen from '../screens/ExploreScreen';
import CommunityScreen from '../screens/CommunityScreen';
import ActivityScreen from '../screens/ActivityScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import TrailDetailScreen from '../screens/TrailDetailScreen';
import WalkScreen from '../screens/WalkScreen';
import WalkCompleteScreen from '../screens/WalkCompleteScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_CONFIG: {
  name: string;
  label: string;
  icon: string;
  component: React.ComponentType<any>;
}[] = [
  { name: 'Home', label: '\uD648', icon: '\u{1F3E0}', component: HomeScreen },
  { name: 'Explore', label: '\uD0D0\uC0C9', icon: '\u{1F50D}', component: ExploreScreen },
  { name: 'Community', label: '\uCEE4\uBBA4\uB2C8\uD2F0', icon: '\u{1F4AC}', component: CommunityScreen },
  { name: 'Activity', label: '\uD65C\uB3D9', icon: '\u26A1', component: ActivityScreen },
  { name: 'Settings', label: 'MY', icon: '\u2699\uFE0F', component: SettingsScreen },
];

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabBarOuter,
        { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 },
      ]}>
      <View style={styles.tabBarPill}>
        {state.routes.map((route: any, index: number) => {
          const config = TAB_CONFIG.find((t) => t.name === route.name);
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tabItem}
              onPress={onPress}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.tabIcon,
                  { opacity: isFocused ? 1 : 0.4 },
                ]}>
                {config?.icon || ''}
              </Text>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isFocused ? colors.primary : colors.textTertiary,
                    fontWeight: isFocused ? '600' : '400',
                  },
                ]}>
                {config?.label || route.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      {TAB_CONFIG.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
        />
      ))}
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="TrailDetail" component={TrailDetailScreen} />
        <Stack.Screen
          name="Walk"
          component={WalkScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen
          name="WalkComplete"
          component={WalkCompleteScreen}
          options={{ gestureEnabled: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBarOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tabBarPill: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 28,
    height: 64,
    paddingHorizontal: 8,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -4 },
      },
      android: {
        elevation: 16,
      },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
  },
});
