import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>개인정보처리방침</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.updated}>시행일: 2026년 4월 1일</Text>

        <Text style={styles.body}>
          모루(Moru, 이하 "회사")는 개인정보보호법 등 관련 법령에 따라 이용자의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립하여 공개합니다.
        </Text>

        <Text style={styles.sectionTitle}>1. 수집하는 개인정보 항목</Text>
        <Text style={styles.subTitle}>필수 수집 항목</Text>
        <Text style={styles.body}>
          - 이메일 주소 (회원가입 및 로그인){'\n'}
          - 닉네임 (서비스 내 식별){'\n'}
          - 비밀번호 (계정 보안, 암호화 저장)
        </Text>
        <Text style={styles.subTitle}>선택 수집 항목</Text>
        <Text style={styles.body}>
          - 프로필 사진{'\n'}
          - 자기소개, 한줄 소개{'\n'}
          - 연령대, 걷기 스타일{'\n'}
          - 전화번호 (본인 인증 시)
        </Text>
        <Text style={styles.subTitle}>서비스 이용 시 자동 수집 항목</Text>
        <Text style={styles.body}>
          - 위치 정보 (GPS 좌표 — 걷기 기록 기능 사용 시){'\n'}
          - 기기 정보 (OS 버전, 기기 모델){'\n'}
          - 접속 로그 (IP 주소, 접속 시간){'\n'}
          - Firebase 분석 데이터 (앱 사용 패턴, 크래시 로그)
        </Text>

        <Text style={styles.sectionTitle}>2. 개인정보의 수집 및 이용 목적</Text>
        <Text style={styles.body}>
          - 회원 가입 및 본인 확인, 계정 관리{'\n'}
          - 걷기 활동 기록 (GPS 경로, 거리, 걸음수, 칼로리, 고도){'\n'}
          - 코스 및 스팟 등록, 커뮤니티 게시글 작성{'\n'}
          - 코스 추천 및 주변 코스 검색 (위치 기반){'\n'}
          - 갤럭시 워치/Health Connect 건강 데이터 연동{'\n'}
          - 푸시 알림 발송 (Firebase Cloud Messaging){'\n'}
          - 서비스 개선을 위한 이용 통계 분석{'\n'}
          - 부정 이용 방지 및 서비스 안정성 확보
        </Text>

        <Text style={styles.sectionTitle}>3. 앱 권한 수집 안내</Text>
        <Text style={styles.body}>
          서비스는 다음 기기 권한을 요청하며, 각 권한은 해당 기능 사용 시에만 수집됩니다. 권한을 거부해도 해당 기능 외 서비스 이용에는 제한이 없습니다.
        </Text>

        <View style={styles.permTable}>
          <View style={styles.permRow}>
            <Text style={styles.permLabel}>위치 (GPS)</Text>
            <Text style={styles.permDesc}>걷기 기록, 경로 추적, 주변 코스 검색</Text>
          </View>
          <View style={styles.permRow}>
            <Text style={styles.permLabel}>백그라운드 위치</Text>
            <Text style={styles.permDesc}>걷기 기록 중 앱이 백그라운드일 때 GPS 추적 유지</Text>
          </View>
          <View style={styles.permRow}>
            <Text style={styles.permLabel}>카메라</Text>
            <Text style={styles.permDesc}>걷기 중 사진 촬영, 경유지 이미지 등록</Text>
          </View>
          <View style={styles.permRow}>
            <Text style={styles.permLabel}>사진/미디어</Text>
            <Text style={styles.permDesc}>프로필 사진, 게시글/코스 이미지 첨부</Text>
          </View>
          <View style={styles.permRow}>
            <Text style={styles.permLabel}>신체 활동</Text>
            <Text style={styles.permDesc}>걸음수 측정 (가속도 센서 기반)</Text>
          </View>
          <View style={styles.permRow}>
            <Text style={styles.permLabel}>Health Connect</Text>
            <Text style={styles.permDesc}>갤럭시 워치 운동 기록, 심박수, 걸음수 가져오기</Text>
          </View>
          <View style={styles.permRow}>
            <Text style={styles.permLabel}>알림</Text>
            <Text style={styles.permDesc}>좋아요, 댓글, 새 코스 등 푸시 알림 수신</Text>
          </View>
          <View style={styles.permRow}>
            <Text style={styles.permLabel}>인터넷</Text>
            <Text style={styles.permDesc}>서비스 이용을 위한 네트워크 통신</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>4. 개인정보의 보유 및 이용 기간</Text>
        <Text style={styles.body}>
          이용자의 개인정보는 수집 및 이용 목적이 달성된 후 지체 없이 파기합니다.{'\n\n'}
          - 회원 정보: 회원 탈퇴 시 즉시 삭제{'\n'}
          - 게스트 계정: 생성 후 7일 경과 시 자동 삭제{'\n'}
          - 걷기 활동 기록: 이용자 삭제 요청 시 즉시 삭제{'\n'}
          - 위치 정보: 걷기 종료 시 서버 전송 후 기기에서 삭제{'\n'}
          - 접속 로그: 3개월 보관 후 파기 (통신비밀보호법){'\n'}
          - 서비스 이용 기록: 3년 보관 (전자상거래법)
        </Text>

        <Text style={styles.sectionTitle}>5. 개인정보의 제3자 제공</Text>
        <Text style={styles.body}>
          회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만 다음의 경우 예외로 합니다:{'\n\n'}
          - 이용자가 사전에 동의한 경우{'\n'}
          - 법령에 따라 수사기관의 요청이 있는 경우
        </Text>

        <Text style={styles.sectionTitle}>6. 개인정보 처리 위탁</Text>
        <Text style={styles.body}>
          회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁합니다:{'\n\n'}
          - Cloudflare R2: 이미지 파일 저장{'\n'}
          - Firebase (Google): 앱 분석, 크래시 리포팅, 푸시 알림{'\n'}
          - Render: 서버 호스팅 및 데이터베이스 운영{'\n'}
          - Mapbox: 지도 표시 (위치 좌표 전송)
        </Text>

        <Text style={styles.sectionTitle}>7. 이용자의 권리</Text>
        <Text style={styles.body}>
          이용자는 언제든지 다음 권리를 행사할 수 있습니다:{'\n\n'}
          - 개인정보 열람, 수정 (설정 > 프로필 수정){'\n'}
          - 걷기 활동 기록 삭제 (활동 탭에서 개별 삭제){'\n'}
          - 게시물, 리뷰, 코스 삭제{'\n'}
          - 위치 정보 수집 거부 (기기 설정에서 권한 해제){'\n'}
          - 푸시 알림 수신 거부 (설정 > 알림 설정){'\n'}
          - 회원 탈퇴 및 개인정보 삭제 요청
        </Text>

        <Text style={styles.sectionTitle}>8. 개인정보의 안전성 확보 조치</Text>
        <Text style={styles.body}>
          - 비밀번호 암호화 저장 (bcrypt){'\n'}
          - HTTPS 통신 암호화{'\n'}
          - JWT 토큰 기반 인증 (자동 만료){'\n'}
          - API 호출 제한 (Rate Limiting){'\n'}
          - 이미지 파일 서명된 URL 제공 (1시간 만료)
        </Text>

        <Text style={styles.sectionTitle}>9. 개인정보 보호책임자</Text>
        <Text style={styles.body}>
          회사는 개인정보 처리에 관한 업무를 총괄하여 책임지고, 개인정보 처리와 관련한 이용자의 불만 처리 및 피해 구제를 위해 다음과 같이 개인정보 보호책임자를 지정하고 있습니다.{'\n\n'}
          담당: 모루 개인정보보호팀{'\n'}
          이메일: privacy@moruwalk.com{'\n'}
          웹사이트: moruwalk.com
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
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 28, marginBottom: 8 },
  subTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginTop: 12, marginBottom: 6 },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  permTable: { marginTop: 12, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  permRow: {
    flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F2F4F6',
  },
  permLabel: { width: 100, fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  permDesc: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
});
