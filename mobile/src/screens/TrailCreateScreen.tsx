import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';

export default function TrailCreateScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Text style={styles.backBtnText}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>코스 만들기</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.subtitle}>어떻게 코스를 만들까요?</Text>

        {/* Card 1: Walk & Record */}
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Walk', { fromTrailCreate: true })}>
          <View style={styles.cardIconWrap}>
            <Text style={styles.cardIcon}>{'\uD83D\uDEB6'}</Text>
          </View>
          <View style={styles.cardTextWrap}>
            <Text style={styles.cardTitle}>걸으면서 기록하기</Text>
            <Text style={styles.cardDesc}>
              GPS로 경로를 자동 기록하고{'\n'}걷는 중에 스팟도 추가해요
            </Text>
          </View>
          <Text style={styles.cardArrow}>{'›'}</Text>
        </TouchableOpacity>

        {/* Card 2: Manual Input */}
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('TrailPublish', {
            pathData: null,
            distance: 0,
            duration: 0,
            elevationGain: 0,
            spots: [],
            startLat: null,
            startLng: null,
            endLat: null,
            endLng: null,
            manualMode: true,
          })}>
          <View style={[styles.cardIconWrap, { backgroundColor: '#FFF5EE' }]}>
            <Text style={styles.cardIcon}>{'📝'}</Text>
          </View>
          <View style={styles.cardTextWrap}>
            <Text style={styles.cardTitle}>직접 입력하기</Text>
            <Text style={styles.cardDesc}>
              코스 정보를 직접 입력해서{'\n'}나만의 코스를 등록해요
            </Text>
          </View>
          <Text style={styles.cardArrow}>{'›'}</Text>
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  backBtnText: {
    fontSize: 18,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 28,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F0F7F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardIcon: {
    fontSize: 24,
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  cardArrow: {
    fontSize: 24,
    color: colors.textTertiary,
    marginLeft: 8,
  },
});
