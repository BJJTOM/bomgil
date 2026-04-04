import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !nickname.trim() || !password.trim()) {
      Alert.alert('\uC624\uB958', '\uBAA8\uB4E0 \uD544\uB4DC\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694');
      return;
    }
    if (password.length < 6) {
      Alert.alert('\uC624\uB958', '\uBE44\uBC00\uBC88\uD638\uB294 6\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register/', {
        email,
        nickname,
        password,
      });
      login(data.user, data.tokens.access, data.tokens.refresh);
      navigation.popToTop();
    } catch (err: any) {
      const errors = err.response?.data;
      let msg = '\uD68C\uC6D0\uAC00\uC785\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4';
      if (errors) {
        const firstKey = Object.keys(errors)[0];
        if (firstKey) {
          const val = errors[firstKey];
          msg = Array.isArray(val) ? val[0] : String(val);
        }
      }
      Alert.alert('\uD68C\uC6D0\uAC00\uC785 \uC2E4\uD328', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'\u2190'}</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.logo}>Roami</Text>
          <Text style={styles.title}>{'\uD68C\uC6D0\uAC00\uC785'}</Text>
          <Text style={styles.subtitle}>
            {'\uAC77\uAE30 \uC5EC\uD589\uC744 \uD568\uAED8 \uC2DC\uC791\uD574\uBCFC\uAE4C\uC694?'}
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>{'\uC774\uBA54\uC77C'}</Text>
            <TextInput
              style={styles.input}
              placeholder="email@example.com"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>{'\uB2C9\uB124\uC784'}</Text>
            <TextInput
              style={styles.input}
              placeholder={'\uB2C9\uB124\uC784 \uC785\uB825'}
              placeholderTextColor={colors.textTertiary}
              value={nickname}
              onChangeText={setNickname}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>{'\uBE44\uBC00\uBC88\uD638'}</Text>
            <TextInput
              style={styles.input}
              placeholder={'6\uC790 \uC774\uC0C1'}
              placeholderTextColor={colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.registerBtn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.registerBtnText}>
                  {'\uD68C\uC6D0\uAC00\uC785'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {'\uC774\uBBF8 \uACC4\uC815\uC774 \uC788\uC73C\uC2E0\uAC00\uC694?'}
            </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.footerLink}>{'\uB85C\uADF8\uC778'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    flexGrow: 1,
  },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backText: {
    fontSize: 24,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  logo: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  form: {},
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  registerBtn: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  registerBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    gap: 6,
  },
  footerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
});
