import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  Modal,
  Dimensions,
  BackHandler,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';
import { colors } from '../theme/colors';
import SafeMapView from '../components/SafeMapView';
import PrettyAlert, { PrettyAlertType } from '../components/PrettyAlert';
import { navParamCache } from '../utils/navParamCache';

const API_URL = 'https://api.moruwalk.com/api/v1';

// ---------------------------------------------------------------------------
// Constants
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

const COUNTRY_OPTIONS = [
  { value: 'KR', label: '한국' },
  { value: 'JP', label: '일본' },
  { value: 'TW', label: '대만' },
  { value: 'TH', label: '태국' },
  { value: 'US', label: '미국' },
  { value: 'GB', label: '영국' },
  { value: 'FR', label: '프랑스' },
  { value: 'ES', label: '스페인' },
];

const TRAIL_TYPE_OPTIONS = [
  { value: 'one_way', label: '편도' },
  { value: 'round_trip', label: '왕복' },
  { value: 'loop', label: '순환' },
];

const SPOT_TYPE_COLORS: Record<string, string> = {
  '맛집': '#D85A30',
  '카페': '#378ADD',
  '포토': '#7F77DD',
  '휴식': '#888780',
  '전망': '#EF9F27',
};

// Request runtime permissions for camera / media library on Android.
// react-native-image-picker does NOT automatically request these, so on
// Android 13+ launchCamera / launchImageLibrary silently fail with
// "permission" errorCode unless we request first.
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
    // Library — Android 13+ uses READ_MEDIA_IMAGES, older uses READ_EXTERNAL_STORAGE
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
// Types
// ---------------------------------------------------------------------------

interface Spot {
  name: string;
  type: string;
  description: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  location?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TrailPublishScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const route = useRoute<any>();

  const {
    pathData: directPathData = [],
    distance: autoDistance = 0,
    duration: autoDuration = 0,
    elevationGain: autoElevation = 0,
    spots: directInitialSpots = [],
    startLat = 0,
    startLng = 0,
    endLat = 0,
    endLng = 0,
    manualMode = false,
    _cacheKey,
  } = route.params || {};

  // Pull heavy arrays (pathData, spots) out of the nav-param cache. We only
  // `peek` because the user may back-navigate to this screen and we still
  // need the data. The cache auto-expires after 5 minutes so memory is
  // reclaimed even if the user abandons the flow.
  const cached = useMemo(
    () => navParamCache.peek<{ pathData?: any[]; spots?: any[] }>(_cacheKey) || {},
    [_cacheKey],
  );
  const pathData = cached.pathData && cached.pathData.length > 0
    ? cached.pathData
    : directPathData;
  const initialSpots = cached.spots && cached.spots.length > 0
    ? cached.spots
    : directInitialSpots;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('moderate');
  const [seasons, setSeasons] = useState<string[]>([]);
  const [country, setCountry] = useState('KR');
  const [tags, setTags] = useState('');
  const [transport, setTransport] = useState('');
  const [trailType, setTrailType] = useState('one_way');
  const [recommendedTime, setRecommendedTime] = useState('');
  const [coverImage, setCoverImage] = useState<any>(null);
  const [spots, setSpots] = useState<Spot[]>(initialSpots);
  const [submitting, setSubmitting] = useState(false);
  const [showSpotModal, setShowSpotModal] = useState(false);
  const [newSpotName, setNewSpotName] = useState('');
  const [newSpotType, setNewSpotType] = useState('photo');
  const [newSpotDesc, setNewSpotDesc] = useState('');
  const [newSpotImageUri, setNewSpotImageUri] = useState('');
  const [newSpotLocation, setNewSpotLocation] = useState('');
  // Progress text shown on the submit button during uploads (null = idle)
  const [progressText, setProgressText] = useState<string | null>(null);
  // Hold post-submit navigation timer so we can cancel on unmount
  const navTimerRef = useRef<any>(null);
  useEffect(() => () => {
    if (navTimerRef.current) clearTimeout(navTimerRef.current);
  }, []);

