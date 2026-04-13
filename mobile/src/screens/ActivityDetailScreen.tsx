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
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';
import SafeMapView from '../components/SafeMapView';
import api from '../api/client';
import { navParamCache } from '../utils/navParamCache';
import { useThemeStore } from '../stores/theme';

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
  const { isDark } = useThemeStore();
  // Theme-reactive surface colors. Computed every render — cheap.
  const bg = isDark ? '#0a0a0a' : '#FAFAFA';
  const cardBg = isDark ? '#1c1c1e' : '#FFFFFF';
  const surfaceBg = isDark ? '#1a1a1a' : '#F7F8FA';
  const textColor = isDark ? '#FFFFFF' : colors.textPrimary;
  const textSecColor = isDark ? 'rgba(255,255,255,0.65)' : colors.textSecondary;
  const textTertColor = isDark ? 'rgba(255,255,255,0.42)' : colors.textTertiary;
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F6';
  const [activity, setActivity] = useState<any>(route.params?.activity);
  const [taggedPhotos, setTaggedPhotos] = useState<any[]>(route.params?.taggedPhotos || []);
  const [walkSpots, setWalkSpots] = useState<any[]>(route.params?.spots || []);

  // Title editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(activity?.title || '');

  // Spot add modal state
  const [showSpotModal, setShowSpotModal] = useState(false);
  const [showResumeConfirm, setShowResumeConfirm] = useState(false);

  const handleResumeWalk = () => {
    setShowResumeConfirm(false);
    try {
      // Defensive: activity may be missing track_points (fresh walks)
      // or the server may return null; never .map() on a non-array.
      const tpRaw = activity?.track_points;
      const tp = Array.isArray(tpRaw) ? tpRaw : [];
      const rc: [number, number][] = tp.map((p: any) => {
        if (Array.isArray(p)) return p as [number, number];
        const lng = p?.lng ?? p?.longitude ?? 0;
        const lat = p?.lat ?? p?.latitude ?? 0;
        return [lng, lat] as [number, number];
      }).filter((c: [number, number]) => c[0] !== 0 && c[1] !== 0);
      const resumeData = {
        segments: [{
          routeCoords: rc, trackPoints: tp,
          distance: parseFloat(activity.distance_km || '0'),
          duration: (activity.duration_minutes || 0) * 60,
          steps: activity.total_steps || 0,
          calories: activity.calories_burned || 0,
          elevationGain: activity.elevation_gain_m || 0,
        }],
        spots: walkSpots || [],
        taggedPhotos: taggedPhotos || [],
        trailId: activity.trail || null,
      };
      // Heavy data (tp, rc, photos) goes through the in-memory cache to
      // avoid Android's TransactionTooLargeException on long walks.
      const cacheKey = navParamCache.put({ resumeData });
      navigation.replace('Walk', { _resumeCacheKey: cacheKey });
    } catch (e: any) {
      Alert.alert('오류', '이어가기를 시작할 수 없습니다: ' + (e?.message || ''));
    }
  };
  const [newSpotName, setNewSpotName] = useState('');
  const [newSpotType, setNewSpotType] = useState('rest');
  const [newSpotDesc, setNewSpotDesc] = useState('');

  // Walk merge state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [sameDayActivities, setSameDayActivities] = useState<any[]>([]);
  const [selectedMergeIds, setSelectedMergeIds] = useState<number[]>([]);
  const [merging, setMerging] = useState(false);
  const [loadingMerge, setLoadingMerge] = useState(false);

  const openMergeModal = async () => {
    if (!activity?.started_at && !activity?.created_at) {
      Alert.alert('오류', '날짜 정보가 없어 합치기를 할 수 없습니다.');
      return;
    }
    setLoadingMerge(true);
    setShowMergeModal(true);
    try {
      const dateStr = (activity.started_at || activity.created_at).split('T')[0];
      const { data } = await api.get('/activities/', { params: { page_size: 50 } });
      const results = data?.results ?? data ?? [];
      const sameDay = results.filter((a: any) => {
        if (a.id === activity.id) return false;
        const aDate = (a.started_at || a.created_at || '').split('T')[0];
        return aDate === dateStr;
      });
      setSameDayActivities(sameDay);
      setSelectedMergeIds([]);
    } catch {
      Alert.alert('오류', '활동 목록을 불러오지 못했습니다.');
      setShowMergeModal(false);
    } finally {
      setLoadingMerge(false);
    }
  };

  const toggleMergeSelect = (id: number) => {
    setSelectedMergeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const executeMerge = async (deleteOriginals: boolean) => {
    const allIds = [activity.id, ...selectedMergeIds];
    setMerging(true);
    try {
      const { data } = await api.post('/activities/merge/', {
        activity_ids: allIds,
        delete_originals: deleteOriginals,
      });
      setShowMergeModal(false);
      Alert.alert('합치기 완료', '기록이 성공적으로 합쳐졌습니다.', [
        {
          text: '확인',
          onPress: () => {
            setActivity(data);
          },
        },
      ]);
    } catch (e: any) {
      const msg = e?.response?.data?.error || '합치기에 실패했습니다.';
      Alert.alert('오류', msg);
    } finally {
      setMerging(false);
    }
  };

  const confirmMerge = () => {
    if (selectedMergeIds.length === 0) {
      Alert.alert('선택 필요', '합칠 기록을 1개 이상 선택해주세요.');
      return;
    }
    Alert.alert(
      '기록 합치기',
      `현재 기록 포함 ${selectedMergeIds.length + 1}개의 기록을 합칩니다.`,
      [
        { text: '취소', style: 'cancel' },
        { text: '합치기 (원본 유지)', onPress: () => executeMerge(false) },
        { text: '합치기 (원본 삭제)', style: 'destructive', onPress: () => executeMerge(true) },
      ],
    );
  };

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

      // 2. Match by timestamp: find a timestamped backup whose save time
      // falls within [started_at, started_at + 24h]. This recovers walks
      // where the API save failed and no activity_{id}_extra key was created.
      // Among matches, pick the one with the most routeCoords (most complete).
      if (!raw && activity?.started_at) {
        const startMs = new Date(activity.started_at).getTime();
        const endMs = startMs + 24 * 60 * 60 * 1000;
        const allKeys = await AsyncStorage.getAllKeys();
        const candidates: { key: string; ts: number; rcLen: number }[] = [];
        for (const k of allKeys) {
          const m = k.match(/^activity_(\d+)_extra$/);
          if (!m) continue;
          const ts = parseInt(m[1]);
          if (ts < startMs || ts > endMs) continue;
          try {
            const r = await AsyncStorage.getItem(k);
            if (!r) continue;
            const d = JSON.parse(r);
            candidates.push({ key: k, ts, rcLen: d.routeCoords?.length || 0 });
          } catch {}
        }
        if (candidates.length > 0) {
          candidates.sort((a, b) => b.rcLen - a.rcLen);
          raw = await AsyncStorage.getItem(candidates[0].key);
          console.log(`[Moru] Matched backup ${candidates[0].key} (rc=${candidates[0].rcLen})`);
        }
      }

      // 3. Try latest — only if activity is very recent (within 5 minutes)
      if (!raw) {
        const actCreated = new Date(activity?.created_at || activity?.started_at || 0).getTime();
        const fiveMinAgo = Date.now() - 5 * 60 * 1000;
        if (actCreated > fiveMinAgo) {
          raw = await AsyncStorage.getItem('activity_latest_extra');
        }
      }

      console.log(`[Moru] ActivityDetail loadExtra: raw=${raw ? 'found' : 'null'}, actId=${activity?.id}`);
      if (raw) {
        const extra = JSON.parse(raw);
        console.log(`[Moru] Extra data: spots=${extra.spots?.length || 0}, photos=${extra.taggedPhotos?.length || 0}, route=${extra.routeCoords?.length || 0}`);
        if (extra.taggedPhotos?.length && taggedPhotos.length === 0) setTaggedPhotos(extra.taggedPhotos);
        if (extra.spots?.length && walkSpots.length === 0) setWalkSpots(extra.spots);
        // Restore track points via setActivity (immutable update so React re-renders)
        // Prefer routeCoords when it has more points than trackPoints —
        // old resume code saved incomplete trackPoints (current segment only)
        // but routeCoords always contained all segments.
        const tpLen = extra.trackPoints?.length || 0;
        const rcLen = extra.routeCoords?.length || 0;
        const bestPoints = rcLen >= tpLen && rcLen > 0
          ? extra.routeCoords.map((c: [number, number]) => ({ lng: c[0], lat: c[1] }))
          : tpLen > 0 ? extra.trackPoints : null;
        setActivity((prev: any) => {
          if (!prev) return prev;
          const serverLen = Array.isArray(prev.track_points) ? prev.track_points.length : 0;
          // If local data is more complete, use it and patch the server
          if (bestPoints && bestPoints.length > serverLen) {
            console.log(`[Moru] Local route (${bestPoints.length}) > server (${serverLen}), patching...`);
            // Fire-and-forget server patch
            if (prev.id) {
              api.patch(`/activities/${prev.id}/`, { track_points: bestPoints })
                .then(() => console.log(`[Moru] Server patched: activity ${prev.id}`))
                .catch((e: any) => console.log(`[Moru] Server patch failed:`, e));
            }
            return { ...prev, track_points: bestPoints };
          }
          return prev;
        });
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

  // Filter out null / malformed points BEFORE mapping. Some legacy imports
  // (Samsung Health, merged activities) produce arrays with null entries
  // or entries lacking lat/lng — accessing p.lng/p.lat on those crashes.
  const rawTrackPoints = Array.isArray(activity.track_points) ? activity.track_points : [];
  const trackPoints = rawTrackPoints.filter(
    (p: any) => p && typeof p.lng === 'number' && typeof p.lat === 'number',
  );
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

    // Defensive — if we somehow got here with no valid path, bail with null
    // so the caller can show an error instead of submitting (0, 0) coords.
    if (!startCoord || !endCoord) return null;

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
    if (seasons.length > 0) {
      const seasonMap: Record<string, string> = { '봄': 'spring', '여름': 'summer', '가을': 'fall', '겨울': 'winter' };
      payload.best_season = seasonMap[seasons[0]] || 'all';
    }
    const trailTypeMap: Record<string, string> = { '편도': 'one_way', '왕복': 'round_trip', '순환': 'loop' };
    payload.trail_type = trailTypeMap[courseType] || 'one_way';
    if (tags.trim()) payload.tags = tags.split('#').map(t => t.trim()).filter(Boolean);
    if (transport.trim()) payload.transport_access = transport.trim();
    if (timeSlot.trim()) payload.recommended_time = timeSlot.trim();

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
      if (!payload) {
        Alert.alert('오류', '경로 좌표를 읽을 수 없습니다.');
        setSubmitting(false);
        return;
      }
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
          const res = await fetch(`https://api.moruwalk.com/api/v1/trails/${trailId}/`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          if (!res.ok) {
            const errText = await res.text();
            console.log('[Moru] Cover image upload failed:', res.status, errText.slice(0, 200));
          }
        } catch (imgErr: any) {
          console.log('Cover image upload error:', imgErr?.message);
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
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: bg }]}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={bg}
        />

        {/* Header */}
        <View style={[styles.header, { backgroundColor: bg, borderBottomColor: borderColor }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            accessibilityLabel="뒤로가기">
            <Feather name="arrow-left" size={20} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textColor }]}>활동 상세</Text>
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
              spots: [
                ...walkSpots.filter((s: any) => s.lat && s.lng),
                ...taggedPhotos.filter((p: any) => p.lat && p.lng).map((p: any) => ({ lat: p.lat, lng: p.lng, name: p.title || 'Photo', type: 'photo' })),
              ],
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
              spots={[
                ...walkSpots.filter((s: any) => s.lat && s.lng).map((s: any) => ({ lat: s.lat, lng: s.lng, name: s.name, type: s.type })),
                ...taggedPhotos.filter((p: any) => p.lat && p.lng).map((p: any) => ({ lat: p.lat, lng: p.lng, name: p.title || 'Photo', type: 'photo' })),
              ]}
            />
            <View style={styles.mapExpandBtn}>
              <Text style={styles.mapExpandIcon}>{'⤢'}</Text>
            </View>
          </TouchableOpacity>

          {/* Photos thumbnails below map */}
          {taggedPhotos.length > 0 && (
            <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                {taggedPhotos.map((photo: any, idx: number) => (
                  <View key={`map-thumb-${idx}`} style={{ marginRight: 8, alignItems: 'center' }}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={{ width: 56, height: 56, borderRadius: 10, borderWidth: 2, borderColor: '#7F77DD' }}
                      resizeMode="cover"
                    />
                    {photo.lat != null && photo.lng != null && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#7F77DD', marginTop: 4 }} />
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* 2. Title & Date */}
          <View style={styles.titleSection}>
            {editingTitle ? (
              <TextInput
                style={[styles.titleInput, { color: textColor, borderBottomColor: colors.primary }]}
                value={editTitle}
                onChangeText={setEditTitle}
                onBlur={saveTitle}
                onSubmitEditing={saveTitle}
                autoFocus
              />
            ) : (
              <TouchableOpacity
                onPress={() => setEditingTitle(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                accessibilityLabel="제목 편집">
                <Text style={[styles.actTitle, { color: textColor }]} numberOfLines={2}>
                  {editTitle || activity.title || '걷기 기록'}
                </Text>
                <Feather name="edit-2" size={14} color={textTertColor} />
              </TouchableOpacity>
            )}
            <Text style={[styles.actDate, { color: textSecColor }]}>{dateStr}</Text>
            {timeStr ? <Text style={[styles.actTime, { color: textTertColor }]}>{timeStr} 시작</Text> : null}
          </View>

          {/* Hero stats — distance is the dominant metric. Time second.
              Steps + calories on a secondary row.

              Visual hierarchy intent:
              - Distance fills the eye first (40px font, primary color).
              - Time slightly smaller (24px) with same weight.
              - Pace + elevation as supporting micro-stats below.
              The previous 4-card grid gave equal weight to every metric,
              which made the screen feel cluttered. */}
          <View style={[styles.heroStatsCard, { backgroundColor: cardBg }]}>
            <View style={styles.heroStatsTop}>
              <View style={styles.heroStatsCol}>
                <Text style={[styles.heroStatLabel, { color: textTertColor }]}>총 거리</Text>
                <Text style={styles.heroDistanceValue}>
                  {distance.toFixed(2)}
                  <Text style={[styles.heroDistanceUnit, { color: textSecColor }]}> km</Text>
                </Text>
              </View>
              <View style={[styles.heroDivider, { backgroundColor: borderColor }]} />
              <View style={styles.heroStatsCol}>
                <Text style={[styles.heroStatLabel, { color: textTertColor }]}>총 시간</Text>
                <Text style={[styles.heroTimeValue, { color: textColor }]}>
                  {formatDuration(duration)}
                </Text>
              </View>
            </View>

            <View style={[styles.heroSecondaryRow, { borderTopColor: borderColor }]}>
              <View style={styles.heroSecondaryItem}>
                <Feather name="activity" size={14} color={textTertColor} />
                <Text style={[styles.heroSecondaryValue, { color: textColor }]}>
                  {steps.toLocaleString()}
                </Text>
                <Text style={[styles.heroSecondaryLabel, { color: textTertColor }]}>걸음</Text>
              </View>
              <View style={styles.heroSecondaryItem}>
                <Feather name="zap" size={14} color="#FF8C42" />
                <Text style={[styles.heroSecondaryValue, { color: textColor }]}>{calories}</Text>
                <Text style={[styles.heroSecondaryLabel, { color: textTertColor }]}>kcal</Text>
              </View>
              <View style={styles.heroSecondaryItem}>
                <Feather name="trending-up" size={14} color={textTertColor} />
                <Text style={[styles.heroSecondaryValue, { color: textColor }]}>
                  {formatPace(pace)}
                </Text>
                <Text style={[styles.heroSecondaryLabel, { color: textTertColor }]}>페이스</Text>
              </View>
              {elevation > 0 && (
                <View style={styles.heroSecondaryItem}>
                  <Feather name="triangle" size={14} color="#FF6B35" />
                  <Text style={[styles.heroSecondaryValue, { color: '#FF6B35' }]}>
                    +{Math.round(elevation)}
                  </Text>
                  <Text style={[styles.heroSecondaryLabel, { color: textTertColor }]}>m</Text>
                </View>
              )}
            </View>
          </View>

          {/* Distance Markers along route */}
          {hasPath && distance > 0.5 && (
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Feather name="flag" size={16} color={colors.primary} />
                <Text style={[styles.sectionTitle, { marginLeft: 6, marginBottom: 0 }]}>거리 구간</Text>
              </View>
              <View style={styles.distanceMarkersRow}>
                {Array.from({ length: Math.floor(distance) }, (_, i) => i + 1).slice(0, 10).map((km) => (
                  <View key={km} style={styles.distanceMarker}>
                    <View style={styles.distanceMarkerDot}>
                      <Text style={styles.distanceMarkerText}>{km}</Text>
                    </View>
                    <Text style={styles.distanceMarkerLabel}>km</Text>
                  </View>
                ))}
                <View style={styles.distanceMarkerFinish}>
                  <Feather name="flag" size={14} color="#FF4B4B" />
                  <Text style={styles.distanceMarkerLabel}>{distance.toFixed(1)}km</Text>
                </View>
              </View>
            </View>
          )}

          {/* Elevation Profile */}
          {trackPoints.length > 5 && trackPoints.some((p: any) => p.elevation != null || p.altitude != null || p.ele != null) && (() => {
            const elevations: number[] = trackPoints
              .map((p: any) => p.elevation ?? p.altitude ?? p.ele)
              .filter((e: any) => e != null && !isNaN(e)) as number[];
            if (elevations.length < 5) return null;
            const minElev = Math.min(...elevations);
            const maxElev = Math.max(...elevations);
            const range = maxElev - minElev || 1;
            const profileWidth = SW - 40;
            const profileHeight = 80;
            // Sample to ~50 points for display
            const step = Math.max(1, Math.floor(elevations.length / 50));
            const sampled = elevations.filter((_, i) => i % step === 0);
            const barWidth = profileWidth / sampled.length;
            return (
              <View style={styles.section}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <Feather name="trending-up" size={16} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { marginLeft: 6, marginBottom: 0 }]}>고도 프로필</Text>
                  <Text style={{ fontSize: 12, color: '#8B95A1', marginLeft: 8 }}>
                    {Math.round(minElev)}m ~ {Math.round(maxElev)}m
                  </Text>
                </View>
                <View style={[styles.elevationChart, { width: profileWidth, height: profileHeight }]}>
                  {sampled.map((elev, i) => {
                    const height = ((elev - minElev) / range) * (profileHeight - 10) + 4;
                    return (
                      <View
                        key={i}
                        style={{
                          width: barWidth - 1,
                          height,
                          backgroundColor: colors.primary,
                          opacity: 0.6,
                          borderTopLeftRadius: 2,
                          borderTopRightRadius: 2,
                          alignSelf: 'flex-end',
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            );
          })()}

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
          </View>

          {/* === Action buttons (unified) === */}
          <View style={styles.actionGroup}>
            <Text style={styles.actionGroupTitle}>활동 관리</Text>
            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={styles.actionCard}
                activeOpacity={0.7}
                onPress={() => setShowResumeConfirm(true)}>
                <View style={[styles.actionIconCircle, { backgroundColor: colors.primary + '15' }]}>
                  <Feather name="play-circle" size={20} color={colors.primary} />
                </View>
                <Text style={styles.actionCardTitle}>이어서 걷기</Text>
                <Text style={styles.actionCardDesc}>이 기록에서 계속</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                activeOpacity={0.7}
                onPress={openMergeModal}>
                <View style={[styles.actionIconCircle, { backgroundColor: '#60A5FA15' }]}>
                  <Feather name="git-merge" size={20} color="#60A5FA" />
                </View>
                <Text style={styles.actionCardTitle}>기록 합치기</Text>
                <Text style={styles.actionCardDesc}>다른 활동과 병합</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                activeOpacity={0.7}
                onPress={() => setShowSpotModal(true)}>
                <View style={[styles.actionIconCircle, { backgroundColor: '#F59E0B15' }]}>
                  <Feather name="map-pin" size={20} color="#F59E0B" />
                </View>
                <Text style={styles.actionCardTitle}>스팟 추가</Text>
                <Text style={styles.actionCardDesc}>장소 등록하기</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                activeOpacity={0.7}
                onPress={() => setCourseExpanded(true)}>
                <View style={[styles.actionIconCircle, { backgroundColor: '#22C55E15' }]}>
                  <Feather name="share-2" size={20} color="#22C55E" />
                </View>
                <Text style={styles.actionCardTitle}>코스 공유</Text>
                <Text style={styles.actionCardDesc}>경로를 코스로</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 5. Course form moved to Modal — see CourseModal at bottom */}
          {false && (
            <View style={styles.section}>
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

            </View>
          )}
        </ScrollView>
      </View>

      {/* Walk Merge Modal */}
      <Modal visible={showMergeModal} transparent animationType="slide">
        <View style={styles.mergeModalOverlay}>
          <View style={styles.mergeModal}>
            <View style={styles.mergeModalHeader}>
              <Text style={styles.mergeModalTitle}>기록 합치기</Text>
              <TouchableOpacity onPress={() => setShowMergeModal(false)}>
                <Feather name="x" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.mergeModalSubtitle}>
              같은 날의 기록을 선택하세요 (현재 기록은 자동 포함)
            </Text>

            {loadingMerge ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : sameDayActivities.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: colors.textTertiary }}>같은 날의 다른 기록이 없습니다</Text>
              </View>
            ) : (
              <FlatList
                data={sameDayActivities}
                keyExtractor={(item) => String(item.id)}
                style={{ maxHeight: 300 }}
                renderItem={({ item }) => {
                  const selected = selectedMergeIds.includes(item.id);
                  const time = item.started_at
                    ? new Date(item.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                    : '';
                  return (
                    <TouchableOpacity
                      style={[styles.mergeItem, selected && styles.mergeItemSelected]}
                      activeOpacity={0.7}
                      onPress={() => toggleMergeSelect(item.id)}
                    >
                      <View style={[styles.mergeCheckbox, selected && styles.mergeCheckboxChecked]}>
                        {selected && <Feather name="check" size={14} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mergeItemTitle}>{item.title || '걷기 기록'}</Text>
                        <Text style={styles.mergeItemMeta}>
                          {time ? `${time} · ` : ''}
                          {item.distance_km ? `${parseFloat(item.distance_km).toFixed(2)}km` : ''}
                          {item.duration_minutes ? ` · ${item.duration_minutes}분` : ''}
                          {item.total_steps ? ` · ${item.total_steps}걸음` : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            <TouchableOpacity
              style={[styles.mergeConfirmBtn, selectedMergeIds.length === 0 && { opacity: 0.4 }]}
              activeOpacity={0.7}
              onPress={confirmMerge}
              disabled={selectedMergeIds.length === 0 || merging}
            >
              {merging ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.mergeConfirmText}>
                  {selectedMergeIds.length > 0
                    ? `${selectedMergeIds.length + 1}개 기록 합치기`
                    : '기록을 선택해주세요'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Resume Walk Confirm Modal */}
      <Modal visible={showResumeConfirm} transparent animationType="fade" onRequestClose={() => setShowResumeConfirm(false)}>
        <TouchableOpacity style={styles.confirmOverlay} activeOpacity={1} onPress={() => setShowResumeConfirm(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <Feather name="play-circle" size={32} color={colors.primary} />
            </View>
            <Text style={styles.confirmTitle}>이어서 걷기</Text>
            <Text style={styles.confirmDesc}>
              이 기록의 경로와 통계를 가지고{'\n'}새로운 걷기를 시작합니다.
            </Text>
            <View style={styles.confirmStatsRow}>
              <View style={styles.confirmStat}>
                <Text style={styles.confirmStatVal}>{parseFloat(activity?.distance_km || '0').toFixed(1)}</Text>
                <Text style={styles.confirmStatLabel}>km</Text>
              </View>
              <View style={styles.confirmStatDivider} />
              <View style={styles.confirmStat}>
                <Text style={styles.confirmStatVal}>{Math.round(activity?.duration_minutes || 0)}</Text>
                <Text style={styles.confirmStatLabel}>분</Text>
              </View>
              <View style={styles.confirmStatDivider} />
              <View style={styles.confirmStat}>
                <Text style={styles.confirmStatVal}>{activity?.total_steps?.toLocaleString() || '0'}</Text>
                <Text style={styles.confirmStatLabel}>걸음</Text>
              </View>
            </View>
            <View style={styles.confirmBtnRow}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setShowResumeConfirm(false)}>
                <Text style={styles.confirmCancelText}>아니요</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmOkBtn} onPress={handleResumeWalk}>
                <Text style={styles.confirmOkText}>이어서 걷기</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Course Registration Modal */}
      <Modal visible={courseExpanded} transparent animationType="slide" onRequestClose={() => setCourseExpanded(false)}>
        <View style={styles.courseModalOverlay}>
          <View style={styles.courseModal}>
            <View style={styles.courseModalHandle} />
            <View style={styles.courseModalHeader}>
              <Text style={styles.courseModalTitle}>코스로 등록하기</Text>
              <TouchableOpacity onPress={() => setCourseExpanded(false)}>
                <Feather name="x" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: '85%' }} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.fieldLabel}>코스 이름</Text>
              <TextInput
                style={styles.textInput}
                value={courseName}
                onChangeText={setCourseName}
                placeholder={activity?.title || '코스 이름을 입력하세요'}
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.fieldLabel}>코스 설명</Text>
              <TextInput
                style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                value={courseDesc}
                onChangeText={setCourseDesc}
                placeholder="코스에 대한 설명을 입력하세요"
                placeholderTextColor={colors.textTertiary}
                multiline
              />

              <Text style={styles.fieldLabel}>커버 사진</Text>
              {coverImage ? (
                <View style={styles.coverImageWrap}>
                  <Image source={{ uri: coverImage.uri }} style={styles.coverImageLarge} resizeMode="cover" />
                  <TouchableOpacity style={styles.coverRemoveBtn} onPress={() => setCoverImage(null)}>
                    <Feather name="x" size={14} color="#fff" />
                  </TouchableOpacity>
                  <View style={styles.coverChangeRow}>
                    <TouchableOpacity style={styles.coverChangeBtn} onPress={pickCoverFromCamera}>
                      <Feather name="camera" size={14} color="#fff" />
                      <Text style={styles.coverChangeText}>카메라</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.coverChangeBtn} onPress={pickCoverFromGallery}>
                      <Feather name="image" size={14} color="#fff" />
                      <Text style={styles.coverChangeText}>갤러리</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.coverPickerRow}>
                  <TouchableOpacity style={styles.coverPickerBtn} onPress={pickCoverFromCamera} activeOpacity={0.7}>
                    <Feather name="camera" size={20} color={colors.primary} />
                    <Text style={styles.coverPickerText}>카메라</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.coverPickerBtn} onPress={pickCoverFromGallery} activeOpacity={0.7}>
                    <Feather name="image" size={20} color={colors.primary} />
                    <Text style={styles.coverPickerText}>갤러리</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>난이도</Text>
                  <View style={styles.chipRow}>
                    {DIFFICULTY_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.chipSm, difficulty === opt && styles.chipSelected]}
                        onPress={() => setDifficulty(opt)}>
                        <Text style={[styles.chipTextSm, difficulty === opt && styles.chipTextSelected]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>코스 유형</Text>
                  <View style={styles.chipRow}>
                    {COURSE_TYPE_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.chipSm, courseType === opt && styles.chipSelected]}
                        onPress={() => setCourseType(opt)}>
                        <Text style={[styles.chipTextSm, courseType === opt && styles.chipTextSelected]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={styles.fieldLabel}>추천 계절</Text>
              <View style={styles.chipRow}>
                {SEASON_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.chipSm, seasons.includes(opt) && styles.chipSelected]}
                    onPress={() => toggleSeason(opt)}>
                    <Text style={[styles.chipTextSm, seasons.includes(opt) && styles.chipTextSelected]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>태그 (선택)</Text>
              <TextInput
                style={styles.textInput}
                value={tags}
                onChangeText={setTags}
                placeholder="#맛집투어 #역사탐방"
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.fieldLabel}>추천 시간대 (선택)</Text>
              <TextInput
                style={styles.textInput}
                value={timeSlot}
                onChangeText={setTimeSlot}
                placeholder="예: 오전 9시~12시"
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.fieldLabel}>교통편 안내 (선택)</Text>
              <TextInput
                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                value={transport}
                onChangeText={setTransport}
                placeholder="대중교통, 주차 정보 등"
                placeholderTextColor={colors.textTertiary}
                multiline
              />
            </ScrollView>

            <View style={styles.courseModalActions}>
              <TouchableOpacity style={styles.draftBtn} onPress={saveDraft} disabled={submitting}>
                <Text style={styles.draftBtnText}>임시 저장</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shareBtn, submitting && { opacity: 0.6 }]}
                onPress={shareCourse}
                disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.shareBtnText}>코스 공유하기</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  // Hero stats — single dominant card replaces the previous 4-card grid
  heroStatsCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    paddingTop: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  heroStatsTop: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 18,
  },
  heroStatsCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  heroDistanceValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#2D4A2E',
    letterSpacing: -1,
    lineHeight: 40,
  },
  heroDistanceUnit: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0,
  },
  heroTimeValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 34,
    marginTop: 2,
  },
  heroDivider: {
    width: 1,
    marginHorizontal: 16,
  },
  heroSecondaryRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'space-around',
  },
  heroSecondaryItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  heroSecondaryValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  heroSecondaryLabel: {
    fontSize: 10,
    fontWeight: '500',
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
  distanceMarkersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  distanceMarker: {
    alignItems: 'center',
    gap: 2,
  },
  distanceMarkerDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(45,74,46,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceMarkerText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  distanceMarkerLabel: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  distanceMarkerFinish: {
    alignItems: 'center',
    gap: 2,
  },
  elevationChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F7F8FA',
    borderRadius: 12,
    overflow: 'hidden',
    paddingHorizontal: 4,
    paddingTop: 4,
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
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  coverImageWrap: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  coverImageLarge: {
    width: '100%',
    height: 180,
    backgroundColor: '#F2F4F6',
  },
  coverRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverChangeRow: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    gap: 6,
  },
  coverChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  coverChangeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  coverPickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  coverPickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary + '30',
    backgroundColor: colors.primary + '08',
  },
  coverPickerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  chipSm: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F2F4F6',
    marginRight: 4,
    marginBottom: 4,
  },
  chipTextSm: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  // ── Course Modal ──
  courseModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  courseModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '92%',
  },
  courseModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E8EB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  courseModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  courseModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  courseModalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F2F4F6',
  },

  // ── Confirm Modal ──
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  confirmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  confirmIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  confirmDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  confirmStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: '#F7F8FA',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 24,
  },
  confirmStat: {
    flex: 1,
    alignItems: 'center',
  },
  confirmStatVal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  confirmStatLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  confirmStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E8EB',
  },
  confirmBtnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  confirmCancelBtn: {
    flex: 1,
    backgroundColor: '#F2F4F6',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  confirmOkBtn: {
    flex: 1.5,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmOkText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  actionGroup: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  actionGroupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  actionCardDesc: {
    fontSize: 11,
    color: colors.textTertiary,
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
  resumeFromActivityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary + '30',
    backgroundColor: colors.primary + '08',
  },
  resumeFromActivityText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
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
  // Walk merge
  mergeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary + '30',
    backgroundColor: colors.primary + '08',
  },
  mergeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  mergeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  mergeModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  mergeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  mergeModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  mergeModalSubtitle: {
    fontSize: 13,
    color: colors.textTertiary,
    marginBottom: 16,
  },
  mergeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F7F8FA',
    gap: 12,
  },
  mergeItemSelected: {
    backgroundColor: colors.primary + '10',
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  mergeCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mergeCheckboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  mergeItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  mergeItemMeta: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  mergeConfirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  mergeConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
