import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { colors } from '../theme/colors';
import { Trail } from '../types';

const { width } = Dimensions.get('window');

interface TrailCardProps {
  trail: Trail;
  onPress: () => void;
  compact?: boolean;
  variant?: 'default' | 'horizontal' | 'compact';
}

const DIFFICULTY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  easy: { label: '\uC27D\uAC8C', bg: '#DCFCE7', text: '#15803D' },
  moderate: { label: '\uBCF4\uD1B5', bg: '#FEF3C7', text: '#B45309' },
  hard: { label: '\uB3C4\uC804', bg: '#FEE2E2', text: '#DC2626' },
};

const TRAIL_TYPE_EMOJI: Record<string, string> = {
  urban: '\u{1F3D9}',
  coastal: '\u{1F30A}',
  village: '\u{1F3E1}',
  cultural: '\u{1F3DB}',
  nature: '\u{1F332}',
  mixed: '\u{1F6B6}',
};

function formatDistance(km: string | number): string {
  const n = typeof km === 'string' ? parseFloat(km) : km;
  return n >= 1 ? `${n.toFixed(1)}km` : `${Math.round(n * 1000)}m`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}\uC2DC\uAC04 ${m}\uBD84` : `${m}\uBD84`;
}

export default function TrailCard({
  trail,
  onPress,
  compact,
  variant = 'default',
}: TrailCardProps) {
  const diff = DIFFICULTY_CONFIG[trail.difficulty] || DIFFICULTY_CONFIG.easy;
  const emoji = TRAIL_TYPE_EMOJI[trail.trail_type] || '\u{1F6B6}';
  const effectiveVariant = compact ? 'compact' : variant;

  // ---- Horizontal Variant ----
  if (effectiveVariant === 'horizontal') {
    return (
      <TouchableOpacity
        style={styles.horizontalCard}
        onPress={onPress}
        activeOpacity={0.85}>
        <View style={styles.horizontalImage}>
          {trail.cover_image || trail.thumbnail_url ? (
            <Image
              source={{ uri: trail.cover_image || trail.thumbnail_url }}
              style={styles.horizontalImg}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.horizontalPlaceholder}>
              <Text style={styles.horizontalPlaceholderEmoji}>{emoji}</Text>
            </View>
          )}
        </View>
        <View style={styles.horizontalContent}>
          <View style={styles.horizontalMeta}>
            <Text style={styles.horizontalRegion}>
              {emoji} {trail.region}
            </Text>
          </View>
          <Text style={styles.horizontalTitle} numberOfLines={1}>
            {trail.title}
          </Text>
          <View style={styles.horizontalBottom}>
            <View style={[styles.diffBadge, { backgroundColor: diff.bg }]}>
              <Text style={[styles.diffText, { color: diff.text }]}>{diff.label}</Text>
            </View>
            <Text style={styles.horizontalStats}>
              {formatDistance(trail.distance_km)} \u00B7 {formatDuration(trail.estimated_minutes)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // ---- Default / Compact Variant ----
  const cardWidth = effectiveVariant === 'compact' ? 280 : width - 32;

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }]}
      onPress={onPress}
      activeOpacity={0.85}>
      {/* Image */}
      <View style={styles.imageContainer}>
        {trail.cover_image || trail.thumbnail_url ? (
          <Image
            source={{ uri: trail.cover_image || trail.thumbnail_url }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderEmoji}>{emoji}</Text>
          </View>
        )}
        {/* Gradient overlay */}
        <View style={styles.imageGradient} />

        {/* Top left badges */}
        <View style={styles.badgeRow}>
          <View style={[styles.diffBadgeOverlay, { backgroundColor: diff.bg }]}>
            <Text style={[styles.diffText, { color: diff.text }]}>{diff.label}</Text>
          </View>
          {trail.is_multi_day && trail.total_days && (
            <View style={styles.multiDayBadge}>
              <Text style={styles.multiDayText}>{trail.total_days}\uC77C</Text>
            </View>
          )}
        </View>

        {/* Liked heart top right */}
        {trail.is_liked && (
          <View style={styles.likedBadge}>
            <Text style={styles.likedHeart}>{'\u2764\uFE0F'}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.typeRow}>
          <Text style={styles.typeLabel}>
            {emoji} {trail.trail_type === 'urban' ? '\uB3C4\uC2DC' :
              trail.trail_type === 'coastal' ? '\uD574\uC548' :
              trail.trail_type === 'village' ? '\uB9C8\uC744' :
              trail.trail_type === 'cultural' ? '\uBB38\uD654' :
              trail.trail_type === 'nature' ? '\uC790\uC5F0' : '\uD63C\uD569'}
          </Text>
          <Text style={styles.regionDot}>\u00B7</Text>
          <Text style={styles.regionLabel}>{trail.region}</Text>
        </View>

        <Text style={styles.title} numberOfLines={1}>
          {trail.title}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaValue}>{formatDistance(trail.distance_km)}</Text>
          <Text style={styles.metaDot}>\u00B7</Text>
          <Text style={styles.metaValue}>{formatDuration(trail.estimated_minutes)}</Text>
          <Text style={styles.metaDot}>\u00B7</Text>
          <Text style={styles.likeCount}>{'\u2764\uFE0F'} {trail.like_count}</Text>
        </View>

        {/* Tags */}
        {trail.tags && trail.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {trail.tags.slice(0, 3).map((tag) => (
              <View key={tag.id} style={styles.tag}>
                <Text style={styles.tagText}>#{tag.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // ---- Default / Compact ----
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  imageContainer: {
    position: 'relative',
    height: 176,
    width: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderEmoji: {
    fontSize: 48,
  },
  imageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
    backgroundColor: 'transparent',
    // Simulating gradient with opacity
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  badgeRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    gap: 6,
  },
  diffBadgeOverlay: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  diffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  diffText: {
    fontSize: 11,
    fontWeight: '600',
  },
  multiDayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  multiDayText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  likedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likedHeart: {
    fontSize: 14,
  },
  content: {
    padding: 16,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  typeLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  regionDot: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  regionLabel: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaValue: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  metaDot: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  likeCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  tag: {
    backgroundColor: colors.primary50,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
  },

  // ---- Horizontal Variant ----
  horizontalCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  horizontalImage: {
    width: 112,
    height: 112,
  },
  horizontalImg: {
    width: '100%',
    height: '100%',
  },
  horizontalPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontalPlaceholderEmoji: {
    fontSize: 24,
  },
  horizontalContent: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  horizontalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  horizontalRegion: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  horizontalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 20,
  },
  horizontalBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  horizontalStats: {
    fontSize: 12,
    color: colors.textTertiary,
  },
});
