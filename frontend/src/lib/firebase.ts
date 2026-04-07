import { initializeApp, getApps } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyB-17nbf6sGtSSEwuiYjFNp9sXG_COojgk",
  authDomain: "moru-media.firebaseapp.com",
  projectId: "moru-media",
  storageBucket: "moru-media.firebasestorage.app",
  messagingSenderId: "819189761074",
  appId: "1:819189761074:web:62f16cc2a65a289ffda82b",
  measurementId: "G-6TBQWCNL9K",
};

export const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const initAnalytics = async () => {
  if (typeof window !== 'undefined' && (await isSupported())) {
    return getAnalytics(app);
  }
  return null;
};
