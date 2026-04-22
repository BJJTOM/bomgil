import React, { useState, useEffect, useRef } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Modal,
  Animated,
  Vibration,
  Linking,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';

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
          <Feather name="alert-triangle" size={40} color="#B0B8C1" style={{ marginBottom: 12 }} />
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
import api from '../api/client';
import { colors } from '../theme/colors';
import { Trail, Spot, Review } from '../types';
import { saveTrailOffline, isSaved, getSavedTrail } from '../utils/offlineStorage';
import SafeMapView from '../components/SafeMapView';
import { ElevationProfile } from '../components/ElevationProfile';
import { TrailSegments } from '../components/TrailSegments';
import { TrailConditionBanner } from '../components/TrailConditionBanner';
import StampBook from '../components/StampBook';
import { useThemeStore } from '../stores/theme';
import { useAuthStore } from '../stores/auth';

const { width } = Dimensions.get('window');

const DIFFICULTY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  easy: { label: '\uC26C\uC6C0', bg: '#DCFCE7', text: '#15803D' },
  moderate: { label: '\uBCF4\uD1B5', bg: '#FEF3C7', text: '#B45309' },
  hard: { label: '\uC5B4\uB824\uC6C0', bg: '#FEE2E2', text: '#DC2626' },
};

const SEASON_LABELS: Record<string, string> = {
  spring: '\uBD04',
  summer: '\uC5EC\uB984',
  autumn: '\uAC00\uC744',
  winter: '\uACA8\uC6B8',
  all: '\uC0AC\uACC4\uC808',
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

const API_BASE = 'https://api.moruwalk.com';

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
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
  const scrollRef = useRef<ScrollView>(null);
  const trailId = route.params?.id ?? route.params?.trailId;
  const { isDark } = useThemeStore();
  const currentUser = useAuthStore((s) => s.user);

  const bg = isDark ? '#0a0a0a' : '#FAFAFA';
  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#191F28';
  const textSecColor = isDark ? 'rgba(255,255,255,0.7)' : '#8B95A1';
  const textTertColor = isDark ? 'rgba(255,255,255,0.6)' : '#B0B8C1';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#F2F4F6';
  const sectionBg = isDark ? '#1a1a1a' : '#F7F8FA';

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    content: '',
    visited_date: new Date().toISOString().split('T')[0],
  });
  const [reviewImages, setReviewImages] = useState<any[]>([]);
  const [savedOffline, setSavedOffline] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);
  const [showAllSpots, setShowAllSpots] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);

  const likeScale = useRef(new Animated.Value(1)).current;

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
    enabled: !!trailId,
    retry: 1,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', trailId],
    queryFn: async () => {
      const { data } = await api.get(`/reviews/trails/${trailId}/`);
      return (data?.results || data || []) as Review[];
    },
    enabled: !!trailId,
    retry: 1,
  });

  const { data: trailWalkers = [] } = useQuery({
    queryKey: ['trail-walkers', trailId],
    queryFn: async () => {
      const { data } = await api.get('/activities/', {
        params: { trail: trailId, page_size: 10 },
      });
      const activities = (data?.results ?? data) || [];
      const seen = new Set<number>();
      return activities
        .filter((a: any) => {
          if (!a.user || seen.has(a.user.id)) return false;
          seen.add(a.user.id);
          return true;
        })
        .map((a: any) => a.user);
    },
    enabled: !!trailId,
    retry: 1,
    staleTime: 60000,
  });

  const likeMutation = useMutation({
    mutationFn: async () => (await api.post(`/trails/${trailId}/like/`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trail', trailId] }),
  });

  const bookmarkMutation = useMutation({
    mutationFn: async () => (await api.post(`/trails/${trailId}/bookmark/`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trail', trailId] });
      queryClient.invalidateQueries({ queryKey: ['my-bookmarks'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => (await api.post(`/trails/${trailId}/complete/`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trail', trailId] });
      queryClient.invalidateQueries({ queryKey: ['my-completions'] });
    },
  });

  const pickReviewImages = () => {
    if (reviewImages.length >= 3) {
      Alert.alert('\uCD5C\uB300 3\uC7A5', '\uB9AC\uBDF0 \uC0AC\uC9C4\uC740 \uCD5C\uB300 3\uC7A5\uAE4C\uC9C0 \uCCA8\uBD80\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
      return;
    }
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.8, selectionLimit: 3 - reviewImages.length },
      (res) => {
        if (!res.didCancel && res.assets) {
          setReviewImages(prev => [...prev, ...res.assets!].slice(0, 3));
        }
      },
    );
  };

  const removeReviewImage = (idx: number) => {
    setReviewImages(prev => prev.filter((_, i) => i !== idx));
  };

  const createReview = useMutation({
    mutationFn: async (form: typeof reviewForm) => {
      const { data } = await api.post(`/reviews/trails/${trailId}/`, form);
      if (reviewImages.length > 0 && data?.id) {
        try {
          const formData = new FormData();
          reviewImages.forEach((img) => {
            formData.append('images', {
              uri: img.uri,
              type: img.type || 'image/jpeg',
              name: img.fileName || `review_${Date.now()}.jpg`,
            } as any);
          });
          await api.post(`/reviews/${data.id}/images/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (imgErr) {
          console.log('Review image upload failed:', imgErr);
        }
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', trailId] });
      setShowReviewForm(false);
      setReviewForm({ rating: 5, content: '', visited_date: new Date().toISOString().split('T')[0] });
      setReviewImages([]);
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
        message: `${trail?.title || ''} - ${trail?.region || ''}\nMoru\uC5D0\uC11C \uD655\uC778\uD574\uBCF4\uC138\uC694!`,
      });
    } catch {}
  };

  const handleLike = () => {
    Vibration.vibrate(10);
    Animated.spring(likeScale, {
      toValue: 1.3,
      friction: 3,
      useNativeDriver: true,
    }).start(() => {
      Animated.spring(likeScale, {
        toValue: 1.0,
        friction: 3,
        useNativeDriver: true,
      }).start();
    });
    likeMutation.mutate();
  };

  const openDirections = () => {
    if (!trail?.start_lat || !trail?.start_lng) return;
    const lat = parseFloat(String(trail.start_lat));
    const lng = parseFloat(String(trail.start_lng));
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url);
  };

  // --- Error / Loading States ---

  if (!trailId) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top, backgroundColor: bg }]}>
        <Feather name="alert-triangle" size={40} color={textTertColor} style={{ marginBottom: 12 }} />
        <Text style={{ fontSize: 16, color: textColor, fontWeight: '600' }}>{'코스를 찾을 수 없습니다'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 12 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{'돌아가기'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top, backgroundColor: bg }]}>
        <Feather name="alert-triangle" size={40} color={textTertColor} style={{ marginBottom: 12 }} />
        <Text style={{ fontSize: 16, color: textColor, fontWeight: '600' }}>{'코스를 불러올 수 없습니다'}</Text>
        <Text style={{ fontSize: 13, color: textTertColor, marginTop: 4 }}>{'네트워크 연결을 확인해주세요'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 12 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{'돌아가기'}</Text>
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

  return (
    <>
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        bounces={true}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
      >

        {/* ===== HERO IMAGE with action buttons overlay ===== */}
        <View style={styles.coverContainer}>
          {resolveImageUrl(trail.cover_image) || resolveImageUrl(trail.thumbnail_url) ? (
            <Image
              source={{ uri: (resolveImageUrl(trail.cover_image) || resolveImageUrl(trail.thumbnail_url))! }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Feather name="map" size={72} color="rgba(255,255,255,0.18)" />
            </View>
          )}

          {/* Status bar protection */}
          <View style={[styles.statusBarOverlay, { height: insets.top }]} />

          {/* Smooth gradient overlay */}
          <LinearGradient
            colors={['transparent', 'transparent', 'rgba(0,0,0,0.65)']}
            locations={[0, 0.25, 1]}
            style={styles.coverGradientBottom}
          />

          {/* Back button */}
          <TouchableOpacity
            style={[styles.heroBackBtn, { top: insets.top + 8 }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Change #3: Action buttons (Like/Save/Share) overlaid on hero image bottom-right */}
          <View style={styles.heroActionsRow}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <TouchableOpacity
                style={styles.heroActionBtn}
                onPress={handleLike}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Feather
                  name="heart"
                  size={20}
                  color={trail.is_liked ? '#FF4B4B' : '#fff'}
                />
                {(trail.like_count ?? 0) > 0 && (
                  <Text style={styles.heroActionCount}>{trail.like_count}</Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              style={styles.heroActionBtn}
              onPress={() => bookmarkMutation.mutate()}
              disabled={bookmarkMutation.isPending}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Feather
                name="bookmark"
                size={20}
                color={trail.is_bookmarked ? '#FFB800' : '#fff'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.heroActionBtn}
              onPress={handleShare}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Feather name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Title overlay at bottom-left */}
          <View style={styles.coverOverlay}>
            <Text
              style={[
                styles.coverTitle,
                (trail?.title || '').length > 20 && { fontSize: 22 },
              ]}
              numberOfLines={2}>
              {trail?.title || ''}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Feather name="map-pin" size={12} color="rgba(255,255,255,0.85)" />
              <Text style={styles.coverRegion}>
                {[trail?.region, trail?.country].filter(Boolean).join(', ')}
              </Text>
            </View>
          </View>
        </View>

        {/* ===== STATS ROW — Change #2: text labels instead of icons ===== */}
        <View style={[styles.statsRow, { backgroundColor: cardBg }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: textTertColor }]}>{'\uAC70\uB9AC'}</Text>
            <Text style={[styles.statValue, { color: textColor }]}>
              {formatDistance(trail.distance_km)}
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: textTertColor }]}>{'\uC2DC\uAC04'}</Text>
            <Text style={[styles.statValue, { color: textColor }]}>
              {formatDuration(trail.estimated_minutes)}
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: textTertColor }]}>{'\uB09C\uC774\uB3C4'}</Text>
            <Text style={[styles.statValue, { color: diff.text }]}>
              {diff.label}
            </Text>
          </View>
          {trail.elevation_gain != null && trail.elevation_gain > 0 && (
            <>
              <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: textTertColor }]}>{'\uACE0\uB3C4'}</Text>
                <Text style={[styles.statValue, { color: textColor }]}>
                  +{Math.round(trail.elevation_gain)}m
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Series-membership chips */}
        {Array.isArray((trail as any).series) && (trail as any).series.length > 0 && (
          <View style={styles.seriesRow}>
            {(trail as any).series.slice(0, 3).map((sm: any) => (
              <TouchableOpacity
                key={`sm-${sm.id || sm.slug}`}
                style={[styles.seriesChip, { backgroundColor: isDark ? 'rgba(45,74,46,0.2)' : '#F0F7F0' }]}
                activeOpacity={0.85}
                onPress={() => {
                  if (sm.slug) navigation.navigate('TrailSeriesDetail', { slug: sm.slug });
                }}>
                <Feather name="flag" size={11} color={colors.primary} />
                <Text style={[styles.seriesChipText, { color: colors.primary }]} numberOfLines={1}>
                  {sm.title || sm.slug}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ===== CONDITION BANNER ===== */}
        <TrailConditionBanner
          condition={(() => {
            const lc = (trail as any).latest_condition;
            if (!lc) return null;
            const tags: string[] = Array.isArray(lc.tags)
              ? lc.tags
              : lc.tag
                ? [lc.tag]
                : [];
            return {
              tags,
              note: lc.note || '',
              image: lc.image || null,
              reporter_nickname: lc.user?.nickname || lc.reporter_nickname || '',
              created_at: lc.created_at,
              helpful_count: lc.helpful_count ?? 0,
            };
          })()}
        />

        {/* ===== CERTIFICATE + EDIT (inline) ===== */}
        {(trail.is_completed || (currentUser && trail.author?.id === currentUser.id)) && (
          <View style={[styles.inlineActionsCard, { backgroundColor: cardBg }]}>
            {trail.is_completed && (
              <View style={styles.completionBadgeRow}>
                <View style={styles.completionBadge}>
                  <Feather name="award" size={14} color="#fff" />
                  <Text style={styles.completionBadgeText}>{'\uC644\uC8FC\uD55C \uCF54\uC2A4'}</Text>
                </View>
              </View>
            )}
            <View style={styles.trailActionBtnsRow}>
              {trail.is_completed && (
                <TouchableOpacity
                  style={[styles.trailActionBtn, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#2D4A2E' }]}
                  onPress={() => navigation.navigate('Certificate', { trailId: trail.id })}
                  activeOpacity={0.7}>
                  <Feather name="award" size={16} color={colors.primary} />
                  <Text style={[styles.trailActionBtnText, { color: isDark ? '#4ADE80' : '#2D4A2E' }]}>{'\uC778\uC99D\uC11C \uBCF4\uAE30'}</Text>
                </TouchableOpacity>
              )}
              {currentUser && trail.author?.id === currentUser.id && (
                <TouchableOpacity
                  style={[styles.trailActionBtn, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#2D4A2E' }]}
                  onPress={() => navigation.navigate('TrailEdit', { trailId: trail.id })}
                  activeOpacity={0.7}>
                  <Feather name="edit-2" size={16} color={colors.primary} />
                  <Text style={[styles.trailActionBtnText, { color: isDark ? '#4ADE80' : '#2D4A2E' }]}>{'\uC218\uC815'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ===== DESCRIPTION — Change #1: no "소개" title, directly after stats ===== */}
        <View style={[styles.contentBlock, { paddingHorizontal: 20 }]}>
          <Text style={[styles.descText, { color: textColor }]}>{trail?.description || ''}</Text>
          {(trail?.tags || []).length > 0 && (
            <View style={styles.tagsRow}>
              {(trail?.tags || []).map((tag) => (
                <View key={tag.id} style={[styles.tag, { backgroundColor: sectionBg }]}>
                  <Text style={[styles.tagText, { color: textSecColor }]}>#{tag.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ===== SEASON TAG (inline, compact) ===== */}
        {trail.best_season && trail.best_season !== 'all' && (
          <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="sun" size={13} color={textTertColor} />
              <Text style={{ fontSize: 13, color: textSecColor }}>
                {SEASON_LABELS[trail.best_season] || trail.best_season} 추천
              </Text>
            </View>
          </View>
        )}

        {/* ===== MAP — compact ===== */}
        <TouchableOpacity
          style={[styles.mapSection, { backgroundColor: sectionBg }]}
          activeOpacity={0.95}
          onPress={() => navigation.navigate('MapDetail', {
            pathCoordinates: trail.path_data?.coordinates || [],
            startLat: parseFloat(String(trail.start_lat)),
            startLng: parseFloat(String(trail.start_lng)),
            endLat: trail.end_lat ? parseFloat(String(trail.end_lat)) : undefined,
            endLng: trail.end_lng ? parseFloat(String(trail.end_lng)) : undefined,
            spots: (spots || []).map((s: Spot) => ({ lat: parseFloat(String(s.lat)), lng: parseFloat(String(s.lng)), name: s.name, type: s.spot_type })),
            title: trail.title,
            distance: trail.distance_km ? parseFloat(trail.distance_km) : undefined,
            duration: trail.estimated_minutes,
          })}>
          {trail?.start_lat ? (
            <SafeMapView
              lat={parseFloat(String(trail.start_lat))}
              lng={parseFloat(String(trail.start_lng))}
              endLat={trail.end_lat ? parseFloat(String(trail.end_lat)) : undefined}
              endLng={trail.end_lng ? parseFloat(String(trail.end_lng)) : undefined}
              pathCoordinates={trail.path_data?.coordinates as [number, number][] | undefined}
              region={trail.region}
              country={trail.country}
              height={200}
              theme="dark"
              spots={(spots || []).map((s: Spot) => ({ lat: parseFloat(String(s.lat)), lng: parseFloat(String(s.lng)), name: s.name, type: s.spot_type }))}
            />
          ) : (
            <View style={[styles.mapFallback, { backgroundColor: sectionBg }]}>
              <Feather name="map" size={32} color={textTertColor} />
              <Text style={{ color: textTertColor, fontSize: 13, marginTop: 6 }}>
                {trail?.region || ''} {trail?.country || ''}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ===== ELEVATION PROFILE ===== */}
        {trail.path_data?.coordinates && (
          <ElevationProfile
            coordinates={trail.path_data.coordinates as any}
            isDark={isDark}
          />
        )}

        {/* ===== TRAIL SEGMENTS ===== */}
        <TrailSegments segments={(trail as any).segments} />

        {/* ===== SPOTS — Change #5: unified dot icon, optional thumbnail ===== */}
        {(spots || []).length > 0 && (
          <View style={[styles.contentBlock, { paddingHorizontal: 20 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Text style={[styles.spotCountBadge, { color: textSecColor, backgroundColor: sectionBg }]}>
                {spots.length}
              </Text>
            </View>
            {(showAllSpots ? spots : (spots || []).slice(0, 3)).map((spot, index) => {
              const spotImgUrl = spot.images && spot.images.length > 0 ? spot.images[0].image : null;
              return (
                <View key={spot.id} style={styles.spotItem}>
                  <View style={styles.spotDotColumn}>
                    <View style={[styles.spotDot, { backgroundColor: sectionBg }]}>
                      <View style={[styles.spotDotInner, {
                        backgroundColor: index === 0 ? '#15803D' : index === spots.length - 1 ? '#DC2626' : colors.primary,
                      }]} />
                    </View>
                    {index < (showAllSpots ? spots.length : Math.min(spots.length, 3)) - 1 && (
                      <View style={[styles.spotConnector, { backgroundColor: borderColor }]} />
                    )}
                  </View>
                  <View style={styles.spotContent}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      {spotImgUrl && (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            setViewerImages(spot.images.map((i: any) => i.image));
                            setViewerIndex(0);
                            setViewerVisible(true);
                          }}>
                          <Image
                            source={{ uri: spotImgUrl }}
                            style={styles.spotThumb}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.spotName, { color: textColor }]}>{spot?.name || ''}</Text>
                        {spot.description ? (
                          <Text style={[styles.spotDesc, { color: textSecColor }]} numberOfLines={2}>
                            {spot.description}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {spot.tip ? (
                      <View style={[styles.tipBox, { backgroundColor: sectionBg }]}>
                        <Text style={[styles.tipText, { color: isDark ? '#4ADE80' : '#2D4A2E' }]}>{spot.tip}</Text>
                      </View>
                    ) : null}
                    {spot.images && spot.images.length > 1 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                        {spot.images.slice(1).map((img: any, imgIdx: number) => (
                          <TouchableOpacity
                            key={img.id}
                            activeOpacity={0.8}
                            onPress={() => {
                              setViewerImages(spot.images.map((i: any) => i.image));
                              setViewerIndex(imgIdx + 1);
                              setViewerVisible(true);
                            }}>
                            <Image
                              source={{ uri: img.image }}
                              style={styles.spotPhoto}
                              resizeMode="cover"
                            />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                </View>
              );
            })}
            {(spots || []).length > 3 && !showAllSpots && (
              <TouchableOpacity
                style={styles.showMoreBtn}
                onPress={() => setShowAllSpots(true)}>
                <Text style={[styles.showMoreText, { color: isDark ? '#4ADE80' : '#2D4A2E' }]}>
                  +{(spots || []).length - 3}{'\uAC1C \uB354\uBCF4\uAE30'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ===== STAMP COLLECTION ===== */}
        <StampBook trailId={trail.id} />

        {/* ===== REVIEWS ===== */}
        <View style={[styles.contentBlock, { paddingHorizontal: 20 }]}>
          <View style={styles.reviewsHeader}>
            <View style={styles.reviewsTitleRow}>
              <Text style={[styles.sectionTitle, { color: textColor, marginBottom: 0 }]}>{'\uB9AC\uBDF0'}</Text>
              {avgRating && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 }}>
                  <Feather name="star" size={14} color="#FFB800" />
                  <Text style={styles.ratingInline}>
                    {avgRating} ({safeReviews.length})
                  </Text>
                </View>
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
            <View style={[styles.reviewForm, { backgroundColor: sectionBg }]}>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setReviewForm((p) => ({ ...p, rating: star }))}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                    <Feather
                      name="star"
                      size={28}
                      color={star <= reviewForm.rating ? '#FBBF24' : '#E5E8EB'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.reviewInput, { backgroundColor: isDark ? '#2a2a2a' : '#fff', color: textColor }]}
                multiline
                numberOfLines={4}
                maxLength={1000}
                placeholder={'\uB9AC\uBDF0\uB97C \uC791\uC131\uD574\uC8FC\uC138\uC694'}
                placeholderTextColor={textTertColor}
                value={reviewForm.content}
                onChangeText={(text) => setReviewForm((p) => ({ ...p, content: text }))}
                textAlignVertical="top"
                onFocus={() => {
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
                }}
              />
              {/* Review Image Picker */}
              <View style={styles.reviewImageSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {reviewImages.map((img, idx) => (
                    <View key={`${img.uri}-${idx}`} style={styles.reviewImageThumbWrap}>
                      <Image source={{ uri: img.uri }} style={styles.reviewImageThumb} resizeMode="cover" />
                      <TouchableOpacity
                        style={styles.reviewImageRemove}
                        onPress={() => removeReviewImage(idx)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Feather name="x" size={11} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {reviewImages.length < 3 && (
                    <TouchableOpacity style={[styles.reviewImageAddBtn, { borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB' }]} onPress={pickReviewImages} activeOpacity={0.7}>
                      <Feather name="camera" size={20} color={textSecColor} />
                      <Text style={[styles.reviewImageAddText, { color: textSecColor }]}>{reviewImages.length}/3</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>

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
              <Feather name="message-circle" size={24} color={textTertColor} style={{ marginBottom: 6 }} />
              <Text style={[styles.emptyReviewsText, { color: textSecColor }]}>{'\uC544\uC9C1 \uB9AC\uBDF0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'}</Text>
              <Text style={[styles.emptyReviewsSub, { color: textTertColor }]}>{'\uCCAB \uBC88\uC9F8 \uB9AC\uBDF0\uB97C \uC791\uC131\uD574\uBCF4\uC138\uC694'}</Text>
            </View>
          )}
          {safeReviews.slice(0, 5).map((review: Review) => (
            <View key={review.id} style={[styles.reviewItem, { borderBottomColor: borderColor }]}>
              <View style={styles.reviewTop}>
                <View style={[styles.reviewAvatarSmall, { backgroundColor: sectionBg }]}>
                  {review.author?.profile_image ? (
                    <Image source={{ uri: review.author.profile_image }} style={styles.reviewAvatarImg} />
                  ) : (
                    <Text style={[styles.reviewAvatarFallback, { color: textSecColor }]}>{(review.author?.nickname || '?')[0]}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reviewAuthor, { color: textColor }]}>{review.author?.nickname || ''}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Feather
                        key={i}
                        name="star"
                        size={12}
                        color={i < review.rating ? '#FFB800' : '#E5E8EB'}
                      />
                    ))}
                    {review.visited_date && (
                      <Text style={[styles.reviewDate, { color: textTertColor }]}>
                        {'  '}{new Date(review.visited_date).toLocaleDateString('ko-KR')}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
              <Text style={[styles.reviewContent, { color: textColor }]} numberOfLines={4}>
                {review.content}
              </Text>
              {review.images && review.images.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                  {review.images.map((img, imgIdx) => (
                    <TouchableOpacity
                      key={img.id}
                      activeOpacity={0.8}
                      onPress={() => {
                        setViewerImages(review.images.map((i) => i.image));
                        setViewerIndex(imgIdx);
                        setViewerVisible(true);
                      }}>
                      <Image
                        source={{ uri: img.image }}
                        style={styles.reviewPhoto}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          ))}
        </View>

        {/* ===== AUTHOR ===== */}
        {trail.author && (
          <View style={[styles.contentBlock, { paddingHorizontal: 20 }]}>
            <TouchableOpacity
              style={[styles.authorCard, { backgroundColor: sectionBg }]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Profile', { nickname: trail.author.nickname })}>
              <View style={styles.authorAvatar}>
                {trail.author.profile_image ? (
                  <Image source={{ uri: trail.author.profile_image }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                ) : (
                  <Feather name="user" size={18} color={textSecColor} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.authorName, { color: textColor }]}>{trail.author.nickname}</Text>
                  {trail.author.is_guide && (
                    <View style={[styles.guideBadge, { backgroundColor: isDark ? 'rgba(74,222,128,0.1)' : 'rgba(45,74,46,0.08)' }]}>
                      <Text style={[styles.guideBadgeText, { color: isDark ? '#4ADE80' : '#2D4A2E' }]}>{'\uC778\uC99D \uAC00\uC774\uB4DC'}</Text>
                    </View>
                  )}
                </View>
                {trail.author.bio ? <Text style={[styles.authorBio, { color: textTertColor }]} numberOfLines={1}>{trail.author.bio}</Text> : null}
              </View>
              <Feather name="chevron-right" size={16} color={textTertColor} />
            </TouchableOpacity>
          </View>
        )}

        {/* ===== WALKERS ===== */}
        {trailWalkers.length > 0 && (
          <View style={[styles.contentBlock, { paddingHorizontal: 20 }]}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              {'\uC774 \uCF54\uC2A4\uB97C \uAC78\uC740 \uC0AC\uB78C'}{' '}
              <Text style={[styles.sectionCount, { color: textSecColor }]}>{trailWalkers.length}</Text>
            </Text>
            <View style={styles.walkersRow}>
              {trailWalkers.slice(0, 5).map((walker: any, index: number) => (
                <TouchableOpacity
                  key={walker.id}
                  style={[styles.walkerItem, index > 0 && { marginLeft: -8 }]}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('Profile', { nickname: walker.nickname })}>
                  <View style={[styles.walkerAvatar, { borderColor: cardBg }]}>
                    {walker.profile_image ? (
                      <Image source={{ uri: walker.profile_image }} style={styles.walkerAvatarImg} />
                    ) : (
                      <Text style={[styles.walkerAvatarFallback, { color: textSecColor }]}>
                        {(walker.nickname || '?')[0]}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
              {trailWalkers.length > 5 && (
                <View style={[styles.walkerItem, { marginLeft: -8 }]}>
                  <View style={[styles.walkerMoreBadge, { borderColor: cardBg }]}>
                    <Text style={styles.walkerMoreText}>+{trailWalkers.length - 5}</Text>
                  </View>
                </View>
              )}
            </View>
            <View style={styles.walkerNamesRow}>
              {trailWalkers.slice(0, 5).map((walker: any) => (
                <TouchableOpacity
                  key={walker.id}
                  onPress={() => navigation.navigate('Profile', { nickname: walker.nickname })}>
                  <Text style={[styles.walkerName, { color: isDark ? '#4ADE80' : '#2D4A2E', backgroundColor: isDark ? 'rgba(74,222,128,0.1)' : 'rgba(45,74,46,0.06)' }]}>{walker.nickname}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ===== OFFLINE SAVE BUTTON (secondary) ===== */}
        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <TouchableOpacity
            style={[styles.offlineSaveBtn, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : borderColor }]}
            onPress={handleSaveOffline}
            disabled={savingOffline}
            activeOpacity={0.7}>
            <Feather
              name={savedOffline ? 'check-circle' : 'download'}
              size={16}
              color={savedOffline ? colors.primary : textSecColor}
            />
            <Text style={[styles.offlineSaveBtnText, { color: savedOffline ? colors.primary : textSecColor }]}>
              {savedOffline ? '\uC624\uD504\uB77C\uC778 \uC800\uC7A5\uB428' : '\uC624\uD504\uB77C\uC778\uC73C\uB85C \uC800\uC7A5'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ===== CTA BUTTON — Change #6: in scroll flow, not fixed ===== */}
        <View style={{ paddingHorizontal: 20, marginTop: 16, marginBottom: 20 }}>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => navigation.navigate('Walk', { trailId: trail.id, trail })}
            activeOpacity={0.88}>
            <Text style={styles.ctaBtnText}>
              {trail.is_completed ? '\uB2E4\uC2DC \uAC77\uAE30' : '\uC774 \uCF54\uC2A4\uB85C \uAC77\uAE30 \uC2DC\uC791'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>

      {/* Fullscreen Image Viewer */}
      <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.viewerOverlay}>
          <StatusBar backgroundColor="#000" barStyle="light-content" />
          <TouchableOpacity style={styles.viewerCloseBtn} onPress={() => setViewerVisible(false)}>
            <Feather name="x" size={18} color="#fff" />
          </TouchableOpacity>
          {viewerImages.length > 1 && (
            <Text style={styles.viewerCounter}>{viewerIndex + 1} / {viewerImages.length}</Text>
          )}
          <FlatList
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            data={viewerImages}
            keyExtractor={(_, i) => String(i)}
            initialScrollIndex={viewerIndex}
            getItemLayout={(_, i) => ({ length: Dimensions.get('window').width, offset: Dimensions.get('window').width * i, index: i })}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / Dimensions.get('window').width);
              setViewerIndex(idx);
            }}
            renderItem={({ item }) => (
              <View style={{ width: Dimensions.get('window').width, justifyContent: 'center', alignItems: 'center' }}>
                <Image
                  source={{ uri: item }}
                  style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.7 }}
                  resizeMode="contain"
                />
              </View>
            )}
          />
        </View>
      </Modal>
    </>
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

  // -- Hero Cover ---------------------------------------------------
  coverContainer: {
    height: 250,
    position: 'relative',
    backgroundColor: '#2D4A2E',
    overflow: 'hidden',
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
  statusBarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 5,
  },
  coverGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  heroBackBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Change #3: action buttons overlaid on hero image
  heroActionsRow: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 22,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 3,
  },
  heroActionCount: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
  },
  coverOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 100,
    zIndex: 6,
  },
  coverTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.4,
    lineHeight: 28,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  coverRegion: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // -- Stats row (Change #2: text labels, not icons) -----------------
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
  },

  // -- Series chips --------------------------------------------------
  seriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  seriesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  seriesChipText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // -- Inline actions (Certificate / Edit) ----------------------------
  inlineActionsCard: {
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 14,
    padding: 14,
  },
  completionBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  completionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15803D',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
  },
  completionBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  trailActionBtnsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  trailActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D4A2E',
    backgroundColor: 'rgba(45,74,46,0.06)',
  },
  trailActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D4A2E',
  },

  // -- Content blocks (replaces sectionCard for tighter layout) -------
  contentBlock: {
    marginTop: 16,
  },

  // -- Section titles (only used where needed) ------------------------
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#191F28',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8B95A1',
  },

  // -- Description ----------------------------------------------------
  descText: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 26,
    letterSpacing: -0.2,
    color: '#191F28',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#F7F8FA',
  },
  tagText: {
    fontSize: 11,
    color: '#8B95A1',
  },

  // -- Map ------------------------------------------------------------
  mapSection: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F7F8FA',
  },
  mapFallback: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F8FA',
  },

  // -- Spots ----------------------------------------------------------
  spotItem: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  spotDotColumn: {
    width: 28,
    alignItems: 'center',
  },
  spotDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  spotConnector: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E8EB',
    marginVertical: 2,
  },
  spotContent: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: 14,
  },
  spotThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  spotCountBadge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  spotName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#191F28',
  },
  spotDesc: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8B95A1',
    marginTop: 2,
    lineHeight: 18,
  },
  tipBox: {
    backgroundColor: '#F7F8FA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 6,
  },
  tipText: {
    fontSize: 12,
    color: '#2D4A2E',
    lineHeight: 17,
  },
  spotPhoto: {
    width: 72,
    height: 54,
    borderRadius: 10,
    marginRight: 6,
  },

  // -- Show More Spots ------------------------------------------------
  showMoreBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 2,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D4A2E',
  },

  // -- Reviews --------------------------------------------------------
  reviewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  reviewsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingInline: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFB800',
  },
  writeReviewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  writeReviewBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyReviews: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyReviewsText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#B0B8C1',
  },
  emptyReviewsSub: {
    fontSize: 11,
    color: '#B0B8C1',
    marginTop: 3,
  },
  reviewForm: {
    backgroundColor: '#F7F8FA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    marginTop: 8,
  },
  starRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  reviewInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#191F28',
    minHeight: 90,
    marginBottom: 10,
  },
  reviewSubmitBtn: {
    backgroundColor: '#2D4A2E',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F6',
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  reviewAvatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  reviewAvatarImg: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  reviewAvatarFallback: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B95A1',
  },
  reviewAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#191F28',
  },
  reviewDate: {
    fontSize: 11,
    marginLeft: 4,
  },
  reviewContent: {
    fontSize: 14,
    fontWeight: '400',
    color: '#191F28',
    lineHeight: 22,
  },
  reviewPhoto: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 6,
  },
  reviewImageSection: {
    marginTop: 8,
    marginBottom: 4,
  },
  reviewImageThumbWrap: {
    position: 'relative',
    marginRight: 8,
  },
  reviewImageThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  reviewImageRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewImageAddBtn: {
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  reviewImageAddText: {
    fontSize: 10,
    color: '#8B95A1',
  },

  // -- Author ---------------------------------------------------------
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  authorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#191F28',
  },
  authorBio: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  guideBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  guideBadgeText: {
    fontSize: 10,
    color: '#2D4A2E',
    fontWeight: '600',
  },

  // -- Additional info ------------------------------------------------
  infoCard: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
  },

  // -- Transport ------------------------------------------------------
  transportBox: {
    marginTop: 12,
    backgroundColor: '#F0F7F0',
    borderRadius: 12,
    padding: 14,
  },
  transportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  transportLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  transportText: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textPrimary,
    lineHeight: 20,
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(45,74,46,0.08)',
  },
  directionsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },

  // -- Offline save button --------------------------------------------
  offlineSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  offlineSaveBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // -- CTA button (Change #6: in-flow, not fixed) --------------------
  ctaBtn: {
    backgroundColor: '#2D4A2E',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },

  // -- Image viewer ---------------------------------------------------
  viewerOverlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  viewerCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCounter: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    zIndex: 10,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },

  // -- Trail Walkers --------------------------------------------------
  walkersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  walkerItem: {
    zIndex: 1,
  },
  walkerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  walkerAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  walkerAvatarFallback: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B95A1',
  },
  walkerMoreBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E8EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  walkerMoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B95A1',
  },
  walkerNamesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  walkerName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#2D4A2E',
    backgroundColor: 'rgba(45,74,46,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
