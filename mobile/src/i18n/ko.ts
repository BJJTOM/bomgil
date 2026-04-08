const ko = {
  // Tab labels
  tabs: {
    home: '홈',
    explore: '탐색',
    activity: '활동',
    community: '커뮤니티',
    my: 'MY',
  },

  // Common buttons
  common: {
    done: '완료',
    cancel: '취소',
    delete: '삭제',
    save: '저장',
    edit: '수정',
    confirm: '확인',
    retry: '다시 시도',
    close: '닫기',
    next: '다음',
    back: '뒤로',
    search: '검색',
    loading: '로딩 중...',
    error: '오류',
    success: '성공',
  },

  // Walk screen
  walk: {
    start: '걷기 시작',
    pause: '일시정지',
    resume: '이어하기',
    stop: '종료',
    walking: '걷는 중',
    paused: '일시정지됨',
    distance: '거리',
    steps: '걸음',
    time: '시간',
    calories: '칼로리',
    pace: '페이스',
    complete: '걷기 완료',
    noGps: 'GPS 신호를 찾는 중...',
  },

  // Settings
  settings: {
    title: '설정',
    profile: '프로필',
    editProfile: '프로필 수정',
    language: '언어',
    theme: '테마',
    notifications: '알림',
    notice: '공지사항',
    terms: '이용약관',
    privacy: '개인정보처리방침',
    version: '버전',
    logout: '로그아웃',
    deleteAccount: '회원 탈퇴',
    darkMode: '다크 모드',
    light: '라이트',
    dark: '다크',
    system: '시스템',
  },

  // Health Connect
  health: {
    title: '워치 기록 가져오기',
    connecting: 'Health Connect 연결 중...',
    unavailable: 'Health Connect를 사용할 수 없습니다',
    installDesc: 'Health Connect 앱을 설치하면 갤럭시 워치 걷기 기록을 가져올 수 있습니다.',
    settingsDesc: 'Health Connect 설정에서 모루 앱의 권한을 확인해주세요.',
    openSettings: 'Health Connect 설정 열기',
    installFromStore: 'Play Store에서 설치',
    retryCheck: '다시 확인',
    permissionNeeded: '건강 데이터 접근 권한이 필요합니다',
    permissionDesc: '갤럭시 워치 걷기 기록을 가져오려면 Health Connect 권한을 허용해주세요.',
    grantPermission: '권한 허용하기',
    noRecords: '최근 30일간 걷기 기록이 없습니다',
    noRecordsDesc: '갤럭시 워치나 Samsung Health에서 걷기를 기록하면 여기에 표시됩니다.',
    import: '가져오기',
    importTitle: '기록 가져오기',
    importComplete: '가져오기 완료',
    importFailed: '가져오기에 실패했습니다.',
  },

  // Activity
  activity: {
    title: '활동',
    noActivities: '아직 활동 기록이 없습니다',
    addRecord: '기록 추가',
  },
} as const;

export default ko;
export type TranslationKeys = typeof ko;
