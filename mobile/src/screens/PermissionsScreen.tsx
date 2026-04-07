import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Linking, PermissionsAndroid } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';

interface PermissionItem {
  name: string;
  icon: string;
  desc: string;
  status: 'granted' | 'denied' | 'unknown' | 'checking';
}

export default function PermissionsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [permissions, setPermissions] = useState<PermissionItem[]>([
    { name: '위치 (GPS)', icon: 'map-pin', desc: '걷기 기록, 주변 코스 검색', status: 'checking' },
    { name: '백그라운드 위치', icon: 'navigation', desc: '걷기 중 앱 전환 시 기록 유지', status: 'checking' },
    { name: '카메라', icon: 'camera', desc: '걷기 중 사진 촬영', status: 'checking' },
    { name: '사진/미디어', icon: 'image', desc: '이미지 첨부', status: 'checking' },
    { name: '신체 활동', icon: 'activity', desc: '걸음수 측정', status: 'checking' },
    { name: '알림', icon: 'bell', desc: '푸시 알림 수신', status: 'checking' },
  ]);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    if (Platform.OS !== 'android') return;

    const checks = [
      { idx: 0, perm: PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION },
      { idx: 1, perm: PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION },
      { idx: 2, perm: PermissionsAndroid.PERMISSIONS.CAMERA },
      { idx: 3, perm: (PermissionsAndroid.PERMISSIONS as any).READ_MEDIA_IMAGES || PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE },
      { idx: 4, perm: PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION },
      { idx: 5, perm: (PermissionsAndroid.PERMISSIONS as any).POST_NOTIFICATIONS },
    ];

    const updated = [...permissions];
    for (const check of checks) {
      try {
        if (check.perm) {
          const result = await PermissionsAndroid.check(check.perm);
          updated[check.idx] = { ...updated[check.idx], status: result ? 'granted' : 'denied' };
        } else {
          updated[check.idx] = { ...updated[check.idx], status: 'unknown' };
        }
      } catch {
        updated[check.idx] = { ...updated[check.idx], status: 'unknown' };
      }
    }
    setPermissions(updated);
  };

  const statusColor = (s: string) => {
    if (s === 'granted') return '#22C55E';
    if (s === 'denied') return '#EF4444';
    return colors.textTertiary;
  };

  const statusLabel = (s: string) => {
    if (s === 'granted') return '허용됨';
    if (s === 'denied') return '거부됨';
    if (s === 'checking') return '확인 중...';
    return '알 수 없음';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>앱 권한 관리</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.sectionDesc}>
          모루 앱이 사용하는 권한 목록입니다.{'\n'}
          거부된 권한은 설정에서 변경할 수 있습니다.
        </Text>

        {permissions.map((perm, i) => (
          <View key={i} style={styles.permRow}>
            <View style={[styles.permIcon, { backgroundColor: statusColor(perm.status) + '15' }]}>
              <Feather name={perm.icon} size={18} color={statusColor(perm.status)} />
            </View>
            <View style={styles.permInfo}>
              <Text style={styles.permName}>{perm.name}</Text>
              <Text style={styles.permDesc}>{perm.desc}</Text>
            </View>
            <View style={[styles.permStatus, { backgroundColor: statusColor(perm.status) + '15' }]}>
              <Text style={[styles.permStatusText, { color: statusColor(perm.status) }]}>
                {statusLabel(perm.status)}
              </Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => Linking.openSettings()}
          activeOpacity={0.7}>
          <Feather name="settings" size={16} color={colors.primary} />
          <Text style={styles.settingsBtnText}>시스템 설정에서 권한 변경</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingsBtn, { marginTop: 8 }]}
          onPress={checkPermissions}
          activeOpacity={0.7}>
          <Feather name="refresh-cw" size={16} color={colors.primary} />
          <Text style={styles.settingsBtnText}>권한 상태 새로고침</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  sectionDesc: {
    fontSize: 13, color: colors.textTertiary, lineHeight: 20,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  permRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 20, marginBottom: 8,
    padding: 14, borderRadius: 14,
  },
  permIcon: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  permInfo: { flex: 1 },
  permName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  permDesc: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  permStatus: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  permStatusText: { fontSize: 11, fontWeight: '600' },
  settingsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 20, marginTop: 20,
    paddingVertical: 14, borderRadius: 14, backgroundColor: '#fff',
  },
  settingsBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
});
