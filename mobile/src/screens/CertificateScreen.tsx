import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import { useAuthStore } from '../stores/auth';
import { colors } from '../theme/colors';
import { useThemeStore } from '../stores/theme';

const API_BASE = 'https://api.moruwalk.com/api/v1';

export default function CertificateScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDark } = useThemeStore();
  const trailId = route.params?.trailId ?? route.params?.id;
  const accessToken = useAuthStore((s) => s.accessToken);

  const bg = isDark ? '#0a0a0a' : '#FAFAFA';
  const textColor = isDark ? '#FFFFFF' : '#191F28';
  const textSecColor = isDark ? 'rgba(255,255,255,0.6)' : '#8B95A1';

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCertificate = useCallback(async () => {
    if (!trailId) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch certificate as arraybuffer and convert to base64 data URI
      const response = await fetch(`${API_BASE}/trails/${trailId}/certificate/`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        const status = response.status;
        if (status === 403 || status === 400) {
          setError('이 코스를 완주하지 않았습니다.');
        } else {
          setError('인증서를 불러올 수 없습니다.');
        }
        setLoading(false);
        return;
      }
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUri(reader.result as string);
        setLoading(false);
      };
      reader.onerror = () => {
        setError('인증서 이미지를 변환할 수 없습니다.');
        setLoading(false);
      };
      reader.readAsDataURL(blob);
    } catch {
      setError('인증서를 불러올 수 없습니다.');
      setLoading(false);
    }
  }, [trailId, accessToken]);

  useEffect(() => {
    fetchCertificate();
  }, [fetchCertificate]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: 'Moru 완주 인증서를 획득했습니다! Moru에서 확인해보세요!',
        url: imageUri || undefined,
      });
    } catch {
      Alert.alert('공유 실패', '인증서를 공유할 수 없습니다.');
    }
  }, [imageUri]);

  const handleSaveToGallery = useCallback(async () => {
    // On both iOS and Android, the native share sheet allows the user
    // to "Save Image". This is the most reliable approach without
    // extra native deps like react-native-fs or @react-native-camera-roll.
    try {
      await Share.share({
        message: 'Moru 완주 인증서',
        url: imageUri || undefined,
      });
    } catch {
      Alert.alert('저장 실패', '공유 시트를 열 수 없습니다.');
    }
  }, [imageUri]);

  if (!trailId) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top, backgroundColor: bg }]}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>{'⚠️'}</Text>
        <Text style={{ fontSize: 16, color: textColor, fontWeight: '600' }}>{'코스를 찾을 수 없습니다'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.errorBackBtn}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{'돌아가기'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top, backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 16, fontSize: 14, color: textSecColor }}>인증서를 불러오는 중...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top, backgroundColor: bg }]}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>{'⚠️'}</Text>
        <Text style={{ fontSize: 16, color: textColor, fontWeight: '600' }}>{error}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.errorBackBtn}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{'돌아가기'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Close button */}
      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 12 }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}>
        <Feather name="x" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Certificate Image */}
      <View style={styles.imageContainer}>
        {imageUri && (
          <Image
            source={{ uri: imageUri }}
            style={styles.certificateImage}
            resizeMode="contain"
          />
        )}
      </View>

      {/* Action buttons */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 24 }]}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.7}>
          <Feather name="share-2" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>공유</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleSaveToGallery} activeOpacity={0.7}>
          <Feather name="download" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>갤러리 저장</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="x-circle" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>닫기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  certificateImage: {
    width: '100%',
    height: '80%',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  actionBtn: {
    alignItems: 'center',
    gap: 6,
    minWidth: 72,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  errorBackBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#2D4A2E',
    borderRadius: 12,
  },
});
