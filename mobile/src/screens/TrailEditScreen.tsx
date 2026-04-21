import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
  Image,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';
import { colors } from '../theme/colors';
import { Trail } from '../types';
import PrettyAlert, { PrettyAlertType } from '../components/PrettyAlert';

const API_BASE = 'https://api.moruwalk.com';

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

// ---------------------------------------------------------------------------
// Constants (matching TrailPublishScreen patterns)
// ---------------------------------------------------------------------------

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: '쉬움' },
  { value: 'moderate', label: '보통' },
  { value: 'hard', label: '어려움' },
];

const SEASON_OPTIONS = [
  { value: 'spring', label: '봄' },
  { value: 'summer', label: '여름' },
  { value: 'autumn', label: '가을' },
  { value: 'winter', label: '겨울' },
];

const TRAIL_TYPE_OPTIONS = [
  { value: 'one_way', label: '편도' },
  { value: 'round_trip', label: '왕복' },
  { value: 'loop', label: '순환' },
];

const SURFACE_OPTIONS = [
  { value: 'paved', label: '포장' },
  { value: 'unpaved', label: '비포장' },
  { value: 'mixed', label: '혼합' },
];

// ---------------------------------------------------------------------------
// Permission helpers (same as TrailPublishScreen)
// ---------------------------------------------------------------------------

