import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import api from '../api/client';
import { colors, darkColors, getColors } from '../theme/colors';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { useLanguageStore, Language } from '../stores/language';

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------
const T: Record<string, Record<Language, string>> = {
  title: {
    ko: '이번 주 활동 리포트',
    en: 'Weekly Activity Report',
    ja: '今週のアクティビティレポート',
    zh: '本周活动报告',
  },
  aiPowered: {
    ko: 'AI 코칭',
    en: 'AI Coaching',
    ja: 'AIコーチング',
    zh: 'AI教练',
  },
  goalLabel: {
    ko: '주간 목표',
    en: 'Weekly Goal',
    ja: '週間目標',
    zh: '周目标',
  },
  suggestion: {
    ko: '추천',
    en: 'Suggestion',
    ja: 'おすすめ',
    zh: '推荐',
  },
  showMore: {
    ko: '자세히 보기',
    en: 'Show more',
    ja: '詳しく見る',
    zh: '查看更多',
  },
  showLess: {
    ko: '접기',
    en: 'Show less',
    ja: '閉じる',
    zh: '收起',
  },
  viewTrail: {
    ko: '코스 보기',
    en: 'View Trail',
    ja: 'コースを見る',
    zh: '查看路线',
  },
};

function t(key: string, lang: Language): string {
  return T[key]?.[lang] || T[key]?.ko || key;
}

