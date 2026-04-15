/**
 * CompanionsScreen — discover upcoming walk plans and request to join.
 * Mirrors the web /companions page.
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';
import {
  PACE_LABELS,
  useRequestCompanion,
  useWalkPlans,
} from '../hooks/useCompanions';
import type { WalkPlan } from '../types';
import { useAuthStore } from '../stores/auth';

const REGIONS = ['서울', '부산', '제주', '전주', '강릉', '경주', '하동'];
const TRAIL_TYPES = [
  { value: '', label: '전체' },
  { value: 'coastal', label: '🌊 바다' },
  { value: 'nature', label: '🌳 숲' },
  { value: 'cultural', label: '🏯 역사' },
  { value: 'urban', label: '🏙 도심' },
  { value: 'village', label: '🏡 마을' },
  { value: 'mixed', label: '🧩 복합' },
];

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_NAMES[d.getDay()]})`;
}

function buildDateChips() {
  const chips: { date: string; label: string; isWeekend: boolean }[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    chips.push({
      date: iso,
      label: `${d.getMonth() + 1}/${d.getDate()} (${DAY_NAMES[d.getDay()]})`,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    });
  }
  return chips;
}

export default function CompanionsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAuthStore();

  const [selectedDate, setSelectedDate] = useState('');
  const [region, setRegion] = useState('');
  const [trailType, setTrailType] = useState('');
  const [requestFor, setRequestFor] = useState<WalkPlan | null>(null);
  const [requestMsg, setRequestMsg] = useState('');

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (selectedDate) f.date = selectedDate;
    if (region) f.region = region;
    if (trailType) f.trail_type = trailType;
    return f;
  }, [selectedDate, region, trailType]);

  const { data: plans = [], isLoading, refetch } = useWalkPlans(filters);
  const requestMutation = useRequestCompanion();
  const dateChips = useMemo(buildDateChips, []);

  const submitRequest = async () => {
    if (!requestFor) return;
    try {
      await requestMutation.mutateAsync({
        planId: requestFor.id,
        message: requestMsg,
      });
      setRequestFor(null);
      setRequestMsg('');
    } catch {
      // mutation error — leave modal open
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>동행 찾기</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {
            if (!isAuthenticated) {
              navigation.navigate('Login');
              return;
            }
            navigation.navigate('WalkPlanCreate');
          }}>
          <Feather name="plus" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={plans}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshing={isLoading}
        onRefresh={refetch}
        ListHeaderComponent={
          <View>
            {/* Date chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}>
              <TouchableOpacity
                onPress={() => setSelectedDate('')}
                style={[styles.chip, !selectedDate && styles.chipActive]}>
                <Text
                  style={[
                    styles.chipText,
                    !selectedDate && styles.chipTextActive,
                  ]}>
                  전체
                </Text>
              </TouchableOpacity>
              {dateChips.map((c) => {
                const active = c.date === selectedDate;
                return (
                  <TouchableOpacity
                    key={c.date}
                    onPress={() => setSelectedDate(active ? '' : c.date)}
                    style={[
                      styles.chip,
                      active && styles.chipActive,
                      !active && c.isWeekend && styles.chipWeekend,
                    ]}>
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                        !active && c.isWeekend && styles.chipTextWeekend,
                      ]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Region chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}>
              <TouchableOpacity
                onPress={() => setRegion('')}
                style={[styles.chipSm, !region && styles.chipActive]}>
                <Text
                  style={[
                    styles.chipText,
                    !region && styles.chipTextActive,
                  ]}>
                  전체 지역
                </Text>
              </TouchableOpacity>
              {REGIONS.map((r) => {
                const active = r === region;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRegion(active ? '' : r)}
                    style={[styles.chipSm, active && styles.chipActive]}>
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Trail type chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.chipRow, { marginBottom: 4 }]}>
              {TRAIL_TYPES.map((tt) => {
                const active =
                  tt.value === trailType || (!tt.value && !trailType);
                return (
                  <TouchableOpacity
                    key={tt.value || 'all'}
                    onPress={() => setTrailType(tt.value)}
                    style={[styles.chipSm, active && styles.chipActive]}>
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}>
                      {tt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <WalkPlanCard
            plan={item}
            onRequest={() => {
              if (!isAuthenticated) {
                navigation.navigate('Login');
                return;
              }
              setRequestFor(item);
            }}
            onOpenTrail={() => {
              if (item.trail) {
                navigation.navigate('TrailDetail', { id: item.trail.id });
              }
            }}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyBox}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🥾</Text>
              <Text style={styles.emptyTitle}>
                아직 이 조건에 맞는 일정이 없어요
              </Text>
              <Text style={styles.emptyDesc}>
                첫 일정을 등록해서 동행을 모아보세요
              </Text>
              {isAuthenticated && (
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => navigation.navigate('WalkPlanCreate')}>
                  <Text style={styles.emptyBtnText}>일정 등록하기</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
      />

      {/* Request modal */}
      <Modal
        visible={!!requestFor}
        transparent
        animationType="fade"
        onRequestClose={() => setRequestFor(null)}
        statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>동행 신청하기</Text>
            <Text style={styles.modalSub}>
              {requestFor?.trail?.title} · {requestFor?.user?.nickname}님에게
            </Text>
            <TextInput
              value={requestMsg}
              onChangeText={setRequestMsg}
              placeholder="안녕하세요! 같이 걸어요~"
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={200}
              style={styles.modalInput}
            />
            <View style={styles.modalRow}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setRequestFor(null);
                  setRequestMsg('');
                }}>
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirm,
                  (!requestMsg || requestMutation.isPending) &&
                    styles.modalConfirmDisabled,
                ]}
                disabled={!requestMsg || requestMutation.isPending}
                onPress={submitRequest}>
                <Text style={styles.modalConfirmText}>
                  {requestMutation.isPending ? '신청 중...' : '신청 보내기'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function WalkPlanCard({
  plan,
  onRequest,
  onOpenTrail,
}: {
  plan: WalkPlan;
  onRequest: () => void;
  onOpenTrail: () => void;
}) {
  const pace = PACE_LABELS[plan.pace] || PACE_LABELS.moderate;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <TouchableOpacity
          style={styles.thumb}
          activeOpacity={0.8}
          onPress={onOpenTrail}>
          {plan.trail?.cover_image ? (
            <Image
              source={{ uri: plan.trail.cover_image }}
              style={styles.thumbImg}
            />
          ) : (
            <Text style={styles.thumbPlaceholder}>🥾</Text>
          )}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.region} numberOfLines={1}>
            {plan.trail?.region || ''}
          </Text>
          <TouchableOpacity onPress={onOpenTrail} activeOpacity={0.7}>
            <Text style={styles.title} numberOfLines={1}>
              {plan.trail?.title || '트레일 정보 없음'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.meta}>
            📅 {formatDateLabel(plan.planned_date)}
            {plan.planned_time
              ? `  🕐 ${plan.planned_time.slice(0, 5)}`
              : ''}
          </Text>
          <Text style={styles.meta}>
            {pace.emoji} {pace.label}
            {plan.trail?.distance_km
              ? ` · ${Number(plan.trail.distance_km).toFixed(1)}km`
              : ''}
          </Text>
        </View>
      </View>

      <View style={styles.authorRow}>
        <View style={styles.avatar}>
          {plan.user?.profile_image ? (
            <Image
              source={{ uri: plan.user.profile_image }}
              style={styles.avatarImg}
            />
          ) : (
            <Text style={{ fontSize: 14 }}>👤</Text>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.authorName}>
            {plan.user?.nickname || '알 수 없음'}
          </Text>
          {plan.message ? (
            <Text style={styles.authorMsg} numberOfLines={1}>
              "{plan.message}"
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actionRow}>
        <Text style={styles.countText}>
          동행 {plan.accepted_count || 0}/{plan.max_companions}명 모집 중
        </Text>
        <TouchableOpacity
          style={styles.reqBtn}
          onPress={onRequest}
          activeOpacity={0.85}>
          <Text style={styles.reqBtnText}>동행 신청하기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    height: 52,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chipRow: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    marginRight: 8,
  },
  chipSm: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipWeekend: {
    backgroundColor: 'rgba(217,119,6,0.08)',
    borderColor: 'rgba(217,119,6,0.25)',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextActive: { color: '#fff' },
  chipTextWeekend: { color: '#D97706' },
  card: {
    marginHorizontal: 14,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', gap: 12 },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#F5F5F4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlaceholder: { fontSize: 28 },
  region: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '600',
    marginBottom: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  meta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  authorName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  authorMsg: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  countText: { fontSize: 12, color: colors.textTertiary },
  reqBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  reqBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  emptyBox: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  modalCancel: { paddingHorizontal: 14, paddingVertical: 10 },
  modalCancelText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalConfirm: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  modalConfirmDisabled: { opacity: 0.5 },
  modalConfirmText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
