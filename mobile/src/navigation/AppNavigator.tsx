import React, { useRef, useEffect, useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../stores/auth';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';
import { useT } from '../i18n';

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
import NoticeScreen from '../screens/NoticeScreen';
import TermsScreen from '../screens/TermsScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import SavedTrailsScreen from '../screens/SavedTrailsScreen';
import BookmarkedTrailsScreen from '../screens/BookmarkedTrailsScreen';
import TrailSeriesListScreen from '../screens/TrailSeriesListScreen';
import TrailSeriesDetailScreen from '../screens/TrailSeriesDetailScreen';
import TrailConditionsScreen from '../screens/TrailConditionsScreen';
import { useThemeStore } from '../stores/theme';
import WalkStatsScreen from '../screens/WalkStatsScreen';
import StrideCalibrationScreen from '../screens/StrideCalibrationScreen';
import AddRecordScreen from '../screens/AddRecordScreen';
import ActivityDetailScreen from '../screens/ActivityDetailScreen';
import MyTrailsScreen from '../screens/MyTrailsScreen';
import MapDetailScreen from '../screens/MapDetailScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import PostCreateScreen from '../screens/PostCreateScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import GroupCreateScreen from '../screens/GroupCreateScreen';
import GroupChatScreen from '../screens/GroupChatScreen';
import ChallengeDetailScreen from '../screens/ChallengeDetailScreen';
import HealthImportScreen from '../screens/HealthImportScreen';
import PasswordChangeScreen from '../screens/PasswordChangeScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import FollowListScreen from '../screens/FollowListScreen';
import PermissionsScreen from '../screens/PermissionsScreen';
import PhoneAuthScreen from '../screens/PhoneAuthScreen';
import CompanionsScreen from '../screens/CompanionsScreen';
import WalkPlanCreateScreen from '../screens/WalkPlanCreateScreen';
import MyWalkPlansScreen from '../screens/MyWalkPlansScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_CONFIG: {
  name: string;
  label: string;
  icon: string;
  component: React.ComponentType<any>;
}[] = [
  { name: 'Home', label: '홈', icon: 'home', component: HomeScreen },
  { name: 'Explore', label: '탐색', icon: 'compass', component: ExploreScreen },
  { name: 'Activity', label: '활동', icon: 'activity', component: ActivityScreen },
  { name: 'Community', label: '커뮤니티', icon: 'message-circle', component: CommunityScreen },
  { name: 'Settings', label: 'MY', icon: 'user', component: SettingsScreen },
];

function AnimatedTabIcon({ icon, isFocused }: { icon: string; isFocused: boolean }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isFocused) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.15, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [isFocused]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Feather
        name={icon}
        size={22}
        color={isFocused ? colors.primary : '#ADB5BD'}
      />
    </Animated.View>
  );
}

const TAB_I18N_KEYS: Record<string, keyof typeof import('../i18n/ko').default['tabs']> = {
  Home: 'home',
  Explore: 'explore',
  Activity: 'activity',
  Community: 'community',
  Settings: 'my',
};

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const { isDark } = useThemeStore();
  const pillBg = isDark ? '#1c1c1e' : '#fff';
  const inactiveColor = isDark ? 'rgba(255,255,255,0.42)' : colors.textTertiary;

  return (
    <View
      style={[
        styles.tabBarOuter,
        { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 },
      ]}>
      <View style={[styles.tabBarPill, { backgroundColor: pillBg }]}>
        {state.routes.map((route: any, index: number) => {
          const config = TAB_CONFIG.find((tc) => tc.name === route.name);
          const isFocused = state.index === index;
          const i18nKey = TAB_I18N_KEYS[route.name];
          const label = i18nKey ? t.tabs[i18nKey] : (config?.label || route.name);

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
                    color: isFocused ? colors.primary : inactiveColor,
                    fontWeight: isFocused ? '600' : '400',
                  },
                ]}>
                {label}
              </Text>
              {isFocused && <View style={styles.activeIndicator} />}
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

const ONBOARDING_KEY = '@moru_onboarding_complete';

export default function AppNavigator() {
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const isAuthenticated = useAuthStore((s: any) => s.isAuthenticated);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((value) => {
      setOnboardingDone(value === 'true');
    }).catch(() => setOnboardingDone(true));
  }, []);

  if (onboardingDone === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Determine initial route:
  // 1. Onboarding if first time
  // 2. Login if not authenticated
  // 3. Main if logged in
  const initialRoute = !onboardingDone ? 'Onboarding' : (isAuthenticated ? 'Main' : 'Login');

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }} initialRouteName={initialRoute}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ gestureEnabled: false }} />
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
        <Stack.Screen name="Notice" component={NoticeScreen} />
        <Stack.Screen name="Terms" component={TermsScreen} />
        <Stack.Screen name="Privacy" component={PrivacyScreen} />
        <Stack.Screen name="SavedTrails" component={SavedTrailsScreen} />
        <Stack.Screen name="BookmarkedTrails" component={BookmarkedTrailsScreen} />
        <Stack.Screen name="TrailSeriesList" component={TrailSeriesListScreen} />
        <Stack.Screen name="TrailSeriesDetail" component={TrailSeriesDetailScreen} />
        <Stack.Screen name="TrailConditions" component={TrailConditionsScreen} />
        <Stack.Screen name="WalkStats" component={WalkStatsScreen} />
        <Stack.Screen name="StrideCalibration" component={StrideCalibrationScreen} />
        <Stack.Screen name="AddRecord" component={AddRecordScreen} />
        <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
        <Stack.Screen name="MyTrails" component={MyTrailsScreen} />
        <Stack.Screen name="MapDetail" component={MapDetailScreen} options={{ gestureEnabled: true }} />
        <Stack.Screen name="PostDetail" component={PostDetailScreen} />
        <Stack.Screen name="PostCreate" component={PostCreateScreen} />
        <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
        <Stack.Screen name="GroupCreate" component={GroupCreateScreen} />
        <Stack.Screen name="GroupChat" component={GroupChatScreen} />
        <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen} />
        <Stack.Screen name="HealthImport" component={HealthImportScreen} />
        <Stack.Screen name="PasswordChange" component={PasswordChangeScreen} />
        <Stack.Screen name="FollowList" component={FollowListScreen} />
        <Stack.Screen name="Permissions" component={PermissionsScreen} />
        <Stack.Screen name="PhoneAuth" component={PhoneAuthScreen} />
        <Stack.Screen name="Companions" component={CompanionsScreen} />
        <Stack.Screen name="WalkPlanCreate" component={WalkPlanCreateScreen} />
        <Stack.Screen name="MyWalkPlans" component={MyWalkPlansScreen} />
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
        shadowOpacity: 0.1,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -2 },
      },
      android: {
        elevation: 12,
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
    marginTop: 2,
  },
  activeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 3,
  },
});
