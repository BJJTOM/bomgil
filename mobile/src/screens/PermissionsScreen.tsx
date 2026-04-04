import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';

const PERMISSIONS = [
  {
    key: 'location',
    icon: '📍',
    title: '위치 정보',
    desc: '걷기 경로를 기록하고 주변 코스를 찾습니다',
    required: false,
    label: '선택',
  },
  {
    key: 'notification',
    icon: '🔔',
    title: '알림',
    desc: '새로운 댓글, 좋아요 알림을 받습니다',
    required: false,
    label: '선택',
  },
  {
    key: 'activity',
    icon: '🏃',
    title: '신체 활동',
    desc: '걸음수와 활동 데이터를 기록합니다',
    required: false,
    label: '선택',
  },
];

export default function PermissionsScreen({ onComplete }: { onComplete: () => void }) {
  const insets = useSafeAreaInsets();
  const [agreed, setAgreed] = useState<Record<string, boolean>>({});

  const togglePermission = (key: string) => {
    setAgreed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleContinue = async () => {
    await AsyncStorage.setItem('permissions_shown', 'true');

    // Request actual permissions based on selections
    if (agreed.location) {
      // Location permission will be requested when Walk screen opens
    }
    if (agreed.notification) {
      // Notification permission
    }

    onComplete();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>Roami</Text>
        <Text style={styles.title}>앱 사용을 위해{'\n'}아래 권한이 필요합니다</Text>
        <Text style={styles.subtitle}>선택 권한은 동의하지 않아도 앱을 사용할 수 있습니다</Text>
      </View>

      {/* Permission Items */}
      <View style={styles.permList}>
        {PERMISSIONS.map((perm) => (
          <TouchableOpacity
            key={perm.key}
            style={[styles.permItem, agreed[perm.key] && styles.permItemActive]}
            onPress={() => togglePermission(perm.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.permIcon}>{perm.icon}</Text>
            <View style={styles.permInfo}>
              <View style={styles.permTitleRow}>
                <Text style={styles.permTitle}>{perm.title}</Text>
                <View style={[styles.permBadge, agreed[perm.key] && styles.permBadgeActive]}>
                  <Text style={[styles.permBadgeText, agreed[perm.key] && styles.permBadgeTextActive]}>
                    {agreed[perm.key] ? '동의' : perm.label}
                  </Text>
                </View>
              </View>
              <Text style={styles.permDesc}>{perm.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Info */}
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>• 위치 정보는 걷기 기록 시에만 사용됩니다</Text>
        <Text style={styles.infoText}>• 수집된 정보는 서비스 제공 목적으로만 사용됩니다</Text>
        <Text style={styles.infoText}>• 설정 {'>'} 앱 권한에서 언제든 변경할 수 있습니다</Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.agreeAllBtn} onPress={() => {
          const all: Record<string, boolean> = {};
          PERMISSIONS.forEach(p => all[p.key] = true);
          setAgreed(all);
        }}>
          <Text style={styles.agreeAllText}>전체 동의</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
          <Text style={styles.continueBtnText}>시작하기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 24 },
  header: { marginBottom: 32 },
  appName: { fontSize: 16, fontWeight: '700', color: colors.primary, marginBottom: 16, fontFamily: 'System' },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, lineHeight: 34 },
  subtitle: { fontSize: 13, color: colors.textTertiary, marginTop: 8 },
  permList: { gap: 12 },
  permItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: '#fff',
  },
  permItemActive: { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
  permIcon: { fontSize: 28 },
  permInfo: { flex: 1 },
  permTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  permTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  permBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: colors.bgSecondary },
  permBadgeActive: { backgroundColor: colors.primary },
  permBadgeText: { fontSize: 11, fontWeight: '600', color: colors.textTertiary },
  permBadgeTextActive: { color: '#fff' },
  permDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  infoBox: { marginTop: 24, padding: 16, backgroundColor: colors.bgSecondary, borderRadius: 12, gap: 6 },
  infoText: { fontSize: 11, color: colors.textTertiary, lineHeight: 16 },
  buttons: { marginTop: 'auto', gap: 10, paddingTop: 20 },
  agreeAllBtn: { padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.borderDefault, alignItems: 'center' },
  agreeAllText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  continueBtn: { padding: 16, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' },
  continueBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
