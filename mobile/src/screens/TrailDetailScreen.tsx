import React, { useState, useEffect } from 'react';
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
  TextInput,
  Share,
  Alert,
} from 'react-native';

class TrailDetailErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA' }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>{'⚠️'}</Text>
          <Text style={{ fontSize: 16, color: '#191F28', fontWeight: '600' }}>{'화면을 불러올 수 없습니다'}</Text>
          <Text style={{ fontSize: 13, color: '#8B95A1', marginTop: 4 }}>{'잠시 후 다시 시도해주세요'}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import api from '../api/client';
import { colors } from '../theme/colors';
import { Trail, Spot, Review } from '../types';
import { saveTrailOffline, isSaved, getSavedTrail } from '../utils/offlineStorage';

const { width } = Dimensions.get('window');

const DIFFICULTY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  easy: { label: '\uC27D\uAC8C', bg: '#DCFCE7', text: '#15803D' },
  moderate: { label: '\uBCF4\uD1B5', bg: '#FEF3C7', text: '#B45309' },
  hard: { label: '\uB3C4\uC804', bg: '#FEE2E2', text: '#DC2626' },
};

const SEASON_LABELS: Record<string, string> = {
  spring: '\uBD04',
  summer: '\uC5EC\uB984',
  autumn: '\uAC00\uC744',
  winter: '\uACA8\uC6B8',
  all: '\uC0AC\uACC4\uC808',
};

const SPOT_ICONS: Record<string, string> = {
  start: '\u{1F7E2}',
  restaurant: '\u{1F35C}',
  cafe: '\u2615',
  photo: '\u{1F4F7}',
  rest: '\u{1F9D8}',
  view: '\u{1F304}',
  danger: '\u26A0\uFE0F',
  end: '\u{1F534}',
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
  return h > 0 ? `${h}\uC2DC\uAC04 ${m}\uBD84` : `${m}\uBD84`;
}

export default function TrailDetailScreen() {
  return (
    <TrailDetailErrorBoundary>
      <TrailDetailScreenInner />
    </TrailDetailErrorBoundary>
  );
}

