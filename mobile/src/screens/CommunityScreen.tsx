import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';
import CommunityFeedTab from './community/CommunityFeedTab';
import CommunityBoardTab from './community/CommunityBoardTab';
import CommunityGroupTab from './community/CommunityGroupTab';
import CommunityChallengeTab from './community/CommunityChallengeTab';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
  { key: 'feed', label: '피드', icon: '📝' },
  { key: 'board', label: '게시판', icon: '💬' },
  { key: 'group', label: '모임', icon: '👥' },
  { key: 'challenge', label: '챌린지', icon: '🏆' },
];

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  const handleTabPress = useCallback((index: number) => {
    setActiveTab(index);
    scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * index, animated: true });
    Animated.spring(indicatorAnim, {
      toValue: index,
      useNativeDriver: true,
      tension: 300,
      friction: 30,
    }).start();
  }, []);

  const handleScroll = useCallback((e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / SCREEN_WIDTH);
    if (index !== activeTab) {
      setActiveTab(index);
      Animated.spring(indicatorAnim, {
        toValue: index,
        useNativeDriver: true,
        tension: 300,
        friction: 30,
      }).start();
    }
  }, [activeTab]);

  const tabWidth = (SCREEN_WIDTH - 40) / TABS.length;
  const indicatorTranslate = indicatorAnim.interpolate({
    inputRange: TABS.map((_, i) => i),
    outputRange: TABS.map((_, i) => i * tabWidth),
  });

  const getFabAction = () => {
    if (!isAuthenticated) return () => navigation.navigate('Login');
    switch (TABS[activeTab].key) {
      case 'feed': return () => navigation.navigate('CommunityWrite');
      case 'board': return () => navigation.navigate('PostCreate');
      case 'group': return () => navigation.navigate('GroupCreate');
      default: return null;
    }
  };

  const fabAction = getFabAction();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>커뮤니티</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.iconBtnEmoji}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Chat')}>
            <Text style={styles.iconBtnEmoji}>💬</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Bar — 토스 스타일 */}
      <View style={styles.tabBar}>
        <View style={styles.tabBarInner}>
          {TABS.map((tab, i) => (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => handleTabPress(i)}
              activeOpacity={0.7}>
              <Text style={[
                styles.tabLabel,
                activeTab === i && styles.tabLabelActive,
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
          <Animated.View
            style={[
              styles.tabIndicator,
              {
                width: tabWidth - 16,
                transform: [{ translateX: Animated.add(indicatorTranslate, 8) }],
              },
            ]}
          />
        </View>
      </View>

      {/* Tab Content */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}>
        <View style={{ width: SCREEN_WIDTH }}><CommunityFeedTab /></View>
        <View style={{ width: SCREEN_WIDTH }}><CommunityBoardTab /></View>
        <View style={{ width: SCREEN_WIDTH }}><CommunityGroupTab /></View>
        <View style={{ width: SCREEN_WIDTH }}><CommunityChallengeTab /></View>
      </ScrollView>

      {/* FAB */}
      {fabAction && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 80 }]}
          activeOpacity={0.85}
          onPress={fabAction}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnEmoji: {
    fontSize: 15,
  },

  // Tab bar — 토스/당근 스타일
  tabBar: {
    paddingHorizontal: 20,
  },
  tabBarInner: {
    flexDirection: 'row',
    position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F4F6',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  tabLabelActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.textPrimary,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 26,
  },
});
