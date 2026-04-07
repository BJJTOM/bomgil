'use client';

import { useEffect } from 'react';
import { initAnalytics } from '@/lib/firebase';

export function FirebaseInit() {
  useEffect(() => {
    initAnalytics();
  }, []);
  return null;
}
