import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';
import { useLanguageStore, Language, LANGUAGES } from '../stores/language';

const { width } = Dimensions.get('window');

const WALKING_STYLES = [
  { key: 'fast', label: '빠른 걸음', emoji: '🏃' },
  { key: 'slow', label: '느린 산책', emoji: '🚶' },
  { key: 'photo', label: '사진 여행', emoji: '📷' },
  { key: 'food', label: '맛집 탐방', emoji: '🍜' },
  { key: 'nature', label: '자연 탐험', emoji: '🌿' },
  { key: 'culture', label: '문화 탐방', emoji: '🏛️' },
];

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { user, setUser } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();

  const [nickname, setNickname] = useState(user?.nickname || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [walkingStyle, setWalkingStyle] = useState(user?.walking_style || '');
  const [selectedLang, setSelectedLang] = useState<Language>(language);
  const [weightStr, setWeightStr] = useState(
    (user as any)?.weight_kg ? String((user as any).weight_kg) : '',
  );
  const [heightStr, setHeightStr] = useState(
    (user as any)?.height_cm ? String((user as any).height_cm) : '',
  );
  const [birthYearStr, setBirthYearStr] = useState(
    (user as any)?.birth_year ? String((user as any).birth_year) : '',
  );
  const [gender, setGender] = useState<string>((user as any)?.gender || '');
  const [weeklyGoalStr, setWeeklyGoalStr] = useState(
    (user as any)?.weekly_goal_km ? String((user as any).weekly_goal_km) : '20',
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        nickname,
        bio,
        walking_style: walkingStyle || null,
        preferred_language: selectedLang,
      };
      // Only send physical fields if user actually entered something — empty
      // string would otherwise hit the PositiveSmallIntegerField validator.
      const w = parseInt(weightStr, 10);
      const h = parseInt(heightStr, 10);
      const by = parseInt(birthYearStr, 10);
      const wg = parseFloat(weeklyGoalStr);
      if (!isNaN(w) && w > 20 && w < 300) payload.weight_kg = w;
      if (!isNaN(h) && h > 100 && h < 250) payload.height_cm = h;
      if (!isNaN(by) && by > 1900 && by < new Date().getFullYear()) payload.birth_year = by;
      if (gender) payload.gender = gender;
      if (!isNaN(wg) && wg > 0 && wg < 999) payload.weekly_goal_km = wg;

      const { data } = await api.patch('/auth/me/', payload);
      return data;
    },
    onSuccess: (data) => {
      setUser(data);
      setLanguage(selectedLang);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      Alert.alert('저장 완료', '프로필이 업데이트되었습니다.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    },
    onError: () => {
      Alert.alert('오류', '프로필 저장에 실패했습니다.');
    },
  });

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>{'←'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>프로필 수정</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            {user?.profile_image ? (
              <Image source={{ uri: user.profile_image }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarEmoji}>{'👤'}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.cameraBtn}>
              <Text style={styles.cameraIcon}>{'📷'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Nickname */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>닉네임</Text>
          <TextInput
            style={styles.textInput}
            value={nickname}
            onChangeText={setNickname}
            placeholder="닉네임을 입력하세요"
            placeholderTextColor={colors.textTertiary}
            maxLength={20}
          />
        </View>

        {/* Bio */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>자기소개</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="간단한 자기소개를 작성해주세요"
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
            maxLength={200}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{bio.length}/200</Text>
        </View>

        {/* Walking Style */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>걷기 스타일</Text>
          <View style={styles.styleGrid}>
            {WALKING_STYLES.map((style) => (
              <TouchableOpacity
                key={style.key}
                style={[
                  styles.styleItem,
                  walkingStyle === style.key && styles.styleItemActive,
                ]}
                onPress={() => setWalkingStyle(walkingStyle === style.key ? '' : style.key)}>
                <Text style={styles.styleEmoji}>{style.emoji}</Text>
                <Text
                  style={[
                    styles.styleLabel,
                    walkingStyle === style.key && styles.styleLabelActive,
                  ]}>
                  {style.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Physical profile (drives walk-engine accuracy) */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>신체 정보</Text>
          <Text style={styles.fieldHint}>
            정확한 칼로리·거리 계산을 위해 입력해주세요. (선택)
          </Text>

          <View style={styles.physRow}>
            <View style={styles.physCol}>
              <Text style={styles.physLabel}>체중</Text>
              <View style={styles.physInputRow}>
                <TextInput
                  style={styles.physInput}
                  value={weightStr}
                  onChangeText={(t) => setWeightStr(t.replace(/[^0-9]/g, ''))}
                  placeholder="65"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={styles.physUnit}>kg</Text>
              </View>
            </View>
            <View style={styles.physCol}>
              <Text style={styles.physLabel}>키</Text>
              <View style={styles.physInputRow}>
                <TextInput
                  style={styles.physInput}
                  value={heightStr}
                  onChangeText={(t) => setHeightStr(t.replace(/[^0-9]/g, ''))}
                  placeholder="170"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={styles.physUnit}>cm</Text>
              </View>
            </View>
          </View>

          <View style={styles.physRow}>
            <View style={styles.physCol}>
              <Text style={styles.physLabel}>출생연도</Text>
              <View style={styles.physInputRow}>
                <TextInput
                  style={styles.physInput}
                  value={birthYearStr}
                  onChangeText={(t) => setBirthYearStr(t.replace(/[^0-9]/g, ''))}
                  placeholder="1990"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={4}
                />
                <Text style={styles.physUnit}>년</Text>
              </View>
            </View>
            <View style={styles.physCol}>
              <Text style={styles.physLabel}>주간 목표</Text>
              <View style={styles.physInputRow}>
                <TextInput
                  style={styles.physInput}
                  value={weeklyGoalStr}
                  onChangeText={(t) => setWeeklyGoalStr(t.replace(/[^0-9.]/g, ''))}
                  placeholder="20"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
                <Text style={styles.physUnit}>km</Text>
              </View>
            </View>
          </View>

          <View style={[styles.physRow, { marginTop: 4 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.physLabel}>성별</Text>
              <View style={styles.genderRow}>
                {[
                  { v: 'male', label: '남성' },
                  { v: 'female', label: '여성' },
                  { v: 'other', label: '기타' },
                ].map((g) => (
                  <TouchableOpacity
                    key={g.v}
                    style={[
                      styles.genderChip,
                      gender === g.v && styles.genderChipActive,
                    ]}
                    onPress={() => setGender(gender === g.v ? '' : g.v)}>
                    <Text
                      style={[
                        styles.genderChipText,
                        gender === g.v && styles.genderChipTextActive,
                      ]}>
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Language */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>언어</Text>
          <View style={styles.langRow}>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.langChip,
                  selectedLang === lang.code && styles.langChipActive,
                ]}
                onPress={() => setSelectedLang(lang.code)}>
                <Text style={styles.langChipFlag}>{lang.flag}</Text>
                <Text
                  style={[
                    styles.langChipLabel,
                    selectedLang === lang.code && styles.langChipLabelActive,
                  ]}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.saveWrap}>
          <TouchableOpacity
            style={[styles.saveBtn, saveMutation.isPending && styles.saveBtnDisabled]}
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            activeOpacity={0.85}>
            {saveMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>저장</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  backIcon: {
    fontSize: 18,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(168,230,207,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 40,
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  cameraIcon: {
    fontSize: 14,
  },
  field: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  fieldHint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: -6,
    marginBottom: 12,
  },
  physRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  physCol: {
    flex: 1,
  },
  physLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
    marginBottom: 6,
  },
  physInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: 14,
    height: 46,
  },
  physInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  physUnit: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textTertiary,
    marginLeft: 6,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderChip: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  genderChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  genderChipTextActive: {
    color: '#fff',
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 15,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    textAlign: 'right',
    marginTop: 4,
    fontSize: 12,
    color: colors.textTertiary,
  },
  styleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  styleItem: {
    width: (width - 40 - 20) / 3,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  styleItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary50,
  },
  styleEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  styleLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  styleLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  langChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary50,
  },
  langChipFlag: {
    fontSize: 18,
  },
  langChipLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  langChipLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  saveWrap: {
    marginHorizontal: 20,
    marginTop: 12,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
