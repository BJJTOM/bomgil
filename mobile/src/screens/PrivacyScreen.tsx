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

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>개인정보처리방침</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>1. 개인정보의 수집 및 이용 목적</Text>
        <Text style={styles.body}>
          Roami(이하 "서비스")는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.{'\n\n'}
          - 회원 가입 및 관리{'\n'}
          - 서비스 제공 및 맞춤형 서비스 제공{'\n'}
          - 마케팅 및 광고에의 활용{'\n'}
          - 서비스 이용 기록 분석
        </Text>

        <Text style={styles.sectionTitle}>2. 수집하는 개인정보 항목</Text>
        <Text style={styles.body}>
          서비스는 회원가입, 서비스 이용 등을 위해 아래와 같은 개인정보를 수집하고 있습니다.{'\n\n'}
          필수항목: 이메일, 닉네임, 비밀번호{'\n'}
          선택항목: 프로필 사진, 자기소개, 연령대, 걷기 스타일, 선호 언어{'\n'}
          자동수집항목: 위치 정보(걷기 기록 시), 기기 정보, 접속 로그
        </Text>

        <Text style={styles.sectionTitle}>3. 개인정보의 보유 및 이용 기간</Text>
        <Text style={styles.body}>
          이용자의 개인정보는 원칙적으로 개인정보의 수집 및 이용목적이 달성되면 지체 없이 파기합니다.{'\n\n'}
          단, 다음의 정보에 대해서는 아래의 이유로 명시한 기간 동안 보존합니다:{'\n'}
          - 서비스 이용 기록: 3년 (전자상거래법){'\n'}
          - 접속 로그: 3개월 (통신비밀보호법)
        </Text>

        <Text style={styles.sectionTitle}>4. 개인정보의 제3자 제공</Text>
        <Text style={styles.body}>
          서비스는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 아래의 경우에는 예외로 합니다:{'\n\n'}
          - 이용자가 사전에 동의한 경우{'\n'}
          - 법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우
        </Text>

        <Text style={styles.sectionTitle}>5. 위치 정보</Text>
        <Text style={styles.body}>
          서비스는 걷기 활동 기록을 위해 이용자의 위치 정보를 수집할 수 있습니다. 위치 정보는 걷기 기록 기능 사용 시에만 수집되며, 이용자가 명시적으로 기능을 활성화한 경우에만 수집합니다.{'\n\n'}
          수집된 위치 정보는 걷기 경로 표시 및 활동 기록 목적으로만 사용되며, 이용자가 원하는 경우 언제든지 삭제할 수 있습니다.
        </Text>

        <Text style={styles.sectionTitle}>6. 이용자의 권리</Text>
        <Text style={styles.body}>
          이용자는 언제든지 자신의 개인정보를 조회하거나 수정할 수 있으며, 회원 탈퇴를 통해 개인정보의 수집 및 이용에 대한 동의를 철회할 수 있습니다.{'\n\n'}
          개인정보 관련 문의: support@roami.app
        </Text>

        <Text style={styles.sectionTitle}>7. 개인정보 보호책임자</Text>
        <Text style={styles.body}>
          성명: Roami 개인정보보호팀{'\n'}
          이메일: privacy@roami.app{'\n\n'}
          시행일: 2026년 1월 1일
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
