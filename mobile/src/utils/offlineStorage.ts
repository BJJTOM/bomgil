import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/client';

const SAVED_TRAILS_KEY = 'roami_saved_trails';

export async function saveTrailOffline(trailId: number) {
  try {
    const { data: trail } = await api.get(`/trails/${trailId}/`);
    const { data: spots } = await api.get(`/spots/?trail=${trailId}`);

    const saved = await getSavedTrails();
    saved[trailId] = { trail, spots, savedAt: new Date().toISOString() };
    await AsyncStorage.setItem(SAVED_TRAILS_KEY, JSON.stringify(saved));
    return true;
  } catch (err) {
    return false;
  }
}

export async function getSavedTrails(): Promise<Record<number, any>> {
  try {
    const data = await AsyncStorage.getItem(SAVED_TRAILS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export async function getSavedTrail(trailId: number) {
  const saved = await getSavedTrails();
  return saved[trailId] || null;
}

export async function removeSavedTrail(trailId: number) {
  const saved = await getSavedTrails();
  delete saved[trailId];
  await AsyncStorage.setItem(SAVED_TRAILS_KEY, JSON.stringify(saved));
}

export async function isSaved(trailId: number): Promise<boolean> {
  const saved = await getSavedTrails();
  return !!saved[trailId];
}
