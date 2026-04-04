import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>서비스 이용약관</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>제1조 (목적)</Text>
        <Text style={styles.body}>
          이 약관은 Roami(이하 "서비스")가 제공하는 모든 서비스의 이용 조건 및 절차, 이용자와 서비스 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
        </Text>

        <Text style={styles.sectionTitle}>제2조 (정의)</Text>
        <Text style={styles.body}>
          1. "서비스"란 Roami가 제공하는 도보여행 코스 공유 플랫폼 및 관련 제반 서비스를 의미합니다.{'\n'}
          2. "이용자"란 이 약관에 따라 서비스가 제공하는 서비스를 받는 회원 및 비회원을 말합니다.{'\n'}
          3. "회원"이란 서비스에 개인정보를 제공하여 회원등록을 한 자로서, 서비스의 정보를 지속적으로 제공받으며, 서비스가 제공하는 서비스를 계속적으로 이용할 수 있는 자를 말합니다.
        </Text>

        <Text style={styles.sectionTitle}>제3조 (약관의 효력 및 변경)</Text>
        <Text style={styles.body}>
          1. 이 약관은 서비스를 이용하고자 하는 모든 이용자에 대하여 그 효력을 발생합니다.{'\n'}
          2. 이 약관의 내용은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지하고, 이에 동의한 이용자가 서비스에 가입함으로써 효력이 발생합니다.
        </Text>

        <Text style={styles.sectionTitle}>제4조 (서비스의 제공)</Text>
        <Text style={styles.body}>
          1. 서비스는 다음과 같은 서비스를 제공합니다:{'\n'}
          - 도보여행 코스 검색 및 탐색{'\n'}
          - 코스 등록 및 공유{'\n'}
          - 걷기 활동 기록 및 추적{'\n'}
          - 커뮤니티 기능 (이야기, 댓글, 좋아요){'\n'}
          - 동행 매칭 서비스{'\n'}
          2. 서비스는 업무상 또는 기술상 특별한 지장이 없는 한 연중무휴, 1일 24시간 서비스를 제공합니다.
        </Text>

        <Text style={styles.sectionTitle}>제5조 (이용자의 의무)</Text>
        <Text style={styles.body}>
          1. 이용자는 다음 행위를 하여서는 안 됩니다:{'\n'}
          - 타인의 정보를 도용하는 행위{'\n'}
          - 서비스에 게시된 정보를 변경하는 행위{'\n'}
          - 서비스가 정한 정보 이외의 정보를 송신하거나 게시하는 행위{'\n'}
          - 서비스 기타 제3자의 저작권 등 지적재산권에 대한 침해{'\n'}
          - 서비스 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위{'\n'}
          - 외설 또는 폭력적인 메시지, 화상, 음성 등 공서양속에 반하는 정보를 서비스에 공개 또는 게시하는 행위
        </Text>

        <Text style={styles.sectionTitle}>제6조 (저작권)</Text>
        <Text style={styles.body}>
          1. 이용자가 서비스 내에 게시한 게시물의 저작권은 해당 게시물의 저작자에게 귀속됩니다.{'\n'}
          2. 이용자가 서비스 내에 게시하는 게시물은 서비스 운영, 홍보 등에 노출될 수 있으며, 해당 노출을 위해 필요한 범위 내에서 일부 수정, 복제, 편집될 수 있습니다.
        </Text>

        <View style={{ height: 60 }} />
      </ScrollView>
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
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  backIcon: {
    fontSize: 18,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 24,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
