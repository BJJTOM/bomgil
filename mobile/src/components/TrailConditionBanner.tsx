/**
 * TrailConditionBanner — compact, expandable banner showing the latest
 * trail condition report.
 *
 * Mirrors the web component's tag config (icons, multilingual labels,
 * severity colors) but uses React Native primitives + StyleSheet.
 *
 * Returns null when there is no condition data.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useThemeStore } from '../stores/theme';
import { useLanguageStore, type Language } from '../stores/language';

// Enable layout animation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ConditionData {
  tags: string[];
  note: string;
  image: string | null;
  reporter_nickname: string;
  created_at: string;
  helpful_count: number;
}

interface TrailConditionBannerProps {
  condition: ConditionData | null | undefined;
}

// ─── Tag config (same as web) ───────────────────────────────────────────────

type Severity = 'good' | 'warning' | 'danger';

interface TagMeta {
  icon: string;
  label: Record<Language, string>;
  severity: Severity;
}

const TAG_CONFIG: Record<string, TagMeta> = {
  clear: {
    icon: '\u2705',
    label: { ko: '상태 양호', en: 'Clear', ja: '良好', zh: '状态良好' },
    severity: 'good',
  },
  muddy: {
    icon: '\uD83D\uDFE4',
    label: { ko: '진흙/미끄러움', en: 'Muddy', ja: '泥濘', zh: '泥泞' },
    severity: 'warning',
  },
  icy: {
    icon: '\uD83E\uDDCA',
    label: { ko: '빙판', en: 'Icy', ja: '凍結', zh: '结冰' },
    severity: 'warning',
  },
  overgrown: {
    icon: '\uD83C\uDF3F',
    label: { ko: '풀 우거짐', en: 'Overgrown', ja: '草が茂っている', zh: '杂草丛生' },
    severity: 'warning',
  },
  flooded: {
    icon: '\uD83C\uDF0A',
    label: { ko: '침수', en: 'Flooded', ja: '浸水', zh: '浸水' },
    severity: 'danger',
  },
  closed: {
    icon: '\uD83D\uDEAB',
    label: { ko: '통행 불가', en: 'Closed', ja: '通行禁止', zh: '禁止通行' },
    severity: 'danger',
  },
  construction: {
    icon: '\uD83D\uDEA7',
    label: { ko: '공사 중', en: 'Construction', ja: '工事中', zh: '施工中' },
    severity: 'warning',
  },
  fallen_trees: {
    icon: '\uD83C\uDF33',
    label: { ko: '쓰러진 나무', en: 'Fallen trees', ja: '倒木', zh: '倒树' },
    severity: 'warning',
  },
  bugs: {
    icon: '\uD83E\uDD9F',
    label: { ko: '벌레 주의', en: 'Bugs', ja: '虫注意', zh: '注意虫子' },
    severity: 'warning',
  },
  crowded: {
    icon: '\uD83D\uDC65',
    label: { ko: '혼잡', en: 'Crowded', ja: '混雑', zh: '拥挤' },
    severity: 'warning',
  },
  other: {
    icon: '\u2139\uFE0F',
    label: { ko: '기타', en: 'Other', ja: 'その他', zh: '其他' },
    severity: 'warning',
  },
};

// ─── Severity color palettes (light / dark) ────────────────────────────────

const SEVERITY_COLORS: Record<Severity, {
  bg: string;
  bgDark: string;
  border: string;
  borderDark: string;
  text: string;
  textDark: string;
  tagBg: string;
  tagBgDark: string;
}> = {
  good: {
    bg: '#E8F5E9',
    bgDark: 'rgba(34,197,94,0.12)',
    border: '#A5D6A7',
    borderDark: 'rgba(34,197,94,0.25)',
    text: '#2E7D32',
    textDark: '#4ADE80',
    tagBg: '#C8E6C9',
    tagBgDark: 'rgba(34,197,94,0.2)',
  },
  warning: {
    bg: '#FFF8E1',
    bgDark: 'rgba(245,158,11,0.12)',
    border: '#FFE082',
    borderDark: 'rgba(245,158,11,0.25)',
    text: '#E65100',
    textDark: '#FBBF24',
    tagBg: '#FFECB3',
    tagBgDark: 'rgba(245,158,11,0.2)',
  },
  danger: {
    bg: '#FFEBEE',
    bgDark: 'rgba(239,68,68,0.12)',
    border: '#EF9A9A',
    borderDark: 'rgba(239,68,68,0.25)',
    text: '#C62828',
    textDark: '#F87171',
    tagBg: '#FFCDD2',
    tagBgDark: 'rgba(239,68,68,0.2)',
  },
};

// ─── Relative time ──────────────────────────────────────────────────────────

function relativeTime(dateStr: string, lang: Language): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (lang === 'ko') {
    if (diffMin < 1) return '방금';
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffHr < 24) return `${diffHr}시간 전`;
    return `${diffDay}일 전`;
  }
  if (lang === 'ja') {
    if (diffMin < 1) return 'たった今';
    if (diffMin < 60) return `${diffMin}分前`;
    if (diffHr < 24) return `${diffHr}時間前`;
    return `${diffDay}日前`;
  }
  if (lang === 'zh') {
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    if (diffHr < 24) return `${diffHr}小时前`;
    return `${diffDay}天前`;
  }
  // en
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.moruwalk.com';

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Determine the highest severity from a list of tags. */
function highestSeverity(tags: string[]): Severity {
  let highest: Severity = 'good';
  for (const tag of tags) {
    const meta = TAG_CONFIG[tag];
    if (!meta) continue;
    if (meta.severity === 'danger') return 'danger';
    if (meta.severity === 'warning') highest = 'warning';
  }
  return highest;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TrailConditionBanner({ condition }: TrailConditionBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const { isDark } = useThemeStore();
  const language = useLanguageStore((s) => s.language);

  if (!condition) return null;

  const tags = condition.tags && condition.tags.length > 0 ? condition.tags : ['other'];
  const severity = highestSeverity(tags);
  const palette = SEVERITY_COLORS[severity];

  const bgColor = isDark ? palette.bgDark : palette.bg;
  const borderColor = isDark ? palette.borderDark : palette.border;
  const textClr = isDark ? palette.textDark : palette.text;
  const tagBgColor = isDark ? palette.tagBgDark : palette.tagBg;
  const textSecColor = isDark ? 'rgba(255,255,255,0.65)' : '#8B95A1';
  const textTertColor = isDark ? 'rgba(255,255,255,0.42)' : '#B0B8C1';

  const time = relativeTime(condition.created_at, language);
  const reporter = condition.reporter_nickname || (language === 'ko' ? '익명' : 'Anonymous');

  const headerLabel: Record<Language, string> = {
    ko: '최근 코스 상태',
    en: 'Trail Condition',
    ja: '最新のコース状態',
    zh: '最新路线状态',
  };

  const helpfulLabel = (count: number): string => {
    if (language === 'ko') return `${count}명이 도움이 됐어요`;
    if (language === 'ja') return `${count}人が役立ったと評価`;
    if (language === 'zh') return `${count}人觉得有用`;
    return `${count} found helpful`;
  };

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: bgColor, borderColor },
      ]}
      onPress={handleToggle}
      activeOpacity={0.85}
    >
      {/* Header label */}
      <Text style={[styles.headerLabel, { color: textTertColor }]}>
        {headerLabel[language] || headerLabel.en}
      </Text>

      {/* Summary row */}
      <View style={styles.summaryRow}>
        {/* Tag chips */}
        <View style={styles.tagsWrap}>
          {tags.map((tag) => {
            const meta = TAG_CONFIG[tag] ?? TAG_CONFIG.other;
            const label = meta.label[language] || meta.label.en;
            return (
              <View key={tag} style={[styles.tagChip, { backgroundColor: tagBgColor }]}>
                <Text style={styles.tagIcon}>{meta.icon}</Text>
                <Text style={[styles.tagLabel, { color: textClr }]}>{label}</Text>
              </View>
            );
          })}
        </View>

        {/* Chevron */}
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={textTertColor}
        />
      </View>

      {/* Reporter + time */}
      <Text style={[styles.reporterText, { color: textSecColor }]}>
        {reporter} {'·'} {time}
      </Text>

      {/* Expanded details */}
      {expanded && (
        <View style={styles.expandedWrap}>
          {/* Note */}
          {!!condition.note && (
            <Text style={[styles.noteText, { color: isDark ? 'rgba(255,255,255,0.8)' : '#4B5563' }]}>
              {condition.note}
            </Text>
          )}

          {/* Image */}
          {!!resolveImageUrl(condition.image) && (
            <Image
              source={{ uri: resolveImageUrl(condition.image)! }}
              style={styles.conditionImage}
              resizeMode="cover"
            />
          )}

          {/* Helpful count */}
          {condition.helpful_count > 0 && (
            <Text style={[styles.helpfulText, { color: textTertColor }]}>
              {helpfulLabel(condition.helpful_count)}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },

  // ── Summary row ───────────────────────────────────────
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  tagIcon: {
    fontSize: 13,
  },
  tagLabel: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Reporter line ─────────────────────────────────────
  reporterText: {
    fontSize: 12,
    marginTop: 8,
  },

  // ── Expanded section ──────────────────────────────────
  expandedWrap: {
    marginTop: 12,
    gap: 10,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 20,
  },
  conditionImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
  },
  helpfulText: {
    fontSize: 11,
  },
});