async function ensureMediaPermissions(kind: 'camera' | 'library'): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    if (kind === 'camera') {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: '카메라 권한',
          message: '사진을 촬영하려면 카메라 권한이 필요해요.',
          buttonPositive: '허용',
          buttonNegative: '취소',
        },
      );
      return res === PermissionsAndroid.RESULTS.GRANTED;
    }
    const perm =
      Number(Platform.Version) >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
    const res = await PermissionsAndroid.request(perm, {
      title: '사진 권한',
      message: '갤러리에서 사진을 선택하려면 권한이 필요해요.',
      buttonPositive: '허용',
      buttonNegative: '취소',
    });
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function showPermissionDeniedAlert(kind: 'camera' | 'library') {
  const label = kind === 'camera' ? '카메라' : '사진';
  Alert.alert(
    `${label} 권한이 필요해요`,
    '설정에서 권한을 허용해주세요.',
    [
      { text: '취소', style: 'cancel' },
      { text: '설정 열기', onPress: () => Linking.openSettings().catch(() => {}) },
    ],
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TrailEditScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const trailId = route.params?.trailId ?? route.params?.id;
  const currentUser = useAuthStore((s) => s.user);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('moderate');
  const [bestSeason, setBestSeason] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [elevationGain, setElevationGain] = useState('');
  const [trailType, setTrailType] = useState('one_way');
  const [surface, setSurface] = useState('mixed');
  const [transportAccess, setTransportAccess] = useState('');
  const [coverImage, setCoverImage] = useState<any>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formReady, setFormReady] = useState(false);

  // Pretty validation alert state
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    type: PrettyAlertType;
    title: string;
    message?: string;
  }>({ visible: false, type: 'warning', title: '' });
  const showPrettyAlert = useCallback((type: PrettyAlertType, titleText: string, message?: string) => {
    setAlertState({ visible: true, type, title: titleText, message });
  }, []);
  const closePrettyAlert = useCallback(() => {
    setAlertState(s => ({ ...s, visible: false }));
  }, []);

  // Fetch trail data
  const { data: trail, isLoading, error } = useQuery({
    queryKey: ['trail', trailId],
    queryFn: async () => {
      const { data } = await api.get(`/trails/${trailId}/`);
      return data as Trail;
    },
    enabled: !!trailId,
    retry: 1,
    staleTime: 30000,
  });

  // Pre-fill form when trail data loads
  useEffect(() => {
    if (!trail) return;
    setTitle(trail.title || '');
    setDescription(trail.description || '');
    setDifficulty(trail.difficulty || 'moderate');
    setBestSeason(trail.best_season || '');
    setDistanceKm(trail.distance_km ? String(trail.distance_km) : '');
    setEstimatedMinutes(trail.estimated_minutes ? String(trail.estimated_minutes) : '');
    setElevationGain(trail.elevation_gain != null ? String(trail.elevation_gain) : '');
    setTrailType(trail.trail_type || 'one_way');
    setSurface(trail.walking_surface || 'mixed');
    setTransportAccess(trail.transport_access || '');
    setExistingCoverUrl(resolveImageUrl(trail.cover_image));
    setFormReady(true);
  }, [trail]);

  // Author-only access check
  const isAuthor = trail && currentUser && trail.author?.id === currentUser.id;

  const pickCoverImage = useCallback(() => {
    Alert.alert('커버 사진', '사진을 선택해주세요', [
      {
        text: '카메라',
        onPress: async () => {
          const ok = await ensureMediaPermissions('camera');
          if (!ok) { showPermissionDeniedAlert('camera'); return; }
          launchCamera({ mediaType: 'photo', quality: 0.7, maxWidth: 1600, maxHeight: 1600, saveToPhotos: false }, (res) => {
            if (res.errorCode) {
              Alert.alert('카메라 오류', res.errorMessage || res.errorCode);
              return;
            }
            if (res.assets?.[0]) setCoverImage(res.assets[0]);
          });
        },
      },
      {
        text: '갤러리',
        onPress: async () => {
          const ok = await ensureMediaPermissions('library');
          if (!ok) { showPermissionDeniedAlert('library'); return; }
          launchImageLibrary({ mediaType: 'photo', quality: 0.7, maxWidth: 1600, maxHeight: 1600, selectionLimit: 1 }, (res) => {
            if (res.errorCode) {
              Alert.alert('갤러리 오류', res.errorMessage || res.errorCode);
              return;
            }
            if (res.assets?.[0]) setCoverImage(res.assets[0]);
          });
        },
      },
      { text: '취소', style: 'cancel' },
    ]);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      showPrettyAlert('warning', '코스 이름을 입력해주세요');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      if (description.trim()) formData.append('description', description.trim());
      formData.append('difficulty', difficulty);
      if (bestSeason) formData.append('best_season', bestSeason);
      if (distanceKm.trim()) formData.append('distance_km', distanceKm.trim());
      if (estimatedMinutes.trim()) formData.append('estimated_minutes', estimatedMinutes.trim());
      if (elevationGain.trim()) formData.append('elevation_gain', elevationGain.trim());
      formData.append('trail_type', trailType);
      formData.append('walking_surface', surface);
      if (transportAccess.trim()) formData.append('transport_access', transportAccess.trim());

      if (coverImage) {
        formData.append('cover_image', {
          uri: coverImage.uri,
          type: coverImage.type || 'image/jpeg',
          name: coverImage.fileName || 'cover.jpg',
        } as any);
      }

      await api.patch(`/trails/${trailId}/`, formData);

      queryClient.invalidateQueries({ queryKey: ['trail', trailId] });
      queryClient.invalidateQueries({ queryKey: ['trails'] });
      queryClient.invalidateQueries({ queryKey: ['trails-all'] });
      queryClient.invalidateQueries({ queryKey: ['my-trails'] });

      showPrettyAlert('success', '수정 완료', '코스가 성공적으로 수정되었습니다!');
      setTimeout(() => navigation.goBack(), 900);
    } catch (err: any) {
      const errData = err?.response?.data;
      let msg = '코스 수정에 실패했습니다.';
      if (errData && typeof errData === 'object') {
        const firstKey = Object.keys(errData)[0];
        const firstVal = Array.isArray(errData[firstKey]) ? errData[firstKey][0] : errData[firstKey];
        msg = `${firstKey}: ${firstVal}`;
      }
      showPrettyAlert('error', '오류', msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    title, description, difficulty, bestSeason, distanceKm, estimatedMinutes,
    elevationGain, trailType, surface, transportAccess, coverImage, trailId, navigation,
  ]);

  // --- Loading / Error states ---

  if (!trailId) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>{'⚠️'}</Text>
        <Text style={{ fontSize: 16, color: colors.textPrimary, fontWeight: '600' }}>{'코스를 찾을 수 없습니다'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.errorBackBtn}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{'돌아가기'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading || !trail) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>{'⚠️'}</Text>
        <Text style={{ fontSize: 16, color: colors.textPrimary, fontWeight: '600' }}>{'코스를 불러올 수 없습니다'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.errorBackBtn}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{'돌아가기'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isAuthor) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>{'🔒'}</Text>
        <Text style={{ fontSize: 16, color: colors.textPrimary, fontWeight: '600' }}>{'작성자만 수정할 수 있습니다'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.errorBackBtn}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{'돌아가기'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!formReady) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const coverPreviewUri = coverImage?.uri || existingCoverUrl;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Text style={styles.backBtnText}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>코스 수정</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* 1. Title */}
        <Text style={styles.fieldLabel}>코스 이름 <Text style={styles.requiredMark}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="예: 북한산 둘레길"
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
          maxLength={50}
        />

        {/* 2. Description */}
        <Text style={styles.fieldLabel}>설명</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder="코스에 대한 설명을 적어주세요"
          placeholderTextColor={colors.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* 3. Cover image */}
        <Text style={styles.fieldLabel}>커버 사진</Text>
        <TouchableOpacity
          style={styles.imagePicker}
          onPress={pickCoverImage}
          activeOpacity={0.7}>
          {coverPreviewUri ? (
            <Image source={{ uri: coverPreviewUri }} style={styles.coverPreview} />
          ) : (
            <View style={styles.imagePickerEmpty}>
              <Text style={{ fontSize: 28 }}>{'\uD83D\uDCF7'}</Text>
              <Text style={styles.imagePickerText}>사진 추가</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* 4. Difficulty */}
        <Text style={styles.fieldLabel}>난이도</Text>
        <View style={styles.chipRow}>
          {DIFFICULTY_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, difficulty === opt.value && styles.chipActive]}
              onPress={() => setDifficulty(opt.value)}
              activeOpacity={0.7}>
              <Text
                style={[styles.chipText, difficulty === opt.value && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 5. Season */}
        <Text style={styles.fieldLabel}>추천 계절</Text>
        <View style={styles.chipRow}>
          {SEASON_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, bestSeason === opt.value && styles.chipActive]}
              onPress={() => setBestSeason(bestSeason === opt.value ? '' : opt.value)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.chipText,
                  bestSeason === opt.value && styles.chipTextActive,
                ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 6. Distance & Duration */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>거리 (km)</Text>
            <TextInput
              style={styles.input}
              placeholder="3.5"
              placeholderTextColor={colors.textTertiary}
              value={distanceKm}
              onChangeText={setDistanceKm}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>소요시간 (분)</Text>
            <TextInput
              style={styles.input}
              placeholder="90"
              placeholderTextColor={colors.textTertiary}
              value={estimatedMinutes}
              onChangeText={setEstimatedMinutes}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* 7. Elevation gain */}
        <Text style={styles.fieldLabel}>고도 상승 (m)</Text>
        <TextInput
          style={styles.input}
          placeholder="150"
          placeholderTextColor={colors.textTertiary}
          value={elevationGain}
          onChangeText={setElevationGain}
          keyboardType="numeric"
        />

        {/* 8. Trail type */}
        <Text style={styles.fieldLabel}>코스 유형</Text>
        <View style={styles.chipRow}>
          {TRAIL_TYPE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, trailType === opt.value && styles.chipActive]}
              onPress={() => setTrailType(opt.value)}
              activeOpacity={0.7}>
              <Text
                style={[styles.chipText, trailType === opt.value && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 9. Surface */}
        <Text style={styles.fieldLabel}>노면</Text>
        <View style={styles.chipRow}>
          {SURFACE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, surface === opt.value && styles.chipActive]}
              onPress={() => setSurface(opt.value)}
              activeOpacity={0.7}>
              <Text
                style={[styles.chipText, surface === opt.value && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 10. Transport access */}
        <Text style={styles.fieldLabel}>교통편 안내</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder="대중교통 이용 방법 등 (선택사항)"
          placeholderTextColor={colors.textTertiary}
          value={transportAccess}
          onChangeText={setTransportAccess}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </ScrollView>

      {/* Submit button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}>
          {submitting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.submitBtnText}>수정 중...</Text>
            </View>
          ) : (
            <Text style={styles.submitBtnText}>수정 완료</Text>
          )}
        </TouchableOpacity>
      </View>

      <PrettyAlert
        visible={alertState.visible}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={closePrettyAlert}
      />
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles (matching TrailPublishScreen patterns)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  backBtnText: {
    fontSize: 18,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
    marginTop: 8,
  },
  requiredMark: {
    color: '#EF4444',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 16,
  },
  multilineInput: {
    minHeight: 90,
    paddingTop: 14,
  },
  imagePicker: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  imagePickerEmpty: {
    height: 120,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  imagePickerText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  coverPreview: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  submitBtn: {
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  errorBackBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
});
