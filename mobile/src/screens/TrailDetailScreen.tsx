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
          <Text style={{ fontSize: 40, marginBottom: 12 }}>{'\u26A0\uFE0F'}</Text>
          <Text style={{ fontSize: 16, color: '#191F28', fontWeight: '600' }}>{'\uD654\uBA74\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4'}</Text>
          <Text style={{ fontSize: 13, color: '#8B95A1', marginTop: 4 }}>{'\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694'}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { Trail, Spot, Review } from '../types';
import { saveTrailOffline, isSaved, getSavedTrail } from '../utils/offlineStorage';
import SafeMapView from '../components/SafeMapView';

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
  const trailId = route.params?.id ?? route.params?.trailId;

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    content: '',
    visited_date: new Date().toISOString().split('T')[0],
  });
  const [savedOffline, setSavedOffline] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);

  useEffect(() => {
    if (trailId) {
      isSaved(trailId).then(setSavedOffline);
    }
  }, [trailId]);

  const { data: trail, isLoading, error } = useQuery({
    queryKey: ['trail', trailId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/trails/${trailId}/`);
        return data as Trail;
      } catch (e) {
        const cached = await getSavedTrail(trailId);
        if (cached) return cached.trail as Trail;
        throw e;
      }
    },
    enabled: !!trailId,
    retry: 1,
    staleTime: 30000,
  });

  const { data: spots = [] } = useQuery({
    queryKey: ['spots', trailId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/spots/`, { params: { trail: trailId } });
        return ((data?.results ?? data) || []) as Spot[];
      } catch {
        return [];
      }
    },
    enabled: !!trailId && !!trail,
    retry: 1,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', trailId],
    queryFn: async () => {
      const { data } = await api.get(`/reviews/trails/${trailId}/`);
      return (data?.results || data || []) as Review[];
    },
    enabled: !!trailId && !!trail,
    retry: 1,
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
      Alert.alert('\uC800\uC7A5 \uC644\uB8CC', '\uC624\uD504\uB77C\uC778\uC5D0\uC11C\uB3C4 \uC774 \uCF54\uC2A4\uB97C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
    } else {
      Alert.alert('\uC800\uC7A5 \uC2E4\uD328', '\uCF54\uC2A4\uB97C \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.');
    }
  };

  const handleShare = async () => {
    if (!trail) return;
    try {
      await Share.share({
        message: `${trail?.title || ''} - ${trail?.region || ''}\nRoami\uC5D0\uC11C \uD655\uC778\uD574\uBCF4\uC138\uC694!`,
      });
    } catch {}
  };

  // --- Error / Loading States ---

  if (!trailId) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>{'\u26A0\uFE0F'}</Text>
        <Text style={{ fontSize: 16, color: '#191F28', fontWeight: '600' }}>{'\uCF54\uC2A4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 12 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{'\uB3CC\uC544\uAC00\uAE30'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>{'\u26A0\uFE0F'}</Text>
        <Text style={{ fontSize: 16, color: '#191F28', fontWeight: '600' }}>{'\uCF54\uC2A4\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4'}</Text>
        <Text style={{ fontSize: 13, color: '#8B95A1', marginTop: 4 }}>{'\uB124\uD2B8\uC6CC\uD06C \uC5F0\uACB0\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 12 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{'\uB3CC\uC544\uAC00\uAE30'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading || !trail) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const diff = DIFFICULTY_CONFIG[trail.difficulty || 'easy'] || DIFFICULTY_CONFIG.easy;
  const safeReviews = reviews || [];
  const avgRating =
    safeReviews.length > 0
      ? (safeReviews.reduce((sum: number, r: Review) => sum + (r.rating || 0), 0) / safeReviews.length).toFixed(1)
      : null;

  const statsItems = [
    formatDistance(trail.distance_km),
    formatDuration(trail.estimated_minutes),
    diff.label,
    SEASON_LABELS[trail?.best_season || ''] || trail?.best_season || '',
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={true}>

        {/* ===== 1. Cover Image ===== */}
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

          {/* Gradient overlay */}
          <View style={styles.coverGradientTop} />
          <View style={styles.coverGradientBottom} />

          {/* Back button */}
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + 8 }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}>
            <Text style={styles.backIcon}>{'\u2190'}</Text>
          </TouchableOpacity>

          {/* Difficulty badge */}
          <View style={[styles.diffBadge, { top: insets.top + 8 }, { backgroundColor: diff.bg }]}>
            <Text style={[styles.diffText, { color: diff.text }]}>{diff.label}</Text>
          </View>

          {/* Title overlay at bottom */}
          <View style={styles.coverOverlay}>
            <Text style={styles.coverTitle} numberOfLines={2}>{trail?.title || ''}</Text>
            <Text style={styles.coverRegion}>
              {[trail?.region, trail?.country].filter(Boolean).join(', ')}
            </Text>
          </View>
        </View>

        {/* ===== 2. Quick Stats Line ===== */}
        <View style={styles.statsLine}>
          <Text style={styles.statsText}>
            {statsItems.join('  \u00B7  ')}
          </Text>
        </View>

        {/* ===== 3. Action Bar ===== */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionRow}
          bounces={false}>
          <TouchableOpacity
            style={[styles.actionBtn, trail.is_liked && styles.actionBtnLiked]}
            onPress={() => likeMutation.mutate()}
            activeOpacity={0.7}>
            <Text style={styles.actionBtnIcon}>{trail.is_liked ? '\u2764\uFE0F' : '\u{1F90D}'}</Text>
            <Text style={[styles.actionBtnText, trail.is_liked && styles.actionBtnTextLiked]}>
              {'\uC88B\uC544\uC694'} {trail.like_count ?? 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.7}>
            <Text style={styles.actionBtnIcon}>{'\u2197\uFE0F'}</Text>
            <Text style={styles.actionBtnText}>{'\uACF5\uC720'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, savedOffline && styles.actionBtnSaved]}
            onPress={handleSaveOffline}
            disabled={savingOffline}
            activeOpacity={0.7}>
            <Text style={styles.actionBtnIcon}>{savedOffline ? '\u2705' : '\u{1F4E5}'}</Text>
            <Text style={[styles.actionBtnText, savedOffline && styles.actionBtnTextSaved]}>
              {savingOffline ? '\uC800\uC7A5 \uC911...' : savedOffline ? '\uC800\uC7A5\uB428' : '\uC800\uC7A5'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => navigation.navigate('Walk', { trailId: trail.id, trail })}
            activeOpacity={0.7}>
            <Text style={styles.actionBtnIcon}>{'\u{1F6B6}'}</Text>
            <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>{'\uAC77\uAE30'}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ===== 4. Description ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{'\uC18C\uAC1C'}</Text>
          <Text style={styles.descText}>{trail?.description || ''}</Text>
          {(trail?.tags || []).length > 0 && (
            <View style={styles.tagsRow}>
              {(trail?.tags || []).map((tag) => (
                <View key={tag.id} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ===== 5. Map ===== */}
        <View style={styles.mapSection}>
          {trail?.start_lat ? (
            <SafeMapView
              lat={parseFloat(String(trail.start_lat))}
              lng={parseFloat(String(trail.start_lng))}
              endLat={trail.end_lat ? parseFloat(String(trail.end_lat)) : undefined}
              endLng={trail.end_lng ? parseFloat(String(trail.end_lng)) : undefined}
              pathCoordinates={trail.path_coordinates as [number, number][] | undefined}
              region={trail.region}
              country={trail.country}
              height={200}
            />
          ) : (
            <View style={styles.mapFallback}>
              <Text style={{ fontSize: 32 }}>{'\u{1F5FA}\uFE0F'}</Text>
              <Text style={{ color: '#8B95A1', fontSize: 13, marginTop: 6 }}>
                {trail?.region || ''} {trail?.country || ''}
              </Text>
            </View>
          )}
        </View>

        {/* ===== 6. Spots ===== */}
        {(spots || []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {'\uACBD\uC720\uC9C0'} <Text style={styles.sectionCount}>{spots.length}</Text>
            </Text>
            {(spots || []).map((spot, index) => (
              <View key={spot.id} style={styles.spotItem}>
                <View style={styles.spotDotColumn}>
                  <View style={styles.spotDot}>
                    <Text style={styles.spotDotIcon}>
                      {SPOT_ICONS[spot.spot_type] || '\u{1F4CD}'}
                    </Text>
                  </View>
                  {index < spots.length - 1 && <View style={styles.spotConnector} />}
                </View>
                <View style={styles.spotContent}>
                  <Text style={styles.spotName}>{spot?.name || ''}</Text>
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

        {/* ===== 7. Reviews ===== */}
        <View style={styles.section}>
          <View style={styles.reviewsHeader}>
            <View style={styles.reviewsTitleRow}>
              <Text style={styles.sectionTitle}>{'\uB9AC\uBDF0'}</Text>
              {avgRating && (
                <Text style={styles.ratingInline}>
                  {'\u2605'} {avgRating} ({safeReviews.length})
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.writeReviewBtn}
              onPress={() => setShowReviewForm(!showReviewForm)}
              activeOpacity={0.7}>
              <Text style={styles.writeReviewBtnText}>
                {showReviewForm ? '\uCDE8\uC18C' : '\uB9AC\uBDF0 \uC791\uC131'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Review Form (collapsible) */}
          {showReviewForm && (
            <View style={styles.reviewForm}>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setReviewForm((p) => ({ ...p, rating: star }))}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
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
              <TextInput
                style={styles.reviewInput}
                multiline
                numberOfLines={4}
                maxLength={1000}
                placeholder={'\uB9AC\uBDF0\uB97C \uC791\uC131\uD574\uC8FC\uC138\uC694'}
                placeholderTextColor="#B0B8C1"
                value={reviewForm.content}
                onChangeText={(text) => setReviewForm((p) => ({ ...p, content: text }))}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[
                  styles.reviewSubmitBtn,
                  (!reviewForm.content || createReview.isPending) && styles.reviewSubmitDisabled,
                ]}
                onPress={() => createReview.mutate(reviewForm)}
                disabled={!reviewForm.content || createReview.isPending}
                activeOpacity={0.7}>
                <Text style={styles.reviewSubmitText}>
                  {createReview.isPending ? '\uC81C\uCD9C \uC911...' : '\uC81C\uCD9C'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Review List */}
          {safeReviews.length === 0 && !showReviewForm && (
            <View style={styles.emptyReviews}>
              <Text style={styles.emptyReviewsText}>{'\uC544\uC9C1 \uB9AC\uBDF0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'}</Text>
              <Text style={styles.emptyReviewsSub}>{'\uCCAB \uBC88\uC9F8 \uB9AC\uBDF0\uB97C \uC791\uC131\uD574\uBCF4\uC138\uC694'}</Text>
            </View>
          )}
          {safeReviews.slice(0, 5).map((review: Review) => (
            <View key={review.id} style={styles.reviewItem}>
              <View style={styles.reviewTop}>
                <View style={styles.reviewAvatarSmall}>
                  {review.author?.profile_image ? (
                    <Image source={{ uri: review.author.profile_image }} style={styles.reviewAvatarImg} />
                  ) : (
                    <Text style={styles.reviewAvatarFallback}>{(review.author?.nickname || '?')[0]}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewAuthor}>{review.author?.nickname || ''}</Text>
                  <Text style={styles.reviewStars}>
                    {Array.from({ length: 5 }, (_, i) =>
                      i < review.rating ? '\u2605' : '\u2606'
                    ).join('')}
                    {review.visited_date ? (
                      '  ' + new Date(review.visited_date).toLocaleDateString('ko-KR')
                    ) : ''}
                  </Text>
                </View>
              </View>
              <Text style={styles.reviewContent} numberOfLines={4}>
                {review.content}
              </Text>
            </View>
          ))}
        </View>

        {/* ===== 8. Author ===== */}
        {trail.author && (
          <View style={styles.authorRow}>
            <View style={styles.authorAvatar}>
              {trail.author.profile_image ? (
                <Image source={{ uri: trail.author.profile_image }} style={styles.authorAvatarImg} />
              ) : (
                <Text style={styles.authorAvatarFallback}>
                  {(trail.author.nickname || '?')[0]}
                </Text>
              )}
            </View>
            <Text style={styles.authorName}>{trail.author.nickname || ''}</Text>
            {trail.author.is_guide && (
              <View style={styles.guideBadge}>
                <Text style={styles.guideBadgeText}>{'\uC778\uC99D \uAC00\uC774\uB4DC'}</Text>
              </View>
            )}
          </View>
        )}

        {/* Bottom spacing for tab bar */}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Cover ──────────────────────────────────────────────
  coverContainer: {
    height: 280,
    position: 'relative',
    backgroundColor: '#2D4A2E',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D4A2E',
  },
  coverEmoji: {
    fontSize: 72,
    opacity: 0.25,
  },
  coverGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  coverGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 140,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  backIcon: {
    fontSize: 18,
    color: '#191F28',
    marginTop: -1,
  },
  diffBadge: {
    position: 'absolute',
    left: 62,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    zIndex: 10,
  },
  diffText: {
    fontSize: 12,
    fontWeight: '700',
  },
  coverOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  coverTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  coverRegion: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },

  // ── Quick Stats ────────────────────────────────────────
  statsLine: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F6',
    backgroundColor: '#fff',
  },
  statsText: {
    fontSize: 14,
    color: '#8B95A1',
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  // ── Action Bar ─────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F6',
    backgroundColor: '#fff',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F7F8FA',
    gap: 6,
    minHeight: 40,
  },
  actionBtnLiked: {
    backgroundColor: '#FFF0F0',
  },
  actionBtnSaved: {
    backgroundColor: '#f0f7f0',
  },
  actionBtnPrimary: {
    backgroundColor: '#2D4A2E',
  },
  actionBtnIcon: {
    fontSize: 14,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8B95A1',
  },
  actionBtnTextLiked: {
    color: '#DC2626',
  },
  actionBtnTextSaved: {
    color: '#2D4A2E',
  },
  actionBtnTextPrimary: {
    color: '#fff',
  },

  // ── Sections ───────────────────────────────────────────
  section: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#191F28',
    marginBottom: 14,
  },
  sectionCount: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8B95A1',
  },

  // ── Description ────────────────────────────────────────
  descText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#191F28',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 16,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
  },
  tagText: {
    fontSize: 12,
    color: '#8B95A1',
  },

  // ── Map ────────────────────────────────────────────────
  mapSection: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F7F8FA',
  },
  mapFallback: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F8FA',
  },

  // ── Spots ──────────────────────────────────────────────
  spotItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  spotDotColumn: {
    width: 32,
    alignItems: 'center',
  },
  spotDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f7f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotDotIcon: {
    fontSize: 14,
  },
  spotConnector: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E8EB',
    marginVertical: 2,
  },
  spotContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 20,
  },
  spotName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#191F28',
  },
  spotDesc: {
    fontSize: 13,
    color: '#8B95A1',
    marginTop: 3,
    lineHeight: 19,
  },
  tipBox: {
    backgroundColor: '#f0f7f0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#2D4A2E',
    lineHeight: 18,
  },
  spotPhoto: {
    width: 80,
    height: 60,
    borderRadius: 8,
    marginRight: 6,
    marginTop: 8,
  },

  // ── Reviews ────────────────────────────────────────────
  reviewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  reviewsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingInline: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFB800',
    marginBottom: 12,
  },
  writeReviewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F7F8FA',
    borderRadius: 16,
    marginBottom: 12,
  },
  writeReviewBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B95A1',
  },
  emptyReviews: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyReviewsText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#B0B8C1',
  },
  emptyReviewsSub: {
    fontSize: 13,
    color: '#B0B8C1',
    marginTop: 4,
  },
  reviewForm: {
    backgroundColor: '#F7F8FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  starRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  starSelect: {
    fontSize: 28,
    color: '#E5E8EB',
  },
  starSelectFilled: {
    color: '#FBBF24',
  },
  reviewInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#191F28',
    minHeight: 100,
    marginBottom: 12,
  },
  reviewSubmitBtn: {
    backgroundColor: '#2D4A2E',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  reviewSubmitDisabled: {
    opacity: 0.4,
  },
  reviewSubmitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  reviewItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F6',
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  reviewAvatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  reviewAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  reviewAvatarFallback: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B95A1',
  },
  reviewAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#191F28',
  },
  reviewStars: {
    fontSize: 12,
    color: '#FFB800',
    marginTop: 1,
  },
  reviewContent: {
    fontSize: 14,
    color: '#191F28',
    lineHeight: 22,
  },

  // ── Author ─────────────────────────────────────────────
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F2F4F6',
    marginTop: 8,
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#d4f5e4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  authorAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  authorAvatarFallback: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D4A2E',
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#191F28',
  },
  guideBadge: {
    backgroundColor: 'rgba(45,74,46,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  guideBadgeText: {
    fontSize: 11,
    color: '#2D4A2E',
    fontWeight: '600',
  },
});
