import React, { useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
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
import StoryDetailScreen from '../screens/StoryDetailScreen';
import CommunityWriteScreen from '../screens/CommunityWriteScreen';
import RankingsScreen from '../screens/RankingsScreen';
import ChatScreen from '../screens/ChatScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import TrailCreateScreen from '../screens/TrailCreateScreen';
import TrailDrawScreen from '../screens/TrailDrawScreen';
import TrailPublishScreen from '../screens/TrailPublishScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import LikedTrailsScreen from '../screens/LikedTrailsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import TermsScreen from '../screens/TermsScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import SavedTrailsScreen from '../screens/SavedTrailsScreen';
import WalkStatsScreen from '../screens/WalkStatsScreen';
import AddRecordScreen from '../screens/AddRecordScreen';
import ActivityDetailScreen from '../screens/ActivityDetailScreen';
import MyTrailsScreen from '../screens/MyTrailsScreen';
import MapDetailScreen from '../screens/MapDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_CONFIG: {
  name: string;
  label: string;
  icon: string;
  component: React.ComponentType<any>;
}[] = [
  { name: 'Home', label: '홈', icon: '⌂', component: HomeScreen },
  { name: 'Explore', label: '탐색', icon: '⊕', component: ExploreScreen },
  { name: 'Activity', label: '활동', icon: '◈', component: ActivityScreen },
  { name: 'Community', label: '커뮤니티', icon: '⊞', component: CommunityScreen },
  { name: 'Settings', label: 'MY', icon: '⊙', component: SettingsScreen },
];

function AnimatedTabIcon({ icon, isFocused }: { icon: string; isFocused: boolean }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isFocused) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.2, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [isFocused]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Text
        style={{
          fontSize: 20,
          color: isFocused ? colors.primary : colors.textTertiary,
          opacity: isFocused ? 1 : 0.5,
        }}>
        {icon}
      </Text>
    </Animated.View>
  );
}

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
              <AnimatedTabIcon icon={config?.icon || '•'} isFocused={isFocused} />
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
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
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
        <Stack.Screen name="StoryDetail" component={StoryDetailScreen} />
        <Stack.Screen name="CommunityWrite" component={CommunityWriteScreen} />
        <Stack.Screen name="Rankings" component={RankingsScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
        <Stack.Screen name="TrailCreate" component={TrailCreateScreen} />
        <Stack.Screen name="TrailDraw" component={TrailDrawScreen} />
        <Stack.Screen name="TrailPublish" component={TrailPublishScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
        <Stack.Screen name="LikedTrails" component={LikedTrailsScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Terms" component={TermsScreen} />
        <Stack.Screen name="Privacy" component={PrivacyScreen} />
        <Stack.Screen name="SavedTrails" component={SavedTrailsScreen} />
        <Stack.Screen name="WalkStats" component={WalkStatsScreen} />
        <Stack.Screen name="AddRecord" component={AddRecordScreen} />
        <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
        <Stack.Screen name="MyTrails" component={MyTrailsScreen} />
        <Stack.Screen name="MapDetail" component={MapDetailScreen} options={{ gestureEnabled: true }} />
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
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
  },
});
