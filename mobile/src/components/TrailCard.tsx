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
const CARD_WIDTH = width * 0.7;

interface TrailCardProps {
  trail: Trail;
  onPress: () => void;
  compact?: boolean;
}

const difficultyLabel: Record<string, { text: string; color: string }> = {
  easy: { text: '\uC27D\uAC8C', color: '#4CAF50' },
  moderate: { text: '\uBCF4\uD1B5', color: '#FF9800' },
  hard: { text: '\uB3C4\uC804', color: '#F44336' },
};

export default function TrailCard({ trail, onPress, compact }: TrailCardProps) {
  const diff = difficultyLabel[trail.difficulty] || difficultyLabel.easy;
  const cardWidth = compact ? CARD_WIDTH : width - 32;

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }]}
      onPress={onPress}
      activeOpacity={0.85}>
      <Image
        source={{ uri: trail.cover_image || trail.thumbnail_url }}
        style={[styles.image, compact && styles.imageCompact]}
        resizeMode="cover"
      />
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.region} numberOfLines={1}>
            {trail.region}
          </Text>
          <View style={[styles.badge, { backgroundColor: diff.color + '18' }]}>
            <Text style={[styles.badgeText, { color: diff.color }]}>
              {diff.text}
            </Text>
          </View>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {trail.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{trail.distance_km}km</Text>
          <Text style={styles.metaDot}> \u00B7 </Text>
          <Text style={styles.meta}>
            {trail.estimated_minutes}\uBD84
          </Text>
          {trail.like_count > 0 && (
            <>
              <Text style={styles.metaDot}> \u00B7 </Text>
              <Text style={styles.meta}>
                \u2764\uFE0F {trail.like_count}
              </Text>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 160,
  },
  imageCompact: {
    height: 130,
  },
  content: {
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  region: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  metaDot: {
    fontSize: 12,
    color: colors.textTertiary,
  },
});
