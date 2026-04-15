/**
 * MyWalkPlansScreen — list the current user's own walk plans and let
 * them accept/reject incoming companion requests.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';
import {
  PACE_LABELS,
  useAcceptRequest,
  useMyWalkPlans,
  usePlanRequests,
  useRejectRequest,
} from '../hooks/useCompanions';
import type { CompanionStatus, WalkPlan } from '../types';

const STATUS_MAP: Record<CompanionStatus, { label: string; color: string; bg: string }> = {
  open: { label: '모집 중', color: '#16A34A', bg: 'rgba(22,163,74,0.1)' },
  matched: {
    label: '매칭 완료',
    color: colors.primary,
    bg: 'rgba(45,74,46,0.08)',
  },
  closed: {
    label: '마감',
    color: colors.textTertiary,
    bg: '#F0F0F0',
  },
  completed: {
    label: '완료',
    color: colors.textTertiary,
    bg: '#F0F0F0',
  },
};

export default function MyWalkPlansScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { data: plans = [], isLoading, refetch } = useMyWalkPlans();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>내 일정</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('WalkPlanCreate')}>
          <Feather name="plus" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={plans}
        keyExtractor={(p) => String(p.id)}
        refreshing={isLoading}
        onRefresh={refetch}
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        renderItem={({ item }) => <MyPlanCard plan={item} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyBox}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>📅</Text>
              <Text style={styles.emptyTitle}>등록한 일정이 없어요</Text>
              <Text style={styles.emptyDesc}>
                일정을 등록하고 동행을 찾아보세요
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('WalkPlanCreate')}>
                <Text style={styles.emptyBtnText}>일정 등록하기</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
    </View>
  );
}

function MyPlanCard({ plan }: { plan: WalkPlan }) {
  const [open, setOpen] = useState(false);
  const { data: requests = [], isLoading } = usePlanRequests(plan.id, open);
  const acceptReq = useAcceptRequest();
  const rejectReq = useRejectRequest();
  const status = STATUS_MAP[plan.companion_status] || STATUS_MAP.open;
  const pace = PACE_LABELS[plan.pace] || PACE_LABELS.moderate;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.title} numberOfLines={1}>
          {plan.trail?.title || '트레일 정보 없음'}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {plan.planned_date}
        {plan.planned_time ? ` · ${plan.planned_time.slice(0, 5)}` : ''} ·{' '}
        {pace.emoji} {pace.label} · 동행 {plan.accepted_count || 0}/
        {plan.max_companions}명
      </Text>
      {plan.message ? (
        <Text style={styles.message} numberOfLines={2}>
          "{plan.message}"
        </Text>
      ) : null}

      {plan.companion_status === 'open' && (
        <TouchableOpacity
          onPress={() => setOpen((v) => !v)}
          activeOpacity={0.7}
          style={styles.toggleBtn}>
          <Text style={styles.toggleText}>
            {open ? '신청 목록 접기' : '받은 신청 보기'}
          </Text>
        </TouchableOpacity>
      )}

      {open && (
        <View style={styles.reqBlock}>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : requests.length === 0 ? (
            <Text style={styles.emptyRequestText}>
              아직 받은 신청이 없어요
            </Text>
          ) : (
            requests.map((req) => (
              <View key={req.id} style={styles.reqRow}>
                <View style={styles.avatar}>
                  {req.requester?.profile_image ? (
                    <Image
                      source={{ uri: req.requester.profile_image }}
                      style={styles.avatarImg}
                    />
                  ) : (
                    <Text style={{ fontSize: 14 }}>👤</Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.reqName}>{req.requester?.nickname}</Text>
                  <Text style={styles.reqMsg} numberOfLines={1}>
                    {req.message}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    disabled={acceptReq.isPending}
                    onPress={() => acceptReq.mutate(req.id)}>
                    <Text style={styles.acceptBtnText}>수락</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    disabled={rejectReq.isPending}
                    onPress={() => rejectReq.mutate(req.id)}>
                    <Text style={styles.rejectBtnText}>거절</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 12, color: colors.textSecondary },
  message: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 6,
    fontStyle: 'italic',
  },
  toggleBtn: { marginTop: 10, alignSelf: 'flex-start' },
  toggleText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  reqBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 10,
  },
  emptyRequestText: {
    fontSize: 12,
    color: colors.textTertiary,
    paddingVertical: 6,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: '#F8F8F7',
    borderRadius: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5F5F4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  reqName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  reqMsg: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  acceptBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  acceptBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rejectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  rejectBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
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
});
