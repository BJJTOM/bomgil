import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { getSavedTrails, removeSavedTrail } from '../utils/offlineStorage';

interface SavedEntry {
  trailId: number;
  trail: any;
  spots: any[];
  savedAt: string;
}

export default function SavedTrailsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [entries, setEntries] = useState<SavedEntry[]>([]);

  const loadSaved = useCallback(async () => {
    const saved = await getSavedTrails();
    const list: SavedEntry[] = Object.entries(saved).map(([id, val]: [string, any]) => ({
      trailId: Number(id),
      trail: val.trail,
      spots: val.spots,
      savedAt: val.savedAt,
    }));
    list.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    setEntries(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSaved();
    }, [loadSaved]),
  );

  const handleDelete = (trailId: number, title: string) => {
    Alert.alert('삭제', `"${title}" 저장을 삭제하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await removeSavedTrail(trailId);
          loadSaved();
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: SavedEntry }) => {
    const savedDate = new Date(item.savedAt).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('TrailDetail', { trailId: item.trailId, offlineData: item })
        }>
        <View style={styles.cardContent}>
          <Text style={styles.trailTitle} numberOfLines={1}>
            {item.trail.title}
          </Text>
          <Text style={styles.trailRegion} numberOfLines={1}>
            {[item.trail.region, item.trail.country].filter(Boolean).join(', ')}
          </Text>
          <Text style={styles.savedDate}>{savedDate} 저장됨</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item.trailId, item.trail.title)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.deleteIcon}>{'✕'}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>저장한 코스</Text>
        <View style={{ width: 40 }} />
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>{'📥'}</Text>
          <Text style={styles.emptyTitle}>저장한 코스가 없습니다</Text>
          <Text style={styles.emptyDesc}>
            코스 상세에서 저장 버튼을 눌러{'\n'}오프라인에서도 확인하세요
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => String(item.trailId)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  backText: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F2F4F6',
  },
  cardContent: {
    flex: 1,
  },
  trailTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  trailRegion: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  savedDate: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  deleteIcon: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
