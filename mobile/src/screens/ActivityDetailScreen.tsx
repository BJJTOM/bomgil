import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  Dimensions,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { colors } from '../theme/colors';
import SafeMapView from '../components/SafeMapView';
import api from '../api/client';

const { width: SW } = Dimensions.get('window');

const SPOT_COLORS: Record<string, string> = {
  restaurant: '#D85A30',
  cafe: '#378ADD',
  photo: '#7F77DD',
  rest: '#888780',
  view: '#EF9F27',
};

const SPOT_LABELS: Record<string, string> = {
  restaurant: '맛집',
  cafe: '카페',
  photo: '포토',
  rest: '휴식',
  view: '전망',
};

const DIFFICULTY_OPTIONS = ['쉬움', '보통', '어려움'];
const COURSE_TYPE_OPTIONS = ['편도', '왕복', '순환'];
const SEASON_OPTIONS = ['봄', '여름', '가을', '겨울'];

function formatDuration(minutes: number | string | null | undefined) {
  const mins = typeof minutes === 'string' ? parseInt(minutes, 10) : minutes;
  if (mins == null || isNaN(mins) || mins <= 0) return '0분';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

function formatPace(p: number) {
  if (p <= 0 || p > 30) return "--'--\"";
  const min = Math.floor(p);
  const sec = Math.round((p - min) * 60);
  return `${min}'${sec.toString().padStart(2, '0')}"`;
}

export default function ActivityDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [activity, setActivity] = useState<any>(route.params?.activity);
  const [taggedPhotos, setTaggedPhotos] = useState<any[]>(route.params?.taggedPhotos || []);
  const [walkSpots, setWalkSpots] = useState<any[]>(route.params?.spots || []);

  // Title editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(activity?.title || '');

  // Spot add modal state
  const [showSpotModal, setShowSpotModal] = useState(false);
  const [newSpotName, setNewSpotName] = useState('');
  const [newSpotType, setNewSpotType] = useState('rest');
  const [newSpotDesc, setNewSpotDesc] = useState('');

  const saveTitle = async () => {
    setEditingTitle(false);
    if (editTitle.trim() && activity?.id) {
      try {
        await api.patch(`/activities/${activity.id}/`, { title: editTitle.trim() });
        setActivity((prev: any) => ({ ...prev, title: editTitle.trim() }));
      } catch {}
    }
  };

  const addSpot = async () => {
    if (!newSpotName.trim()) return;
    const spot = {
      name: newSpotName.trim(),
      type: newSpotType,
      description: newSpotDesc.trim(),
    };
    const updated = [...walkSpots, spot];
    setWalkSpots(updated);
    setShowSpotModal(false);
    setNewSpotName('');
    setNewSpotType('rest');
    setNewSpotDesc('');
    // Persist to AsyncStorage
    try {
      const key = activity?.id ? `activity_${activity.id}_extra` : 'activity_latest_extra';
      const rawStr = await AsyncStorage.getItem(key);
      const extra = rawStr ? JSON.parse(rawStr) : {};
      extra.spots = updated;
      await AsyncStorage.setItem(key, JSON.stringify(extra));
    } catch {}
  };

  // Fetch full activity detail from API — merge, don't replace
  useEffect(() => {
    if (activity?.id) {
      api.get(`/activities/${activity.id}/`).then(res => {
        if (res.data) {
          setActivity((prev: any) => {
            const merged = { ...prev };
            // Only override with API data if API has non-empty values
            for (const [key, val] of Object.entries(res.data)) {
              if (key === 'track_points') {
                // Keep existing track_points if API returns empty
                if (Array.isArray(val) && (val as any[]).length > 0) {
                  merged[key] = val;
                }
              } else if (val != null && val !== '' && val !== 0) {
                merged[key] = val;
              }
            }
            return merged;
          });
          setDetailLoaded(true);
        }
      }).catch(() => setDetailLoaded(true));
    } else {
      setDetailLoaded(true);
    }
  }, []);

  // Load extra data from AsyncStorage
  useEffect(() => {
    loadExtraData();
  }, []);

  const loadExtraData = async () => {
    try {
      let raw: string | null = null;

      // 1. Try exact ID match
      if (activity?.id) {
        raw = await AsyncStorage.getItem(`activity_${activity.id}_extra`);
      }

      // 2. Try latest — only if activity is very recent (within 5 minutes)
      if (!raw) {
        const actCreated = new Date(activity?.created_at || activity?.started_at || 0).getTime();
        const fiveMinAgo = Date.now() - 5 * 60 * 1000;
        if (actCreated > fiveMinAgo) {
          raw = await AsyncStorage.getItem('activity_latest_extra');
        }
      }

      // 3. Scan all keys, pick most recent
      if (!raw) {
        const allKeys = await AsyncStorage.getAllKeys();
        const actKeys = allKeys.filter(k => k.startsWith('activity_') && k.endsWith('_extra') && k !== 'activity_latest_extra');
        if (actKeys.length > 0) {
          raw = await AsyncStorage.getItem(actKeys.sort().reverse()[0]);
        }
      }

      console.log(`[Moru] ActivityDetail loadExtra: raw=${raw ? 'found' : 'null'}, actId=${activity?.id}`);
      if (raw) {
        const extra = JSON.parse(raw);
        console.log(`[Moru] Extra data: spots=${extra.spots?.length || 0}, photos=${extra.taggedPhotos?.length || 0}, route=${extra.routeCoords?.length || 0}`);
        if (extra.taggedPhotos?.length && taggedPhotos.length === 0) setTaggedPhotos(extra.taggedPhotos);
        if (extra.spots?.length && walkSpots.length === 0) setWalkSpots(extra.spots);
        if (extra.routeCoords?.length && (!activity.track_points || activity.track_points.length === 0)) {
          activity.track_points = extra.routeCoords.map((c: [number, number]) => ({ lng: c[0], lat: c[1] }));
        }
        // Also restore trackPoints if available
        if (extra.trackPoints?.length && (!activity.track_points || activity.track_points.length === 0)) {
          activity.track_points = extra.trackPoints;
        }
      }
    } catch (e) {
      console.log('Failed to load activity extra data:', e);
    }
  };

  // Course draft state
  const [courseExpanded, setCourseExpanded] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [coverImage, setCoverImage] = useState<any>(null);
  const [difficulty, setDifficulty] = useState('보통');
  const [courseType, setCourseType] = useState('편도');
  const [seasons, setSeasons] = useState<string[]>([]);
  const [timeSlot, setTimeSlot] = useState('');
  const [tags, setTags] = useState('');
  const [transport, setTransport] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detailLoaded, setDetailLoaded] = useState(false);

  if (!activity) return null;

  const trackPoints = activity.track_points || [];
  const pathCoords: [number, number][] = trackPoints.map((p: any) => [p.lng, p.lat]);
  const hasPath = pathCoords.length >= 2;
  const firstPoint = trackPoints[0];
  const lastPoint = trackPoints[trackPoints.length - 1];

  const dateStr = (activity.started_at || activity.created_at)
    ? new Date(activity.started_at || activity.created_at).toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
      })
    : '';

  const timeStr = activity.started_at
    ? new Date(activity.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : '';

  const distance = activity.distance_km ? parseFloat(activity.distance_km) : 0;
  const steps = activity.total_steps || 0;
  const calories = activity.calories_burned || 0;
  const elevation = activity.elevation_gain_m || 0;
  const pace = activity.avg_pace_min_km ? parseFloat(activity.avg_pace_min_km) : 0;
  const duration = activity.duration_minutes || 0;

  const toggleSeason = (s: string) => {
    setSeasons(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const pickCoverFromGallery = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (res) => {
      if (!res.didCancel && res.assets?.[0]) {
        setCoverImage(res.assets[0]);
      }
    });
  };

  const pickCoverFromCamera = () => {
    launchCamera({ mediaType: 'photo', quality: 0.8 }, (res) => {
      if (!res.didCancel && res.assets?.[0]) {
        setCoverImage(res.assets[0]);
      }
    });
  };

  const difficultyMap: Record<string, string> = {
    '쉬움': 'easy',
    '보통': 'moderate',
    '어려움': 'hard',
  };

  const buildPayload = () => {
    const title = courseName.trim() || activity.title || '걷기 코스';
    const roundedPath = pathCoords.map((c) => [
      parseFloat(c[0].toFixed(6)),
      parseFloat(c[1].toFixed(6)),
    ]);
    const startCoord = roundedPath[0];
    const endCoord = roundedPath[roundedPath.length - 1];

    const payload: any = {
      title,
      description: courseDesc.trim() || title,
      difficulty: difficultyMap[difficulty] || 'moderate',
      country: 'KR',
      status: 'approved',
      distance_km: parseFloat(distance.toFixed(2)),
      estimated_minutes: Math.max(1, Math.round(duration)),
      path_data: { type: 'LineString', coordinates: roundedPath },
      start_lat: parseFloat(startCoord[1].toFixed(6)),
      start_lng: parseFloat(startCoord[0].toFixed(6)),
      end_lat: parseFloat(endCoord[1].toFixed(6)),
      end_lng: parseFloat(endCoord[0].toFixed(6)),
    };

    if (elevation > 0) payload.elevation_gain = Math.round(elevation);
    if (seasons.length > 0) payload.best_season = seasons[0];

    return payload;
  };

  const saveDraft = async () => {
    try {
      const draft = {
        ...buildPayload(),
        courseType,
        seasons,
        timeSlot,
        tags,
        transport,
        coverImageUri: coverImage?.uri || null,
        savedAt: new Date().toISOString(),
      };
      const key = `course_draft_${Date.now()}`;
      await AsyncStorage.setItem(key, JSON.stringify(draft));
      Alert.alert('저장 완료', '임시 저장되었습니다.');
    } catch (err) {
      Alert.alert('오류', '임시 저장에 실패했습니다.');
    }
  };

  const shareCourse = async () => {
    const token = require('../stores/auth').useAuthStore.getState().accessToken;
    if (!token) {
      Alert.alert('로그인 필요', '코스를 등록하려면 로그인해주세요.');
      return;
    }
    if (!hasPath) {
      Alert.alert('오류', '경로 데이터가 필요합니다.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      const { data } = await api.post('/trails/', payload);
      const trailId = data.id;

      if (coverImage && trailId) {
        try {
          const formData = new FormData();
          formData.append('cover_image', {
            uri: coverImage.uri,
            type: coverImage.type || 'image/jpeg',
            name: coverImage.fileName || 'cover.jpg',
          } as any);
          await api.patch(`/trails/${trailId}/`, formData, {
          });
        } catch (imgErr) {
          console.log('Cover image upload failed:', imgErr);
        }
      }

      Alert.alert('등록 완료', '코스가 성공적으로 공유되었습니다!', [
        { text: '확인', onPress: () => navigation.navigate('Main') },
      ]);
    } catch (err: any) {
      const errData = err?.response?.data;
      console.log('Trail create error:', errData || err);
      let msg = '코스 등록에 실패했습니다.';
      if (errData && typeof errData === 'object') {
        const firstKey = Object.keys(errData)[0];
        const firstVal = Array.isArray(errData[firstKey]) ? errData[firstKey][0] : errData[firstKey];
        msg = `${firstKey}: ${firstVal}`;
      }
      Alert.alert('오류', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>활동 상세</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. Route map preview — tap to expand */}
          <TouchableOpacity
            style={styles.mapSection}
            activeOpacity={0.95}
            onPress={() => navigation.navigate('MapDetail', {
              pathCoordinates: hasPath ? pathCoords : [],
              startLat: firstPoint?.lat,
              startLng: firstPoint?.lng,
              endLat: hasPath ? lastPoint?.lat : undefined,
              endLng: hasPath ? lastPoint?.lng : undefined,
              spots: walkSpots.filter((s: any) => s.lat && s.lng),
              title: activity.title || '활동 경로',
              distance: activity.distance_km ? parseFloat(activity.distance_km) : distance,
              duration: activity.duration_minutes || duration,
            })}>
            <SafeMapView
              lat={firstPoint?.lat || 37.5665}
              lng={firstPoint?.lng || 126.978}
              endLat={hasPath ? lastPoint?.lat : undefined}
              endLng={hasPath ? lastPoint?.lng : undefined}
              pathCoordinates={hasPath ? pathCoords : undefined}
              height={240}
              theme="dark"
              spots={walkSpots.filter((s: any) => s.lat && s.lng).map((s: any) => ({ lat: s.lat, lng: s.lng, name: s.name, type: s.type }))}
            />
            <View style={styles.mapExpandBtn}>
              <Text style={styles.mapExpandIcon}>{'⤢'}</Text>
            </View>
          </TouchableOpacity>

          {/* 2. Title & Date */}
          <View style={styles.titleSection}>
            {editingTitle ? (
              <TextInput
                style={styles.titleInput}
                value={editTitle}
                onChangeText={setEditTitle}
                onBlur={saveTitle}
                onSubmitEditing={saveTitle}
                autoFocus
              />
            ) : (
              <TouchableOpacity onPress={() => setEditingTitle(true)}>
                <Text style={styles.actTitle}>{editTitle || activity.title || '걷기 기록'} {'✏️'}</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.actDate}>{dateStr}</Text>
            {timeStr ? <Text style={styles.actTime}>{timeStr} 시작</Text> : null}
          </View>

          {/* 2. Stats cards — Row 1 */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>시간</Text>
              <Text style={styles.statVal}>{formatDuration(duration)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>거리</Text>
              <Text style={styles.statVal}>{distance.toFixed(2)} km</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>걸음</Text>
              <Text style={styles.statVal}>{steps.toLocaleString()}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>칼로리</Text>
              <Text style={styles.statVal}>{calories} kcal</Text>
            </View>
          </View>

          {/* Stats cards — Row 2 */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>평균 페이스</Text>
              <Text style={styles.statVal}>{formatPace(pace)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>고도 상승</Text>
              <Text style={styles.statVal}>{elevation > 0 ? `+${Math.round(elevation)}m` : '-'}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>소스</Text>
              <Text style={styles.statVal}>{activity.source === 'phone_gps' ? 'GPS' : activity.source || '-'}</Text>
            </View>
          </View>

          {/* 3. Photos section */}
          {taggedPhotos.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>사진 ({taggedPhotos.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {taggedPhotos.map((photo: any, idx: number) => (
                  <View key={idx} style={styles.photoItem}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.photoThumb}
                      resizeMode="cover"
                    />
                    <Text style={styles.photoLocation} numberOfLines={1}>
                      {photo.title || `사진 ${idx + 1}`}
                    </Text>
                    {photo.lat != null && photo.lng != null && (
                      <Text style={styles.photoCoords}>
                        {'\uD83D\uDCCD'} {photo.lat.toFixed(4)}, {photo.lng.toFixed(4)}
                      </Text>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* 4. Spots section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>스팟 ({walkSpots.length})</Text>
            {walkSpots.map((spot: any, idx: number) => (
              <View key={idx} style={styles.spotItem}>
                <View style={[styles.spotDot, { backgroundColor: SPOT_COLORS[spot.type] || '#888780' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.spotName}>{spot.name} <Text style={styles.spotTypeLabel}>{SPOT_LABELS[spot.type] || spot.type}</Text></Text>
                  {spot.description ? <Text style={styles.spotDesc}>{spot.description}</Text> : null}
                  {spot.lat != null && spot.lng != null && (
                    <Text style={styles.spotCoords}>
                      {'\uD83D\uDCCD'} {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}
                    </Text>
                  )}
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={styles.addSpotBtn}
              onPress={() => setShowSpotModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.addSpotBtnText}>+ 스팟 추가</Text>
            </TouchableOpacity>
          </View>

          {/* 5. Course draft section — always visible */}
          <View style={styles.section}>
              {!courseExpanded ? (
                <TouchableOpacity
                  style={styles.courseToggleBtn}
                  activeOpacity={0.8}
                  onPress={() => setCourseExpanded(true)}
                >
                  <Text style={styles.courseToggleText}>코스로 등록하기</Text>
                  <Text style={styles.courseToggleArrow}>{'>'}</Text>
                </TouchableOpacity>
              ) : (
                <View>
                  <TouchableOpacity
                    style={styles.courseHeaderRow}
                    activeOpacity={0.8}
                    onPress={() => setCourseExpanded(false)}
                  >
                    <Text style={styles.sectionTitle}>코스로 등록하기</Text>
                    <Text style={styles.courseToggleArrow}>{'v'}</Text>
                  </TouchableOpacity>

                  {/* 코스 이름 */}
                  <Text style={styles.fieldLabel}>코스 이름</Text>
                  <TextInput
                    style={styles.textInput}
                    value={courseName}
                    onChangeText={setCourseName}
                    placeholder={activity.title || '코스 이름을 입력하세요'}
                    placeholderTextColor={colors.textTertiary}
                  />

                  {/* 코스 설명 */}
                  <Text style={styles.fieldLabel}>코스 설명</Text>
                  <TextInput
                    style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                    value={courseDesc}
                    onChangeText={setCourseDesc}
                    placeholder="코스에 대한 설명을 입력하세요"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                  />

                  {/* 커버 사진 */}
                  <Text style={styles.fieldLabel}>커버 사진</Text>
                  <View style={styles.coverRow}>
                    {coverImage ? (
                      <Image source={{ uri: coverImage.uri }} style={styles.coverPreview} resizeMode="cover" />
                    ) : (
                      <View style={styles.coverPlaceholder}>
                        <Text style={styles.coverPlaceholderText}>사진 없음</Text>
                      </View>
                    )}
                    <View style={styles.coverButtons}>
                      <TouchableOpacity style={styles.coverBtn} onPress={pickCoverFromCamera}>
                        <Text style={styles.coverBtnText}>카메라</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.coverBtn} onPress={pickCoverFromGallery}>
                        <Text style={styles.coverBtnText}>갤러리</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* 난이도 */}
                  <Text style={styles.fieldLabel}>난이도</Text>
                  <View style={styles.chipRow}>
                    {DIFFICULTY_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.chip, difficulty === opt && styles.chipSelected]}
                        onPress={() => setDifficulty(opt)}
                      >
                        <Text style={[styles.chipText, difficulty === opt && styles.chipTextSelected]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 코스 유형 */}
                  <Text style={styles.fieldLabel}>코스 유형</Text>
                  <View style={styles.chipRow}>
                    {COURSE_TYPE_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.chip, courseType === opt && styles.chipSelected]}
                        onPress={() => setCourseType(opt)}
                      >
                        <Text style={[styles.chipText, courseType === opt && styles.chipTextSelected]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 추천 계절 */}
                  <Text style={styles.fieldLabel}>추천 계절</Text>
                  <View style={styles.chipRow}>
                    {SEASON_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.chip, seasons.includes(opt) && styles.chipSelected]}
                        onPress={() => toggleSeason(opt)}
                      >
                        <Text style={[styles.chipText, seasons.includes(opt) && styles.chipTextSelected]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 추천 시간대 */}
                  <Text style={styles.fieldLabel}>추천 시간대</Text>
                  <TextInput
                    style={styles.textInput}
                    value={timeSlot}
                    onChangeText={setTimeSlot}
                    placeholder="예: 오전 9시~12시"
                    placeholderTextColor={colors.textTertiary}
                  />

                  {/* 태그 */}
                  <Text style={styles.fieldLabel}>태그</Text>
                  <TextInput
                    style={styles.textInput}
                    value={tags}
                    onChangeText={setTags}
                    placeholder="예: #맛집투어 #역사탐방"
                    placeholderTextColor={colors.textTertiary}
                  />

                  {/* 교통편 안내 */}
                  <Text style={styles.fieldLabel}>교통편 안내</Text>
                  <TextInput
                    style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                    value={transport}
                    onChangeText={setTransport}
                    placeholder="대중교통, 주차 정보 등"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                  />

                  {/* Action buttons */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.draftBtn}
                      onPress={saveDraft}
                      disabled={submitting}
                    >
                      <Text style={styles.draftBtnText}>임시 저장</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.shareBtn, submitting && { opacity: 0.6 }]}
                      onPress={shareCourse}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.shareBtnText}>코스 공유하기</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
        </ScrollView>
      </View>

      {/* Spot Add Modal */}
      <Modal visible={showSpotModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.spotModalOverlay}
          onPress={() => setShowSpotModal(false)}
          activeOpacity={1}
        >
          <View style={styles.spotModal}>
            <Text style={styles.spotModalTitle}>스팟 추가</Text>

            <Text style={styles.fieldLabel}>이름</Text>
            <TextInput
              style={styles.textInput}
              value={newSpotName}
              onChangeText={setNewSpotName}
              placeholder="스팟 이름"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.fieldLabel}>유형</Text>
            <View style={styles.chipRow}>
              {Object.keys(SPOT_COLORS).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, newSpotType === t && styles.chipSelected]}
                  onPress={() => setNewSpotType(t)}
                >
                  <Text style={[styles.chipText, newSpotType === t && styles.chipTextSelected]}>{SPOT_LABELS[t] || t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>설명</Text>
            <TextInput
              style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
              value={newSpotDesc}
              onChangeText={setNewSpotDesc}
              placeholder="설명 (선택)"
              placeholderTextColor={colors.textTertiary}
              multiline
            />

            <View style={styles.spotModalActions}>
              <TouchableOpacity
                style={styles.spotModalCancel}
                onPress={() => setShowSpotModal(false)}
              >
                <Text style={styles.spotModalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.spotModalConfirm}
                onPress={addSpot}
              >
                <Text style={styles.spotModalConfirmText}>추가</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  actTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  actDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  actTime: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  mapSection: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  mapExpandBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapExpandIcon: {
    fontSize: 18,
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    marginBottom: 4,
  },
  statVal: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  section: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  photoItem: {
    marginRight: 12,
    width: SW * 0.38,
  },
  photoThumb: {
    width: SW * 0.38,
    height: SW * 0.38,
    borderRadius: 12,
  },
  photoLocation: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 6,
  },
  photoCoords: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  spotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  spotDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  spotName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  spotTypeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  spotDesc: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  spotCoords: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 3,
  },
  // Course draft toggle
  courseToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  courseToggleText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  courseToggleArrow: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  courseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  // Form fields
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 14,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
  },
  coverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  coverPreview: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  coverPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  coverPlaceholderText: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  coverButtons: {
    gap: 8,
  },
  coverBtn: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  coverBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    marginBottom: 20,
  },
  draftBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  draftBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  shareBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingVertical: 4,
  },
  addSpotBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  addSpotBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  spotModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: SW - 48,
    maxWidth: 360,
  },
  spotModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  spotModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  spotModalCancel: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  spotModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  spotModalConfirm: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  spotModalConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
