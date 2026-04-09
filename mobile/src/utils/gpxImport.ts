/**
 * GPX import — pick a .gpx file from the device and POST it to the
 * backend. The server parses the file (apps/trails/gpx_import.py) and
 * creates a draft Trail record that the user can then edit.
 *
 * Returns the new trail's id on success, or throws.
 */
import { pick, types } from '@react-native-documents/picker';
import { Platform } from 'react-native';
import api from '../api/client';

export interface ImportedTrail {
  id: number;
  title: string;
  distance_km: number;
  elevation_gain_m: number;
  point_count: number;
  status: string;
  message: string;
}

export async function pickAndImportGpx(): Promise<ImportedTrail> {
  // Step 1: open the system file picker, restrict to .gpx
  const results = await pick({
    type:
      Platform.OS === 'ios'
        ? ['com.topografix.gpx', 'public.xml', 'public.data']
        : ['application/gpx+xml', 'application/octet-stream', 'text/xml', '*/*'],
    allowMultiSelection: false,
  });
  if (!results || results.length === 0) {
    throw new Error('파일 선택이 취소되었습니다.');
  }
  const file = results[0];
  if (!file.uri) {
    throw new Error('파일을 읽을 수 없습니다.');
  }
  if (!(file.name || '').toLowerCase().endsWith('.gpx')) {
    throw new Error('GPX 파일만 가져올 수 있습니다.');
  }

  // Step 2: build multipart body and POST
  const form = new FormData();
  form.append('gpx', {
    uri: file.uri,
    name: file.name || 'route.gpx',
    type: 'application/gpx+xml',
  } as any);

  const { data } = await api.post('/trails/import-gpx/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  return data as ImportedTrail;
}
