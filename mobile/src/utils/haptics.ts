/**
 * Haptic feedback utility
 *
 * Provides consistent haptic patterns across the app. Uses the built-in
 * Vibration API so there are no extra native dependencies.
 *
 * iOS durations are much shorter because the Taptic Engine is more
 * responsive; Android needs longer pulses to be perceptible.
 */
import { Vibration, Platform } from 'react-native';

const ios = Platform.OS === 'ios';

export const haptics = {
  /** Subtle tap — button presses, toggles */
  light: () => Vibration.vibrate(ios ? 10 : 50),

  /** Noticeable tap — confirmations, selections */
  medium: () => Vibration.vibrate(ios ? 20 : 100),

  /** Double-pulse — success moments (stamp collected, walk complete) */
  success: () => Vibration.vibrate(ios ? [0, 10, 50, 10] : [0, 40, 80, 40]),

  /** Short buzz — errors, destructive actions */
  warning: () => Vibration.vibrate(ios ? 30 : 150),
};
