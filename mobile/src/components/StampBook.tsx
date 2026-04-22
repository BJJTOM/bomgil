/**
 * StampBook — stamp collection grid for a trail
 *
 * Shows all stamp points as a grid. Collected stamps appear colored
 * with a checkmark; uncollected ones are greyed out. Includes a
 * progress bar and tap-to-collect flow (GPS check + POST).
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
  useWindowDimensions,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import Geolocation from '@react-native-community/geolocation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useThemeStore } from '../stores/theme';
import { StampPoint } from '../types';
import { haptics } from '../utils/haptics';

// ─── Grid layout constants ───
const STAMP_GRID_GAP = 10;
const STAMP_GRID_COLUMNS = 3;
const STAMP_GRID_HORIZONTAL_PADDING = 20;

interface Props {
  trailId: number;
}

export default function StampBook({ trailId }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const stampItemWidth =
    (screenWidth - STAMP_GRID_HORIZONTAL_PADDING * 2 - STAMP_GRID_GAP * (STAMP_GRID_COLUMNS - 1)) /
    STAMP_GRID_COLUMNS;
  const queryClient = useQueryClient();
  const { isDark } = useThemeStore();
  const [collectingId, setCollectingId] = useState<number | null>(null);
  const [justCollectedId, setJustCollectedId] = useState<number | null>(null);

  // Animation ref for the success bounce
  const bounceAnim = useRef(new Animated.Value(1)).current;

  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#191F28';
  const textSecColor = isDark ? 'rgba(255,255,255,0.6)' : '#8B95A1';
  const textTertColor = isDark ? 'rgba(255,255,255,0.4)' : '#B0B8C1';
  const sectionBg = isDark ? '#1a1a1a' : '#F7F8FA';
  const trackBg = isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F6';

  const { data: stamps = [], isLoading } = useQuery({
    queryKey: ['trail-stamps', trailId],
    queryFn: async () => {
      const { data } = await api.get(`/trails/${trailId}/stamps/`);
      return ((data?.results ?? data) || []) as StampPoint[];
    },
    enabled: !!trailId,
    retry: 1,
    staleTime: 30000,
  });

  const collectMutation = useMutation({
    mutationFn: async ({ stampId, lat, lng }: { stampId: number; lat: number; lng: number }) => {
      const { data } = await api.post(`/trails/${trailId}/stamps/${stampId}/collect/`, { lat, lng });
      return data;
    },
    onSuccess: (_data, variables) => {
      // Haptic feedback on successful stamp collection
      haptics.success();

      // Bounce animation on the newly collected stamp
      setJustCollectedId(variables.stampId);
      bounceAnim.setValue(0.5);
      Animated.spring(bounceAnim, {
        toValue: 1,
        friction: 3,
        tension: 200,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => setJustCollectedId(null), 1500);
      });

      // Invalidate queries to refresh stamp status
      queryClient.invalidateQueries({ queryKey: ['trail-stamps', trailId] });
      queryClient.invalidateQueries({ queryKey: ['my-stamps'] });
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        '';

      if (/too far|거리|멀리|far away|range/i.test(msg)) {
        Alert.alert(
          '수집 실패',
          '스탬프 지점에 더 가까이 이동해주세요.\n현재 위치가 스탬프 지점에서 너무 멀어요.',
        );
      } else if (/already|이미|collected|수집/i.test(msg)) {
        Alert.alert('이미 수집됨', '이 스탬프는 이미 수집되었습니다.');
      } else {
        Alert.alert('수집 실패', msg || '스탬프를 수집하지 못했습니다. 다시 시도해주세요.');
      }
    },
    onSettled: () => {
      setCollectingId(null);
    },
  });

  const handleCollect = useCallback(
    (stamp: StampPoint) => {
      if (stamp.is_collected || collectingId !== null) return;

      setCollectingId(stamp.id);

      Geolocation.getCurrentPosition(
        (position) => {
          collectMutation.mutate({
            stampId: stamp.id,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          setCollectingId(null);
          if (error.code === 1) {
            Alert.alert(
              'GPS 권한 필요',
              '스탬프를 수집하려면 위치 권한이 필요합니다.\n설정에서 위치 접근을 허용해주세요.',
            );
          } else {
            Alert.alert(
              'GPS 오류',
              '현재 위치를 가져올 수 없습니다.\nGPS 신호가 안정될 때 다시 시도해주세요.',
            );
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000,
        },
      );
    },
    [collectingId, collectMutation],
  );

  // Don't render the section at all if there are no stamps
  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>{'스탬프 수집'}</Text>
        <View style={[styles.loadingWrap, { backgroundColor: sectionBg }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (stamps.length === 0) return null;

  const collectedCount = stamps.filter((s) => s.is_collected).length;
  const totalCount = stamps.length;
  const progressPct = totalCount > 0 ? (collectedCount / totalCount) * 100 : 0;
  const isComplete = collectedCount === totalCount;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        {'스탬프 수집'}{' '}
        <Text style={[styles.sectionCount, { color: textSecColor }]}>
          {collectedCount}/{totalCount}
        </Text>
      </Text>

      {/* Progress bar */}
      <View style={[styles.progressCard, { backgroundColor: sectionBg }]}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: textSecColor }]}>
            {isComplete ? '모두 수집 완료!' : '수집 진행률'}
          </Text>
          <Text style={[styles.progressValue, { color: textColor }]}>
            {collectedCount}/{totalCount} 수집완료
          </Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: trackBg }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(100, progressPct)}%`,
                backgroundColor: isComplete ? '#22C55E' : colors.primary,
              },
            ]}
          />
        </View>
        {isComplete && (
          <View style={styles.completeIconWrap}>
            <Feather name="award" size={20} color="#15803D" />
          </View>
        )}
      </View>

      {/* Stamp grid */}
      <View style={[styles.stampGrid, { gap: STAMP_GRID_GAP }]}>
        {stamps.map((stamp) => {
          const isCollected = stamp.is_collected;
          const isCollecting = collectingId === stamp.id;
          const isJustCollected = justCollectedId === stamp.id;

          const stampContent = (
            <View
              style={[
                styles.stampItem,
                {
                  backgroundColor: isCollected
                    ? isDark
                      ? 'rgba(45,74,46,0.3)'
                      : '#F0F7F0'
                    : isDark
                      ? 'rgba(255,255,255,0.04)'
                      : '#F7F8FA',
                  borderColor: isCollected
                    ? isDark
                      ? 'rgba(74,222,128,0.3)'
                      : 'rgba(45,74,46,0.15)'
                    : 'transparent',
                  borderWidth: isCollected ? 1.5 : 0,
                },
              ]}>
              <View style={[styles.stampEmojiWrap, !isCollected && styles.stampEmojiGreyed]}>
                {isCollecting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.stampEmoji}>{stamp.emoji || '\uD83D\uDCCD'}</Text>
                )}
              </View>
              <Text
                style={[
                  styles.stampName,
                  { color: isCollected ? textColor : textTertColor },
                ]}
                numberOfLines={2}>
                {stamp.name}
              </Text>
              {isCollected && (
                <View style={styles.checkBadge}>
                  <Feather name="check" size={10} color="#fff" />
                </View>
              )}
              {isJustCollected && (
                <Text style={styles.justCollectedLabel}>{'수집!'}</Text>
              )}
            </View>
          );

          if (isJustCollected) {
            return (
              <Animated.View
                key={stamp.id}
                style={[styles.stampTouchable, { width: stampItemWidth, transform: [{ scale: bounceAnim }] }]}>
                {stampContent}
              </Animated.View>
            );
          }

          return (
            <TouchableOpacity
              key={stamp.id}
              style={[styles.stampTouchable, { width: stampItemWidth }]}
              activeOpacity={isCollected ? 1 : 0.7}
              onPress={() => {
                if (isCollected) return;
                handleCollect(stamp);
              }}
              disabled={isCollecting}>
              {stampContent}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Hint text */}
      {!isComplete && (
        <Text style={[styles.hintText, { color: textTertColor }]}>
          {'스탬프 지점 근처에서 탭하면 수집할 수 있어요'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#191F28',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  sectionCount: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8B95A1',
  },
  loadingWrap: {
    height: 80,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Progress
  progressCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  completeIconWrap: {
    alignItems: 'center',
    marginTop: 8,
  },

  // Stamp grid
  stampGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stampTouchable: {
    flexGrow: 0,
    flexShrink: 0,
  },
  stampItem: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    position: 'relative',
    minHeight: 100,
  },
  stampEmojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stampEmojiGreyed: {
    opacity: 0.35,
  },
  stampEmoji: {
    fontSize: 24,
  },
  stampName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#15803D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  justCollectedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
    marginTop: 4,
  },

  // Hint
  hintText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
});
