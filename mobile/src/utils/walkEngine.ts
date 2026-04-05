/**
 * Roami Walk Engine
 * Professional-grade walk tracking comparable to Nike Run / Garmin
 *
 * Features:
 * - Kalman-filtered GPS for noise reduction
 * - Auto-pause when speed drops below threshold
 * - Per-km split tracking
 * - Elevation gain/loss calculation
 * - Step estimation from distance
 * - Cadence calculation
 */

export interface TrackPoint {
  lat: number;
  lng: number;
  ele: number | null;
  time: string;
  speed: number | null; // m/s
  accuracy: number | null;
}

export interface KmSplit {
  km: number;
  duration: number; // seconds for this km
  pace: number; // min/km
  elevationGain: number;
  elevationLoss: number;
}

export interface WalkStats {
  distance: number; // km
  duration: number; // seconds (active time, excludes pauses)
  totalTime: number; // seconds (including pauses)
  pace: number; // min/km (average)
  currentPace: number; // min/km (last 30 sec rolling average)
  speed: number; // km/h
  steps: number;
  cadence: number; // steps per minute
  calories: number;
  elevationGain: number; // meters
  elevationLoss: number; // meters
  maxElevation: number;
  minElevation: number;
  maxSpeed: number; // km/h
  splits: KmSplit[];
  isAutoPaused: boolean;
}

// Haversine distance in km
function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Simple Kalman filter for GPS smoothing
class KalmanFilter {
  private lat: number = 0;
  private lng: number = 0;
  private variance: number = -1; // Negative means uninitialized
  private readonly minAccuracy = 3; // meters

  update(
    lat: number,
    lng: number,
    accuracy: number,
  ): { lat: number; lng: number } {
    accuracy = Math.max(accuracy, this.minAccuracy);

    if (this.variance < 0) {
      // First update
      this.lat = lat;
      this.lng = lng;
      this.variance = accuracy * accuracy;
    } else {
      // Kalman gain
      const k = this.variance / (this.variance + accuracy * accuracy);
      this.lat += k * (lat - this.lat);
      this.lng += k * (lng - this.lng);
      this.variance = (1 - k) * this.variance;
    }

    return { lat: this.lat, lng: this.lng };
  }
}

export class WalkEngine {
  private trackPoints: TrackPoint[] = [];
  private kalman = new KalmanFilter();
  private distance = 0; // km
  private activeTime = 0; // seconds
  private startTime = 0;
  private lastActiveTime = 0;
  private elevationGain = 0;
  private elevationLoss = 0;
  private maxElevation = -Infinity;
  private minElevation = Infinity;
  private maxSpeed = 0;
  private splits: KmSplit[] = [];
  private currentSplitStart = 0; // time when current km started
  private currentSplitDistance = 0; // distance at start of current km
  private currentSplitEleGain = 0;
  private currentSplitEleLoss = 0;
  private isAutoPaused = false;
  private autoPauseThreshold = 0.5; // km/h — below this = auto pause
  private lastSpeedSamples: number[] = [];

  // Constants
  private readonly STEPS_PER_KM = 1350; // average walking
  private readonly CALORIES_PER_KM = 65; // average walking
  private readonly MIN_DISTANCE_FILTER = 0.003; // 3 meters — ignore GPS jitter

  start() {
    this.startTime = Date.now();
    this.lastActiveTime = Date.now();
    this.currentSplitStart = Date.now();
  }

