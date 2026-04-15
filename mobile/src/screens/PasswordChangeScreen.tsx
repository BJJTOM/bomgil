import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';
import api from '../api/client';
import { useT } from '../i18n';

export default function PasswordChangeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const t = useT();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const canSubmit =
    oldPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    if (newPassword !== confirmPassword) {
      Alert.alert('오류', '새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('오류', '새 비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/password-change/', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      Alert.alert(t.common.done, t.password.changeComplete, [
        { text: t.common.confirm, onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        '비밀번호 변경에 실패했습니다.';
      Alert.alert('오류', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t.password.changeTitle}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Lock icon */}
          <View style={styles.iconWrap}>
            <Feather name="lock" size={32} color={colors.primary} />
          </View>

          <Text style={styles.description}>
            {t.password.changeDesc}
          </Text>

          {/* Current password */}
          <Text style={styles.fieldLabel}>현재 비밀번호</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="현재 비밀번호 입력"
              placeholderTextColor="#B0B8C1"
              secureTextEntry={!showOld}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowOld(!showOld)}>
              <Feather name={showOld ? 'eye' : 'eye-off'} size={18} color="#B0B8C1" />
            </TouchableOpacity>
          </View>

          {/* New password */}
          <Text style={styles.fieldLabel}>새 비밀번호</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="8자 이상 입력"
              placeholderTextColor="#B0B8C1"
              secureTextEntry={!showNew}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowNew(!showNew)}>
              <Feather name={showNew ? 'eye' : 'eye-off'} size={18} color="#B0B8C1" />
            </TouchableOpacity>
          </View>
          {newPassword.length > 0 && newPassword.length < 8 && (
            <Text style={styles.hint}>8자 이상 입력해주세요</Text>
          )}

          {/* Confirm password */}
          <Text style={styles.fieldLabel}>새 비밀번호 확인</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="새 비밀번호 다시 입력"
              placeholderTextColor="#B0B8C1"
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowConfirm(!showConfirm)}>
              <Feather
                name={showConfirm ? 'eye' : 'eye-off'}
                size={18}
                color="#B0B8C1"
              />
            </TouchableOpacity>
          </View>
          {confirmPassword.length > 0 && confirmPassword !== newPassword && (
            <Text style={styles.hint}>비밀번호가 일치하지 않습니다</Text>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>{t.password.changeTitle}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
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
    paddingHorizontal: 16,
    height: 44,
    marginBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(45,74,46,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#8B95A1',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E8EB',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.textPrimary,
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  hint: {
    fontSize: 12,
    color: '#FF4B4B',
    marginTop: 4,
    marginLeft: 4,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
