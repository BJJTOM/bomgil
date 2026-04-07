import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>서비스 이용약관</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.updated}>최종 수정일: 2026년 4월 1일</Text>

        <Text style={styles.sectionTitle}>제1조 (목적)</Text>
        <Text style={styles.body}>
          본 약관은 모루(Moru, 이하 "회사")가 운영하는 모루워크(moruwalk.com) 모바일 애플리케이션 및 웹사이트(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
        </Text>

        <Text style={styles.sectionTitle}>제2조 (정의)</Text>
        <Text style={styles.body}>
          1. "서비스"란 회사가 제공하는 도보 산책 코스 탐색, 걷기 활동 기록, 커뮤니티 등 관련 제반 서비스를 의미합니다.{'\n'}
          2. "이용자"란 본 약관에 동의하고 서비스를 이용하는 회원 및 비회원을 말합니다.{'\n'}
          3. "회원"이란 서비스에 가입하여 계정을 생성한 자를 말합니다.{'\n'}
          4. "게스트"란 회원가입 없이 제한된 기능을 이용하는 자를 말합니다.{'\n'}
          5. "코스"란 이용자가 등록한 도보 경로 정보를 말합니다.{'\n'}
          6. "스팟"이란 코스 내 특정 경유지 정보를 말합니다.{'\n'}
          7. "활동"이란 GPS 기반 걷기 기록 데이터를 말합니다.
        </Text>

        <Text style={styles.sectionTitle}>제3조 (약관의 효력 및 변경)</Text>
        <Text style={styles.body}>
          1. 본 약관은 서비스 내 공지 또는 이용자에게 전자적 방법으로 통지함으로써 효력이 발생합니다.{'\n'}
          2. 회사는 관련 법령에 위배되지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 7일 전에 공지합니다.{'\n'}
          3. 이용자가 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.
        </Text>

        <Text style={styles.sectionTitle}>제4조 (서비스의 제공)</Text>
        <Text style={styles.body}>
          회사는 다음과 같은 서비스를 제공합니다:{'\n\n'}
          - 도보 산책 코스 검색, 탐색 및 상세 정보 제공{'\n'}
          - GPS 기반 걷기 활동 기록 및 추적{'\n'}
          - 코스 등록, 경유지(스팟) 등록 및 공유{'\n'}
          - 걷기 활동 통계 (거리, 걸음수, 칼로리, 고도){'\n'}
          - 커뮤니티 (게시글, 댓글, 좋아요, 북마크){'\n'}
          - 리뷰 및 평점 시스템{'\n'}
          - 코스 랭킹 및 추천{'\n'}
          - 갤럭시 워치/Health Connect 연동{'\n'}
          - 푸시 알림 서비스
        </Text>

        <Text style={styles.sectionTitle}>제5조 (회원가입 및 계정)</Text>
        <Text style={styles.body}>
          1. 회원가입은 이메일 또는 게스트 로그인으로 가능합니다.{'\n'}
          2. 게스트 계정은 일부 기능이 제한되며, 7일 이상 미사용 시 자동 삭제될 수 있습니다.{'\n'}
          3. 이용자는 정확한 정보를 제공해야 하며, 타인의 정보를 도용해서는 안 됩니다.{'\n'}
          4. 계정 관리 책임은 이용자 본인에게 있습니다.
        </Text>

        <Text style={styles.sectionTitle}>제6조 (이용자의 의무)</Text>
        <Text style={styles.body}>
          이용자는 다음 행위를 하여서는 안 됩니다:{'\n\n'}
          - 타인의 개인정보를 무단 수집하거나 도용하는 행위{'\n'}
          - 허위 코스 정보 또는 스팟 정보를 등록하는 행위{'\n'}
          - 서비스를 이용한 영리 목적의 스팸 활동{'\n'}
          - 욕설, 비방, 음란물 등 커뮤니티 질서를 해치는 게시물 작성{'\n'}
          - 서비스의 정상적인 운영을 방해하는 행위{'\n'}
          - 자동화된 도구를 이용한 대량 데이터 수집{'\n'}
          - 기타 관련 법령에 위반되는 행위
        </Text>

        <Text style={styles.sectionTitle}>제7조 (게시물의 저작권 및 관리)</Text>
        <Text style={styles.body}>
          1. 이용자가 작성한 코스, 스팟, 리뷰, 사진 등 게시물의 저작권은 해당 이용자에게 귀속됩니다.{'\n'}
          2. 이용자는 게시물을 서비스 내에서 다른 이용자가 열람하는 것에 동의합니다.{'\n'}
          3. 회사는 서비스 운영 및 홍보 목적으로 게시물을 활용할 수 있으며, 이 경우 게시물의 일부를 수정하거나 편집할 수 있습니다.{'\n'}
          4. 회사는 관련 법령 및 커뮤니티 가이드라인에 위반되는 게시물을 사전 통보 없이 삭제할 수 있습니다.
        </Text>

        <Text style={styles.sectionTitle}>제8조 (위치 정보 이용)</Text>
        <Text style={styles.body}>
          1. 서비스는 걷기 기록, 코스 탐색, 주변 코스 검색 등을 위해 이용자의 위치 정보를 수집합니다.{'\n'}
          2. 위치 정보는 이용자가 해당 기능을 명시적으로 활성화한 경우에만 수집됩니다.{'\n'}
          3. 백그라운드 위치 수집은 걷기 기록 기능 사용 중에만 이루어지며, 걷기 종료 시 즉시 중단됩니다.{'\n'}
          4. 수집된 위치 정보는 이용자가 언제든 삭제를 요청할 수 있습니다.
        </Text>

        <Text style={styles.sectionTitle}>제9조 (서비스 이용 제한)</Text>
        <Text style={styles.body}>
          1. 회사는 이용자가 본 약관을 위반한 경우 서비스 이용을 제한하거나 계정을 정지할 수 있습니다.{'\n'}
          2. 스팸, 허위 정보, 부적절한 게시물에 대해 레이트 리밋이 적용됩니다.{'\n'}
          3. API 호출은 시간당 일정 횟수로 제한되며, 초과 시 일시적으로 이용이 제한될 수 있습니다.
        </Text>

        <Text style={styles.sectionTitle}>제10조 (면책 조항)</Text>
        <Text style={styles.body}>
          1. 회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력적 사유로 서비스를 제공할 수 없는 경우 책임이 면제됩니다.{'\n'}
          2. 이용자가 등록한 코스 및 스팟 정보의 정확성에 대해 회사는 보증하지 않습니다. 실제 도보 시 안전에 유의하시기 바랍니다.{'\n'}
          3. GPS 기반 활동 기록의 정확도는 기기 성능 및 환경에 따라 달라질 수 있습니다.
        </Text>

        <Text style={styles.sectionTitle}>제11조 (분쟁 해결)</Text>
        <Text style={styles.body}>
          본 약관과 관련된 분쟁은 대한민국 법률에 따르며, 관할 법원은 회사의 본사 소재지를 관할하는 법원으로 합니다.{'\n\n'}
          문의: support@moruwalk.com
        </Text>

        <View style={{ height: 80 }} />
      </ScrollView>
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
  content: { paddingHorizontal: 20, paddingTop: 8 },
  updated: { fontSize: 12, color: colors.textTertiary, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 24, marginBottom: 8 },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
});
