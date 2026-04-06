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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import api from '../api/client';
import { colors } from '../theme/colors';
import SafeMapView from '../components/SafeMapView';

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

const SPOT_TYPE_COLORS: Record<string, string> = {
  '맛집': '#D85A30',
  '카페': '#378ADD',
  '포토': '#7F77DD',
  '휴식': '#888780',
  '전망': '#EF9F27',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Spot {
  name: string;
  type: string;
  description: string;
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TrailPublishScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const {
    pathData = [],
    distance: autoDistance = 0,
    duration: autoDuration = 0,
    elevationGain: autoElevation = 0,
    spots: initialSpots = [],
    startLat = 0,
    startLng = 0,
    endLat = 0,
    endLng = 0,
    manualMode = false,
  } = route.params || {};

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('moderate');
  const [seasons, setSeasons] = useState<string[]>([]);
  const [country, setCountry] = useState('KR');
  const [tags, setTags] = useState('');
  const [transport, setTransport] = useState('');
  const [coverImage, setCoverImage] = useState<any>(null);
  const [spots, setSpots] = useState<Spot[]>(initialSpots);
  const [submitting, setSubmitting] = useState(false);

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
        onPress: () => {
          launchCamera({ mediaType: 'photo', quality: 0.8 }, (res) => {
            if (res.assets?.[0]) setCoverImage(res.assets[0]);
          });
        },
      },
      {
        text: '갤러리',
        onPress: () => {
          launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (res) => {
            if (res.assets?.[0]) setCoverImage(res.assets[0]);
          });
        },
      },
      { text: '취소', style: 'cancel' },
    ]);
  }, []);

  const removeSpot = useCallback((idx: number) => {
    setSpots(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('필수 입력', '코스 이름을 입력해주세요.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('필수 입력', '설명을 입력해주세요.');
      return;
    }
    if (!manualMode && pathData.length < 2) {
      Alert.alert('오류', '경로 데이터가 부족합니다.');
      return;
    }
    if (manualMode && !manualDistance.trim()) {
      Alert.alert('필수 입력', '거리를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        title: name.trim(),
        description: description.trim(),
        difficulty,
        country,
        status: 'approved',
        distance_km: parseFloat(distance.toFixed(2)),
        estimated_minutes: Math.max(1, Math.round(duration)),
      };

      if (manualMode) {
        // Manual mode — text region, no path data
        payload.region = manualRegion.trim() || undefined;
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

      const { data } = await api.post('/trails/', payload);
      const trailId = data.id;

      // Upload cover image separately if present
      if (coverImage && trailId) {
        try {
          const formData = new FormData();
          formData.append('cover_image', {
            uri: coverImage.uri,
            type: coverImage.type || 'image/jpeg',
            name: coverImage.fileName || 'cover.jpg',
          } as any);
          await api.patch(`/trails/${trailId}/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (imgErr) {
          console.log('Cover image upload failed:', imgErr);
        }
      }

      Alert.alert('등록 완료', '코스가 성공적으로 등록되었습니다!', [
        {
          text: '확인',
          onPress: () => navigation.navigate('Main'),
        },
      ]);
    } catch (err: any) {
      console.log('Trail create error:', err?.response?.data || err);
      Alert.alert('오류', '코스 등록에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [
    name, description, difficulty, country, seasons, transport,
    pathData, distance, duration, elevationGain,
    startLat, startLng, endLat, endLng,
    spots, coverImage, navigation,
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

        {/* 1. Map preview (only if route data exists) */}
        {!manualMode && pathData && pathData.length > 1 && (
          <SafeMapView
            lat={startLat}
            lng={startLng}
            endLat={endLat}
            endLng={endLng}
            pathCoordinates={pathData}
            height={200}
          />
        )}

        {/* 2. Stats — auto or manual */}
        {manualMode ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>코스 상세</Text>

            <Text style={styles.fieldLabel}>출발 지역 *</Text>
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

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>거리 (km) *</Text>
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
                <Text style={styles.fieldLabel}>소요시간 (분) *</Text>
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
          </View>
        ) : (
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

        {/* 3. Name */}
        <Text style={styles.fieldLabel}>코스 이름 *</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 북한산 둘레길"
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
          maxLength={50}
        />

        {/* 4. Description */}
        <Text style={styles.fieldLabel}>설명 *</Text>
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
          placeholder="쉼표로 구분 (예: 숲길, 야경, 데이트)"
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

        {/* 11. Spots list */}
        {spots.length > 0 && (
          <>
            <Text style={styles.fieldLabel}>등록된 스팟 ({spots.length})</Text>
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
                  {spot.description ? (
                    <Text style={styles.spotDesc}>{spot.description}</Text>
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
          </>
        )}
      </ScrollView>

      {/* 12. Submit button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>등록하기</Text>
          )}
        </TouchableOpacity>
      </View>
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
  submitBtn: {
    backgroundColor: colors.primary,
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
});
