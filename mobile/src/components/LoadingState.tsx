/**
 * LoadingState — unified loading indicator
 *
 * Three variants:
 *  - "fullscreen" : centered spinner + text, fills parent
 *  - "inline"     : small horizontal spinner + text row
 *  - "skeleton"   : configurable number of shimmer placeholder rows
 *
 * Supports dark mode via the theme store.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { colors } from '../theme/colors';
import { useThemeStore } from '../stores/theme';

interface FullscreenProps {
  variant?: 'fullscreen';
  text?: string;
}

interface InlineProps {
  variant: 'inline';
  text?: string;
}

interface SkeletonProps {
  variant: 'skeleton';
  rows?: number;
  /** Width fraction for the last row (0-1). Default 0.6 */
  lastRowWidth?: number;
}

export type LoadingStateProps = FullscreenProps | InlineProps | SkeletonProps;

/* ─── Skeleton shimmer row ─────────────────────────────────── */

function SkeletonRow({
  widthPercent,
  isDark,
}: {
  widthPercent: number;
  isDark: boolean;
}) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const bg = isDark ? 'rgba(255,255,255,0.08)' : '#E5E8EB';

  return (
    <Animated.View
      style={[
        styles.skeletonRow,
        { width: `${widthPercent}%`, backgroundColor: bg, opacity },
      ]}
    />
  );
}

/* ─── Main component ───────────────────────────────────────── */

export default function LoadingState(props: LoadingStateProps) {
  const { isDark } = useThemeStore();
  const textColor = isDark ? 'rgba(255,255,255,0.5)' : colors.textTertiary;
  const spinnerColor = isDark ? 'rgba(255,255,255,0.6)' : colors.primary;

  const variant = props.variant ?? 'fullscreen';

  /* Skeleton */
  if (variant === 'skeleton') {
    const { rows = 3, lastRowWidth = 0.6 } = props as SkeletonProps;
    return (
      <View style={styles.skeletonContainer}>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonRow
            key={i}
            widthPercent={i === rows - 1 ? lastRowWidth * 100 : 100}
            isDark={isDark}
          />
        ))}
      </View>
    );
  }

  /* Inline */
  if (variant === 'inline') {
    const text = (props as InlineProps).text ?? '로딩 중...';
    return (
      <View style={styles.inlineContainer}>
        <ActivityIndicator size="small" color={spinnerColor} />
        <Text style={[styles.inlineText, { color: textColor }]}>{text}</Text>
      </View>
    );
  }

  /* Fullscreen (default) */
  const text = (props as FullscreenProps).text ?? '로딩 중...';
  return (
    <View style={styles.fullscreenContainer}>
      <ActivityIndicator size="large" color={spinnerColor} />
      <Text style={[styles.fullscreenText, { color: textColor }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Fullscreen */
  fullscreenContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  fullscreenText: {
    fontSize: 14,
    fontWeight: '500',
  },

  /* Inline */
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  inlineText: {
    fontSize: 13,
    fontWeight: '500',
  },

  /* Skeleton */
  skeletonContainer: {
    gap: 12,
    paddingVertical: 8,
  },
  skeletonRow: {
    height: 14,
    borderRadius: 7,
  },
});
