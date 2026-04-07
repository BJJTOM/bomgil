import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';
import CommunityBoardTab from './community/CommunityBoardTab';
import CommunityGroupTab from './community/CommunityGroupTab';
import CommunityChallengeTab from './community/CommunityChallengeTab';

const TABS = [
  { key: 'feed', label: '피드' },
  { key: 'group', label: '모임' },
  { key: 'challenge', label: '챌린지' },
];

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState(0);
  const [searchVisible, setSearchVisible] = useState(false);

  const getFabAction = () => {
    if (!isAuthenticated) return () => navigation.navigate('Login');
    switch (TABS[activeTab].key) {
      case 'feed': return () => navigation.navigate('PostCreate');
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
            <Feather name="bell" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Bar + Search icon */}
      <View style={styles.tabBar}>
        <View style={styles.tabItems}>
          {TABS.map((tab, i) => (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => setActiveTab(i)}
              activeOpacity={0.7}>
              <Text style={[styles.tabLabel, activeTab === i && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {activeTab === i && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={styles.tabSearchBtn}
          onPress={() => setSearchVisible(!searchVisible)}>
          <Feather name="search" size={18} color={searchVisible ? colors.primary : colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Tab Content — 스와이프 대신 직접 렌더 (제스처 충돌 방지) */}
      <View style={styles.tabContent}>
        {activeTab === 0 && <CommunityBoardTab searchVisible={searchVisible} />}
        {activeTab === 1 && <CommunityGroupTab />}
        {activeTab === 2 && <CommunityChallengeTab />}
      </View>

      {/* FAB */}
      {fabAction && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 80 }]}
          activeOpacity={0.85}
          onPress={fabAction}>
          <Feather name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F7F8FA',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnText: { fontSize: 16 },

  // Tab bar
  tabBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F2F4F6',
  },
  tabItems: { flexDirection: 'row', flex: 1 },
  tabSearchBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  tabItem: { marginRight: 24, paddingVertical: 12, position: 'relative' },
  tabLabel: { fontSize: 15, fontWeight: '500', color: colors.textTertiary },
  tabLabelActive: { color: colors.primary, fontWeight: '700' },
  tabIndicator: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 2.5, borderRadius: 1.5, backgroundColor: colors.primary,
  },

  // Content
  tabContent: { flex: 1 },

  // FAB
  fab: {
    position: 'absolute', right: 20,
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 30 },
});
