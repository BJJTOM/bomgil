/**
 * GPX Exporter
 *
 * Converts a Moru walk recording (trackPoints + metadata) into a
 * standard GPX 1.1 XML file that can be imported into Strava, Garmin
 * Connect, AllTrails, Komoot, etc.
 *
 * GPX format reference: https://www.topografix.com/gpx/1/1/
 */
import { Share, Platform } from 'react-native';

interface GpxTrackPoint {
  lat: number;
  lng: number;
  ele?: number | null;
  time?: string;
  speed?: number | null; // m/s
}

interface GpxMetadata {
  name?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  distanceKm?: number;
  durationMinutes?: number;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate a GPX 1.1 XML string from track points and metadata.
 */
export function generateGpxString(
  points: GpxTrackPoint[],
  metadata: GpxMetadata = {},
): string {
  const name = metadata.name || 'Moru Walk';
  const desc = metadata.description || '';
  const time = metadata.startTime || new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1"
     creator="Moru - moruwalk.com"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(desc)}</desc>
    <time>${time}</time>
    <link href="https://moruwalk.com">
      <text>Moru</text>
    </link>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <type>walking</type>
    <trkseg>
`;

  for (const pt of points) {
    if (!pt.lat || !pt.lng) continue;
    xml += `      <trkpt lat="${pt.lat.toFixed(7)}" lon="${pt.lng.toFixed(7)}">`;
    if (pt.ele != null) {
      xml += `<ele>${pt.ele.toFixed(1)}</ele>`;
    }
    if (pt.time) {
      xml += `<time>${pt.time}</time>`;
    }
    if (pt.speed != null && pt.speed > 0) {
      xml += `<extensions><speed>${pt.speed.toFixed(2)}</speed></extensions>`;
    }
    xml += `</trkpt>\n`;
  }

  xml += `    </trkseg>
  </trk>
</gpx>`;

  return xml;
}

/**
 * Share a GPX file via the system share sheet.
 * On Android, this opens the share dialog. On iOS, the share sheet.
 *
 * Note: This uses Share.share() with the GPX content as message text.
 * For actual file sharing (e.g., save to Downloads), you'd need
 * react-native-fs or react-native-blob-util. This approach works for
 * sharing via KakaoTalk, email, Strava import URL, etc.
 */
export async function shareGpxFile(
  points: GpxTrackPoint[],
  metadata: GpxMetadata = {},
): Promise<boolean> {
  if (points.length === 0) return false;

  const gpx = generateGpxString(points, metadata);
  const filename = `moru_${(metadata.name || 'walk').replace(/\s+/g, '_')}_${
    new Date().toISOString().split('T')[0]
  }.gpx`;

  try {
    const result = await Share.share(
      Platform.OS === 'android'
        ? {
            title: filename,
            message: gpx,
          }
        : {
            title: filename,
            message: gpx,
          },
      {
        dialogTitle: 'GPX 내보내기',
        subject: filename,
      },
    );
    return result.action !== Share.dismissedAction;
  } catch (e) {
    console.log('[GPX] share failed:', e);
    return false;
  }
}