  // Pretty validation alert state
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    type: PrettyAlertType;
    title: string;
    message?: string;
  }>({ visible: false, type: 'warning', title: '' });
  const showPrettyAlert = useCallback((type: PrettyAlertType, title: string, message?: string) => {
    setAlertState({ visible: true, type, title, message });
  }, []);
  const closePrettyAlert = useCallback(() => {
    setAlertState(s => ({ ...s, visible: false }));
  }, []);

  // Close the waypoint modal and reset its form state. Pulling this into one
  // function ensures back-button / cancel / swipe-down all clean up
  // consistently (previously a stale state was leaving a ghost overlay).
  const closeSpotModal = useCallback(() => {
    setShowSpotModal(false);
    setNewSpotName('');
    setNewSpotDesc('');
    setNewSpotType('photo');
    setNewSpotImageUri('');
    setNewSpotLocation('');
  }, []);

  // Intercept the hardware back button while the waypoint modal is open so
  // that the screen itself doesn't navigate back. Without this, pressing
  // back closes the Modal via onRequestClose AND pops the screen at the
  // same time, leaving a ghost overlay half-rendered.
  useEffect(() => {
    if (!showSpotModal) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSpotModal();
      return true; // consume the event, don't navigate back
    });
    return () => sub.remove();
  }, [showSpotModal, closeSpotModal]);

  // Manual mode fields
  const [manualDistance, setManualDistance] = useState('');
  const [manualDuration, setManualDuration] = useState('');
  const [manualRegion, setManualRegion] = useState('');
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');

  const distance = manualMode ? (parseFloat(manualDistance) || 0) : autoDistance;
  const duration = manualMode ? (parseInt(manualDuration, 10) || 0) : autoDuration;
  const elevationGain = manualMode ? 0 : autoElevation;

  const toggleSeason = useCallback((val: string) => {
    setSeasons(prev =>
      prev.includes(val) ? prev.filter(s => s !== val) : [...prev, val],
    );
  }, []);

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

  const addSpot = useCallback(() => {
    if (!newSpotName.trim()) {
      showPrettyAlert('warning', '장소 이름이 비어있어요', '경유지 이름은 꼭 입력해주세요.');
      return;
    }
    setSpots(prev => [...prev, {
      name: newSpotName.trim(),
      type: newSpotType,
      description: newSpotDesc.trim(),
      lat: startLat || 0,
      lng: startLng || 0,
      imageUrl: newSpotImageUri.trim() || undefined,
      location: newSpotLocation.trim() || undefined,
    }]);
    closeSpotModal();
  }, [newSpotName, newSpotType, newSpotDesc, newSpotImageUri, newSpotLocation, startLat, startLng, closeSpotModal, showPrettyAlert]);

  const removeSpot = useCallback((idx: number) => {
    setSpots(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const saveDraft = useCallback(async () => {
    const draft = {
      name, description, difficulty, trailType, seasons, country,
      tags, transport, recommendedTime, coverImage,
    };
    await AsyncStorage.setItem('trail_draft', JSON.stringify(draft));
    Alert.alert('저장 완료', '임시 저장되었습니다.');
  }, [name, description, difficulty, trailType, seasons, country, tags, transport, recommendedTime, coverImage]);

  const handleSubmit = useCallback(async () => {
    // --- Required field validation ---
    if (!name.trim()) {
      showPrettyAlert('warning', '코스 이름을 입력해주세요', '나중에 찾기 쉽도록 이름을 지어주세요.');
      return;
    }
    if (!manualRegion.trim()) {
      showPrettyAlert('warning', '지역을 입력해주세요', '예) 서울 종로구, 부산 해운대구');
      return;
    }
    if (manualMode) {
      if (!manualDistance.trim() || parseFloat(manualDistance) <= 0) {
        showPrettyAlert('warning', '거리를 입력해주세요', '숫자로 km 단위를 입력해주세요. 예) 3.5');
        return;
      }
      if (!manualDuration.trim() || parseFloat(manualDuration) <= 0) {
        showPrettyAlert('warning', '소요 시간을 입력해주세요', '분 단위로 입력해주세요. 예) 90');
        return;
      }
    }
    if (!manualMode && pathData.length < 2) {
      showPrettyAlert('error', '경로 데이터가 부족해요', '걷기를 통해 수집된 경로가 충분하지 않습니다.');
      return;
    }
    // Reject GPS-mode submissions where the start/end coords never locked
    // onto a real location — prevents trails appearing at (0,0) in the
    // Atlantic Ocean after an indoor-only walk.
    if (!manualMode && startLat === 0 && startLng === 0) {
      showPrettyAlert('error', 'GPS 위치가 잡히지 않았어요', '실외에서 GPS가 정상적으로 작동한 뒤에 다시 시도해주세요.');
      return;
    }

    // Check auth
    const token = require('../stores/auth').useAuthStore.getState().accessToken;
    if (!token) {
      showPrettyAlert('info', '로그인이 필요해요', '코스를 등록하려면 먼저 로그인해주세요.');
      return;
    }

    const finalName = name.trim();

    setSubmitting(true);
    try {
      const tagList = tags.split('#').map((t: string) => t.trim()).filter(Boolean);

      const payload: any = {
        title: finalName,
        difficulty,
        country,
        trail_type: trailType,
        status: 'approved',
        distance_km: parseFloat(distance.toFixed(2)),
        estimated_minutes: Math.max(1, Math.round(duration)),
      };

      if (description.trim()) payload.description = description.trim();
      if (tagList.length > 0) payload.tags = tagList;
      if (recommendedTime.trim()) payload.recommended_time = recommendedTime.trim();
      if (transport.trim()) payload.transport = transport.trim();

      // Always include region if provided
      if (manualRegion.trim()) payload.region = manualRegion.trim();

      if (manualMode) {
        // Manual mode — send default coords (Seoul) if none provided
        payload.start_lat = '37.566500';
        payload.start_lng = '126.978000';
        payload.end_lat = '37.566500';
        payload.end_lng = '126.978000';
      } else {
        // GPS/draw mode — full path data
        const roundedPath = pathData.map((c: [number, number]) => [
          parseFloat(c[0].toFixed(6)),
          parseFloat(c[1].toFixed(6)),
        ]);
        payload.path_data = { type: 'LineString', coordinates: roundedPath };
        payload.start_lat = parseFloat(startLat.toFixed(6));
        payload.start_lng = parseFloat(startLng.toFixed(6));
        payload.end_lat = parseFloat(endLat.toFixed(6));
        payload.end_lng = parseFloat(endLng.toFixed(6));
        payload.elevation_gain = Math.round(elevationGain);
      }

      if (seasons.length > 0) payload.best_season = seasons[0];

      setProgressText('코스 정보 저장 중...');
      const { data } = await api.post('/trails/', payload);
      const trailId = data.id;
      const token = useAuthStore.getState().accessToken;

      // --- PARALLEL UPLOADS ---
      // Previously: create trail → upload cover (await) → for-loop each spot
      //   with await spot-create then await image-upload. For 5 spots with
      //   images, that's 1 + 1 + 10 = 12 sequential round trips.
      // Now: create cover + all spots in parallel (Promise.all), then all
      //   spot-images in parallel. 5 spots w/ images = ~3 parallel waves.
      const uploadErrors: string[] = [];

      // Wave 1: cover image PATCH + all spot creates in parallel
      setProgressText(
        spots.length > 0
          ? `업로드 중... (경유지 ${spots.length}개)`
          : '이미지 업로드 중...',
      );
      const coverPromise: Promise<void> = (coverImage && trailId)
        ? (async () => {
            try {
              const formData = new FormData();
              formData.append('cover_image', {
                uri: coverImage.uri,
                type: coverImage.type || 'image/jpeg',
                name: coverImage.fileName || 'cover.jpg',
              } as any);
              const res = await fetch(`${API_URL}/trails/${trailId}/`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
              });
              if (!res.ok) {
                const txt = await res.text();
                uploadErrors.push(`커버: ${res.status} ${txt.slice(0, 80)}`);
              }
            } catch (e: any) {
              uploadErrors.push(`커버: ${e?.message || 'error'}`);
            }
          })()
        : Promise.resolve();

      const spotCreatePromises: Promise<{ id: number | null; imageUrl?: string }>[] =
        (spots.length > 0 && trailId)
          ? spots.map((spot, i) =>
              api.post('/spots/', {
                trail: trailId,
                name: spot.name,
                spot_type: spot.type || 'photo',
                description: spot.description || '',
                lat: spot.lat || 0,
                lng: spot.lng || 0,
                order: i,
              })
              .then((res) => ({ id: res?.data?.id ?? null, imageUrl: spot.imageUrl }))
              .catch((e) => {
                uploadErrors.push(`경유지 "${spot.name}": ${e?.response?.status || 'error'}`);
                return { id: null, imageUrl: spot.imageUrl };
              }),
            )
          : [];

      const [, createdSpots] = await Promise.all([
        coverPromise,
        Promise.all(spotCreatePromises),
      ]);

      // Wave 2: all spot images in parallel
      const spotsNeedingImages = createdSpots.filter(s => s.id && s.imageUrl);
      if (spotsNeedingImages.length > 0) {
        setProgressText(`경유지 사진 업로드 중... (${spotsNeedingImages.length}개)`);
        await Promise.all(spotsNeedingImages.map(async (s) => {
          try {
            const imgForm = new FormData();
            imgForm.append('spot', String(s.id));
            imgForm.append('image', {
              uri: s.imageUrl,
              type: 'image/jpeg',
              name: `spot_${s.id}.jpg`,
            } as any);
            imgForm.append('order', '0');
            const imgRes = await fetch(`${API_URL}/spots/images/`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: imgForm,
            });
            if (!imgRes.ok) {
              uploadErrors.push(`경유지 이미지: ${imgRes.status}`);
            }
          } catch (e: any) {
            uploadErrors.push(`경유지 이미지: ${e?.message || 'error'}`);
          }
        }));
      }

      setProgressText(null);
      queryClient.invalidateQueries({ queryKey: ['trails'] });
      queryClient.invalidateQueries({ queryKey: ['trails-all'] });
      queryClient.invalidateQueries({ queryKey: ['my-trails'] });

      // If there were any upload errors, show a warning but still proceed.
      // The trail itself was created successfully.
      if (uploadErrors.length > 0) {
        showPrettyAlert(
          'warning',
          '일부 업로드 실패',
          `코스는 등록되었지만 ${uploadErrors.length}건이 실패했어요.\n(${uploadErrors[0]})`,
        );
        navTimerRef.current = setTimeout(() => navigation.navigate('Main'), 1500);
      } else {
        showPrettyAlert('success', '등록 완료', '코스가 성공적으로 등록되었습니다!');
        navTimerRef.current = setTimeout(() => navigation.navigate('Main'), 900);
      }
    } catch (err: any) {
      const errData = err?.response?.data;
      console.log('Trail create error:', errData || err);
      let msg = '코스 등록에 실패했습니다.';
      if (errData && typeof errData === 'object') {
        const firstKey = Object.keys(errData)[0];
        const firstVal = Array.isArray(errData[firstKey]) ? errData[firstKey][0] : errData[firstKey];
        msg = `${firstKey}: ${firstVal}`;
      }
      showPrettyAlert('error', '오류', msg);
    } finally {
      setSubmitting(false);
      setProgressText(null);
    }
  }, [
    name, description, difficulty, country, seasons, transport, trailType, recommendedTime, tags,
    pathData, distance, duration, elevationGain,
    startLat, startLng, endLat, endLng,
    spots, coverImage, navigation, manualMode, manualRegion, manualDistance,
  ]);

  const durationH = Math.floor(duration / 60);
  const durationM = Math.round(duration % 60);
  const durationLabel = durationH > 0 ? `${durationH}시간 ${durationM}분` : `${durationM}분`;

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
        <Text style={styles.headerTitle}>코스 등록</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* 1. Map preview — always visible (dark theme to match TrailDetail) */}
        <SafeMapView
          lat={startLat || 37.5665}
          lng={startLng || 126.978}
          endLat={endLat || undefined}
          endLng={endLng || undefined}
          pathCoordinates={pathData && pathData.length > 1 ? pathData : undefined}
          height={200}
          theme="dark"
        />

        {/* 2a. Auto stats (GPS mode) */}
        {!manualMode && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{distance.toFixed(2)}</Text>
              <Text style={styles.statLabel}>km</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{durationLabel}</Text>
              <Text style={styles.statLabel}>소요시간</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{elevationGain > 0 ? `+${Math.round(elevationGain)}` : '0'}m</Text>
              <Text style={styles.statLabel}>고도</Text>
            </View>
          </View>
        )}

        {/* 2b. Location & details (always shown) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>코스 위치</Text>

          <Text style={styles.fieldLabel}>지역 <Text style={styles.requiredMark}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="예: 서울 종로구"
            placeholderTextColor={colors.textTertiary}
            value={manualRegion}
            onChangeText={setManualRegion}
          />

          <Text style={styles.fieldLabel}>출발점</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 경복궁역 3번 출구"
            placeholderTextColor={colors.textTertiary}
            value={startLocation}
            onChangeText={setStartLocation}
          />

          <Text style={styles.fieldLabel}>도착점</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 안국역 1번 출구"
            placeholderTextColor={colors.textTertiary}
            value={endLocation}
            onChangeText={setEndLocation}
          />

          {manualMode && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>거리 (km) <Text style={styles.requiredMark}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="3.5"
                  placeholderTextColor={colors.textTertiary}
                  value={manualDistance}
                  onChangeText={setManualDistance}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>소요시간 (분) <Text style={styles.requiredMark}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="90"
                  placeholderTextColor={colors.textTertiary}
                  value={manualDuration}
                  onChangeText={setManualDuration}
                  keyboardType="numeric"
                />
              </View>
            </View>
          )}
        </View>

        {/* 3. Name */}
        <Text style={styles.fieldLabel}>코스 이름 <Text style={styles.requiredMark}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="예: 북한산 둘레길"
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
          maxLength={50}
        />

        {/* 4. Description */}
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

        {/* 5. Cover image */}
        <Text style={styles.fieldLabel}>커버 사진</Text>
        <TouchableOpacity
          style={styles.imagePicker}
          onPress={pickCoverImage}
          activeOpacity={0.7}>
          {coverImage ? (
            <Image source={{ uri: coverImage.uri }} style={styles.coverPreview} />
          ) : (
            <View style={styles.imagePickerEmpty}>
              <Text style={{ fontSize: 28 }}>{'\uD83D\uDCF7'}</Text>
              <Text style={styles.imagePickerText}>사진 추가</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* 6. Difficulty */}
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

        {/* 7. Recommended seasons */}
        <Text style={styles.fieldLabel}>추천 계절</Text>
        <View style={styles.chipRow}>
          {SEASON_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, seasons.includes(opt.value) && styles.chipActive]}
              onPress={() => toggleSeason(opt.value)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.chipText,
                  seasons.includes(opt.value) && styles.chipTextActive,
                ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 8. Country */}
        <Text style={styles.fieldLabel}>국가</Text>
        <View style={styles.chipRow}>
          {COUNTRY_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, country === opt.value && styles.chipActive]}
              onPress={() => setCountry(opt.value)}
              activeOpacity={0.7}>
              <Text
                style={[styles.chipText, country === opt.value && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 9. Tags */}
        <Text style={styles.fieldLabel}>태그</Text>
        <TextInput
          style={styles.input}
          placeholder="#맛집투어 #역사탐방"
          placeholderTextColor={colors.textTertiary}
          value={tags}
          onChangeText={setTags}
        />

        {/* 10. Transport info */}
        <Text style={styles.fieldLabel}>교통편 안내</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder="대중교통 이용 방법 등 (선택사항)"
          placeholderTextColor={colors.textTertiary}
          value={transport}
          onChangeText={setTransport}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* 10a. Trail type */}
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

        {/* 10b. Recommended time */}
        <Text style={styles.fieldLabel}>추천 시간대</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 오전 9시~12시"
          placeholderTextColor={colors.textTertiary}
          value={recommendedTime}
          onChangeText={setRecommendedTime}
        />

        {/* 11. Spots list + add */}
        <Text style={styles.fieldLabel}>경유지 / 스팟 ({spots.length})</Text>
        {spots.map((spot, idx) => (
          <View key={`spot-${idx}`} style={styles.spotCard}>
            <View
              style={[
                styles.spotTypeBadge,
                { backgroundColor: SPOT_TYPE_COLORS[spot.type] || colors.textSecondary },
              ]}>
              <Text style={styles.spotTypeBadgeText}>{spot.type}</Text>
            </View>
            <View style={styles.spotInfo}>
              <Text style={styles.spotName}>{spot.name}</Text>
              {spot.location ? (
                <Text style={styles.spotDesc}>{'📍 '}{spot.location}</Text>
              ) : null}
              {spot.description ? (
                <Text style={styles.spotDesc}>{spot.description}</Text>
              ) : null}
              {spot.imageUrl ? (
                <Text style={[styles.spotDesc, { color: '#378ADD' }]}>{'🖼 이미지 첨부'}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.spotDeleteBtn}
              onPress={() => removeSpot(idx)}
              activeOpacity={0.7}>
              <Text style={styles.spotDeleteText}>{'✕'}</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          style={styles.addSpotBtn}
          onPress={() => setShowSpotModal(true)}
          activeOpacity={0.7}>
          <Text style={styles.addSpotBtnText}>+ 경유지 추가</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Spot add modal — statusBarTranslucent is intentionally OFF so
          Android's windowSoftInputMode=adjustResize pushes the sheet up
          correctly when the keyboard appears. */}
      <Modal
        visible={showSpotModal}
        transparent
        animationType="slide"
        onRequestClose={closeSpotModal}>
        <KeyboardAvoidingView
          style={styles.spotModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={closeSpotModal}
          />
          <View style={styles.spotModalSheet}>
            <View style={styles.spotModalHandle} />
            <Text style={styles.spotModalTitle}>경유지 추가</Text>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 8 }}>
              <TextInput
                style={styles.input}
                placeholder="장소 이름 *"
                placeholderTextColor={colors.textTertiary}
                value={newSpotName}
                onChangeText={setNewSpotName}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { value: 'restaurant', label: '맛집' },
                    { value: 'cafe', label: '카페' },
                    { value: 'photo', label: '포토' },
                    { value: 'rest', label: '휴식' },
                    { value: 'view', label: '전망' },
                  ].map(t => (
                    <TouchableOpacity
                      key={t.value}
                      style={[styles.chipSmall, newSpotType === t.value && { backgroundColor: SPOT_TYPE_COLORS[t.label] || colors.primary }]}
                      onPress={() => setNewSpotType(t.value)}>
                      <Text style={[styles.chipSmallText, newSpotType === t.value && { color: '#fff' }]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <TextInput
                style={styles.input}
                placeholder="한줄 설명 (선택)"
                placeholderTextColor={colors.textTertiary}
                value={newSpotDesc}
                onChangeText={setNewSpotDesc}
              />
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                placeholder="위치 (선택) 예: 안국역 2번 출구 앞"
                placeholderTextColor={colors.textTertiary}
                value={newSpotLocation}
                onChangeText={setNewSpotLocation}
              />
              <Text style={[styles.fieldLabel, { marginTop: 8, marginBottom: 6 }]}>사진</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={styles.miniPickBtn} onPress={async () => {
                  const ok = await ensureMediaPermissions('camera');
                  if (!ok) { showPermissionDeniedAlert('camera'); return; }
                  launchCamera({ mediaType: 'photo', quality: 0.7, maxWidth: 1600, maxHeight: 1600, saveToPhotos: false }, (res) => {
                    if (res.errorCode) {
                      Alert.alert('카메라 오류', res.errorMessage || res.errorCode);
                      return;
                    }
                    if (!res.didCancel && res.assets?.[0]?.uri) setNewSpotImageUri(res.assets[0].uri);
                  });
                }}>
                  <Text style={styles.miniPickBtnText}>{'\uD83D\uDCF7'} 카메라</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.miniPickBtn} onPress={async () => {
                  const ok = await ensureMediaPermissions('library');
                  if (!ok) { showPermissionDeniedAlert('library'); return; }
                  launchImageLibrary({ mediaType: 'photo', quality: 0.7, maxWidth: 1600, maxHeight: 1600, selectionLimit: 1 }, (res) => {
                    if (res.errorCode) {
                      Alert.alert('갤러리 오류', res.errorMessage || res.errorCode);
                      return;
                    }
                    if (!res.didCancel && res.assets?.[0]?.uri) setNewSpotImageUri(res.assets[0].uri);
                  });
                }}>
                  <Text style={styles.miniPickBtnText}>{'\uD83D\uDDBC'} 갤러리</Text>
                </TouchableOpacity>
              </View>
              {newSpotImageUri ? (
                <Image source={{ uri: newSpotImageUri }} style={{ width: '100%', height: 120, borderRadius: 12, marginTop: 8 }} />
              ) : null}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.spotModalBtn, { backgroundColor: '#F2F4F6' }]}
                onPress={closeSpotModal}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.spotModalBtn, { backgroundColor: colors.primary }]}
                onPress={addSpot}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>추가</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 12. Submit buttons */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={[styles.draftBtn]}
            onPress={saveDraft}
            activeOpacity={0.85}>
            <Text style={styles.draftBtnText}>임시 저장</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, { flex: 1 }, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}>
            {submitting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.submitBtnText}>{progressText || '등록 중...'}</Text>
              </View>
            ) : (
              <Text style={styles.submitBtnText}>코스 공유하기</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Pretty validation alert — replaces the default OS Alert for
          friendlier in-app feedback. */}
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
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
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

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 16,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderDefault,
  },

  // Fields
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

  // Image picker
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

  // Chips
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

  // Spots
  spotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  spotTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 12,
  },
  spotTypeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  spotInfo: {
    flex: 1,
  },
  spotName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  spotDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  spotDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  spotDeleteText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  draftBtn: {
    backgroundColor: '#E8E8E8',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
  },
  draftBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666',
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
  addSpotBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  addSpotBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  spotModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  spotModalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    // Cap natural height so the sheet never pushes above the screen when
    // content is long. ScrollView inside handles overflow.
    maxHeight: SCREEN_HEIGHT * 0.88,
  },
  spotModalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E8EB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  spotModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  spotModalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  chipSmall: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F0E8',
    borderWidth: 1,
    borderColor: '#E8E5DE',
  },
  chipSmallText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#777',
  },
  miniPickBtn: {
    flex: 1,
    backgroundColor: '#F5F0E8',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E5DE',
  },
  miniPickBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
