import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';

export type PrettyAlertType = 'info' | 'warning' | 'error' | 'success';

interface Props {
  visible: boolean;
  type?: PrettyAlertType;
  title: string;
  message?: string;
  confirmLabel?: string;
  onClose: () => void;
}

const TYPE_CONFIG: Record<PrettyAlertType, { icon: string; color: string; bg: string }> = {
  info:    { icon: 'info',          color: '#2D4A2E', bg: '#F0F7F0' },
  warning: { icon: 'alert-circle',  color: '#D97706', bg: '#FEF3C7' },
  error:   { icon: 'x-circle',      color: '#DC2626', bg: '#FEE2E2' },
  success: { icon: 'check-circle',  color: '#16A34A', bg: '#DCFCE7' },
};

export default function PrettyAlert({
  visible,
  type = 'warning',
  title,
  message,
  confirmLabel = '확인',
  onClose,
}: Props) {
  const cfg = TYPE_CONFIG[type];
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
            <Feather name={cfg.icon} size={28} color={cfg.color} />
          </View>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: cfg.color }]}
            activeOpacity={0.85}
            onPress={onClose}>
            <Text style={styles.btnText}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  btn: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
