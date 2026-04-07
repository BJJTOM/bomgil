import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Feather from 'react-native-vector-icons/Feather';
import api from '../api/client';
import { colors } from '../theme/colors';

interface Notice {
  id: number;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
}

export default function NoticeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [expandedId, setExpandedId] = React.useState<number | null>(null);

  const { data: notices = [], isLoading, refetch, isRefetching } = useQuery<Notice[]>({
    queryKey: ['notices'],
    queryFn: async () => {
      const { data } = await api.get('/community/notices/');
      return data.results ?? data;
    },
    staleTime: 60000,
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>공지사항</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}>
          {notices.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="bell-off" size={32} color={colors.textTertiary} />
              <Text style={styles.emptyText}>공지사항이 없습니다</Text>
            </View>
          ) : (
            notices.map((notice) => {
              const isExpanded = expandedId === notice.id;
              const dateStr = new Date(notice.created_at).toLocaleDateString('ko-KR', {
                year: 'numeric', month: 'long', day: 'numeric',
              });
              return (
                <TouchableOpacity
                  key={notice.id}
                  style={styles.noticeItem}
                  activeOpacity={0.7}
                  onPress={() => setExpandedId(isExpanded ? null : notice.id)}>
                  <View style={styles.noticeHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.noticeMeta}>
                        {notice.is_pinned && (
                          <View style={styles.pinnedBadge}>
                            <Text style={styles.pinnedText}>중요</Text>
                          </View>
                        )}
                        <Text style={styles.noticeDate}>{dateStr}</Text>
                      </View>
                      <Text style={styles.noticeTitle}>{notice.title}</Text>
                    </View>
                    <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
                  </View>
                  {isExpanded && (
                    <View style={styles.noticeBody}>
                      <Text style={styles.noticeContent}>{notice.content}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: colors.textTertiary },
  noticeItem: {
    backgroundColor: '#fff', marginHorizontal: 20, marginTop: 10, borderRadius: 14, overflow: 'hidden',
  },
  noticeHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  noticeMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  pinnedBadge: { backgroundColor: '#FF4B4B', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  pinnedText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  noticeDate: { fontSize: 12, color: colors.textTertiary },
  noticeTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, lineHeight: 21 },
  noticeBody: {
    paddingHorizontal: 16, paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F2F4F6', paddingTop: 12,
  },
  noticeContent: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
});