function TrailDetailScreenInner() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { trailId } = route.params;

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    content: '',
    visited_date: new Date().toISOString().split('T')[0],
  });
  const [savedOffline, setSavedOffline] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);

  useEffect(() => {
    isSaved(trailId).then(setSavedOffline);
  }, [trailId]);

  const { data: trail, isLoading } = useQuery({
    queryKey: ['trail', trailId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/trails/${trailId}/`);
        return data as Trail;
      } catch {
        // Fallback to offline cache
        const cached = await getSavedTrail(trailId);
        if (cached) return cached.trail as Trail;
        throw new Error('Trail not available');
      }
    },
  });

  const { data: spots = [] } = useQuery({
    queryKey: ['spots', trailId],
    queryFn: async () => {
      const { data } = await api.get(`/trails/${trailId}/spots/`);
      return data as Spot[];
    },
    enabled: !!trail,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', trailId],
    queryFn: async () => {
      const { data } = await api.get(`/reviews/trails/${trailId}/`);
      return (data.results || data) as Review[];
    },
    enabled: !!trail,
  });

  const likeMutation = useMutation({
    mutationFn: async () => (await api.post(`/trails/${trailId}/like/`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trail', trailId] }),
  });

  const createReview = useMutation({
    mutationFn: async (form: typeof reviewForm) =>
      (await api.post(`/reviews/trails/${trailId}/`, form)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', trailId] });
      setShowReviewForm(false);
      setReviewForm({ rating: 5, content: '', visited_date: new Date().toISOString().split('T')[0] });
    },
  });

  const handleSaveOffline = async () => {
    if (savingOffline) return;
    setSavingOffline(true);
    const success = await saveTrailOffline(trailId);
    setSavingOffline(false);
    if (success) {
      setSavedOffline(true);
      Alert.alert('저장 완료', '오프라인에서도 이 코스를 확인할 수 있습니다.');
    } else {
      Alert.alert('저장 실패', '코스를 저장하지 못했습니다. 다시 시도해주세요.');
    }
  };

  const handleShare = async () => {
    if (!trail) return;
    try {
      await Share.share({
        message: `${trail.title} - ${trail.region}\nRoami\uC5D0\uC11C \uD655\uC778\uD574\uBCF4\uC138\uC694!`,
      });
    } catch {}
  };

  if (isLoading || !trail) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const diff = DIFFICULTY_CONFIG[trail.difficulty] || DIFFICULTY_CONFIG.easy;
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={true}>
        {/* Cover Image with Gradient */}
        <View style={styles.coverContainer}>
          {trail.cover_image || trail.thumbnail_url ? (
            <Image
              source={{ uri: trail.cover_image || trail.thumbnail_url }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Text style={styles.coverEmoji}>{'\u{1F97E}'}</Text>
            </View>
          )}
          <View style={styles.coverGradient} />

          {/* Back button */}
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + 8 }]}
            onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>{'\u2190'}</Text>
          </TouchableOpacity>

          {/* Overlay content */}
          <View style={styles.coverContent}>
            <View style={[styles.diffBadge, { backgroundColor: diff.bg }]}>
              <Text style={[styles.diffText, { color: diff.text }]}>{diff.label}</Text>
            </View>
            <Text style={styles.coverTitle}>{trail.title}</Text>
            <Text style={styles.coverRegion}>
              {[trail.region, trail.country].filter(Boolean).join(', ')}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Info Cards Row */}
          <View style={styles.infoRow}>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>{'\uAC70\uB9AC'}</Text>
              <Text style={styles.infoValue}>{formatDistance(trail.distance_km)}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>{'\uC2DC\uAC04'}</Text>
              <Text style={styles.infoValue}>{formatDuration(trail.estimated_minutes)}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>{'\uB204\uC801\uC0C1\uC2B9'}</Text>
              <Text style={styles.infoValue}>
                {trail.elevation_gain ? `${trail.elevation_gain}m` : '-'}
              </Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>{'\uC2DC\uC990'}</Text>
              <Text style={styles.infoValue}>
                {SEASON_LABELS[trail.best_season] || trail.best_season}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.likeBtn,
                trail.is_liked && styles.likeBtnActive,
              ]}
              onPress={() => likeMutation.mutate()}>
              <Text style={styles.likeBtnEmoji}>
                {trail.is_liked ? '\u2764\uFE0F' : '\u{1F90D}'}
              </Text>
              <Text
                style={[
                  styles.likeBtnCount,
                  trail.is_liked && styles.likeBtnCountActive,
                ]}>
                {trail.like_count}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Text style={styles.shareBtnEmoji}>{'\u2B06\uFE0F'}</Text>
              <Text style={styles.shareBtnText}>{'\uACF5\uC720'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveOfflineBtn, savedOffline && styles.saveOfflineBtnActive]}
              onPress={handleSaveOffline}
              disabled={savingOffline}>
              <Text style={styles.saveOfflineBtnEmoji}>
                {savedOffline ? '\u2705' : '\u{1F4E5}'}
              </Text>
              <Text
                style={[
                  styles.saveOfflineBtnText,
                  savedOffline && styles.saveOfflineBtnTextActive,
                ]}>
                {savingOffline ? '저장 중...' : savedOffline ? '저장됨' : '저장'}
              </Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <Text style={styles.viewCount}>
              {'\u{1F441}'} {trail.view_count}
            </Text>
          </View>

          {/* Description Section */}
          <View style={styles.descCard}>
            <Text style={styles.sectionTitle}>{'\uCF54\uC2A4 \uC18C\uAC1C'}</Text>
            <Text style={styles.descText}>{trail.description}</Text>
            {trail.tags && trail.tags.length > 0 && (
              <View style={styles.tagsRow}>
                {trail.tags.map((tag) => (
                  <View key={tag.id} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Map */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{'\uACBD\uB85C \uC9C0\uB3C4'}</Text>
            <View style={styles.mapContainer}>
              {trail.start_lat && trail.start_lng ? (
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: parseFloat(trail.start_lat),
                    longitude: parseFloat(trail.start_lng),
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                >
                  <Marker
                    coordinate={{ latitude: parseFloat(trail.start_lat), longitude: parseFloat(trail.start_lng) }}
                    title={'\uCD9C\uBC1C'}
                  />
                  {trail.end_lat && trail.end_lng && (
                    <Marker
                      coordinate={{ latitude: parseFloat(trail.end_lat), longitude: parseFloat(trail.end_lng) }}
                      title={'\uB3C4\uCC29'}
                      pinColor="red"
                    />
                  )}
                  {trail.path_data?.coordinates && trail.path_data.coordinates.length > 0 && (
                    <Polyline
                      coordinates={trail.path_data.coordinates.map(([lng, lat]: number[]) => ({ latitude: lat, longitude: lng }))}
                      strokeColor={colors.primary}
                      strokeWidth={4}
                    />
                  )}
                </MapView>
              ) : (
                <View style={styles.mapFallback}>
                  <Text style={{ fontSize: 40 }}>{'\u{1F5FA}\uFE0F'}</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 8 }}>{'\uC704\uCE58 \uC815\uBCF4 \uC5C6\uC74C'}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Spots Timeline */}
          {spots.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {'\uCF54\uC2A4 \uC2A4\uD31F'} ({spots.length})
              </Text>
              {spots.map((spot, index) => (
                <View key={spot.id} style={styles.spotItem}>
                  <View style={styles.spotTimeline}>
                    <Text style={styles.spotIcon}>
                      {SPOT_ICONS[spot.spot_type] || '\u{1F4CD}'}
                    </Text>
                    {index < spots.length - 1 && <View style={styles.spotLine} />}
                  </View>
                  <View style={styles.spotContent}>
                    <Text style={styles.spotName}>{spot.name}</Text>
                    <Text style={styles.spotDistance}>{spot.distance_from_start_km}km</Text>
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
                    {spot.images && spot.images.length > 0 && (
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
          <View style={styles.section}>
            <View style={styles.reviewsHeader}>
              <View style={styles.reviewsTitleRow}>
                <Text style={styles.sectionTitle}>{'\uB9AC\uBDF0'}</Text>
                {avgRating && (
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingBadgeText}>
                      {'\u2605'} {avgRating} ({reviews.length})
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.writeReviewBtn}
                onPress={() => setShowReviewForm(!showReviewForm)}>
                <Text style={styles.writeReviewBtnText}>{'\uB9AC\uBDF0 \uC791\uC131'}</Text>
              </TouchableOpacity>
            </View>

            {/* Rating Distribution */}
            {reviews.length > 0 && (
              <View style={styles.ratingDistCard}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviews.filter((r) => r.rating === star).length;
                  const pct = (count / reviews.length) * 100;
                  return (
                    <View key={star} style={styles.ratingDistRow}>
                      <Text style={styles.ratingDistStar}>{star}</Text>
                      <Text style={styles.ratingDistStarIcon}>{'\u2605'}</Text>
                      <View style={styles.ratingDistBar}>
                        <View
                          style={[styles.ratingDistFill, { width: `${pct}%` }]}
                        />
                      </View>
                      <Text style={styles.ratingDistCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Review Form */}
            {showReviewForm && (
              <View style={styles.reviewFormCard}>
                <Text style={styles.reviewFormTitle}>{'\uB9AC\uBDF0 \uC791\uC131'}</Text>
                <Text style={styles.reviewFormLabel}>{'\uD3C9\uC810'}</Text>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setReviewForm((p) => ({ ...p, rating: star }))}>
                      <Text
                        style={[
                          styles.starSelect,
                          star <= reviewForm.rating && styles.starSelectFilled,
                        ]}>
                        {'\u2605'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.reviewFormLabel}>{'\uB0B4\uC6A9'}</Text>
                <TextInput
                  style={styles.reviewInput}
                  multiline
                  numberOfLines={4}
                  maxLength={1000}
                  placeholder={'\uB9AC\uBDF0\uB97C \uC791\uC131\uD574\uC8FC\uC138\uC694'}
                  placeholderTextColor={colors.textTertiary}
                  value={reviewForm.content}
                  onChangeText={(text) => setReviewForm((p) => ({ ...p, content: text }))}
                  textAlignVertical="top"
                />
                <View style={styles.reviewFormActions}>
                  <TouchableOpacity
                    style={styles.reviewCancelBtn}
                    onPress={() => setShowReviewForm(false)}>
                    <Text style={styles.reviewCancelText}>{'\uCDE8\uC18C'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.reviewSubmitBtn,
                      (!reviewForm.content || createReview.isPending) && styles.reviewSubmitDisabled,
                    ]}
                    onPress={() => createReview.mutate(reviewForm)}
                    disabled={!reviewForm.content || createReview.isPending}>
                    <Text style={styles.reviewSubmitText}>
                      {createReview.isPending ? '\uC81C\uCD9C \uC911...' : '\uC81C\uCD9C'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Review List */}
            {reviews.slice(0, 5).map((review) => (
              <View key={review.id} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewAuthor}>{review.author?.nickname || ''}</Text>
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Text
                        key={star}
                        style={[styles.star, star <= review.rating && styles.starFilled]}>
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

          {/* Author Card */}
          {trail.author && (
          <View style={styles.authorCard}>
            <Text style={styles.sectionTitle}>{'\uC791\uC131\uC790'}</Text>
            <TouchableOpacity style={styles.authorRow}>
              <View style={styles.authorAvatar}>
                {trail.author.profile_image ? (
                  <Image
                    source={{ uri: trail.author.profile_image }}
                    style={styles.authorAvatarImg}
                  />
                ) : (
                  <Text style={styles.authorAvatarFallback}>{'\u{1F464}'}</Text>
                )}
              </View>
              <View>
                <Text style={styles.authorName}>{trail.author.nickname || ''}</Text>
                {trail.author.is_guide && (
                  <View style={styles.guideBadge}>
                    <Text style={styles.guideBadgeText}>{'\uC778\uC99D \uAC00\uC774\uB4DC'}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
          )}

          {/* Walk CTA */}
          <TouchableOpacity
            style={styles.walkCta}
            onPress={() =>
              navigation.navigate('Walk', { trailId: trail.id, trail })
            }>
            <Text style={styles.walkCtaText}>{'\uC774 \uCF54\uC2A4 \uAC77\uAE30'}</Text>
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
    backgroundColor: colors.warm,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverContainer: {
    height: 300,
    position: 'relative',
  },
  coverImage: {
    width: width,
    height: 300,
  },
  coverPlaceholder: {
    width: width,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  coverEmoji: {
    fontSize: 80,
    opacity: 0.3,
  },
  coverGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
    backgroundColor: 'rgba(0,0,0,0.35)',
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
  coverContent: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
  },
  diffBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  diffText: {
    fontSize: 12,
    fontWeight: '700',
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  coverRegion: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  body: {
    padding: 24,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  likeBtnActive: {
    backgroundColor: '#FF4B4B',
  },
  likeBtnEmoji: {
    fontSize: 16,
  },
  likeBtnCount: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  likeBtnCountActive: {
    color: '#fff',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  shareBtnEmoji: {
    fontSize: 16,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  saveOfflineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  saveOfflineBtnActive: {
    backgroundColor: colors.primary50 || '#E8F5E9',
    borderColor: colors.primary,
  },
  saveOfflineBtnEmoji: {
    fontSize: 16,
  },
  saveOfflineBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  saveOfflineBtnTextActive: {
    color: colors.primary,
  },
  viewCount: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  descCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  descText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 20,
  },
  tag: {
    backgroundColor: colors.primary50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  mapContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  map: {
    height: 250,
    width: '100%',
  },
  mapFallback: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSecondary,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.borderLight,
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
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
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
    borderRadius: 10,
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
    borderRadius: 10,
    marginRight: 8,
    marginTop: 4,
  },
  reviewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  reviewsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingBadge: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  ratingBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#B45309',
  },
  writeReviewBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  writeReviewBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  ratingDistCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  ratingDistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  ratingDistStar: {
    fontSize: 12,
    color: colors.textSecondary,
    width: 14,
    textAlign: 'right',
  },
  ratingDistStarIcon: {
    fontSize: 12,
    color: '#FBBF24',
  },
  ratingDistBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#F5F6F7',
    borderRadius: 4,
    overflow: 'hidden',
  },
  ratingDistFill: {
    height: '100%',
    backgroundColor: '#FBBF24',
    borderRadius: 4,
  },
  ratingDistCount: {
    fontSize: 12,
    color: colors.textTertiary,
    width: 24,
    textAlign: 'right',
  },
  reviewFormCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  reviewFormTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  reviewFormLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  starRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 20,
  },
  starSelect: {
    fontSize: 24,
    color: '#E5E8EB',
  },
  starSelectFilled: {
    color: '#FBBF24',
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 100,
    marginBottom: 16,
  },
  reviewFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  reviewCancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  reviewCancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  reviewSubmitBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  reviewSubmitDisabled: {
    opacity: 0.5,
  },
  reviewSubmitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  reviewItem: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  authorCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  authorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(168,230,207,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  authorAvatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  authorAvatarFallback: {
    fontSize: 24,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  guideBadge: {
    marginTop: 4,
    backgroundColor: 'rgba(45,74,46,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  guideBadgeText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  walkCta: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  walkCtaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
