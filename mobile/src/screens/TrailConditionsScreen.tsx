/**
 * TrailConditionsScreen — list of user-submitted condition reports
 * for a single trail + a compose sheet for submitting a new one.
 *
 * Shows:
 * - Current reports with timeline ("3일 전"), tag, optional note, author
 * - A sticky FAB to open the compose modal
 * - Tag chip grid + free-text field + submit button
 *
 * Inspired by AllTrails "Trail Conditions" and Google Maps "Contribute".
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useThemeStore } from '../stores/theme';
import type { TrailConditionReport } from '../types';

const TAG_OPTIONS: Array<{ key: string; label: string; emoji: string }> = [
  { key: 'clear', label: '상태 양호', emoji: '✨' },
  { key: 'muddy', label: '진흙/미끄러움', emoji: '🥾' },
  { key: 'icy', label: '빙판/결빙', emoji: '🧊' },
  { key: 'overgrown', label: '수풀 무성', emoji: '🌿' },
  { key: 'flooded', label: '침수', emoji: '💧' },
  { key: 'closed', label: '구간 통제', emoji: '🚫' },
  { key: 'construction', label: '공사중', emoji: '🚧' },
  { key: 'fallen_trees', label: '쓰러진 나무', emoji: '🌳' },
  { key: 'bugs', label: '벌레 많음', emoji: '🦟' },
  { key: 'crowded', label: '사람 많음', emoji: '👥' },
  { key: 'other', label: '기타', emoji: '❓' },
];

function formatRelative(iso: string): string {
  const t = Date.now() - new Date(iso).getTime();
  const h = Math.floor(t / 3600000);
  if (h < 1) return '방금 전';
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return `${Math.floor(d / 7)}주 전`;
}

export default function TrailConditionsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const trailId: number | undefined = route.params?.id;
  const qc = useQueryClient();
  const { isDark } = useThemeStore();

  const bg = isDark ? '#0a0a0a' : '#FAFAFA';
  const cardBg = isDark ? '#1e1e1e' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#191F28';
  const textSecColor = isDark ? 'rgba(255,255,255,0.65)' : colors.textSecondary;
  const textTertColor = isDark ? 'rgba(255,255,255,0.42)' : colors.textTertiary;
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#F2F4F6';

  const [showCompose, setShowCompose] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>('clear');
  const [note, setNote] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery<TrailConditionReport[]>({
    queryKey: ['trail-conditions', trailId],
    queryFn: async () => {
      if (!trailId) return [];
      const { data: res } = await api.get(`/trails/${trailId}/conditions/`);
      return Array.isArray(res) ? res : (res?.results ?? []);
    },
    enabled: !!trailId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!trailId) throw new Error('no trail id');
      const { data: res } = await api.post(
        `/trails/${trailId}/conditions/`,
        { tag: selectedTag, note: note.trim() },
      );
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trail-conditions', trailId] });
      qc.invalidateQueries({ queryKey: ['trail', trailId] });
      setShowCompose(false);
      setNote('');
      setSelectedTag('clear');
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail || '제보 실패. 잠시 후 다시 시도해주세요.';
      Alert.alert('오류', detail);
    },
  });

  const reports = data || [];

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={bg}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: cardBg, borderBottomColor: borderColor }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="chevron-left" size={24} color={textColor} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: textColor }]}>코스 상태 제보</Text>
          <Text style={[styles.headerSub, { color: textTertColor }]}>
            최근 {reports.length}건
          </Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : reports.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.centerWrap}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }>
          <View style={styles.emptyIcon}>
            <Feather name="message-square" size={28} color={textTertColor} />
          </View>
          <Text style={[styles.emptyTitle, { color: textColor }]}>
            아직 제보가 없어요
          </Text>
          <Text style={[styles.emptySub, { color: textSecColor }]}>
            처음으로 이 코스의 상태를 알려주세요
          </Text>
        </ScrollView>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => `cond-${item.id}`}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          renderItem={({ item }) => {
            const opt = TAG_OPTIONS.find((o) => o.key === item.tag);
            return (
              <View style={[styles.reportCard, { backgroundColor: cardBg }]}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportEmoji}>{opt?.emoji || '❓'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reportTag, { color: textColor }]}>
                      {item.tag_display || opt?.label || item.tag}
                    </Text>
                    <Text style={[styles.reportMeta, { color: textTertColor }]}>
                      {item.user?.nickname || '익명'} · {formatRelative(item.created_at)}
                    </Text>
                  </View>
                </View>
                {!!item.note && (
                  <Text style={[styles.reportNote, { color: textSecColor }]}>
                    {item.note}
                  </Text>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Compose FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => setShowCompose(true)}
        activeOpacity={0.9}>
        <Feather name="plus" size={24} color="#fff" />
        <Text style={styles.fabText}>제보하기</Text>
      </TouchableOpacity>

      {/* Compose modal */}
      <Modal
        visible={showCompose}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCompose(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: textColor }]}>코스 상태 제보</Text>
            <Text style={[styles.modalSub, { color: textTertColor }]}>
              다른 걷는 분들에게 현재 상태를 알려주세요
            </Text>

            <Text style={[styles.modalLabel, { color: textSecColor }]}>상태 선택</Text>
            <View style={styles.tagGrid}>
              {TAG_OPTIONS.map((opt) => {
                const active = selectedTag === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.tagChip,
                      { backgroundColor: active ? '#2D4A2E' : borderColor },
                    ]}
                    onPress={() => setSelectedTag(opt.key)}
                    activeOpacity={0.85}>
                    <Text style={styles.tagChipEmoji}>{opt.emoji}</Text>
                    <Text
                      style={[
                        styles.tagChipLabel,
                        { color: active ? '#fff' : textColor },
                      ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.modalLabel, { color: textSecColor, marginTop: 20 }]}>
              상세 설명 (선택)
            </Text>
            <TextInput
              style={[
                styles.noteInput,
                { backgroundColor: isDark ? '#2a2a2a' : '#F7F8FA', color: textColor },
              ]}
              placeholder="예: 입구 쪽 데크 미끄러움"
              placeholderTextColor={textTertColor}
              value={note}
              onChangeText={setNote}
              maxLength={300}
              multiline
              numberOfLines={3}
            />
            <Text style={[styles.noteCount, { color: textTertColor }]}>
              {note.length}/300
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: borderColor }]}
                onPress={() => setShowCompose(false)}>
                <Text style={[styles.modalBtnText, { color: textColor }]}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={() => createMutation.mutate()}
                disabled={createMutation.isPending}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                  {createMutation.isPending ? '전송 중...' : '제보'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSub: { fontSize: 11, marginTop: 2 },
  centerWrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  list: { padding: 16, gap: 12 },
  reportCard: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reportEmoji: { fontSize: 28 },
  reportTag: { fontSize: 14, fontWeight: '700' },
  reportMeta: { fontSize: 11, marginTop: 2 },
  reportNote: { fontSize: 13, marginTop: 8, lineHeight: 19 },

  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D4A2E',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 8,
    shadowColor: '#2D4A2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  modalSub: { fontSize: 12, marginBottom: 20 },
  modalLabel: { fontSize: 12, fontWeight: '700', marginBottom: 10 },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  tagChipEmoji: { fontSize: 14 },
  tagChipLabel: { fontSize: 12, fontWeight: '600' },
  noteInput: {
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  noteCount: { fontSize: 11, textAlign: 'right', marginTop: 4 },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalBtnPrimary: { backgroundColor: '#2D4A2E' },
  modalBtnText: { fontSize: 15, fontWeight: '700' },
});