// ---------------------------------------------------------------------------
// Trend arrow component
// ---------------------------------------------------------------------------
function TrendIndicator({ trend, isDark }: { trend: string; isDark: boolean }) {
  const c = getColors(isDark);
  if (trend === 'improving') {
    return (
      <View style={[styles.trendBadge, { backgroundColor: isDark ? 'rgba(74,222,128,0.15)' : '#E8F9EE' }]}>
        <Feather name="trending-up" size={12} color={isDark ? '#4ADE80' : '#22C55E'} />
        <Text style={[styles.trendText, { color: isDark ? '#4ADE80' : '#22C55E' }]}>
          {'\u2191'}
        </Text>
      </View>
    );
  }
  if (trend === 'declining') {
    return (
      <View style={[styles.trendBadge, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2' }]}>
        <Feather name="trending-down" size={12} color={isDark ? '#EF4444' : '#DC2626'} />
        <Text style={[styles.trendText, { color: isDark ? '#EF4444' : '#DC2626' }]}>
          {'\u2193'}
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.trendBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}>
      <Feather name="minus" size={12} color={isDark ? 'rgba(255,255,255,0.5)' : '#9CA3AF'} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface WeeklyInsightsData {
  summary: string;
  highlights: string[];
  suggestion: string;
  suggested_trail_id: number | null;
  goal_progress: number;
  trend: string;
}

export default function WeeklyInsights() {
  const { isAuthenticated } = useAuthStore();
  const { isDark } = useThemeStore();
  const { language } = useLanguageStore();
  const navigation = useNavigation<any>();
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;

  const c = getColors(isDark);

  const { data, isLoading, error } = useQuery<WeeklyInsightsData>({
    queryKey: ['weekly-insights'],
    queryFn: async () => {
      const { data } = await api.get('/activities/weekly-insights/');
      return data;
    },
    enabled: isAuthenticated,
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });

  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: expanded ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [expanded]);

  // Don't render for unauthenticated users
  if (!isAuthenticated) return null;

  // Don't render while loading (avoid flash)
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: c.surface, borderColor: c.borderDefault }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={c.primary} />
        </View>
      </View>
    );
  }

  // Don't render if error or no data
  if (error || !data) return null;

  // Don't render if no summary (new user with zero data and bland response)
  if (!data.summary) return null;

  const goalPct = Math.round(data.goal_progress * 100);
  const hasHighlights = data.highlights && data.highlights.length > 0;
  const hasSuggestion = !!data.suggestion;

  return (
    <View style={[styles.container, { backgroundColor: c.surface, borderColor: c.borderDefault }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.sparkleWrap, { backgroundColor: isDark ? 'rgba(74,222,128,0.12)' : '#F0F7F0' }]}>
            <Text style={styles.sparkleIcon}>{'✨'}</Text>
          </View>
          <View>
            <Text style={[styles.title, { color: c.textPrimary }]}>
              {t('title', language)}
            </Text>
            <Text style={[styles.aiBadge, { color: c.textTertiary }]}>
              {t('aiPowered', language)}
            </Text>
          </View>
        </View>
        <TrendIndicator trend={data.trend} isDark={isDark} />
      </View>

      {/* Summary */}
      <Text style={[styles.summary, { color: c.textPrimary }]}>
        {data.summary}
      </Text>

      {/* Goal progress bar */}
      <View style={styles.goalSection}>
        <View style={styles.goalLabelRow}>
          <Text style={[styles.goalLabel, { color: c.textTertiary }]}>
            {t('goalLabel', language)}
          </Text>
          <Text style={[styles.goalPct, { color: goalPct >= 100 ? (isDark ? '#4ADE80' : '#22C55E') : c.textSecondary }]}>
            {goalPct}%
          </Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#EEF1F4' }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(goalPct, 100)}%`,
                backgroundColor: goalPct >= 100
                  ? (isDark ? '#4ADE80' : '#22C55E')
                  : (isDark ? '#4ADE80' : colors.primary),
              },
            ]}
          />
        </View>
      </View>

      {/* Expandable section */}
      {(hasHighlights || hasSuggestion) && (
        <>
          <Animated.View
            style={[
              styles.expandable,
              {
                maxHeight: expandAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 400],
                }),
                opacity: expandAnim,
              },
            ]}>
            {/* Highlights */}
            {hasHighlights && (
              <View style={styles.highlightsSection}>
                {data.highlights.map((h, idx) => (
                  <View key={idx} style={styles.highlightRow}>
                    <Text style={[styles.bullet, { color: isDark ? '#4ADE80' : colors.primary }]}>
                      {'  \u2022  '}
                    </Text>
                    <Text style={[styles.highlightText, { color: c.textSecondary }]}>
                      {h}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Suggestion */}
            {hasSuggestion && (
              <View style={[styles.suggestionCard, { backgroundColor: isDark ? 'rgba(74,222,128,0.08)' : '#F0F7F0' }]}>
                <Feather name="compass" size={14} color={isDark ? '#4ADE80' : colors.primary} />
                <Text style={[styles.suggestionText, { color: c.textPrimary }]}>
                  {data.suggestion}
                </Text>
              </View>
            )}

            {/* Suggested trail link */}
            {data.suggested_trail_id && (
              <TouchableOpacity
                style={[styles.trailLink, { borderColor: c.borderDefault }]}
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate('TrailDetail', { id: data.suggested_trail_id })
                }>
                <Feather name="map-pin" size={14} color={isDark ? '#4ADE80' : colors.primary} />
                <Text style={[styles.trailLinkText, { color: isDark ? '#4ADE80' : colors.primary }]}>
                  {t('viewTrail', language)}
                </Text>
                <Feather name="chevron-right" size={14} color={isDark ? '#4ADE80' : colors.primary} />
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Expand/Collapse toggle */}
          <TouchableOpacity
            style={styles.toggleBtn}
            activeOpacity={0.6}
            onPress={() => setExpanded(!expanded)}>
            <Text style={[styles.toggleText, { color: isDark ? '#4ADE80' : colors.primary }]}>
              {expanded ? t('showLess', language) : t('showMore', language)}
            </Text>
            <Feather
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={isDark ? '#4ADE80' : colors.primary}
            />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sparkleWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleIcon: {
    fontSize: 18,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  aiBadge: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  summary: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 14,
  },
  goalSection: {
    marginBottom: 4,
  },
  goalLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  goalLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  goalPct: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  expandable: {
    overflow: 'hidden',
  },
  highlightsSection: {
    marginTop: 14,
    gap: 6,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bullet: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  highlightText: {
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },
  trailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  trailLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingVertical: 4,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
