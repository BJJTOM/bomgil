import { launchCamera } from 'react-native-image-picker';

export interface TaggedPhoto {
  uri: string;
  lat: number;
  lng: number;
  timestamp: string;
  title?: string;
  description?: string;
}

export async function takeTaggedPhoto(
  currentLat: number,
  currentLng: number,
): Promise<TaggedPhoto | null> {
  return new Promise((resolve) => {
    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.8,
        saveToPhotos: true,
      },
      (response) => {
        if (response.didCancel || response.errorCode) {
          resolve(null);
          return;
        }
        const asset = response.assets?.[0];
        if (asset?.uri) {
          resolve({
            uri: asset.uri,
            lat: currentLat,
            lng: currentLng,
            timestamp: new Date().toISOString(),
          });
        } else {
          resolve(null);
        }
      },
    );
  });
}
