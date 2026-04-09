/**
 * Moru Walk Engine v2
 * Professional-grade walk tracking comparable to Nike Run / Garmin
 *
 * Features:
 * - Kalman-filtered GPS with speed-adaptive strength
 * - Heading consistency check to reject impossible turns
 * - Auto-pause with 8-sample rolling average
 * - Per-km split tracking with elevation per split
 * - Pace-based step estimation
 * - MET-based calorie calculation
 * - Exponential moving average for elevation smoothing
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
  avgPace: number; // min/km — more accurate average pace for split
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

// Calculate bearing between two points (degrees 0-360)
function bearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const la1 = (lat1 * Math.PI) / 180;
  const la2 = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(la2);
  const x =
    Math.cos(la1) * Math.sin(la2) -
    Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Angle difference (0-180)
function angleDiff(a: number, b: number): number {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

// Speed-adaptive Kalman filter for GPS smoothing
class KalmanFilter {
  private lat: number = 0;
  private lng: number = 0;
  private variance: number = -1; // Negative means uninitialized
  private readonly minAccuracy = 2; // meters — trust GPS more

  update(
    lat: number,
    lng: number,
    accuracy: number,
    speedKmh: number = 0,
  ): { lat: number; lng: number } {
    accuracy = Math.max(accuracy, this.minAccuracy);

    // Speed-based accuracy adjustment: when stationary, increase filter strength
    if (speedKmh < 0.5) {
      // Stationary — trust existing position more, reduce jitter
      accuracy = accuracy * 2.5;
    } else if (speedKmh < 2) {
      // Very slow — moderate filter strength
      accuracy = accuracy * 1.5;
    }

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

// Get pace-based steps per km
function getStepsPerKm(paceMinPerKm: number): number {
  if (paceMinPerKm > 12) return 1200; // Walking slow
  if (paceMinPerKm >= 8) return 1400; // Normal walking
  if (paceMinPerKm >= 6) return 1600; // Fast walking
  return 1800; // Jogging
}

// Get MET value based on speed in km/h
function getMET(speedKmh: number): number {
  if (speedKmh < 3) return 2.0; // Very slow
  if (speedKmh < 4) return 3.0; // Walking 3-4 km/h
  if (speedKmh < 5) return 3.5; // Walking 4-5 km/h
  if (speedKmh < 6) return 4.3; // Brisk walking 5-6 km/h
  if (speedKmh < 7) return 5.0; // Fast walking 6-7 km/h
  return 7.0; // Jogging 7+ km/h
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
  private currentSplitActiveTime = 0; // active seconds in current split
  private isAutoPaused = false;
  private autoPauseThreshold = 0.3; // km/h — below this = auto pause (more sensitive)
  private lastSpeedSamples: number[] = [];
  private lastBearing: number | null = null;

  // Cumulative step and calorie tracking (dynamic, per-update)
  private totalSteps = 0;
  private totalCalories = 0;

  // Elevation smoothing (exponential moving average)
  private smoothedElevation: number | null = null;
  private readonly ELE_SMOOTHING_ALPHA = 0.3; // lower = smoother

  // Constants (tuned for walking accuracy on Android)
  private readonly DEFAULT_WEIGHT_KG = 65;
  // 1.2m min distance keeps resolution high enough for slow walking (5 km/h
  // ≈ 1.4m per 1-second GPS fix) while still dropping sub-meter jitter.
  // Anything larger would silently drop alternating fixes at walking speed.
  private readonly MIN_DISTANCE_FILTER = 0.0012;
  private readonly ELE_NOISE_FILTER = 2; // meters — GPS elevation is noisy
  private readonly MAX_ACCURACY_METERS = 25; // hard reject points beyond this
  private readonly MAX_SEGMENT_SPEED_KMH = 18; // cap per-segment speed at "fast jog"
  private readonly MIN_TIME_BETWEEN_POINTS_MS = 400; // ignore sub-400ms bursts
  private readonly WARMUP_POINTS = 3; // first N points are stored but don't add distance

  private warmupCount = 0;
  private rejectedPoints = 0;

  private pausedAt = 0; // timestamp when paused
  private totalPausedTime = 0; // accumulated pause duration in ms
  private durationOffset = 0; // seconds from previous segments

  start() {
    this.startTime = Date.now();
    this.lastActiveTime = Date.now();
    this.currentSplitStart = Date.now();
    this.pausedAt = 0;
    this.totalPausedTime = 0;
    this.warmupCount = 0;
    this.rejectedPoints = 0;
  }

  pause() {
    if (this.pausedAt === 0) {
      this.pausedAt = Date.now();
    }
  }

  resume() {
    if (this.pausedAt > 0) {
      this.totalPausedTime += Date.now() - this.pausedAt;
      this.pausedAt = 0;
    }
  }

  /** Set cumulative offsets when resuming a paused walk */
  setOffset(distance: number, steps: number, calories: number, duration: number, elevationGain: number) {
    this.distance = distance;
    this.totalSteps = steps;
    this.totalCalories = calories;
    this.activeTime = duration;
    this.durationOffset = duration;
    this.elevationGain = elevationGain;
    this.currentSplitDistance = distance;
  }

  addPoint(
    lat: number,
    lng: number,
    altitude: number | null,
    accuracy: number | null,
    timestamp: number,
  ): TrackPoint | null {
    // ---- Pre-filter stage (before Kalman): hard rejects for obviously bad data ----

    // Require an accuracy estimate. Unknown accuracy is common on weak GPS
    // and these points were the main source of distance inflation.
    if (accuracy == null || accuracy <= 0) {
      this.rejectedPoints += 1;
      return null;
    }
    // Hard-reject low-accuracy points. 25m is a generous threshold for
    // urban walking and drops GPS drift spikes that happen when buildings
    // momentarily block satellites.
    if (accuracy > this.MAX_ACCURACY_METERS) {
      this.rejectedPoints += 1;
      return null;
    }
    // Minimum time gap between points — bursts inside 400ms are almost
    // always duplicate fixes from the OS
    if (this.trackPoints.length > 0) {
      const prevTs = new Date(this.trackPoints[this.trackPoints.length - 1].time).getTime();
      if (timestamp - prevTs < this.MIN_TIME_BETWEEN_POINTS_MS) {
        this.rejectedPoints += 1;
        return null;
      }
    }

    // Estimate current speed for Kalman filter
    let estimatedSpeedKmh = 0;
    if (this.lastSpeedSamples.length > 0) {
      estimatedSpeedKmh =
        this.lastSpeedSamples.reduce((a, b) => a + b, 0) /
        this.lastSpeedSamples.length;
    }

    // Apply Kalman filter with speed awareness
    const filtered = this.kalman.update(
      lat,
      lng,
      accuracy,
      estimatedSpeedKmh,
    );

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

      // Filter out GPS jitter — minimum distance between accepted points.
      // At 2.5m this is just above GPS noise floor for consumer phones.
      if (d < this.MIN_DISTANCE_FILTER) {
        return null;
      }

      // Per-segment speed sanity check. If the implied instantaneous speed
      // is over the walking/jogging cap, this is almost certainly a GPS
      // jump (multipath in cities, tunnel exit, etc.) — drop it.
      const timeDiffPrecheck =
        (timestamp - new Date(prev.time).getTime()) / 1000;
      if (timeDiffPrecheck > 0) {
        const impliedKmh = (d / timeDiffPrecheck) * 3600;
        if (impliedKmh > this.MAX_SEGMENT_SPEED_KMH) {
          this.rejectedPoints += 1;
          return null;
        }
      }

      // Heading consistency check: reject points requiring 180-degree turn at walking speed
      if (this.lastBearing !== null && d > 0.001) {
        const newBearing = bearing(
          prev.lat,
          prev.lng,
          filtered.lat,
          filtered.lng,
        );
        const turnAngle = angleDiff(this.lastBearing, newBearing);
        // At walking speed (< 8 km/h) with short distance (< 5m),
        // reject > 150 degree turns (likely GPS bounce)
        if (
          estimatedSpeedKmh < 8 &&
          d < 0.005 &&
          turnAngle > 150
        ) {
          return null; // Skip this point — likely GPS noise
        }
      }

      // GPS warm-up: store the first few points but don't count them toward
      // distance. Initial fixes after a walk starts are often meters off
      // from the true location, which used to add phantom distance.
      if (this.warmupCount < this.WARMUP_POINTS) {
        this.warmupCount += 1;
        this.trackPoints.push(point);
        this.lastBearing = bearing(prev.lat, prev.lng, filtered.lat, filtered.lng);
        return point;
      }

      // Calculate speed
      const timeDiff =
        (timestamp - new Date(prev.time).getTime()) / 1000; // seconds
      if (timeDiff > 0) {
        const speedKmh = (d / timeDiff) * 3600;
        point.speed = speedKmh / 3.6; // m/s

        // Auto-pause detection with 8 samples for stability
        this.lastSpeedSamples.push(speedKmh);
        if (this.lastSpeedSamples.length > 8) this.lastSpeedSamples.shift();
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
          this.currentSplitActiveTime += timeDiff;
          this.distance += d;

          // Dynamic step counting based on current pace
          const currentPaceMinPerKm =
            speedKmh > 0 ? 60 / speedKmh : 12;
          const stepsPerKm = getStepsPerKm(currentPaceMinPerKm);
          this.totalSteps += d * stepsPerKm;

          // MET-based calorie calculation
          const met = getMET(speedKmh);
          const durationHours = timeDiff / 3600;
          this.totalCalories +=
            met * this.DEFAULT_WEIGHT_KG * durationHours;

          // Track max speed
          if (speedKmh > this.maxSpeed && speedKmh < 20) {
            // cap at 20km/h for walking
            this.maxSpeed = speedKmh;
          }

          // Update bearing for heading consistency check
          if (d > 0.002) {
            // Only update bearing for moves > 2m
            this.lastBearing = bearing(
              prev.lat,
              prev.lng,
              filtered.lat,
              filtered.lng,
            );
          }
        }
      }

      // Elevation tracking with exponential moving average smoothing
      if (altitude != null) {
        // Apply EMA smoothing
        if (this.smoothedElevation === null) {
          this.smoothedElevation = altitude;
        } else {
          this.smoothedElevation =
            this.ELE_SMOOTHING_ALPHA * altitude +
            (1 - this.ELE_SMOOTHING_ALPHA) * this.smoothedElevation;
        }

        if (prev.ele != null) {
          // Use smoothed values for gain/loss calculation
          const prevSmoothed =
            this.trackPoints.length > 1
              ? this.smoothedElevation -
                this.ELE_SMOOTHING_ALPHA * (altitude - (prev.ele || 0))
              : prev.ele;
          const eleDiff = this.smoothedElevation - prevSmoothed;

          if (Math.abs(eleDiff) > this.ELE_NOISE_FILTER) {
            // Ignore < 2m changes (GPS elevation noise)
            if (eleDiff > 0) {
              this.elevationGain += eleDiff;
              this.currentSplitEleGain += eleDiff;
            } else {
              this.elevationLoss += Math.abs(eleDiff);
              this.currentSplitEleLoss += Math.abs(eleDiff);
            }
          }
        }

        this.maxElevation = Math.max(
          this.maxElevation,
          this.smoothedElevation,
        );
        this.minElevation = Math.min(
          this.minElevation,
          this.smoothedElevation,
        );
      }

      // Check for km split
      const currentKm = Math.floor(this.distance);
      if (currentKm > this.splits.length) {
        const splitDuration = (timestamp - this.currentSplitStart) / 1000;
        const splitDistance =
          this.distance - this.currentSplitDistance;
        // More accurate pace using actual active time in this split
        const avgPace =
          this.currentSplitActiveTime > 0 && splitDistance > 0
            ? this.currentSplitActiveTime / 60 / splitDistance
            : splitDuration / 60;
        this.splits.push({
          km: currentKm,
          duration: splitDuration,
          pace: splitDuration / 60, // min/km (wall clock)
          avgPace, // min/km (active time, more accurate)
          elevationGain: Math.round(this.currentSplitEleGain),
          elevationLoss: Math.round(this.currentSplitEleLoss),
        });
        this.currentSplitStart = timestamp;
        this.currentSplitDistance = this.distance;
        this.currentSplitEleGain = 0;
        this.currentSplitEleLoss = 0;
        this.currentSplitActiveTime = 0;
      }
    } else {
      // First point
      if (altitude != null) {
        this.maxElevation = altitude;
        this.minElevation = altitude;
        this.smoothedElevation = altitude;
      }
    }

    this.trackPoints.push(point);
    return point;
  }

  getStats(): WalkStats {
    // Wall clock minus paused time + offset from previous segments
    let elapsed = 0;
    if (this.startTime > 0) {
      const now = this.pausedAt > 0 ? this.pausedAt : Date.now();
      elapsed = (now - this.startTime - this.totalPausedTime) / 1000;
    }
    const totalTime = this.durationOffset + Math.max(0, elapsed);
    const pace =
      this.activeTime > 0 && this.distance > 0.01
        ? this.activeTime / 60 / this.distance
        : 0;

    // Current pace (rolling average from recent points)
    let currentPace = 0;
    if (this.trackPoints.length >= 2) {
      const recent = this.trackPoints.slice(-10); // use more points for stability
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
    // Fallback to average pace if currentPace is 0 but we have distance
    if (currentPace <= 0 && this.distance > 0.01 && this.activeTime > 0) {
      currentPace = this.activeTime / 60 / this.distance;
    }

    const steps = Math.round(this.totalSteps);
    const cadence =
      this.activeTime > 0 ? (steps / this.activeTime) * 60 : 0;

    return {
      distance: this.distance,
      duration: totalTime,
      totalTime,
      pace,
      currentPace,
      speed:
        this.activeTime > 0
          ? (this.distance / this.activeTime) * 3600
          : 0,
      steps,
      cadence: Math.round(cadence),
      calories: Math.round(this.totalCalories),
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
    this.lastBearing = null;
    this.totalSteps = 0;
    this.totalCalories = 0;
    this.smoothedElevation = null;
    this.currentSplitDistance = 0;
    this.currentSplitActiveTime = 0;
    this.currentSplitEleGain = 0;
    this.currentSplitEleLoss = 0;
    this.warmupCount = 0;
    this.rejectedPoints = 0;
    this.pausedAt = 0;
    this.totalPausedTime = 0;
    this.durationOffset = 0;
  }

  /** Diagnostics — number of GPS points rejected by pre-filters this session */
  getRejectedCount(): number {
    return this.rejectedPoints;
  }
}
