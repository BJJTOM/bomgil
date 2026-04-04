import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { Trail, Spot, Review } from '../types';

const { width } = Dimensions.get('window');

const SPOT_ICONS: Record<string, string> = {
  start: '\uD83D\uDFE2',
  restaurant: '\uD83C\uDF5C',
  cafe: '\u2615',
  photo: '\uD83D\uDCF7',
  rest: '\uD83E\uDDD8',
  view: '\uD83C\uDF04',
  danger: '\u26A0\uFE0F',
  end: '\uD83D\uDD34',
};

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: '\uC27D\uAC8C',
  moderate: '\uBCF4\uD1B5',
  hard: '\uB3C4\uC804',
};

export default function TrailDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { trailId } = route.params;

  const { data: trail, isLoading } = useQuery({
    queryKey: ['trail', trailId],
    queryFn: async () => {
      const { data } = await api.get(`/trails/${trailId}/`);
      return data as Trail;
    },
  });

  const { data: spots } = useQuery({
    queryKey: ['spots', trailId],
    queryFn: async () => {
      const { data } = await api.get(`/trails/${trailId}/spots/`);
      return data as Spot[];
    },
    enabled: !!trail,
  });

  const { data: reviews } = useQuery({
    queryKey: ['reviews', trailId],
    queryFn: async () => {
      const { data } = await api.get(`/reviews/trails/${trailId}/`);
      return (data.results || data) as Review[];
    },
    enabled: !!trail,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/trails/${trailId}/like/`);
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['trail', trailId] }),
  });

  if (isLoading || !trail) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover Image */}
        <View>
          <Image
            source={{ uri: trail.cover_image || trail.thumbnail_url }}
            style={styles.coverImage}
            resizeMode="cover"
          />
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + 8 }]}
            onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>{'\u2190'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.likeButton, { top: insets.top + 8 }]}
            onPress={() => likeMutation.mutate()}>
            <Text style={styles.likeIcon}>
              {trail.is_liked ? '\u2764\uFE0F' : '\uD83E\uDD0D'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Title */}
          <Text style={styles.region}>{trail.region}</Text>
          <Text style={styles.title}>{trail.title}</Text>

          {/* Info Cards */}
          <View style={styles.infoRow}>
            <View style={styles.infoCard}>
              <Text style={styles.infoValue}>{trail.distance_km}km</Text>
              <Text style={styles.infoLabel}>{'\uAC70\uB9AC'}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoValue}>{trail.estimated_minutes}{'\uBD84'}</Text>
              <Text style={styles.infoLabel}>{'\uC18C\uC694\uC2DC\uAC04'}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoValue}>
                {DIFFICULTY_LABEL[trail.difficulty]}
              </Text>
              <Text style={styles.infoLabel}>{'\uB09C\uC774\uB3C4'}</Text>
            </View>
            {trail.elevation_gain && (
              <View style={styles.infoCard}>
                <Text style={styles.infoValue}>{trail.elevation_gain}m</Text>
                <Text style={styles.infoLabel}>{'\uB204\uC801\uC0C1\uC2B9'}</Text>
              </View>
            )}
          </View>

          {/* Description */}
          <Text style={styles.description}>{trail.description}</Text>

          {/* Tags */}
          {trail.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {trail.tags.map((tag) => (
                <View key={tag.id} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag.name}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Spots Timeline */}
          {spots && spots.length > 0 && (
            <View style={styles.spotsSection}>
              <Text style={styles.sectionTitle}>
                {'\uCF54\uC2A4 \uC2A4\uD31F'} ({spots.length})
              </Text>
              {spots.map((spot, index) => (
                <View key={spot.id} style={styles.spotItem}>
                  <View style={styles.spotTimeline}>
                    <Text style={styles.spotIcon}>
                      {SPOT_ICONS[spot.spot_type] || '\uD83D\uDCCD'}
                    </Text>
                    {index < spots.length - 1 && (
                      <View style={styles.spotLine} />
                    )}
                  </View>
                  <View style={styles.spotContent}>
                    <Text style={styles.spotName}>{spot.name}</Text>
                    <Text style={styles.spotDistance}>
                      {spot.distance_from_start_km}km
                    </Text>
                    {spot.description ? (
                      <Text style={styles.spotDesc} numberOfLines={2}>
                        {spot.description}
                      </Text>
                    ) : null}
                    {spot.tip ? (
                      <View style={styles.tipBox}>
                        <Text style={styles.tipText}>{spot.tip}</Text>
                      </View>
                    ) : null}
                    {spot.images.length > 0 && (
                      <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={spot.images}
                        keyExtractor={(img) => String(img.id)}
                        renderItem={({ item: img }) => (
                          <Image
                            source={{ uri: img.image }}
                            style={styles.spotPhoto}
                            resizeMode="cover"
                          />
                        )}
                      />
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Reviews */}
          {reviews && reviews.length > 0 && (
            <View style={styles.reviewsSection}>
              <Text style={styles.sectionTitle}>
                {'\uB9AC\uBDF0'} ({reviews.length})
              </Text>
              {reviews.slice(0, 5).map((review) => (
                <View key={review.id} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewAuthor}>
                      {review.author.nickname}
                    </Text>
                    <View style={styles.ratingRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Text
                          key={star}
                          style={[
                            styles.star,
                            star <= review.rating && styles.starFilled,
                          ]}>
                          {'\u2605'}
                        </Text>
                      ))}
                    </View>
                  </View>
                  <Text style={styles.reviewContent} numberOfLines={3}>
                    {review.content}
                  </Text>
                  <Text style={styles.reviewDate}>
                    {new Date(review.visited_date).toLocaleDateString('ko-KR')}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Walk CTA */}
          <TouchableOpacity
            style={styles.walkCta}
            onPress={() =>
              navigation.navigate('Walk', { trailId: trail.id, trail })
            }>
            <Text style={styles.walkCtaText}>
              {'\uC774 \uCF54\uC2A4 \uAC77\uAE30'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    width: width,
    height: 280,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  likeButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeIcon: {
    fontSize: 18,
  },
  body: {
    padding: 20,
  },
  region: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 32,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  infoCard: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: 16,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  tag: {
    backgroundColor: colors.primary50,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  spotsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  spotItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  spotTimeline: {
    width: 32,
    alignItems: 'center',
  },
  spotIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  spotLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.borderDefault,
  },
  spotContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 20,
  },
  spotName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  spotDistance: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 4,
  },
  spotDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 6,
  },
  tipBox: {
    backgroundColor: colors.accentLight,
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    color: colors.primary,
    lineHeight: 18,
  },
  spotPhoto: {
    width: 100,
    height: 75,
    borderRadius: 8,
    marginRight: 8,
    marginTop: 4,
  },
  reviewsSection: {
    marginBottom: 24,
  },
  reviewItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reviewAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  ratingRow: {
    flexDirection: 'row',
  },
  star: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  starFilled: {
    color: '#FFB800',
  },
  reviewContent: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  walkCta: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  walkCtaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
