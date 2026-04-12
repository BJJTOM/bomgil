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
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
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
import api from '../api/client';
import { colors } from '../theme/colors';
import { Trail, Spot, Review } from '../types';
import { saveTrailOffline, isSaved, getSavedTrail } from '../utils/offlineStorage';
import SafeMapView from '../components/SafeMapView';
import { useThemeStore } from '../stores/theme';

const { width } = Dimensions.get('window');

const DIFFICULTY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  easy: { label: '쉽게', bg: '#DCFCE7', text: '#15803D' },
  moderate: { label: '보통', bg: '#FEF3C7', text: '#B45309' },
  hard: { label: '도전', bg: '#FEE2E2', text: '#DC2626' },
};

const SEASON_LABELS: Record<string, string> = {
  spring: '봄',
  summer: '여름',
  autumn: '가을',
  winter: '겨울',
  all: '사계절',
};

const SPOT_ICONS: Record<string, string> = {
  start: '\u{1F7E2}',
  restaurant: '\u{1F35C}',
  cafe: '☕',
  photo: '\u{1F4F7}',
  rest: '\u{1F9D8}',
  view: '\u{1F304}',
  danger: '⚠️',
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
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

const API_BASE = 'https://api.moruwalk.com';

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Relative path like /media/trails/covers/foo.jpg
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

  const bg = isDark ? '#0a0a0a' : '#FAFAFA';
  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#191F28';
  const textSecColor = isDark ? 'rgba(255,255,255,0.6)' : '#8B95A1';
  const textTertColor = isDark ? 'rgba(255,255,255,0.4)' : '#B0B8C1';
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
      // Deduplicate by user id
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
      Alert.alert('최대 3장', '리뷰 사진은 최대 3장까지 첨부할 수 있습니다.');
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
      // Upload images if any
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
      Alert.alert('저장 완료', '오프라인에서도 이 코스를 확인할 수 있습니다.');
    } else {
      Alert.alert('저장 실패', '코스를 저장하지 못했습니다. 다시 시도해주세요.');
    }
  };

  const handleShare = async () => {
    if (!trail) return;
    try {
      await Share.share({
        message: `${trail?.title || ''} - ${trail?.region || ''}\nMoru에서 확인해보세요!`,
      });
    } catch {}
  };

  // --- Error / Loading States ---

  if (!trailId) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>{'⚠️'}</Text>
        <Text style={{ fontSize: 16, color: '#191F28', fontWeight: '600' }}>{'코스를 찾을 수 없습니다'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 12 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{'돌아가기'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>{'⚠️'}</Text>
        <Text style={{ fontSize: 16, color: '#191F28', fontWeight: '600' }}>{'코스를 불러올 수 없습니다'}</Text>
        <Text style={{ fontSize: 13, color: '#8B95A1', marginTop: 4 }}>{'네트워크 연결을 확인해주세요'}</Text>
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

  const statsItems = [
    formatDistance(trail.distance_km),
    formatDuration(trail.estimated_minutes),
    diff.label,
    SEASON_LABELS[trail?.best_season || ''] || trail?.best_season || '',
  ].filter(Boolean);

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
              <Text style={styles.coverEmoji}>{'\u{1F97E}'}</Text>
            </View>
          )}

          {/* Status bar protection */}
          <View style={[styles.statusBarOverlay, { height: insets.top }]} />
          {/* Gradient overlay */}
          <View style={styles.coverGradientBottom} />

          {/* Title overlay at bottom */}
          <View style={styles.coverOverlay}>
            <Text style={styles.coverTitle} numberOfLines={2}>{trail?.title || ''}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.coverRegion}>
                {[trail?.region, trail?.country].filter(Boolean).join(', ')}
              </Text>
              <View style={[styles.diffBadgeBottom, { backgroundColor: diff.bg }]}>
                <Text style={[styles.diffText, { color: diff.text }]}>{diff.label}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ===== 2. Quick Stats Line ===== */}
        <View style={[styles.statsLine, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
          <Text style={[styles.statsText, { color: textSecColor }]}>
            {statsItems.join('  ·  ')}
          </Text>
        </View>

        {/* ===== 3. Action Bar ===== */}
        <View style={[styles.actionBar, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
          <View style={styles.actionIcons}>
            <TouchableOpacity style={styles.actionIconBtn} onPress={() => likeMutation.mutate()} activeOpacity={0.7}>
              <Feather name="heart" size={20} color={(trail as any).is_liked ? '#FF4B4B' : '#8B95A1'} />
              <Text style={[styles.actionIconLabel, (trail as any).is_liked && { color: '#FF4B4B' }]}>{trail.like_count ?? 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => bookmarkMutation.mutate()}
              disabled={bookmarkMutation.isPending}
              activeOpacity={0.7}>
              <Feather
                name={(trail as any).is_bookmarked ? 'bookmark' : 'bookmark'}
                size={20}
                color={(trail as any).is_bookmarked ? colors.primary : '#8B95A1'}
                style={{ opacity: (trail as any).is_bookmarked ? 1 : 0.7 }}
              />
              <Text style={[styles.actionIconLabel, (trail as any).is_bookmarked && { color: colors.primary }]}>
                {(trail as any).is_bookmarked ? '저장됨' : '저장'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionIconBtn} onPress={handleShare} activeOpacity={0.7}>
              <Feather name="share" size={20} color="#8B95A1" />
              <Text style={styles.actionIconLabel}>{'공유'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionIconBtn} onPress={handleSaveOffline} disabled={savingOffline} activeOpacity={0.7}>
              <Feather name={savedOffline ? 'check-circle' : 'download'} size={20} color={savedOffline ? colors.primary : '#8B95A1'} />
              <Text style={[styles.actionIconLabel, savedOffline && { color: colors.primary }]}>
                {savingOffline ? '...' : savedOffline ? '오프라인' : '오프라인'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Completion badge — shown if user has already completed this trail */}
          {(trail as any).is_completed && (
            <View style={styles.completionBadgeRow}>
              <View style={styles.completionBadge}>
                <Feather name="award" size={14} color="#fff" />
                <Text style={styles.completionBadgeText}>완주한 코스</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.walkBtn}
            onPress={() => navigation.navigate('Walk', { trailId: trail.id, trail })}
            activeOpacity={0.85}>
            <Text style={styles.walkBtnText}>
              {(trail as any).is_completed ? '다시 걷기 시작' : '걷기 시작'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ===== 4. Description ===== */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>{'소개'}</Text>
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

        {/* ===== 4b. Course Details ===== */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>코스 정보</Text>
          <View style={styles.detailGrid}>
            <View style={[styles.detailItem, { backgroundColor: sectionBg }]}>
              <Text style={[styles.detailLabel, { color: textTertColor }]}>거리</Text>
              <Text style={[styles.detailValue, { color: textColor }]}>{formatDistance(trail.distance_km)}</Text>
            </View>
            <View style={[styles.detailItem, { backgroundColor: sectionBg }]}>
              <Text style={[styles.detailLabel, { color: textTertColor }]}>소요시간</Text>
              <Text style={[styles.detailValue, { color: textColor }]}>{formatDuration(trail.estimated_minutes)}</Text>
            </View>
            <View style={[styles.detailItem, { backgroundColor: sectionBg }]}>
              <Text style={[styles.detailLabel, { color: textTertColor }]}>난이도</Text>
              <View style={[styles.detailBadge, { backgroundColor: diff.bg }]}>
                <Text style={[styles.detailBadgeText, { color: diff.text }]}>{diff.label}</Text>
              </View>
            </View>
            {trail.elevation_gain != null && trail.elevation_gain > 0 && (
              <View style={[styles.detailItem, { backgroundColor: sectionBg }]}>
                <Text style={[styles.detailLabel, { color: textTertColor }]}>고도 상승</Text>
                <Text style={[styles.detailValue, { color: textColor }]}>+{Math.round(trail.elevation_gain)}m</Text>
              </View>
            )}
            {trail.best_season && (
              <View style={[styles.detailItem, { backgroundColor: sectionBg }]}>
                <Text style={[styles.detailLabel, { color: textTertColor }]}>추천 계절</Text>
                <Text style={[styles.detailValue, { color: textColor }]}>{SEASON_LABELS[trail.best_season] || trail.best_season}</Text>
              </View>
            )}
            {(trail as any).trail_type && (
              <View style={[styles.detailItem, { backgroundColor: sectionBg }]}>
                <Text style={[styles.detailLabel, { color: textTertColor }]}>코스 유형</Text>
                <Text style={[styles.detailValue, { color: textColor }]}>
                  {(trail as any).trail_type === 'one_way' ? '편도' : (trail as any).trail_type === 'round_trip' ? '왕복' : '순환'}
                </Text>
              </View>
            )}
          </View>
          {(trail as any).transport_access && (
            <View style={[styles.transportBox, isDark && { backgroundColor: 'rgba(45,74,46,0.2)' }]}>
              <Text style={styles.transportLabel}>교통편 안내</Text>
              <Text style={[styles.transportText, { color: textColor }]}>{(trail as any).transport_access}</Text>
            </View>
          )}
        </View>

        {/* ===== 4c. Author ===== */}
        {trail.author && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>작성자</Text>
            <TouchableOpacity
              style={[styles.authorCard, { backgroundColor: sectionBg }]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Profile', { nickname: trail.author.nickname })}>
              <View style={styles.authorAvatar}>
                {trail.author.profile_image ? (
                  <Image source={{ uri: trail.author.profile_image }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                ) : (
                  <Text style={{ fontSize: 20 }}>{'👤'}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.authorName, { color: textColor }]}>{trail.author.nickname}</Text>
                {trail.author.bio ? <Text style={[styles.authorBio, { color: textTertColor }]} numberOfLines={1}>{trail.author.bio}</Text> : null}
              </View>
              <Text style={{ color: textTertColor, fontSize: 18 }}>{'›'}</Text>
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
            <View style={styles.mapFallback}>
              <Text style={{ fontSize: 32 }}>{'\u{1F5FA}️'}</Text>
              <Text style={{ color: '#8B95A1', fontSize: 13, marginTop: 6 }}>
                {trail?.region || ''} {trail?.country || ''}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ===== 6. Spots ===== */}
        {(spots || []).length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              {'경유지'} <Text style={[styles.sectionCount, { color: textSecColor }]}>{spots.length}</Text>
            </Text>
            {(showAllSpots ? spots : (spots || []).slice(0, 3)).map((spot, index) => (
              <View key={spot.id} style={styles.spotItem}>
                <View style={styles.spotDotColumn}>
                  <View style={[styles.spotDot, { backgroundColor: sectionBg }]}>
                    <Text style={styles.spotDotIcon}>
                      {SPOT_ICONS[spot.spot_type] || '\u{1F4CD}'}
                    </Text>
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
                      <Text style={styles.tipText}>{spot.tip}</Text>
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
                <Text style={styles.showMoreText}>
                  +{(spots || []).length - 3}개 경유지 더보기
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ===== 7. Reviews ===== */}
        <View style={styles.section}>
          <View style={styles.reviewsHeader}>
            <View style={styles.reviewsTitleRow}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>{'리뷰'}</Text>
              {avgRating && (
                <Text style={styles.ratingInline}>
                  {'★'} {avgRating} ({safeReviews.length})
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.writeReviewBtn}
              onPress={() => setShowReviewForm(!showReviewForm)}
              activeOpacity={0.7}>
              <Text style={styles.writeReviewBtnText}>
                {showReviewForm ? '취소' : '리뷰 작성'}
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
                    <Text
                      style={[
                        styles.starSelect,
                        star <= reviewForm.rating && styles.starSelectFilled,
                      ]}>
                      {'★'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.reviewInput, { backgroundColor: cardBg, color: textColor }]}
                multiline
                numberOfLines={4}
                maxLength={1000}
                placeholder={'리뷰를 작성해주세요'}
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
                        <Text style={styles.reviewImageRemoveText}>{'✕'}</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {reviewImages.length < 3 && (
                    <TouchableOpacity style={styles.reviewImageAddBtn} onPress={pickReviewImages} activeOpacity={0.7}>
                      <Feather name="camera" size={20} color="#8B95A1" />
                      <Text style={styles.reviewImageAddText}>{reviewImages.length}/3</Text>
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
                  {createReview.isPending ? '제출 중...' : '제출'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Review List */}
          {safeReviews.length === 0 && !showReviewForm && (
            <View style={styles.emptyReviews}>
              <Text style={styles.emptyReviewsText}>{'아직 리뷰가 없습니다'}</Text>
              <Text style={styles.emptyReviewsSub}>{'첫 번째 리뷰를 작성해보세요'}</Text>
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
                  <Text style={styles.reviewStars}>
                    {Array.from({ length: 5 }, (_, i) =>
                      i < review.rating ? '★' : '☆'
                    ).join('')}
                    {review.visited_date ? (
                      '  ' + new Date(review.visited_date).toLocaleDateString('ko-KR')
                    ) : ''}
                  </Text>
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

        {/* ===== 8. Author ===== */}
        {trail.author && (
          <View style={[styles.authorRow, { borderTopColor: borderColor }]}>
            <View style={[styles.authorAvatar, { backgroundColor: sectionBg }]}>
              {trail.author.profile_image ? (
                <Image source={{ uri: trail.author.profile_image }} style={styles.authorAvatarImg} />
              ) : (
                <Text style={styles.authorAvatarFallback}>
                  {(trail.author.nickname || '?')[0]}
                </Text>
              )}
            </View>
            <Text style={[styles.authorName, { color: textColor }]}>{trail.author.nickname || ''}</Text>
            {trail.author.is_guide && (
              <View style={styles.guideBadge}>
                <Text style={styles.guideBadgeText}>{'인증 가이드'}</Text>
              </View>
            )}
          </View>
        )}

        {/* ===== 9. Users who walked this trail ===== */}
        {trailWalkers.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              {'이 코스를 걸은 사람'}{' '}
              <Text style={[styles.sectionCount, { color: textSecColor }]}>{trailWalkers.length}</Text>
            </Text>
            <View style={styles.walkersRow}>
              {trailWalkers.slice(0, 5).map((walker: any, index: number) => (
                <TouchableOpacity
                  key={walker.id}
                  style={[styles.walkerItem, index > 0 && { marginLeft: -8 }]}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('Profile', { nickname: walker.nickname })}>
                  <View style={styles.walkerAvatar}>
                    {walker.profile_image ? (
                      <Image source={{ uri: walker.profile_image }} style={styles.walkerAvatarImg} />
                    ) : (
                      <Text style={styles.walkerAvatarFallback}>
                        {(walker.nickname || '?')[0]}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
              {trailWalkers.length > 5 && (
                <View style={[styles.walkerItem, { marginLeft: -8 }]}>
                  <View style={styles.walkerMoreBadge}>
                    <Text style={styles.walkerMoreText}>+{trailWalkers.length - 5}명</Text>
                  </View>
                </View>
              )}
            </View>
            <View style={styles.walkerNamesRow}>
              {trailWalkers.slice(0, 5).map((walker: any) => (
                <TouchableOpacity
                  key={walker.id}
                  onPress={() => navigation.navigate('Profile', { nickname: walker.nickname })}>
                  <Text style={styles.walkerName}>{walker.nickname}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Bottom spacing for tab bar */}
        <View style={{ height: 120 }} />
      </ScrollView>
    </KeyboardAvoidingView>

      {/* Fullscreen Image Viewer */}
      <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.viewerOverlay}>
          <StatusBar backgroundColor="#000" barStyle="light-content" />
          <TouchableOpacity style={styles.viewerCloseBtn} onPress={() => setViewerVisible(false)}>
            <Text style={styles.viewerCloseText}>{'✕'}</Text>
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

  // ── Cover ──────────────────────────────────────────────
  coverContainer: {
    height: 320,
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
  coverEmoji: {
    fontSize: 72,
    opacity: 0.25,
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
    height: 90,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  diffBadgeBottom: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  coverRegion: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.95)',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
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
    fontWeight: '500',
    color: '#8B95A1',
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // ── Action Bar ─────────────────────────────────────────
  actionBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F6',
    backgroundColor: '#fff',
  },
  actionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  actionIconBtn: {
    alignItems: 'center',
    gap: 2,
  },
  actionIconEmoji: {
    fontSize: 20,
  },
  actionIconLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8B95A1',
  },
  walkBtn: {
    backgroundColor: '#2D4A2E',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  walkBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  completionBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
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
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  sectionCount: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8B95A1',
  },

  // ── Description ────────────────────────────────────────
  descText: {
    fontSize: 14,
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
    backgroundColor: '#F7F8FA',
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    borderRadius: 20,
    marginBottom: 12,
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
  reviewImageRemoveText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
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
    fontSize: 15,
    fontWeight: '600',
    color: '#191F28',
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

  // ── Show More Spots ───────────────────────────────────
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
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    width: '45%',
    backgroundColor: '#F7F8FA',
    borderRadius: 14,
    padding: 14,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  detailBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 2,
  },
  detailBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  transportBox: {
    marginTop: 16,
    backgroundColor: '#F0F7F0',
    borderRadius: 14,
    padding: 16,
  },
  transportLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  transportText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
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
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
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
  viewerCloseText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
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

  // ── Trail Walkers ─────────────────────────────────────
  walkersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  walkerItem: {
    zIndex: 1,
  },
  walkerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F2F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FAFAFA',
    overflow: 'hidden',
  },
  walkerAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  walkerAvatarFallback: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B95A1',
  },
  walkerMoreBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E8EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FAFAFA',
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
    fontSize: 12,
    fontWeight: '500',
    color: '#2D4A2E',
    backgroundColor: 'rgba(45,74,46,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
