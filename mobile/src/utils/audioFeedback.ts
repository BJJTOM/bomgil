/**
 * Audio & Haptic Feedback for Walk Recording
 *
 * Announces distance, pace, and time via TTS at each km split and
 * vibrates the phone. Matches Nike Run Club / Strava / Samsung Health
 * behavior — users with the phone in their pocket depend on these cues.
 *
 * Usage (from WalkScreen):
 *   const feedback = new WalkAudioFeedback('ko');
 *   feedback.announceSplit(km, paceMinPerKm, totalDistance, durationSec);
 *   feedback.announceFinish(totalDistance, durationSec, steps, calories);
 *   feedback.destroy();
 */
import { Vibration, Platform } from 'react-native';
import Tts from 'react-native-tts';

export type FeedbackLanguage = 'ko' | 'en';

// Haptic patterns (milliseconds: [pause, vibrate, pause, vibrate, ...])
const SPLIT_VIBRATION = Platform.OS === 'android'
  ? [0, 150, 80, 300]  // short–long
  : [0, 200];           // iOS simplified
const FINISH_VIBRATION = Platform.OS === 'android'
  ? [0, 200, 100, 200, 100, 400] // celebration triple-buzz
  : [0, 300, 100, 300];

let ttsInitialized = false;

async function initTts(lang: FeedbackLanguage): Promise<void> {
  if (ttsInitialized) return;
  try {
    await Tts.setDefaultLanguage(lang === 'ko' ? 'ko-KR' : 'en-US');
    await Tts.setDefaultRate(0.52); // slightly slower than normal for clarity outdoors
    await Tts.setDefaultPitch(1.0);
    // Lower the music volume temporarily while speaking (ducking)
    await Tts.setDucking(true);
    ttsInitialized = true;
  } catch (e) {
    console.log('[AudioFeedback] TTS init failed:', e);
  }
}

function formatPaceKorean(paceMinPerKm: number): string {
  if (!paceMinPerKm || paceMinPerKm <= 0 || paceMinPerKm > 30) return '';
  const min = Math.floor(paceMinPerKm);
  const sec = Math.round((paceMinPerKm - min) * 60);
  if (sec === 0) return `킬로미터당 ${min}분`;
  return `킬로미터당 ${min}분 ${sec}초`;
}

function formatPaceEnglish(paceMinPerKm: number): string {
  if (!paceMinPerKm || paceMinPerKm <= 0 || paceMinPerKm > 30) return '';
  const min = Math.floor(paceMinPerKm);
  const sec = Math.round((paceMinPerKm - min) * 60);
  if (sec === 0) return `${min} minutes per kilometer`;
  return `${min} minutes ${sec} seconds per kilometer`;
}

function formatDurationKorean(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}시간`);
  if (m > 0) parts.push(`${m}분`);
  if (s > 0 && h === 0) parts.push(`${s}초`); // skip seconds for long walks
  return parts.join(' ') || '0초';
}

function formatDurationEnglish(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} hour${h > 1 ? 's' : ''}`);
  if (m > 0) parts.push(`${m} minute${m > 1 ? 's' : ''}`);
  if (s > 0 && h === 0) parts.push(`${s} second${s > 1 ? 's' : ''}`);
  return parts.join(' ') || '0 seconds';
}

export class WalkAudioFeedback {
  private lang: FeedbackLanguage;
  private enabled: boolean = true;
  private hapticEnabled: boolean = true;

  constructor(lang: FeedbackLanguage = 'ko') {
    this.lang = lang;
    initTts(lang);
  }

  setEnabled(audio: boolean, haptic: boolean = true) {
    this.enabled = audio;
    this.hapticEnabled = haptic;
  }

  /**
   * Called when a new km split is completed.
   * Vibrates + speaks: "N킬로미터. 페이스 M분 S초. 총 시간 ..."
   */
  announceSplit(
    km: number,
    paceMinPerKm: number,
    totalDistanceKm: number,
    durationSeconds: number,
  ): void {
    // Always vibrate (even if audio is off — haptic is separate)
    if (this.hapticEnabled) {
      try { Vibration.vibrate(SPLIT_VIBRATION); } catch {}
    }

    if (!this.enabled) return;

    let text: string;
    if (this.lang === 'ko') {
      const pace = formatPaceKorean(paceMinPerKm);
      const time = formatDurationKorean(durationSeconds);
      text = `${km}킬로미터. ${pace}. 시간 ${time}.`;
    } else {
      const pace = formatPaceEnglish(paceMinPerKm);
      const time = formatDurationEnglish(durationSeconds);
      text = `${km} kilometer${km > 1 ? 's' : ''}. Pace ${pace}. Time ${time}.`;
    }

    this.speak(text);
  }

  /**
   * Called when the walk is completed.
   * Vibrates celebration pattern + speaks summary.
   */
  announceFinish(
    distanceKm: number,
    durationSeconds: number,
    steps: number,
    calories: number,
  ): void {
    if (this.hapticEnabled) {
      try { Vibration.vibrate(FINISH_VIBRATION); } catch {}
    }

    if (!this.enabled) return;

    let text: string;
    if (this.lang === 'ko') {
      const time = formatDurationKorean(durationSeconds);
      text = `걷기 완료. ${distanceKm.toFixed(1)}킬로미터. ${time}. ${steps.toLocaleString()}걸음. ${calories}칼로리 소모. 수고했어요!`;
    } else {
      const time = formatDurationEnglish(durationSeconds);
      text = `Walk complete. ${distanceKm.toFixed(1)} kilometers. ${time}. ${steps.toLocaleString()} steps. ${calories} calories burned. Great job!`;
    }

    this.speak(text);
  }

  private speak(text: string): void {
    try {
      // Stop any in-progress speech first
      Tts.stop();
      Tts.speak(text);
    } catch (e) {
      console.log('[AudioFeedback] TTS speak failed:', e);
    }
  }

  destroy(): void {
    try { Tts.stop(); } catch {}
  }
}
