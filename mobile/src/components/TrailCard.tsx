import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';
import { useThemeStore } from '../stores/theme';
import { Trail } from '../types';

const { width } = Dimensions.get('window');

const API_BASE = 'https://api.moruwalk.com';

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

interface TrailCardProps {
  trail: Trail;
  onPress: () => void;
  compact?: boolean;
  variant?: 'default' | 'horizontal' | 'compact';
}

const DIFFICULTY_CONFIG: Record<string, { label: string; bg: string; bgDark: string; text: string; textDark: string }> = {
  easy: { label: '쉬움', bg: '#DCFCE7', bgDark: 'rgba(34,197,94,0.15)', text: '#15803D', textDark: '#4ADE80' },
  moderate: { label: '보통', bg: '#FEF3C7', bgDark: 'rgba(245,158,11,0.15)', text: '#B45309', textDark: '#FBBF24' },
  hard: { label: '어려움', bg: '#FEE2E2', bgDark: 'rgba(239,68,68,0.15)', text: '#DC2626', textDark: '#F87171' },
};

const TRAIL_TYPE_ICON: Record<string, { name: string; color: string }> = {
  urban: { name: 'map-pin', color: '#6366F1' },
  coastal: { name: 'wind', color: '#0EA5E9' },
  village: { name: 'home', color: '#D97706' },
  cultural: { name: 'book-open', color: '#8B5CF6' },
  nature: { name: 'sun', color: '#16A34A' },
  mixed: { name: 'layers', color: '#64748B' },
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

function formatCount(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '0';
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

/**
 * Region/type-aware emoji + gradient for trails without a cover image.
 * Matches the web TrailCard fallback so the visual identity is the
 * same across both platforms.
 */
function fallbackTheme(trail: Trail): { emoji: string; gradient: [string, string] } {
  const type = trail.trail_type;
  if (type === 'coastal') return { emoji: '🌊', gradient: ['#A3C9E2', '#3D7EB5'] };
  if (type === 'urban') return { emoji: '🏙️', gradient: ['#D9C8B4', '#6B5A45'] };
  if (type === 'cultural') return { emoji: '🏯', gradient: ['#E9D5B4', '#8B6F3E'] };
  if (type === 'nature') return { emoji: '🌲', gradient: ['#BFD8BD', '#3D6B4A'] };
  if (type === 'village') return { emoji: '🏘️', gradient: ['#EAD9A8', '#A8883D'] };
  const region = (trail.region || '').toLowerCase();
  if (region.includes('제주')) return { emoji: '🏝️', gradient: ['#B7E0E6', '#3E8B9A'] };
  if (region.includes('부산') || region.includes('해운대'))
    return { emoji: '🌊', gradient: ['#A3C9E2', '#3D7EB5'] };
  if (region.includes('강원') || region.includes('설악'))
    return { emoji: '⛰️', gradient: ['#A8C0A3', '#4A7C59'] };
  if (region.includes('서울') || region.includes('종로') || region.includes('성동'))
    return { emoji: '🏙️', gradient: ['#D9C8B4', '#6B5A45'] };
  return { emoji: '🥾', gradient: ['#C9D8C5', '#6B8A6E'] };
}

export default function TrailCard({
  trail,
  onPress,
  compact,
  variant = 'default',
}: TrailCardProps) {
  const { isDark } = useThemeStore();
  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const titleColor = isDark ? '#FFFFFF' : colors.textPrimary;
  const metaColor = isDark ? 'rgba(255,255,255,0.65)' : colors.textSecondary;
  const likeColor = isDark ? 'rgba(255,255,255,0.5)' : colors.textTertiary;
  const imagePlaceholderBg = isDark ? '#2a2a2a' : colors.accentLight;

  const diff = DIFFICULTY_CONFIG[trail.difficulty] || DIFFICULTY_CONFIG.easy;
  const trailIcon = TRAIL_TYPE_ICON[trail.trail_type] || TRAIL_TYPE_ICON.mixed;
  const effectiveVariant = compact ? 'compact' : variant;

  // Broken-image tracking — if the CDN URL 404s at runtime, swap to the
  // gradient+emoji fallback instead of leaving a blank box.
  const [imgBroken, setImgBroken] = useState(false);
  const rawUri =
    resolveImageUrl(trail.cover_image) || resolveImageUrl(trail.thumbnail_url);
  const showImage = !!rawUri && !imgBroken;
  const theme = fallbackTheme(trail);

  // Rating data (optional from API)
  const avgRating = trail.avg_rating;
  const reviewCount = trail.review_count;

  // ---- Horizontal Variant ----
  if (effectiveVariant === 'horizontal') {
    return (
      <TouchableOpacity
        style={[styles.horizontalCard, { backgroundColor: cardBg }]}
        onPress={onPress}
        activeOpacity={0.85}>
        <View style={styles.horizontalImage}>
          {showImage ? (
            <Image
              source={{ uri: rawUri! }}
              style={styles.horizontalImg}
              resizeMode="cover"
              onError={() => setImgBroken(true)}
            />
          ) : (
            <LinearGradient
              colors={theme.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.horizontalPlaceholder}
            >
              <Text style={{ fontSize: 32 }}>{theme.emoji}</Text>
            </LinearGradient>
          )}
        </View>
        <View style={styles.horizontalContent}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {trail.is_official && (
              <View style={styles.officialBadgeInline}>
                <Feather name="check" size={10} color="#fff" />
              </View>
            )}
            <Text style={[styles.horizontalTitle, { color: titleColor }]} numberOfLines={1}>
              {trail?.title || ''}
            </Text>
          </View>
          <Text style={[styles.horizontalMeta, { color: metaColor }]} numberOfLines={1}>
            {trail?.region || ''} · {formatDistance(trail.distance_km)} · {formatDuration(trail.estimated_minutes)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ---- Default / Compact Variant ----
  const isCompact = effectiveVariant === 'compact';
  const cardWidth = isCompact ? 260 : width - 32;
  const imageHeight = isCompact ? 140 : 140;

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth, backgroundColor: cardBg }]}
      onPress={onPress}
      activeOpacity={0.85}>
      {/* Image */}
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        {showImage ? (
          <Image
            source={{ uri: rawUri! }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImgBroken(true)}
          />
        ) : (
          <LinearGradient
            colors={theme.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.imagePlaceholder}
          >
            <Text style={{ fontSize: 56 }}>{theme.emoji}</Text>
            {!!trail.region && (
              <Text style={styles.fallbackRegion} numberOfLines={1}>
                {trail.region}
              </Text>
            )}
          </LinearGradient>
        )}

        {/* Liked heart top right */}
        {trail.is_liked && (
          <View style={styles.likedBadge}>
            <Feather name="heart" size={14} color="#EF4444" />
          </View>
        )}

        {/* Official badge top left */}
        {trail.is_official && (
          <View style={styles.officialBadge}>
            <Feather name="check" size={11} color="#fff" style={{ marginRight: 3 }} />
            <Text style={styles.officialBadgeText}>공식</Text>
          </View>
        )}

        {/* Difficulty pill top right (below heart or alone) */}
        <View style={[styles.difficultyBadge, { backgroundColor: isDark ? diff.bgDark : diff.bg }]}>
          <Text style={[styles.difficultyText, { color: isDark ? diff.textDark : diff.text }]}>
            {diff.label}
          </Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
          {trail.title || ''}
        </Text>
        <Text style={[styles.meta, { color: metaColor }]} numberOfLines={1}>
          {trail.region || ''} · {formatDistance(trail.distance_km)} · {formatDuration(trail.estimated_minutes)}
        </Text>

        {/* Bottom row: rating + like count + completion count */}
        <View style={styles.bottomRow}>
          {/* Rating */}
          {avgRating != null && avgRating > 0 ? (
            <View style={styles.ratingWrap}>
              <Feather name="star" size={12} color="#F59E0B" />
              <Text style={[styles.ratingText, { color: metaColor }]}>
                {Number(avgRating).toFixed(1)}
                {reviewCount != null && reviewCount > 0 ? ` (${reviewCount})` : ''}
              </Text>
            </View>
          ) : null}

          {/* Like count */}
          <View style={styles.likeWrap}>
            <Feather name="heart" size={11} color={likeColor} />
            <Text style={[styles.likeCount, { color: likeColor }]}>
              {formatCount(trail.like_count ?? 0)}
            </Text>
          </View>

          {/* Completion count */}
          {trail.completion_count != null && trail.completion_count > 0 ? (
            <View style={styles.likeWrap}>
              <Feather name="check-circle" size={11} color={likeColor} />
              <Text style={[styles.likeCount, { color: likeColor }]}>
                {formatCount(trail.completion_count)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // ---- Default / Compact ----
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackRegion: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 4,
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
  officialBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#2D4A2E',
  },
  officialBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  officialBadgeInline: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2D4A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  difficultyBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 19,
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  likeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
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