  addPoint(
    lat: number,
    lng: number,
    altitude: number | null,
    accuracy: number | null,
    timestamp: number,
  ): TrackPoint | null {
    // Apply Kalman filter
    const filtered = this.kalman.update(lat, lng, accuracy || 10);

    const point: TrackPoint = {
      lat: filtered.lat,
      lng: filtered.lng,
      ele: altitude,
      time: new Date(timestamp).toISOString(),
      speed: null,
      accuracy,
    };

    if (this.trackPoints.length > 0) {
      const prev = this.trackPoints[this.trackPoints.length - 1];
      const d = haversine(prev.lat, prev.lng, filtered.lat, filtered.lng);

      // Filter out GPS jitter
      if (d < this.MIN_DISTANCE_FILTER) {
        return null; // Skip this point
      }

      // Calculate speed
      const timeDiff =
        (timestamp - new Date(prev.time).getTime()) / 1000; // seconds
      if (timeDiff > 0) {
        const speedKmh = (d / timeDiff) * 3600;
        point.speed = speedKmh / 3.6; // m/s

        // Auto-pause detection
        this.lastSpeedSamples.push(speedKmh);
        if (this.lastSpeedSamples.length > 5) this.lastSpeedSamples.shift();
        const avgSpeed =
          this.lastSpeedSamples.reduce((a, b) => a + b, 0) /
          this.lastSpeedSamples.length;

        if (avgSpeed < this.autoPauseThreshold) {
          this.isAutoPaused = true;
        } else {
          if (this.isAutoPaused) {
            // Resuming from auto-pause
            this.isAutoPaused = false;
          }
          this.activeTime += timeDiff;
          this.distance += d;

          // Track max speed
          if (speedKmh > this.maxSpeed && speedKmh < 20) {
            // cap at 20km/h for walking
            this.maxSpeed = speedKmh;
          }
        }
      }

      // Elevation tracking
      if (altitude != null && prev.ele != null) {
        const eleDiff = altitude - prev.ele;
        if (Math.abs(eleDiff) > 1) {
          // Ignore < 1m changes (noise)
          if (eleDiff > 0) {
            this.elevationGain += eleDiff;
            this.currentSplitEleGain += eleDiff;
          } else {
            this.elevationLoss += Math.abs(eleDiff);
            this.currentSplitEleLoss += Math.abs(eleDiff);
          }
        }
      }

      if (altitude != null) {
        this.maxElevation = Math.max(this.maxElevation, altitude);
        this.minElevation = Math.min(this.minElevation, altitude);
      }

      // Check for km split
      const currentKm = Math.floor(this.distance);
      if (currentKm > this.splits.length) {
        const splitDuration = (timestamp - this.currentSplitStart) / 1000;
        this.splits.push({
          km: currentKm,
          duration: splitDuration,
          pace: splitDuration / 60, // min/km
          elevationGain: this.currentSplitEleGain,
          elevationLoss: this.currentSplitEleLoss,
        });
        this.currentSplitStart = timestamp;
        this.currentSplitEleGain = 0;
        this.currentSplitEleLoss = 0;
      }
    } else {
      // First point
      if (altitude != null) {
        this.maxElevation = altitude;
        this.minElevation = altitude;
      }
    }

    this.trackPoints.push(point);
    return point;
  }

  getStats(): WalkStats {
    const totalTime =
      this.startTime > 0 ? (Date.now() - this.startTime) / 1000 : 0;
    const pace =
      this.activeTime > 0 && this.distance > 0.01
        ? this.activeTime / 60 / this.distance
        : 0;

    // Current pace (rolling average from recent points)
    let currentPace = 0;
    if (this.trackPoints.length >= 2) {
      const recent = this.trackPoints.slice(-5);
      let recentDist = 0;
      let recentTime = 0;
      for (let i = 1; i < recent.length; i++) {
        recentDist += haversine(
          recent[i - 1].lat,
          recent[i - 1].lng,
          recent[i].lat,
          recent[i].lng,
        );
        recentTime +=
          (new Date(recent[i].time).getTime() -
            new Date(recent[i - 1].time).getTime()) /
          1000;
      }
      if (recentDist > 0.001 && recentTime > 0) {
        currentPace = recentTime / 60 / recentDist;
      }
    }

    const steps = Math.round(this.distance * this.STEPS_PER_KM);
    const cadence =
      this.activeTime > 0 ? (steps / this.activeTime) * 60 : 0;

    return {
      distance: this.distance,
      duration: this.activeTime,
      totalTime,
      pace,
      currentPace,
      speed:
        this.activeTime > 0
          ? (this.distance / this.activeTime) * 3600
          : 0,
      steps,
      cadence: Math.round(cadence),
      calories: Math.round(this.distance * this.CALORIES_PER_KM),
      elevationGain: Math.round(this.elevationGain),
      elevationLoss: Math.round(this.elevationLoss),
      maxElevation:
        this.maxElevation === -Infinity
          ? 0
          : Math.round(this.maxElevation),
      minElevation:
        this.minElevation === Infinity
          ? 0
          : Math.round(this.minElevation),
      maxSpeed: this.maxSpeed,
      splits: this.splits,
      isAutoPaused: this.isAutoPaused,
    };
  }

  getTrackPoints(): TrackPoint[] {
    return this.trackPoints;
  }

  getDistance(): number {
    return this.distance;
  }

  reset() {
    this.trackPoints = [];
    this.kalman = new KalmanFilter();
    this.distance = 0;
    this.activeTime = 0;
    this.startTime = 0;
    this.elevationGain = 0;
    this.elevationLoss = 0;
    this.maxElevation = -Infinity;
    this.minElevation = Infinity;
    this.maxSpeed = 0;
    this.splits = [];
    this.isAutoPaused = false;
    this.lastSpeedSamples = [];
  }
}
