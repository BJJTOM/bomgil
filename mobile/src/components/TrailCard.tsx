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
  easy: { label: '쉽게', bg: '#DCFCE7', text: '#15803D' },
  moderate: { label: '보통', bg: '#FEF3C7', text: '#B45309' },
  hard: { label: '도전', bg: '#FEE2E2', text: '#DC2626' },
};

const TRAIL_TYPE_EMOJI: Record<string, string> = {
  urban: '\u{1F3D9}',
  coastal: '\u{1F30A}',
  village: '\u{1F3E1}',
  cultural: '\u{1F3DB}',
  nature: '\u{1F332}',
  mixed: '\u{1F6B6}',
};

function formatDistance(km: string | number | null | undefined): string {
  if (km == null) return '-';
  const n = typeof km === 'string' ? parseFloat(km) : km;
  if (isNaN(n)) return '-';
  return n >= 1 ? `${n.toFixed(1)}km` : `${Math.round(n * 1000)}m`;
}

function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || isNaN(minutes)) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
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
          <Text style={styles.horizontalTitle} numberOfLines={1}>
            {trail?.title || ''}
          </Text>
          <Text style={styles.horizontalMeta} numberOfLines={1}>
            {trail?.region || ''} · {formatDistance(trail.distance_km)} · {formatDuration(trail.estimated_minutes)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ---- Default / Compact Variant ----
  const isCompact = effectiveVariant === 'compact';
  const cardWidth = isCompact ? 260 : width - 32;
  const imageHeight = isCompact ? 160 : 176;

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }]}
      onPress={onPress}
      activeOpacity={0.85}>
      {/* Image */}
      <View style={[styles.imageContainer, { height: imageHeight }]}>
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

        {/* Liked heart top right */}
        {trail.is_liked && (
          <View style={styles.likedBadge}>
            <Text style={styles.likedHeart}>{'❤️'}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {trail.title || ''}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {trail.region || ''} · {formatDistance(trail.distance_km)} · {formatDuration(trail.estimated_minutes)}
        </Text>
        <Text style={styles.likeCount}>
          {'♥'} {trail.like_count ?? 0}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // ---- Default / Compact ----
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
  },
  imageContainer: {
    position: 'relative',
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
    fontSize: 40,
  },
  likedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likedHeart: {
    fontSize: 13,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  likeCount: {
    fontSize: 12,
    color: colors.textTertiary,
  },

  // ---- Horizontal Variant ----
  horizontalCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  horizontalImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
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
    fontSize: 22,
  },
  horizontalContent: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: 'center',
  },
  horizontalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
  },
  horizontalMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
