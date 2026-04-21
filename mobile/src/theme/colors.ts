export const colors = {
  primary: '#2D4A2E',
  primary50: '#f0f7f0',
  accent: '#4ADE80',
  accentLight: '#d4f5e4',
  warm: '#FAFAFA',
  surface: '#FFFFFF',
  danger: '#FF4B4B',
  textPrimary: '#191F28',
  textSecondary: '#8B95A1',
  textTertiary: '#B0B8C1',
  borderDefault: '#E5E8EB',
  borderLight: '#F2F4F6',
  bgSecondary: '#F7F8FA',
  difficulty: {
    easy: '#22C55E',
    moderate: '#F59E0B',
    hard: '#EF4444',
  },
};

export const darkColors = {
  primary: '#4ADE80',
  primary50: 'rgba(74,222,128,0.1)',
  accent: '#A8E6CF',
  accentLight: 'rgba(168,230,207,0.15)',
  warm: '#0a0a0a',
  surface: '#1e1e1e',
  danger: '#EF4444',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  textTertiary: 'rgba(255,255,255,0.4)',
  borderDefault: 'rgba(255,255,255,0.1)',
  borderLight: 'rgba(255,255,255,0.06)',
  bgSecondary: '#1a1a1a',
  difficulty: {
    easy: '#4ADE80',
    moderate: '#FBBF24',
    hard: '#F87171',
  },
};

export function getColors(isDark: boolean) {
  return isDark ? darkColors : colors;
}
