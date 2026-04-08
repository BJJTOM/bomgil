import type { TranslationKeys } from './ko';

const en: TranslationKeys = {
  // Tab labels
  tabs: {
    home: 'Home',
    explore: 'Explore',
    activity: 'Activity',
    community: 'Community',
    my: 'MY',
  },

  // Common buttons
  common: {
    done: 'Done',
    cancel: 'Cancel',
    delete: 'Delete',
    save: 'Save',
    edit: 'Edit',
    confirm: 'OK',
    retry: 'Retry',
    close: 'Close',
    next: 'Next',
    back: 'Back',
    search: 'Search',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
  },

  // Walk screen
  walk: {
    start: 'Start Walk',
    pause: 'Pause',
    resume: 'Resume',
    stop: 'Stop',
    walking: 'Walking',
    paused: 'Paused',
    distance: 'Distance',
    steps: 'Steps',
    time: 'Time',
    calories: 'Calories',
    pace: 'Pace',
    complete: 'Walk Complete',
    noGps: 'Searching for GPS...',
  },

  // Settings
  settings: {
    title: 'Settings',
    profile: 'Profile',
    editProfile: 'Edit Profile',
    language: 'Language',
    theme: 'Theme',
    notifications: 'Notifications',
    notice: 'Notices',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    version: 'Version',
    logout: 'Log Out',
    deleteAccount: 'Delete Account',
    darkMode: 'Dark Mode',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  },

  // Health Connect
  health: {
    title: 'Import Watch Records',
    connecting: 'Connecting to Health Connect...',
    unavailable: 'Health Connect is not available',
    installDesc: 'Install Health Connect to import walking records from your Galaxy Watch.',
    settingsDesc: 'Please check Moru app permissions in Health Connect settings.',
    openSettings: 'Open Health Connect Settings',
    installFromStore: 'Install from Play Store',
    retryCheck: 'Check Again',
    permissionNeeded: 'Health data access permission is required',
    permissionDesc: 'Please allow Health Connect permissions to import walking records from your Galaxy Watch.',
    grantPermission: 'Grant Permission',
    noRecords: 'No walking records in the last 30 days',
    noRecordsDesc: 'Walking records from your Galaxy Watch or Samsung Health will appear here.',
    import: 'Import',
    importTitle: 'Import Record',
    importComplete: 'Import Complete',
    importFailed: 'Import failed.',
  },

  // Activity
  activity: {
    title: 'Activity',
    noActivities: 'No activity records yet',
    addRecord: 'Add Record',
  },
} as const;

export default en;
