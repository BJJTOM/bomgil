import type { TranslationKeys } from './ko';

const ja: TranslationKeys = {
  // Tab labels
  tabs: {
    home: 'ホーム',
    explore: '探索',
    activity: 'アクティビティ',
    community: 'コミュニティ',
    my: 'MY',
  },

  // Common buttons
  common: {
    done: '完了',
    cancel: 'キャンセル',
    delete: '削除',
    save: '保存',
    edit: '編集',
    confirm: '確認',
    retry: 'リトライ',
    close: '閉じる',
    next: '次へ',
    back: '戻る',
    search: '検索',
    loading: '読み込み中...',
    error: 'エラー',
    success: '成功',
  },

  // Walk screen
  walk: {
    start: 'ウォーキング開始',
    pause: '一時停止',
    resume: '再開',
    stop: '終了',
    walking: 'ウォーキング中',
    paused: '一時停止中',
    distance: '距離',
    steps: '歩数',
    time: '時間',
    calories: 'カロリー',
    pace: 'ペース',
    complete: 'ウォーキング完了',
    noGps: 'GPS信号を検索中...',
  },

  // Settings
  settings: {
    title: '設定',
    profile: 'プロフィール',
    editProfile: 'プロフィール編集',
    language: '言語',
    theme: 'テーマ',
    notifications: '通知',
    notice: 'お知らせ',
    terms: '利用規約',
    privacy: 'プライバシーポリシー',
    version: 'バージョン',
    logout: 'ログアウト',
    deleteAccount: 'アカウント削除',
    darkMode: 'ダークモード',
    light: 'ライト',
    dark: 'ダーク',
    system: 'システム',
  },

  // Health Connect
  health: {
    title: 'ウォッチ記録をインポート',
    connecting: 'Health Connectに接続中...',
    unavailable: 'Health Connectが利用できません',
    installDesc: 'Health Connectをインストールすると、Galaxy Watchのウォーキング記録をインポートできます。',
    settingsDesc: 'Health Connectの設定でMoruアプリの権限を確認してください。',
    openSettings: 'Health Connect設定を開く',
    installFromStore: 'Play Storeからインストール',
    retryCheck: '再確認',
    permissionNeeded: '健康データへのアクセス権限が必要です',
    permissionDesc: 'Galaxy Watchのウォーキング記録をインポートするには、Health Connectの権限を許可してください。',
    grantPermission: '権限を許可',
    noRecords: '過去30日間のウォーキング記録がありません',
    noRecordsDesc: 'Galaxy WatchまたはSamsung Healthでウォーキングを記録すると、ここに表示されます。',
    import: 'インポート',
    importTitle: '記録をインポート',
    importComplete: 'インポート完了',
    importFailed: 'インポートに失敗しました。',
  },

  // Activity
  activity: {
    title: 'アクティビティ',
    noActivities: 'まだアクティビティ記録がありません',
    addRecord: '記録を追加',
  },
} as const;

export default ja;
