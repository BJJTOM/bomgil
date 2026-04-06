import React, { useState, useCallback } from 'react';
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
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import api from '../api/client';
import { colors } from '../theme/colors';
import Geolocation from '@react-native-community/geolocation';
import SafeMapView from '../components/SafeMapView';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: '쉬움' },
  { value: 'moderate', label: '보통' },
  { value: 'hard', label: '어려움' },
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

const WAYPOINT_TYPES = [
  { value: 'restaurant', label: '맛집' },
  { value: 'cafe', label: '카페' },
  { value: 'photo', label: '포토' },
  { value: 'rest', label: '휴식' },
  { value: 'view', label: '전망' },
];

const STEP_LABELS = [
  '기본 정보',
  '경로 상세',
  '웨이포인트',
  '사진 & 미리보기',
];

const TOTAL_STEPS = 4;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Waypoint {
  id: string;
  name: string;
  type: string;
  description: string;
  lat: number | null;
  lng: number | null;
  imageUrl: string;
  link: string;
}

interface Activity {
  id: number;
  title?: string;
  started_at?: string;
  distance_km?: number;
  track_points?: { lat: number; lng: number }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TrailCreateScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startRegion, setStartRegion] = useState('');
  const [endRegion, setEndRegion] = useState('');
  const [country, setCountry] = useState('KR');
  const [difficulty, setDifficulty] = useState('moderate');
  const [tags, setTags] = useState('');

  // Step 2 — Route & Details
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [startLat, setStartLat] = useState<number | null>(null);
  const [startLng, setStartLng] = useState<number | null>(null);
  const [endLat, setEndLat] = useState<number | null>(null);
  const [endLng, setEndLng] = useState<number | null>(null);
  const [pathData, setPathData] = useState<[number, number][] | null>(null);

  // Activity import modal
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Step 3 — Waypoints
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  // Step 4 — Photo & Preview
  const [coverImage, setCoverImage] = useState<{
    uri: string;
    type?: string;
    fileName?: string;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // GPS helpers
  // ---------------------------------------------------------------------------

  const grabCurrentGPS = useCallback(
    (onSuccess: (lat: number, lng: number) => void) => {
      Geolocation.getCurrentPosition(
        (pos) => onSuccess(pos.coords.latitude, pos.coords.longitude),
        () =>
          Alert.alert(
            '위치 오류',
            '현재 위치를 가져올 수 없습니다',
          ),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    },
    [],
  );

  const useCurrentLocationForStart = useCallback(() => {
    grabCurrentGPS((lat, lng) => {
      setStartLat(lat);
      setStartLng(lng);
      Alert.alert(
        '완료',
        `출발점 좌표: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      );
    });
  }, [grabCurrentGPS]);

  const useCurrentLocationForEnd = useCallback(() => {
    grabCurrentGPS((lat, lng) => {
      setEndLat(lat);
      setEndLng(lng);
      Alert.alert(
        '완료',
        `도착점 좌표: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      );
    });
  }, [grabCurrentGPS]);

  // ---------------------------------------------------------------------------
  // Activity import
  // ---------------------------------------------------------------------------

  const openActivityModal = useCallback(async () => {
    setLoadingActivities(true);
    setActivityModalVisible(true);
    try {
      const res = await api.get('/activities/');
      const list: Activity[] = Array.isArray(res.data)
        ? res.data
        : res.data?.results ?? [];
      setActivities(list);
    } catch {
      Alert.alert(
        '오류',
        '활동 기록을 불러올 수 없습니다',
      );
      setActivityModalVisible(false);
    } finally {
      setLoadingActivities(false);
    }
  }, []);

  const importActivity = useCallback(
    (activity: Activity) => {
      setActivityModalVisible(false);
      const pts = activity.track_points;
      if (!pts || pts.length === 0) {
        Alert.alert(
          '오류',
          '이 활동에는 경로 데이터가 없습니다',
        );
        return;
      }

      // Build path_data as [lng, lat] for GeoJSON
      const coords: [number, number][] = pts.map((p) => [p.lng, p.lat]);
      setPathData(coords);

      // Start / end from first / last point
      const first = pts[0];
      const last = pts[pts.length - 1];
      setStartLat(first.lat);
      setStartLng(first.lng);
      setEndLat(last.lat);
      setEndLng(last.lng);

      // Calculate total distance
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        total += haversineDistance(
          pts[i - 1].lat,
          pts[i - 1].lng,
          pts[i].lat,
          pts[i].lng,
        );
      }
      setDistanceKm(total.toFixed(2));

      if (activity.distance_km && activity.distance_km > 0) {
        setDistanceKm(activity.distance_km.toFixed(2));
      }

      Alert.alert(
        '가져오기 완료',
        `${pts.length}개 트랙포인트가 적용되었습니다`,
      );
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Waypoints
  // ---------------------------------------------------------------------------

  const addWaypoint = useCallback(() => {
    setWaypoints((prev) => [
      ...prev,
      {
        id: generateId(),
        name: '',
        type: 'photo',
        description: '',
        lat: null,
        lng: null,
        imageUrl: '',
        link: '',
      },
    ]);
  }, []);

  const removeWaypoint = useCallback((id: string) => {
    setWaypoints((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const updateWaypoint = useCallback(
    (id: string, field: keyof Waypoint, value: any) => {
      setWaypoints((prev) =>
        prev.map((w) => (w.id === id ? { ...w, [field]: value } : w)),
      );
    },
    [],
  );

  const grabGPSForWaypoint = useCallback(
    (id: string) => {
      grabCurrentGPS((lat, lng) => {
        setWaypoints((prev) =>
          prev.map((w) => (w.id === id ? { ...w, lat, lng } : w)),
        );
        Alert.alert(
          '완료',
          `좌표: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        );
      });
    },
    [grabCurrentGPS],
  );

  // ---------------------------------------------------------------------------
  // Image picker
  // ---------------------------------------------------------------------------

  const pickImage = useCallback((source: 'camera' | 'gallery') => {
    const options = {
      mediaType: 'photo' as const,
      quality: 0.8 as const,
      maxWidth: 1200,
      maxHeight: 1200,
    };
    const fn = source === 'camera' ? launchCamera : launchImageLibrary;
    fn(options, (response) => {
      if (response.didCancel || response.errorCode) return;
      const asset = response.assets?.[0];
      if (asset?.uri) {
        setCoverImage({
          uri: asset.uri,
          type: asset.type,
          fileName: asset.fileName,
        });
      }
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const canGoNext = useCallback(() => {
    if (step === 1) {
      return title.trim().length > 0 && description.trim().length > 0 && startRegion.trim().length > 0;
    }
    if (step === 2) {
      return distanceKm.trim().length > 0 && estimatedMinutes.trim().length > 0;
    }
    return true;
  }, [step, title, description, startRegion, distanceKm, estimatedMinutes]);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      // Build JSON payload
      const payload: Record<string, any> = {
        title: title.trim(),
        description: description.trim(),
        region: [startRegion.trim(), endRegion.trim()].filter(Boolean).join(' → ') || undefined,
        country,
        difficulty,
        distance_km: parseFloat(distanceKm) || 0,
        estimated_minutes: parseInt(estimatedMinutes, 10) || 0,
        status: 'approved',
      };

      // Coordinates — round to 6 decimal places to fit DB constraint (9 digits total)
      if (startLat != null && startLng != null) {
        payload.start_lat = parseFloat(startLat.toFixed(6));
        payload.start_lng = parseFloat(startLng.toFixed(6));
      }
      if (endLat != null && endLng != null) {
        payload.end_lat = parseFloat(endLat.toFixed(6));
        payload.end_lng = parseFloat(endLng.toFixed(6));
      }

      // path_data as GeoJSON LineString — also round coordinates
      if (pathData && pathData.length > 1) {
        payload.path_data = {
          type: 'LineString',
          coordinates: pathData.map(([lng, lat]) => [
            parseFloat(lng.toFixed(6)),
            parseFloat(lat.toFixed(6)),
          ]),
        };
      }

      // Tags — don't send tag_ids (requires numeric IDs), just skip for now
      // Tags will be managed via admin or future tag search endpoint

      // 1) Create the trail with JSON
      const trailRes = await api.post('/trails/', payload);
      const trailId = trailRes.data?.id;

      // 2) If cover image, PATCH with FormData
      if (coverImage && trailId) {
        const formData = new FormData();
        formData.append('cover_image', {
          uri: coverImage.uri,
          type: coverImage.type || 'image/jpeg',
          name: coverImage.fileName || 'cover.jpg',
        } as any);

        await api.patch(`/trails/${trailId}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // 3) Create waypoints (spots)
      if (trailId && waypoints.length > 0) {
        const validWaypoints = waypoints.filter((w) => w.name.trim());
        for (let i = 0; i < validWaypoints.length; i++) {
          const wp = validWaypoints[i];
          const spotPayload: Record<string, any> = {
            trail: trailId,
            name: wp.name.trim(),
            spot_type: wp.type,
            description: wp.description.trim() || undefined,
            order: i + 1,
          };
          if (wp.lat != null && wp.lng != null) {
            spotPayload.latitude = wp.lat;
            spotPayload.longitude = wp.lng;
          }
          try {
            await api.post('/spots/', spotPayload);
          } catch {
            // Continue even if a spot fails
          }
        }
      }

      Alert.alert(
        '성공',
        '코스가 등록되었습니다!',
        [{ text: '확인', onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      const data = err?.response?.data;
      let msg = '코스 등록에 실패했습니다';
      if (data) {
        if (typeof data === 'string') {
          msg = data;
        } else if (data.detail) {
          msg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        } else {
          // Show field errors
          const errors = Object.entries(data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join('\n');
          msg = errors || msg;
        }
      }
      Alert.alert('오류', msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    title,
    description,
    startRegion,
    country,
    difficulty,
    distanceKm,
    estimatedMinutes,
    startLat,
    startLng,
    endLat,
    endLng,
    pathData,
    tags,
    coverImage,
    waypoints,
    navigation,
  ]);

  // ---------------------------------------------------------------------------
  // Step Indicator
  // ---------------------------------------------------------------------------

  const renderStepIndicator = () => (
    <View style={styles.stepRow}>
      {[1, 2, 3, 4].map((s) => (
        <View key={s} style={styles.stepItemWrap}>
          <View style={[styles.stepDot, s <= step && styles.stepDotActive]}>
            <Text
              style={[
                styles.stepDotText,
                s <= step && styles.stepDotTextActive,
              ]}>
              {s}
            </Text>
          </View>
          <Text style={[styles.stepLabel, s === step && styles.stepLabelActive]}>
            {STEP_LABELS[s - 1]}
          </Text>
        </View>
      ))}
    </View>
  );

  // ---------------------------------------------------------------------------
  // Step 1 — Basic Info
  // ---------------------------------------------------------------------------

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>
          {'코스 이름'} <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.textInput}
          placeholder="예: 북촌한옥마을 걸기"
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.fieldLabel}>
          {'설명'} <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="코스에 대한 설명을 작성해주세요"
          placeholderTextColor={colors.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={styles.fieldLabel}>{'출발 지역'}</Text>
        <TextInput
          style={styles.textInput}
          placeholder="예: 서울 종로구"
          placeholderTextColor={colors.textTertiary}
          value={startRegion}
          onChangeText={setStartRegion}
        />

        <Text style={styles.fieldLabel}>{'도착 지역'}</Text>
        <TextInput
          style={styles.textInput}
          placeholder="예: 서울 중구 (같으면 비워두세요)"
          placeholderTextColor={colors.textTertiary}
          value={endRegion}
          onChangeText={setEndRegion}
        />

        <Text style={styles.fieldLabel}>{'태그'}</Text>
        <TextInput
          style={styles.textInput}
          placeholder="예: 맛집투어, 역사탐방 (쉼표로 구분)"
          placeholderTextColor={colors.textTertiary}
          value={tags}
          onChangeText={setTags}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>{'국가'}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}>
          <View style={styles.chipGroup}>
            {COUNTRY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.selectChip,
                  country === opt.value && styles.selectChipActive,
                ]}
                onPress={() => setCountry(opt.value)}>
                <Text
                  style={[
                    styles.selectChipText,
                    country === opt.value && styles.selectChipTextActive,
                  ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.fieldLabel}>{'난이도'}</Text>
        <View style={styles.chipGroup}>
          {DIFFICULTY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.selectChip,
                difficulty === opt.value && styles.selectChipActive,
              ]}
              onPress={() => setDifficulty(opt.value)}>
              <Text
                style={[
                  styles.selectChipText,
                  difficulty === opt.value && styles.selectChipTextActive,
                ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  // ---------------------------------------------------------------------------
  // Step 2 — Route & Details
  // ---------------------------------------------------------------------------

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>{'출발지'}</Text>
        <TextInput
          style={styles.textInput}
          placeholder="예: 경복궁역 3번 출구"
          placeholderTextColor={colors.textTertiary}
          value={startLocation}
          onChangeText={setStartLocation}
        />

        <Text style={styles.fieldLabel}>{'도착지'}</Text>
        <TextInput
          style={styles.textInput}
          placeholder="예: 안국역 1번 출구"
          placeholderTextColor={colors.textTertiary}
          value={endLocation}
          onChangeText={setEndLocation}
        />

        <View style={styles.rowBetween}>
          <View style={styles.halfField}>
            <Text style={styles.fieldLabel}>
              {'거리 (km)'}{' '}
              <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="3.5"
              placeholderTextColor={colors.textTertiary}
              value={distanceKm}
              onChangeText={setDistanceKm}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.fieldLabel}>
              {'예상 시간 (분)'}{' '}
              <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="90"
              placeholderTextColor={colors.textTertiary}
              value={estimatedMinutes}
              onChangeText={setEstimatedMinutes}
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>GPS {'좌표'}</Text>

        <View style={styles.gpsRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.gpsLabel}>
              {'출발점'}:{' '}
              {startLat != null
                ? `${startLat.toFixed(5)}, ${startLng?.toFixed(5)}`
                : '미설정'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.gpsBtnSmall}
            onPress={useCurrentLocationForStart}>
            <Text style={styles.gpsBtnSmallText}>
              {'현재 위치'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gpsRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.gpsLabel}>
              {'도착점'}:{' '}
              {endLat != null
                ? `${endLat.toFixed(5)}, ${endLng?.toFixed(5)}`
                : '미설정'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.gpsBtnSmall}
            onPress={useCurrentLocationForEnd}>
            <Text style={styles.gpsBtnSmallText}>
              {'현재 위치'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.importBtn} onPress={openActivityModal}>
        <Text style={styles.importBtnIcon}>{'📥'}</Text>
        <View>
          <Text style={styles.importBtnTitle}>
            {'활동 기록에서 가져오기'}
          </Text>
          <Text style={styles.importBtnSub}>
            {'저장된 산책 기록의 경로를 자동 입력합니다'}
          </Text>
        </View>
      </TouchableOpacity>

      {pathData && pathData.length > 1 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {'경로 미리보기'} ({pathData.length}{' '}
            {'포인트'})
          </Text>
          <SafeMapView
            lat={pathData[0][1]}
            lng={pathData[0][0]}
            endLat={pathData[pathData.length - 1][1]}
            endLng={pathData[pathData.length - 1][0]}
            pathCoordinates={pathData}
            region={startRegion}
            country={country}
            height={180}
          />
        </View>
      )}
    </View>
  );

  // ---------------------------------------------------------------------------
  // Step 3 — Waypoints
  // ---------------------------------------------------------------------------

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {'웨이포인트 (스팟)'}
        </Text>
        <Text style={styles.cardSubtitle}>
          {'경로 중 주요 장소를 추가해보세요'}
        </Text>

        {waypoints.map((wp, idx) => (
          <View key={wp.id} style={styles.waypointItem}>
            <View style={styles.waypointHeader}>
              <Text style={styles.waypointNumber}>{idx + 1}</Text>
              <TouchableOpacity
                style={styles.waypointRemoveBtn}
                onPress={() => removeWaypoint(wp.id)}>
                <Text style={styles.waypointRemoveText}>{'✕'}</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.textInput}
              placeholder={'장소 이름'}
              placeholderTextColor={colors.textTertiary}
              value={wp.name}
              onChangeText={(v) => updateWaypoint(wp.id, 'name', v)}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 8 }}>
              <View style={styles.chipGroup}>
                {WAYPOINT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[
                      styles.selectChipSmall,
                      wp.type === t.value && styles.selectChipActive,
                    ]}
                    onPress={() => updateWaypoint(wp.id, 'type', t.value)}>
                    <Text
                      style={[
                        styles.selectChipTextSmall,
                        wp.type === t.value && styles.selectChipTextActive,
                      ]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TextInput
              style={[styles.textInput, { marginTop: 8 }]}
              placeholder={'설명 (선택)'}
              placeholderTextColor={colors.textTertiary}
              value={wp.description}
              onChangeText={(v) => updateWaypoint(wp.id, 'description', v)}
            />

            <View style={styles.waypointGpsRow}>
              <Text style={styles.gpsLabel}>
                {wp.lat != null
                  ? `${wp.lat.toFixed(5)}, ${wp.lng?.toFixed(5)}`
                  : '좌표 미설정'}
              </Text>
              <TouchableOpacity
                style={styles.gpsBtnTiny}
                onPress={() => grabGPSForWaypoint(wp.id)}>
                <Text style={styles.gpsBtnTinyText}>GPS</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.textInput, { marginTop: 8 }]}
              placeholder={'이미지 URL (선택)'}
              placeholderTextColor={colors.textTertiary}
              value={wp.imageUrl}
              onChangeText={(v) => updateWaypoint(wp.id, 'imageUrl', v)}
              autoCapitalize="none"
            />

            <TextInput
              style={[styles.textInput, { marginTop: 8 }]}
              placeholder={'관련 링크 (선택)'}
              placeholderTextColor={colors.textTertiary}
              value={wp.link}
              onChangeText={(v) => updateWaypoint(wp.id, 'link', v)}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>
        ))}

        <TouchableOpacity style={styles.addWaypointBtn} onPress={addWaypoint}>
          <Text style={styles.addWaypointText}>
            + {'웨이포인트 추가'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ---------------------------------------------------------------------------
  // Step 4 — Photo & Preview
  // ---------------------------------------------------------------------------

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>{'커버 사진'}</Text>
        {coverImage ? (
          <View style={styles.previewWrap}>
            <Image
              source={{ uri: coverImage.uri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={styles.removeImageBtn}
              onPress={() => setCoverImage(null)}>
              <Text style={styles.removeImageText}>{'✕'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.imageButtons}>
            <TouchableOpacity
              style={styles.imagePickBtn}
              onPress={() => pickImage('camera')}>
              <Text style={styles.imagePickIcon}>{'📷'}</Text>
              <Text style={styles.imagePickLabel}>{'카메라'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.imagePickBtn}
              onPress={() => pickImage('gallery')}>
              <Text style={styles.imagePickIcon}>{'🖼'}</Text>
              <Text style={styles.imagePickLabel}>{'갤러리'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Map preview */}
      {startLat != null && startLng != null && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {'경로 미리보기'}
          </Text>
          <SafeMapView
            lat={startLat}
            lng={startLng}
            endLat={endLat ?? undefined}
            endLng={endLng ?? undefined}
            pathCoordinates={pathData ?? undefined}
            region={startRegion}
            country={country}
            height={200}
          />
        </View>
      )}

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>
          {'코스 요약'}
        </Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{'제목'}</Text>
          <Text style={styles.summaryValue}>{title || '-'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{'지역'}</Text>
          <Text style={styles.summaryValue}>
            {startRegion || '-'}{endRegion ? ` → ${endRegion}` : ''}
            {' · '}
            {COUNTRY_OPTIONS.find((c) => c.value === country)?.label || country}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{'난이도'}</Text>
          <Text style={styles.summaryValue}>
            {DIFFICULTY_OPTIONS.find((d) => d.value === difficulty)?.label ||
              difficulty}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{'거리 / 시간'}</Text>
          <Text style={styles.summaryValue}>
            {distanceKm || '-'} km {' · '} {estimatedMinutes || '-'}{' '}
            {'분'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{'경로'}</Text>
          <Text style={styles.summaryValue}>
            {pathData
              ? `${pathData.length}개 포인트`
              : '미설정'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            {'웨이포인트'}
          </Text>
          <Text style={styles.summaryValue}>
            {waypoints.filter((w) => w.name.trim()).length}
            {'개'}
          </Text>
        </View>
        {tags.trim() ? (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{'태그'}</Text>
            <Text style={styles.summaryValue}>{tags}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  // ---------------------------------------------------------------------------
  // Activity Import Modal
  // ---------------------------------------------------------------------------

  const renderActivityModal = () => (
    <Modal
      visible={activityModalVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setActivityModalVisible(false)}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 },
          ]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {'활동 기록 선택'}
            </Text>
            <TouchableOpacity onPress={() => setActivityModalVisible(false)}>
              <Text style={styles.modalClose}>{'✕'}</Text>
            </TouchableOpacity>
          </View>

          {loadingActivities ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : activities.length === 0 ? (
            <View style={styles.modalLoading}>
              <Text style={styles.modalEmptyText}>
                {'활동 기록이 없습니다'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={activities}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.activityItem}
                  onPress={() => importActivity(item)}>
                  <View>
                    <Text style={styles.activityTitle}>
                      {item.title || `활동 #${item.id}`}
                    </Text>
                    <Text style={styles.activityMeta}>
                      {item.started_at
                        ? new Date(item.started_at).toLocaleDateString()
                        : ''}
                      {item.distance_km
                        ? ` · ${item.distance_km.toFixed(1)}km`
                        : ''}
                      {item.track_points
                        ? ` · ${item.track_points.length}포인트`
                        : ''}
                    </Text>
                  </View>
                  <Text style={styles.activityArrow}>{'›'}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </View>
      </View>
    </Modal>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}>
          <Text style={styles.backText}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{'코스 등록'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {renderStepIndicator()}

      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </ScrollView>

      {/* Bottom nav buttons */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 },
        ]}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.prevBtn}
            onPress={() => setStep(step - 1)}>
            <Text style={styles.prevBtnText}>{'이전'}</Text>
          </TouchableOpacity>
        )}
        {step < TOTAL_STEPS ? (
          <TouchableOpacity
            style={[styles.nextBtn, !canGoNext() && styles.btnDisabled]}
            onPress={() => {
              if (canGoNext()) setStep(step + 1);
            }}
            disabled={!canGoNext()}>
            <Text style={styles.nextBtnText}>{'다음'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>
                {'등록하기'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {renderActivityModal()}
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 22,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // Step indicator
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 16,
  },
  stepItemWrap: {
    alignItems: 'center',
    gap: 4,
  },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.borderDefault,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  stepDotTextActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },

  // Content
  scrollBody: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 20,
    gap: 16,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: -8,
    marginBottom: 12,
  },

  // Fields
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
    marginTop: 12,
  },
  required: {
    color: '#EF4444',
  },
  textInput: {
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },

  // Chips
  chipScroll: {
    marginBottom: 4,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  selectChipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  selectChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  selectChipTextSmall: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  selectChipTextActive: {
    color: '#FFFFFF',
  },

  // Row layouts
  rowBetween: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },

  // GPS
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  gpsLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  gpsBtnSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  gpsBtnSmallText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  gpsBtnTiny: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  gpsBtnTinyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Import
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed' as any,
  },
  importBtnIcon: {
    fontSize: 24,
  },
  importBtnTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  importBtnSub: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Waypoints
  waypointItem: {
    backgroundColor: '#F7F8FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  waypointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  waypointNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.accentLight,
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
  },
  waypointRemoveBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waypointRemoveText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  waypointGpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  addWaypointBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderStyle: 'dashed' as any,
    alignItems: 'center',
    marginTop: 4,
  },
  addWaypointText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  // Image
  imageButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  imagePickBtn: {
    flex: 1,
    height: 120,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 16,
    borderStyle: 'dashed' as any,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePickIcon: {
    fontSize: 28,
  },
  imagePickLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  previewWrap: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Summary
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  prevBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
  },
  prevBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  nextBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.5,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalClose: {
    fontSize: 18,
    color: colors.textTertiary,
    padding: 4,
  },
  modalLoading: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  activityMeta: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  activityArrow: {
    fontSize: 22,
    color: colors.textTertiary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginHorizontal: 20,
  },
});
