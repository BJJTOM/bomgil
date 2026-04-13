/**
 * Off-route detection for trail-following walks.
 *
 * Given a trail path (GeoJSON LineString coordinates) and a sliding
 * window of recent GPS fixes, returns whether the user has wandered
 * too far from the path. Hysteresis is intentional — fire once when
 * the user goes off, then stay silent until they come back on, to
 * avoid repeat buzzing on noisy GPS fixes near the threshold.
 *
 * Inspired by AllTrails Plus "Wrong Turn" alerts. Tuned for walking
 * speeds (slow) so 60m threshold is a generous offset before we bug
 * the user.
 */

export type LatLng = { lat: number; lng: number };

// coordinates: Mapbox/GeoJSON style [[lng, lat], ...]
export type GeoJsonLineString = [number, number][];

const R = 6371000;

function haversineM(a: LatLng, b: LatLng): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distance in meters from `point` to the nearest vertex of `path`. */
function nearestVertexDistance(point: LatLng, path: GeoJsonLineString): number {
  if (path.length === 0) return Infinity;
  let best = Infinity;
  for (let i = 0; i < path.length; i++) {
    const [lng, lat] = path[i];
    const d = haversineM(point, { lat, lng });
    if (d < best) best = d;
  }
  return best;
}

export type OffRouteState = "on" | "off";

export class OffRouteDetector {
  // Distance in meters at which we consider the user "off-route".
  // 60m is permissive enough for parallel sidewalks and minor GPS
  // noise while still catching actual wrong-turns.
  private static OFF_THRESHOLD = 60;
  // Distance at which we consider the user "back on-route" (hysteresis).
  private static ON_THRESHOLD = 30;
  // Number of consecutive off-route fixes before we fire an alert.
  private static OFF_CONSECUTIVE = 3;

  private path: GeoJsonLineString;
  private state: OffRouteState = "on";
  private offStreak = 0;
  private lastAlertAt = 0;

  constructor(path: GeoJsonLineString) {
    this.path = path;
  }

  /**
   * Feed a new GPS fix. Returns a new state and whether an alert
   * should fire on this transition (one-shot per off event).
   */
  update(point: LatLng, now: number = Date.now()): {
    state: OffRouteState;
    distanceM: number;
    alert: boolean;
  } {
    const distance = nearestVertexDistance(point, this.path);

    if (this.state === "on") {
      if (distance > OffRouteDetector.OFF_THRESHOLD) {
        this.offStreak += 1;
        if (this.offStreak >= OffRouteDetector.OFF_CONSECUTIVE) {
          this.state = "off";
          this.offStreak = 0;
          // Suppress repeated alerts for the same off event (min 30s gap)
          const shouldAlert = now - this.lastAlertAt > 30_000;
          if (shouldAlert) this.lastAlertAt = now;
          return { state: this.state, distanceM: distance, alert: shouldAlert };
        }
      } else {
        this.offStreak = 0;
      }
      return { state: this.state, distanceM: distance, alert: false };
    }

    // state === "off"
    if (distance <= OffRouteDetector.ON_THRESHOLD) {
      this.state = "on";
      this.offStreak = 0;
      return { state: this.state, distanceM: distance, alert: false };
    }
    return { state: this.state, distanceM: distance, alert: false };
  }

  /** Is the user currently off-route? */
  isOff(): boolean {
    return this.state === "off";
  }
}
