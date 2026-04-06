import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import api from '../api/client';
import { colors } from '../theme/colors';

import Geolocation from '@react-native-community/geolocation';

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

const TOTAL_STEPS = 3;

export default function TrailCreateScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('KR');
  const [difficulty, setDifficulty] = useState('moderate');

  // Step 2
  const [distanceKm, setDistanceKm] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [startLat, setStartLat] = useState('');
  const [startLng, setStartLng] = useState('');
  const [endLat, setEndLat] = useState('');
  const [endLng, setEndLng] = useState('');

  // Step 3
  const [coverImage, setCoverImage] = useState<{ uri: string; type?: string; fileName?: string } | null>(null);

  const useCurrentLocation = (target: 'start' | 'end') => {
    Geolocation.getCurrentPosition(
      (pos) => {
        const lat = String(pos.coords.latitude);
        const lng = String(pos.coords.longitude);
        if (target === 'start') {
          setStartLat(lat);
          setStartLng(lng);
        } else {
          setEndLat(lat);
          setEndLng(lng);
        }
      },
      (err) => Alert.alert('위치 오류', '현재 위치를 가져올 수 없습니다'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const pickImage = (source: 'camera' | 'gallery') => {
    const options = { mediaType: 'photo' as const, quality: 0.8 as const, maxWidth: 1200, maxHeight: 1200 };
    const fn = source === 'camera' ? launchCamera : launchImageLibrary;
    fn(options, (response) => {
      if (response.didCancel || response.errorCode) return;
      const asset = response.assets?.[0];
      if (asset?.uri) {
        setCoverImage({ uri: asset.uri, type: asset.type, fileName: asset.fileName });
      }
    });
  };

  const canGoNext = () => {
    if (step === 1) return title.trim() && description.trim() && region.trim();
    if (step === 2) return distanceKm.trim() && estimatedMinutes.trim();
    return true;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('region', region.trim());
      formData.append('country', country);
      formData.append('difficulty', difficulty);
      formData.append('distance_km', distanceKm.trim());
      formData.append('estimated_minutes', estimatedMinutes.trim());
      if (startLat) formData.append('start_lat', startLat);
      if (startLng) formData.append('start_lng', startLng);
      if (endLat) formData.append('end_lat', endLat);
      if (endLng) formData.append('end_lng', endLng);

      if (coverImage) {
        formData.append('cover_image', {
          uri: coverImage.uri,
          type: coverImage.type || 'image/jpeg',
          name: coverImage.fileName || 'cover.jpg',
        } as any);
      }

      await api.post('/trails/', formData);

      Alert.alert('성공', '코스가 등록되었습니다!', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || '코스 등록에 실패했습니다';
      Alert.alert('오류', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepRow}>
      {[1, 2, 3].map((s) => (
        <View key={s} style={styles.stepItemWrap}>
          <View style={[styles.stepDot, s <= step && styles.stepDotActive]}>
            <Text style={[styles.stepDotText, s <= step && styles.stepDotTextActive]}>
              {s}
            </Text>
          </View>
          <Text style={[styles.stepLabel, s === step && styles.stepLabelActive]}>
            {s === 1 ? '기본 정보' : s === 2 ? '상세 정보' : '사진'}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.fieldLabel}>코스 이름 *</Text>
      <TextInput
        style={styles.textInput}
        placeholder="예: 북촌한옥마을 걷기"
        placeholderTextColor={colors.textTertiary}
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.fieldLabel}>설명 *</Text>
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

      <Text style={styles.fieldLabel}>지역 *</Text>
      <TextInput
        style={styles.textInput}
        placeholder="예: 서울 종로구"
        placeholderTextColor={colors.textTertiary}
        value={region}
        onChangeText={setRegion}
      />

      <Text style={styles.fieldLabel}>국가</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        <View style={styles.chipGroup}>
          {COUNTRY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.selectChip, country === opt.value && styles.selectChipActive]}
              onPress={() => setCountry(opt.value)}>
              <Text style={[styles.selectChipText, country === opt.value && styles.selectChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Text style={styles.fieldLabel}>난이도</Text>
      <View style={styles.chipGroup}>
        {DIFFICULTY_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.selectChip, difficulty === opt.value && styles.selectChipActive]}
            onPress={() => setDifficulty(opt.value)}>
            <Text style={[styles.selectChipText, difficulty === opt.value && styles.selectChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.fieldLabel}>거리 (km) *</Text>
      <TextInput
        style={styles.textInput}
        placeholder="예: 3.5"
        placeholderTextColor={colors.textTertiary}
        value={distanceKm}
        onChangeText={setDistanceKm}
        keyboardType="numeric"
      />

      <Text style={styles.fieldLabel}>예상 소요시간 (분) *</Text>
      <TextInput
        style={styles.textInput}
        placeholder="예: 90"
        placeholderTextColor={colors.textTertiary}
        value={estimatedMinutes}
        onChangeText={setEstimatedMinutes}
        keyboardType="numeric"
      />

      <Text style={styles.fieldLabel}>출발점 좌표</Text>
      <View style={styles.coordRow}>
        <TextInput
          style={[styles.textInput, styles.coordInput]}
          placeholder="위도"
          placeholderTextColor={colors.textTertiary}
          value={startLat}
          onChangeText={setStartLat}
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.textInput, styles.coordInput]}
          placeholder="경도"
          placeholderTextColor={colors.textTertiary}
          value={startLng}
          onChangeText={setStartLng}
          keyboardType="numeric"
        />
        <TouchableOpacity style={styles.locationBtn} onPress={() => useCurrentLocation('start')}>
          <Text style={styles.locationBtnText}>{'\u{1F4CD}'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.fieldLabel}>도착점 좌표</Text>
      <View style={styles.coordRow}>
        <TextInput
          style={[styles.textInput, styles.coordInput]}
          placeholder="위도"
          placeholderTextColor={colors.textTertiary}
          value={endLat}
          onChangeText={setEndLat}
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.textInput, styles.coordInput]}
          placeholder="경도"
          placeholderTextColor={colors.textTertiary}
          value={endLng}
          onChangeText={setEndLng}
          keyboardType="numeric"
        />
        <TouchableOpacity style={styles.locationBtn} onPress={() => useCurrentLocation('end')}>
          <Text style={styles.locationBtnText}>{'\u{1F4CD}'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.fieldLabel}>커버 사진</Text>
      {coverImage ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: coverImage.uri }} style={styles.previewImage} resizeMode="cover" />
          <TouchableOpacity style={styles.removeImageBtn} onPress={() => setCoverImage(null)}>
            <Text style={styles.removeImageText}>{'✕'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.imageButtons}>
          <TouchableOpacity style={styles.imagePickBtn} onPress={() => pickImage('camera')}>
            <Text style={styles.imagePickIcon}>{'\u{1F4F7}'}</Text>
            <Text style={styles.imagePickLabel}>카메라</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imagePickBtn} onPress={() => pickImage('gallery')}>
            <Text style={styles.imagePickIcon}>{'\u{1F5BC}'}</Text>
            <Text style={styles.imagePickLabel}>갤러리</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>코스 요약</Text>
        <Text style={styles.summaryItem}>제목: {title || '-'}</Text>
        <Text style={styles.summaryItem}>지역: {region || '-'}{' · '}{COUNTRY_OPTIONS.find((c) => c.value === country)?.label || country}</Text>
        <Text style={styles.summaryItem}>난이도: {DIFFICULTY_OPTIONS.find((d) => d.value === difficulty)?.label || difficulty}</Text>
        <Text style={styles.summaryItem}>거리: {distanceKm || '-'} km{' · '}{estimatedMinutes || '-'} 분</Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>코스 등록</Text>
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
      </ScrollView>

      {/* Bottom nav buttons */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
        {step > 1 && (
          <TouchableOpacity style={styles.prevBtn} onPress={() => setStep(step - 1)}>
            <Text style={styles.prevBtnText}>이전</Text>
          </TouchableOpacity>
        )}
        {step < TOTAL_STEPS ? (
          <TouchableOpacity
            style={[styles.nextBtn, !canGoNext() && styles.btnDisabled]}
            onPress={() => { if (canGoNext()) setStep(step + 1); }}
            disabled={!canGoNext()}>
            <Text style={styles.nextBtnText}>다음</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>등록하기</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
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
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 16,
    gap: 24,
  },
  stepItemWrap: {
    alignItems: 'center',
    gap: 4,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  stepDotTextActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  scrollBody: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
  selectChipTextActive: {
    color: '#FFFFFF',
  },
  coordRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  coordInput: {
    flex: 1,
  },
  locationBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationBtnText: {
    fontSize: 18,
  },
  imageButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  imagePickBtn: {
    flex: 1,
    height: 120,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 16,
    borderStyle: 'dashed',
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
  summaryCard: {
    marginTop: 24,
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
    marginBottom: 10,
  },
  summaryItem: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
    lineHeight: 20,
  },
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
});
