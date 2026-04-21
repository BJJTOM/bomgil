/**
 * EmptyState — reusable empty / zero-data placeholder
 *
 * Centered layout with a Feather icon in a soft circular background,
 * title, optional subtitle, and an optional CTA button.
 * Supports dark mode via the theme store.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';
import { useThemeStore } from '../stores/theme';

export interface EmptyStateProps {
  /** Feather icon name (e.g. "inbox", "map-pin") */
  icon: string;
  /** Primary message */
  title: string;
  /** Optional secondary explanation */
  subtitle?: string;
  /** Label for the call-to-action button */
  ctaText?: string;
  /** Callback when the CTA is pressed */
  onCta?: () => void;
}

export default function EmptyState({
  icon,
  title,
  subtitle,
  ctaText,
  onCta,
}: EmptyStateProps) {
  const { isDark } = useThemeStore();

  const textColor = isDark ? '#FFFFFF' : colors.textPrimary;
  const subtitleColor = isDark ? 'rgba(255,255,255,0.5)' : colors.textTertiary;
  const iconBg = isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F6';
  const iconColor = isDark ? 'rgba(255,255,255,0.4)' : colors.textTertiary;

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={32} color={iconColor} />
      </View>

      <Text style={[styles.title, { color: textColor }]}>{title}</Text>

      {subtitle ? (
        <Text style={[styles.subtitle, { color: subtitleColor }]}>
          {subtitle}
        </Text>
      ) : null}

      {ctaText && onCta ? (
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={onCta}
          activeOpacity={0.8}>
          <Text style={styles.ctaText}>{ctaText}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  ctaBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
