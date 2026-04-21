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

// --- Requirement #3: Difficulty wording standardized ---
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

// --- Requirement #1: SPOT_ICONS now use Feather icon names instead of emojis ---
const SPOT_ICONS: Record<string, string> = {
  start: 'play-circle',
  restaurant: 'coffee',
  cafe: 'coffee',
  photo: 'camera',
  rest: 'pause-circle',
  view: 'eye',
  danger: 'alert-triangle',
  end: 'flag',
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
  // --- Requirement #12: Dark mode contrast upgraded to minimum 0.7 for WCAG AA ---
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

  // --- Requirement #11: Like button micro-interaction ---
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

  // --- Requirement #11: Like button animation handler ---
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

  // --- Requirement #9: Transport map deep link ---
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
        contentContainerStyle={{ paddingBottom: 110 }}
      >

        {/* ===== 1. Cover Image ===== */}
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

          {/* --- Requirement #4: Smooth gradient overlay --- */}
          <LinearGradient
            colors={['transparent', 'transparent', 'rgba(0,0,0,0.6)']}
            locations={[0, 0.3, 1]}
            style={styles.coverGradientBottom}
          />

          {/* Title overlay at bottom */}
          <View style={styles.coverOverlay}>
            <Text style={styles.coverTitle} numberOfLines={2}>{trail?.title || ''}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="map-pin" size={12} color="rgba(255,255,255,0.85)" />
              <Text style={styles.coverRegion}>
                {[trail?.region, trail?.country].filter(Boolean).join(', ')}
              </Text>
            </View>
          </View>
        </View>

        {/* ===== 2. Hero Stats Card =====
            --- Requirement #2: Unified stat items with vertical dividers --- */}
        <View style={[styles.heroStatsCard, { backgroundColor: cardBg }]}>
          <View style={styles.heroStatsCol}>
            <Feather name="map" size={16} color={colors.primary} />
            <Text style={[styles.heroStatValue, { color: textColor }]}>
              {formatDistance(trail.distance_km)}
            </Text>
          </View>
          <View style={[styles.heroStatsDivider, { backgroundColor: borderColor }]} />
          <View style={styles.heroStatsCol}>
            <Feather name="clock" size={16} color={colors.primary} />
            <Text style={[styles.heroStatValue, { color: textColor }]}>
              {formatDuration(trail.estimated_minutes)}
            </Text>
          </View>
          <View style={[styles.heroStatsDivider, { backgroundColor: borderColor }]} />
          <View style={styles.heroStatsCol}>
            <Feather name="trending-up" size={16} color={diff.text} />
            <Text style={[styles.heroStatValue, { color: diff.text }]}>
              {diff.label}
            </Text>
          </View>
          {trail.elevation_gain != null && trail.elevation_gain > 0 && (
            <>
              <View style={[styles.heroStatsDivider, { backgroundColor: borderColor }]} />
              <View style={styles.heroStatsCol}>
                <Feather name="triangle" size={16} color="#FF6B35" />
                <Text style={[styles.heroStatValue, { color: textColor }]}>
                  +{Math.round(trail.elevation_gain)}m
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Series-membership chip */}
        {Array.isArray((trail as any).series) && (trail as any).series.length > 0 && (
          <View style={styles.seriesMembershipRow}>
            {(trail as any).series.slice(0, 3).map((sm: any) => (
              <TouchableOpacity
                key={`sm-${sm.id || sm.slug}`}
                style={[styles.seriesMembershipChip, { backgroundColor: isDark ? 'rgba(45,74,46,0.2)' : '#F0F7F0' }]}
                activeOpacity={0.85}
                onPress={() => {
                  if (sm.slug) navigation.navigate('TrailSeriesDetail', { slug: sm.slug });
                }}>
                <Feather name="flag" size={11} color={colors.primary} />
                <Text style={[styles.seriesMembershipText, { color: colors.primary }]} numberOfLines={1}>
                  {sm.title || sm.slug}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ===== 3. Condition Banner ===== */}
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

        {/* ===== 3b. Certificate + Edit — inline, not in action bar (Requirement #5) ===== */}
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

        {/* ===== 4. Description — wrapped in card (Requirement #7) ===== */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>{'\uC18C\uAC1C'}</Text>
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

        {/* ===== 4b. Additional Info — wrapped in card (Requirement #7) ===== */}
        {(() => {
          const tt = (trail as any).trail_type;
          const ws = (trail as any).walking_surface;
          const ta = (trail as any).transport_access;
          const hasAny = trail.best_season || tt || ws || ta;
          if (!hasAny) return null;

          const rows: { label: string; value: string }[] = [];
          if (trail.best_season) {
            rows.push({
              label: '\uCD94\uCC9C \uACC4\uC808',
              value: SEASON_LABELS[trail.best_season] || trail.best_season,
            });
          }
          if (tt) {
            rows.push({
              label: '\uCF54\uC2A4 \uC720\uD615',
              value: tt === 'one_way' ? '\uD3B8\uB3C4' : tt === 'round_trip' ? '\uC655\uBCF5' : '\uC21C\uD658',
            });
          }
          if (ws) {
            rows.push({
              label: '\uB178\uBA74',
              value: ws === 'paved' ? '\uD3EC\uC7A5' : ws === 'unpaved' ? '\uBE44\uD3EC\uC7A5' : '\uD63C\uD569',
            });
          }

          return (
            <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>{'\uCD94\uAC00 \uC815\uBCF4'}</Text>
              <View style={[styles.infoCard, { backgroundColor: sectionBg }]}>
                {rows.map((r, idx) => (
                  <View
                    key={r.label}
                    style={[
                      styles.infoRow,
                      idx < rows.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: borderColor,
                      },
                    ]}>
                    <Text style={[styles.infoLabel, { color: textTertColor }]}>{r.label}</Text>
                    <Text style={[styles.infoValue, { color: textColor }]}>{r.value}</Text>
                  </View>
                ))}
              </View>
              {/* --- Requirement #9: Transport with map deep link --- */}
              {ta && (
                <View style={[styles.transportBox, isDark && { backgroundColor: 'rgba(45,74,46,0.2)' }]}>
                  <View style={styles.transportHeader}>
                    <Feather name="navigation" size={14} color={colors.primary} />
                    <Text style={styles.transportLabel}>{'\uAD50\uD1B5\uD3B8 \uC548\uB0B4'}</Text>
                  </View>
                  <Text style={[styles.transportText, { color: textColor }]}>{ta}</Text>
                  <TouchableOpacity
                    style={styles.directionsBtn}
                    onPress={openDirections}
                    activeOpacity={0.7}>
                    <Feather name="external-link" size={14} color={colors.primary} />
                    <Text style={styles.directionsBtnText}>{'\uAE38\uCC3E\uAE30'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })()}

        {/* ===== 4b+ Elevation Profile ===== */}
        {trail.path_data?.coordinates && (
          <ElevationProfile
            coordinates={trail.path_data.coordinates as any}
            isDark={isDark}
          />
        )}

        {/* ===== 4c. Author — wrapped in card (Requirement #7) ===== */}
        {trail.author && (
          <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>{'\uC791\uC131\uC790'}</Text>
            <TouchableOpacity
              style={[styles.authorCard, { backgroundColor: sectionBg }]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Profile', { nickname: trail.author.nickname })}>
              <View style={styles.authorAvatar}>
                {trail.author.profile_image ? (
                  <Image source={{ uri: trail.author.profile_image }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                ) : (
                  <Feather name="user" size={20} color={textSecColor} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.authorName, { color: textColor }]}>{trail.author.nickname}</Text>
                {trail.author.bio ? <Text style={[styles.authorBio, { color: textTertColor }]} numberOfLines={1}>{trail.author.bio}</Text> : null}
              </View>
              <Feather name="chevron-right" size={18} color={textTertColor} />
            </TouchableOpacity>
          </View>
        )}

        {/* ===== 5. Map ===== */}
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
              height={260}
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

        {/* ===== 5b. Trail Segments ===== */}
        <TrailSegments segments={(trail as any).segments} />

        {/* ===== 6. Spots — wrapped in card (Requirement #7) ===== */}
        {(spots || []).length > 0 && (
          <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              {'\uACBD\uC720\uC9C0'} <Text style={[styles.sectionCount, { color: textSecColor }]}>{spots.length}</Text>
            </Text>
            {(showAllSpots ? spots : (spots || []).slice(0, 3)).map((spot, index) => (
              <View key={spot.id} style={styles.spotItem}>
                <View style={styles.spotDotColumn}>
                  <View style={[styles.spotDot, { backgroundColor: sectionBg }]}>
                    <Feather
                      name={SPOT_ICONS[spot.spot_type] || 'map-pin'}
                      size={14}
                      color={spot.spot_type === 'danger' ? '#DC2626' : spot.spot_type === 'start' ? '#15803D' : spot.spot_type === 'end' ? '#DC2626' : colors.primary}
                    />
                  </View>
                  {index < spots.length - 1 && <View style={[styles.spotConnector, { backgroundColor: borderColor }]} />}
                </View>
                <View style={styles.spotContent}>
                  <Text style={[styles.spotName, { color: textColor }]}>{spot?.name || ''}</Text>
                  {spot.description ? (
                    <Text style={[styles.spotDesc, { color: textSecColor }]} numberOfLines={2}>
                      {spot.description}
                    </Text>
                  ) : null}
                  {spot.tip ? (
                    <View style={[styles.tipBox, { backgroundColor: sectionBg }]}>
                      <Text style={[styles.tipText, { color: isDark ? '#4ADE80' : '#2D4A2E' }]}>{spot.tip}</Text>
                    </View>
                  ) : null}
                  {spot.images && spot.images.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                      {spot.images.map((img: any, imgIdx: number) => (
                        <TouchableOpacity
                          key={img.id}
                          activeOpacity={0.8}
                          onPress={() => {
                            setViewerImages(spot.images.map((i: any) => i.image));
                            setViewerIndex(imgIdx);
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
            ))}
            {(spots || []).length > 3 && !showAllSpots && (
              <TouchableOpacity
                style={styles.showMoreBtn}
                onPress={() => setShowAllSpots(true)}
              >
                <Text style={[styles.showMoreText, { color: isDark ? '#4ADE80' : '#2D4A2E' }]}>
                  +{(spots || []).length - 3}{'\uAC1C \uACBD\uC720\uC9C0 \uB354\uBCF4\uAE30'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ===== 6b. Stamp Collection ===== */}
        <StampBook trailId={trail.id} />

        {/* ===== 7. Reviews — wrapped in card (Requirement #7) ===== */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
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
                    <View key={idx} style={styles.reviewImageThumbWrap}>
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
              <Feather name="message-circle" size={28} color={textTertColor} style={{ marginBottom: 8 }} />
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
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
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

        {/* ===== 8. Author bottom row — wrapped in card (Requirement #7) ===== */}
        {trail.author && (
          <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
            <View style={styles.authorRow}>
              <View style={[styles.authorAvatar, { backgroundColor: sectionBg }]}>
                {trail.author.profile_image ? (
                  <Image source={{ uri: trail.author.profile_image }} style={styles.authorAvatarImg} />
                ) : (
                  <Feather name="user" size={16} color={textSecColor} />
                )}
              </View>
              <Text style={[styles.authorName, { color: textColor }]}>{trail.author.nickname || ''}</Text>
              {trail.author.is_guide && (
                <View style={[styles.guideBadge, { backgroundColor: sectionBg }]}>
                  <Text style={[styles.guideBadgeText, { color: isDark ? '#4ADE80' : '#2D4A2E' }]}>{'\uC778\uC99D \uAC00\uC774\uB4DC'}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ===== 9. Users who walked this trail — wrapped in card (Requirement #7, #8) ===== */}
        {trailWalkers.length > 0 && (
          <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              {'\uC774 \uCF54\uC2A4\uB97C \uAC78\uC740 \uC0AC\uB78C'}{' '}
              <Text style={[styles.sectionCount, { color: textSecColor }]}>{trailWalkers.length}</Text>
            </Text>
            {/* --- Requirement #8: alignItems center on walker row --- */}
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
                    <Text style={styles.walkerMoreText}>+{trailWalkers.length - 5}{'\uBA85'}</Text>
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

      </ScrollView>

      {/* ===== Floating bottom bar: Like/Save/Share + primary CTA (Requirement #5) =====
          Slim row with icon-only action buttons + the walk CTA */}
      <View
        style={[
          styles.stickyCtaWrap,
          {
            backgroundColor: cardBg,
            borderTopColor: borderColor,
            paddingBottom: insets.bottom > 0 ? insets.bottom + 4 : 12,
          },
        ]}>
        <View style={styles.floatingActionRow}>
          {/* --- Requirement #11: Animated like button --- */}
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <TouchableOpacity style={styles.floatingActionBtn} onPress={handleLike} activeOpacity={0.7}>
              <Feather
                name="heart"
                size={20}
                color={trail.is_liked ? '#FF4B4B' : textSecColor}
              />
              {(trail.like_count ?? 0) > 0 && (
                <Text style={[styles.floatingActionCount, { color: trail.is_liked ? '#FF4B4B' : textTertColor }]}>
                  {trail.like_count}
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={styles.floatingActionBtn}
            onPress={() => bookmarkMutation.mutate()}
            disabled={bookmarkMutation.isPending}
            activeOpacity={0.7}>
            <Feather
              name="bookmark"
              size={20}
              color={trail.is_bookmarked ? colors.primary : textSecColor}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.floatingActionBtn} onPress={handleShare} activeOpacity={0.7}>
            <Feather name="share-2" size={20} color={textSecColor} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.floatingActionBtn} onPress={handleSaveOffline} disabled={savingOffline} activeOpacity={0.7}>
            <Feather name={savedOffline ? 'check-circle' : 'download'} size={20} color={savedOffline ? colors.primary : textSecColor} />
          </TouchableOpacity>

          {/* Primary CTA */}
          <TouchableOpacity
            style={styles.stickyCtaBtn}
            onPress={() => navigation.navigate('Walk', { trailId: trail.id, trail })}
            activeOpacity={0.88}>
            <Feather
              name={trail.is_completed ? 'rotate-cw' : 'play'}
              size={16}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.stickyCtaText}>
              {trail.is_completed ? '\uB2E4\uC2DC \uAC77\uAE30' : '\uAC77\uAE30 \uC2DC\uC791'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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

  // -- Cover -------------------------------------------------------
  coverContainer: {
    height: 360,
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
  // Requirement #4: Now rendered via LinearGradient component
  coverGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 260,
  },
  coverOverlay: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    zIndex: 6,
  },
  coverTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -0.6,
    lineHeight: 36,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  coverRegion: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.92)',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // -- Hero stats card (Requirement #2: unified with vertical dividers) --
  heroStatsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    backgroundColor: '#fff',
  },
  heroStatsCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  heroStatValue: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  heroStatsDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: '#E5E8EB',
  },
  heroDifficultyPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  heroDifficultyText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // -- Series chips ------------------------------------------------
  seriesMembershipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  seriesMembershipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  seriesMembershipText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // -- Inline actions card (Certificate / Edit) --------------------
  inlineActionsCard: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
  },

  // -- Floating bottom action bar (Requirement #5) -----------------
  stickyCtaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  floatingActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  floatingActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  floatingActionCount: {
    fontSize: 11,
    fontWeight: '700',
  },
  stickyCtaBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#2D4A2E',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  stickyCtaText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },

  completionBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  completionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15803D',
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
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

  // -- Section card wrapper (Requirement #7) -----------------------
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 12,
  },

  // -- Sections (Requirement #10: Typography hierarchy) ------------
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#191F28',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8B95A1',
  },

  // -- Description -------------------------------------------------
  descText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
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
    borderRadius: 20,
    backgroundColor: '#F7F8FA',
  },
  tagText: {
    fontSize: 11,
    color: '#8B95A1',
  },

  // -- Map ---------------------------------------------------------
  mapSection: {
    marginHorizontal: 20,
    marginTop: 12,
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

  // -- Spots -------------------------------------------------------
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
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 14,
    fontWeight: '600',
    color: '#191F28',
  },
  spotDesc: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8B95A1',
    marginTop: 3,
    lineHeight: 19,
  },
  tipBox: {
    backgroundColor: '#F7F8FA',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
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
    borderRadius: 12,
    marginRight: 6,
    marginTop: 8,
  },

  // -- Reviews -----------------------------------------------------
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  writeReviewBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyReviews: {
    paddingVertical: 32,
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
    height: 48,
    borderRadius: 14,
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
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 6,
  },
  reviewImageSection: {
    marginTop: 10,
    marginBottom: 4,
  },
  reviewImageThumbWrap: {
    position: 'relative',
    marginRight: 8,
  },
  reviewImageThumb: {
    width: 64,
    height: 64,
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
    width: 64,
    height: 64,
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

  // -- Author ------------------------------------------------------
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F7F8FA',
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
    fontSize: 14,
    fontWeight: '600',
    color: '#191F28',
  },
  authorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  authorBio: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  guideBadge: {
    backgroundColor: '#F7F8FA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  guideBadgeText: {
    fontSize: 11,
    color: '#2D4A2E',
    fontWeight: '600',
  },

  // -- Show More Spots ---------------------------------------------
  showMoreBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2D4A2E',
  },

  // -- Additional info list ----------------------------------------
  infoCard: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
  },

  // -- Transport (Requirement #9) ----------------------------------
  transportBox: {
    marginTop: 16,
    backgroundColor: '#F0F7F0',
    borderRadius: 14,
    padding: 16,
  },
  transportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
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
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(45,74,46,0.08)',
  },
  directionsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },

  // -- Image viewer ------------------------------------------------
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

  // -- Trail Walkers (Requirement #8) ------------------------------
  walkersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  walkerItem: {
    zIndex: 1,
  },
  walkerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  walkerAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  walkerAvatarFallback: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B95A1',
  },
  walkerMoreBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    gap: 8,
    marginTop: 4,
  },
  walkerName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#2D4A2E',
    backgroundColor: 'rgba(45,74,46,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
