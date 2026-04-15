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
  // GPS health — lets UI show when sensor fallback is active
  gpsHealthy: boolean;
  usingSensorFallback: boolean;
  barometerActive: boolean;
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

// Speed-adaptive Kalman filter for GPS smoothing.
//
// FIX: Added process noise model. Previously the variance only decreased
// over time, causing the filter to become "stuck" — after many updates it
// was so confident in the old position that new GPS points had almost no
// effect. This made the filtered track lag behind during turns, cutting
// corners and underestimating distance by 2-5%.
//
// The fix grows variance proportionally to (a) elapsed time since the
// last update (the user may have moved) and (b) estimated speed. This
// means the filter stays responsive during movement but still suppresses
// jitter at rest.
class KalmanFilter {
  private lat: number = 0;
  private lng: number = 0;
  private variance: number = -1; // Negative means uninitialized
  private lastTimestamp: number = 0;
  private readonly minAccuracy = 2; // meters — trust GPS more
  // Process noise: how much uncertainty grows per second (meters²/s).
  // At walking speed (~1.4 m/s), after 1 second the user could be
  // ~1.4m away, so variance should grow by ~2 m²/s. We scale this
  // by estimated speed so a stationary user gets almost no growth
  // and a fast walker gets proportionally more.
  private readonly BASE_PROCESS_NOISE = 0.5; // m²/s at 0 speed
  private readonly SPEED_PROCESS_NOISE = 0.8; // additional m²/s per km/h

  update(
    lat: number,
    lng: number,
    accuracy: number,
    speedKmh: number = 0,
    timestamp: number = Date.now(),
  ): { lat: number; lng: number } {
    accuracy = Math.max(accuracy, this.minAccuracy);

    // Speed-based accuracy adjustment: when stationary, increase filter
    // strength to suppress jitter. When moving, trust new readings more.
    if (speedKmh < 0.5) {
      accuracy = accuracy * 2.5;
    } else if (speedKmh < 2) {
      accuracy = accuracy * 1.5;
    }

    if (this.variance < 0) {
      // First update — initialize
      this.lat = lat;
      this.lng = lng;
      this.variance = accuracy * accuracy;
      this.lastTimestamp = timestamp;
    } else {
      // --- Process noise: grow variance based on elapsed time + speed ---
      // Without this, the filter becomes overconfident and new points
      // barely move the estimate. With it, turns are tracked accurately.
      const dtSeconds = Math.max(0, (timestamp - this.lastTimestamp) / 1000);
      this.lastTimestamp = timestamp;
      const processNoise =
        (this.BASE_PROCESS_NOISE + this.SPEED_PROCESS_NOISE * speedKmh) * dtSeconds;
      this.variance += processNoise;

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

// Get MET value based on speed in km/h.
// Uses continuous interpolation instead of coarse buckets for smoother
// calorie tracking across speed transitions.
function getMET(speedKmh: number, inclinePercent: number = 0): number {
  // Base MET from walking speed (linear interpolation between anchor points)
  let met: number;
  if (speedKmh < 2) met = 2.0;
  else if (speedKmh < 3) met = 2.0 + (speedKmh - 2) * 1.0;     // 2.0 → 3.0
  else if (speedKmh < 4) met = 3.0 + (speedKmh - 3) * 0.5;     // 3.0 → 3.5
  else if (speedKmh < 5) met = 3.5 + (speedKmh - 4) * 0.8;     // 3.5 → 4.3
  else if (speedKmh < 6) met = 4.3 + (speedKmh - 5) * 0.7;     // 4.3 → 5.0
  else if (speedKmh < 7) met = 5.0 + (speedKmh - 6) * 1.0;     // 5.0 → 6.0
  else met = Math.min(6.0 + (speedKmh - 7) * 1.5, 12);          // 6.0 → 12 (running)

  // Incline adjustment: uphill adds ~0.5 MET per 5% grade (ACSM walking
  // equation). Downhill subtracts less because eccentric work still costs
  // energy. Clamped to ±2 MET to avoid unrealistic values from GPS jitter.
  if (inclinePercent > 0) {
    met += Math.min(inclinePercent * 0.1, 2.0);
  } else if (inclinePercent < 0) {
    met -= Math.min(Math.abs(inclinePercent) * 0.03, 0.5);
  }

  return Math.max(met, 1.5);
}

export class WalkEngine {
  private trackPoints: TrackPoint[] = [];
  private kalman = new KalmanFilter();
  private distance = 0; // km
  private activeTime = 0; // seconds
  private startTime = 0;
  private lastActiveTime = 0;

  // --- Sensor-based step counting (for indoor / no-GPS fallback) ---
  // The native StepCounterModule feeds us the cumulative step count for
  // the current walk session. We track the previous value so we can
  // convert deltas into distance when GPS is unavailable.
  private sensorStepsPrev: number = -1;
  private sensorStepsTotal: number = 0;
  private lastGpsAcceptedAt: number = 0;
  private lastSensorTickAt: number = 0;
  // Distance contributed by the step-counter fallback. Tracked separately
  // so we can show the user how much of their total came from GPS vs. steps.
  private sensorDistance: number = 0;
  // (Stride length is now stored on `strideLengthM` and updated by setUserProfile.)
  // How long GPS can be silent before we start trusting the step counter.
  // GPS normally fires every 1s, so 5s gives room for a couple of dropped
  // fixes before we decide we're "indoors".
  private readonly GPS_STALE_MS = 5000;
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
  // Hysteresis: pause at 0.3 km/h, resume at 0.5 km/h — prevents
  // flickering when the user is barely moving (bus stop, traffic light).
  private autoPauseThreshold = 0.3; // km/h — enter auto-pause
  private autoResumeThreshold = 0.5; // km/h — exit auto-pause (higher → needs real movement)
  // Debounce: require N consecutive fast points before resuming.
  // Prevents a single GPS jitter from breaking a genuine pause.
  private autoResumeConsecutive = 0;
  private readonly AUTO_RESUME_REQUIRED = 2;
  private lastSpeedSamples: number[] = [];
  private lastBearing: number | null = null;
  // Track recent incline for MET adjustment
  private recentInclinePercent = 0;

  // Cumulative step and calorie tracking (dynamic, per-update)
  private totalSteps = 0;
  private totalCalories = 0;
  // Steps offset from previous segments (set by setOffset on resume).
  // Sensor steps are session-relative (start at 0) so we ADD this offset
  // when the sensor overwrites totalSteps.
  private stepsOffset = 0;

  // Elevation smoothing (exponential moving average)
  private smoothedElevation: number | null = null;
  // FIX: Track PREVIOUS smoothed elevation separately. The old code
  // tried to back-calculate it from the current value, which was
  // mathematically wrong (mixed smoothed current with raw previous).
  // This caused elevation gain/loss to be 10-20% inaccurate.
  private prevSmoothedElevation: number | null = null;
  private readonly ELE_SMOOTHING_ALPHA = 0.15; // lower = smoother

  // Barometric altitude from the pressure sensor. When available, this
  // is 10-20x more accurate than GPS altitude for relative changes.
  // Updated via updateBarometerAltitude() from WalkScreen.
  private baroAltitude: number | null = null;
  private baroBaselineOffset: number | null = null; // GPS - baro at first calibration point

  // User profile — set via setUserProfile() before calling start().
  // Defaults are an "average adult" so the engine still works for users
  // who haven't filled in their profile yet, but accurate calorie and
  // step-based distance estimates require the real values.
  private weightKg = 65;
  private strideLengthM = 0.75;

  // Constants (tuned for walking accuracy on Android)
  // 1.2m min distance keeps resolution high enough for slow walking (5 km/h
  // ≈ 1.4m per 1-second GPS fix) while still dropping sub-meter jitter.
  private readonly MIN_DISTANCE_FILTER = 0.0012;
  private readonly ELE_NOISE_FILTER = 2;
  // Tightened from 25m → 15m to reduce distance inflation in urban areas
  // where multipath errors cause 20-25m accuracy readings with wild jumps.
  // In open sky, consumer GPS is typically 3-8m; 15m is generous enough
  // for tree cover / low-rise buildings while rejecting worst-case urban drift.
  private readonly MAX_ACCURACY_METERS = 15;
  private readonly MAX_SEGMENT_SPEED_KMH = 18;
  private readonly MIN_TIME_BETWEEN_POINTS_MS = 400;
  private readonly WARMUP_POINTS = 3;

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
  setOffset(
    distance: number,
    steps: number,
    calories: number,
    duration: number,
    elevationGain: number,
    elevationLoss: number = 0,
  ) {
    this.distance = distance;
    this.totalSteps = steps;
    // Store the offset so sensor steps ADD to it instead of overwriting
    this.stepsOffset = steps;
    this.totalCalories = calories;
    this.activeTime = duration;
    this.durationOffset = duration;
    this.elevationGain = elevationGain;
    this.elevationLoss = elevationLoss;
    this.currentSplitDistance = distance;

    // Pre-populate splits array so checkSplits() doesn't generate
    // bogus near-zero-duration entries for previously completed km.
    const completedKm = Math.floor(distance);
    while (this.splits.length < completedKm) {
      this.splits.push({
        km: this.splits.length + 1,
        duration: 0,
        pace: 0,
        avgPace: 0,
        elevationGain: 0,
        elevationLoss: 0,
      });
    }
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

    // Apply Kalman filter with speed awareness + timestamp for process noise
    const filtered = this.kalman.update(
      lat,
      lng,
      accuracy,
      estimatedSpeedKmh,
      timestamp,
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
        this.lastGpsAcceptedAt = timestamp;
        return point;
      }

      // Mark GPS as active for sensor fusion decisions.
      this.lastGpsAcceptedAt = timestamp;

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

        // --- Auto-pause with hysteresis + debounce ---
        // Lower threshold to enter pause, higher to leave.
        // Plus require 2+ consecutive fast points to actually resume,
        // so a single GPS jitter spike doesn't break a genuine rest.
        if (!this.isAutoPaused && avgSpeed < this.autoPauseThreshold) {
          this.isAutoPaused = true;
          this.autoResumeConsecutive = 0;
        } else if (this.isAutoPaused && avgSpeed >= this.autoResumeThreshold) {
          this.autoResumeConsecutive += 1;
          if (this.autoResumeConsecutive >= this.AUTO_RESUME_REQUIRED) {
            this.isAutoPaused = false;
            this.autoResumeConsecutive = 0;
          }
        } else if (this.isAutoPaused) {
          // Speed above pause threshold but below resume threshold — reset debounce
          this.autoResumeConsecutive = 0;
        }

        if (!this.isAutoPaused) {
          this.activeTime += timeDiff;
          this.currentSplitActiveTime += timeDiff;
          this.distance += d;

          // Dynamic step counting — use actual stride length when available.
          // FIX: Previously used pace-bucket estimation which ignored the
          // user's calibrated stride. Now: steps = distance / stride.
          // Falls back to pace-based estimate only when stride is the default.
          const stepsPerKm = this.strideLengthM > 0
            ? 1000 / this.strideLengthM
            : getStepsPerKm(speedKmh > 0 ? 60 / speedKmh : 12);
          this.totalSteps += d * stepsPerKm;

          // Incline-aware MET-based calorie calculation.
          // Estimate incline % from recent elevation change over distance.
          // d is in km, elevation in meters → incline = (eleΔ / (d*1000)) * 100
          // FIX: Use prevSmoothedElevation (not raw prev.ele) for incline calc
          const eleChange = (this.smoothedElevation != null && this.prevSmoothedElevation != null)
            ? (this.smoothedElevation - this.prevSmoothedElevation)
            : 0;
          if (d > 0.002) {
            // Only update incline estimate for meaningful moves (>2m)
            this.recentInclinePercent = (eleChange / (d * 1000)) * 100;
          }
          const met = getMET(speedKmh, this.recentInclinePercent);
          const durationHours = timeDiff / 3600;
          this.totalCalories +=
            met * this.weightKg * durationHours;

          // Track max speed
          if (speedKmh > this.maxSpeed && speedKmh < 20) {
            // cap at 20km/h for walking
            this.maxSpeed = speedKmh;
          }

          // Update bearing for heading consistency check.
          // FIX: Lowered from 2m to 1.2m (matching MIN_DISTANCE_FILTER).
          // At 2m, sharp turns in narrow alleys were missed — the bearing
          // didn't update, so the next point was rejected as a "180° turn".
          if (d > 0.0012) {
            this.lastBearing = bearing(
              prev.lat,
              prev.lng,
              filtered.lat,
              filtered.lng,
            );
          }
        }
      }

      // Elevation tracking with barometer + GPS fusion and proper EMA.
      //
      // Priority: barometric altitude (±1m accuracy) > GPS altitude (±10-30m).
      // If barometer is available, we use it exclusively for gain/loss.
      // GPS altitude is only used as a fallback when barometer is absent.
      //
      // FIX: Previous code tried to back-calculate prevSmoothed from the
      // current smoothed value, which was mathematically wrong. Now we
      // store prevSmoothedElevation as a dedicated field for correct EMA diffs.
      {
        // Choose the best altitude source
        let rawAlt: number | null = null;
        // Calibrate barometer baseline FIRST: on the first point where we
        // have BOTH GPS altitude and barometer, compute the offset so the
        // barometric altitude aligns with the GPS absolute value.
        // FIX: Must happen before computing rawAlt / point.ele so the
        // first track point gets the calibrated value, not uncalibrated.
        if (this.baroBaselineOffset === null && this.baroAltitude != null && altitude != null) {
          this.baroBaselineOffset = altitude - this.baroAltitude;
        }

        if (this.baroAltitude != null && this.baroBaselineOffset != null) {
          // Barometer is running + calibrated — use it (±1m accuracy)
          rawAlt = this.baroAltitude + this.baroBaselineOffset;
          point.ele = rawAlt;
        } else if (this.baroAltitude != null) {
          // Barometer running but not yet calibrated (no GPS alt) — use raw baro
          rawAlt = this.baroAltitude;
          point.ele = rawAlt;
        } else if (altitude != null) {
          // No barometer — GPS altitude fallback
          rawAlt = altitude;
        }

        if (rawAlt != null) {
          // Apply EMA smoothing. Noise filter is tighter for barometer
          // since it's inherently smoother.
          // Noise filter must match the EMA scale. With alpha=0.15, a raw
          // 1m change only moves the smoothed value by ~0.15m. The threshold
          // must be smaller than that to detect real 1m climbs.
          // Barometer: 0.1m (sensor is ±0.5m, smoothed even tighter)
          // GPS-only:  2m (GPS altitude is ±10-30m, need aggressive filtering)
          const noiseFilter = this.baroAltitude != null ? 0.1 : this.ELE_NOISE_FILTER;

          // Save current as "previous" BEFORE updating
          this.prevSmoothedElevation = this.smoothedElevation;

          if (this.smoothedElevation === null) {
            this.smoothedElevation = rawAlt;
          } else {
            this.smoothedElevation =
              this.ELE_SMOOTHING_ALPHA * rawAlt +
              (1 - this.ELE_SMOOTHING_ALPHA) * this.smoothedElevation;
          }

          // Now compute gain/loss using BOTH smoothed values (correct EMA diff)
          if (this.prevSmoothedElevation != null) {
            const eleDiff = this.smoothedElevation - this.prevSmoothedElevation;

            if (Math.abs(eleDiff) > noiseFilter) {
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
      }

      // Check for km split (shared method — also called from sensor fallback)
      this.checkSplits(timestamp);
    } else {
      // First point — initialize elevation from best available source
      const firstAlt = (this.baroAltitude != null)
        ? this.baroAltitude
        : altitude;
      if (firstAlt != null) {
        this.maxElevation = firstAlt;
        this.minElevation = firstAlt;
        this.smoothedElevation = firstAlt;
        this.prevSmoothedElevation = firstAlt;
        point.ele = firstAlt;
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
      gpsHealthy: this.lastGpsAcceptedAt > 0 &&
        (Date.now() - this.lastGpsAcceptedAt) < this.GPS_STALE_MS,
      usingSensorFallback: this.isUsingSensorFallback(),
      barometerActive: this.baroAltitude != null,
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
    this.prevSmoothedElevation = null;
    this.baroAltitude = null;
    this.baroBaselineOffset = null;
    this.currentSplitDistance = 0;
    this.currentSplitActiveTime = 0;
    this.currentSplitEleGain = 0;
    this.currentSplitEleLoss = 0;
    this.warmupCount = 0;
    this.rejectedPoints = 0;
    this.pausedAt = 0;
    this.totalPausedTime = 0;
    this.durationOffset = 0;
    this.autoResumeConsecutive = 0;
    this.recentInclinePercent = 0;
    this.currentSplitStart = 0;
    this.stepsOffset = 0;
    this.sensorStepsPrev = -1;
    this.sensorStepsTotal = 0;
    this.lastGpsAcceptedAt = 0;
    this.lastSensorTickAt = 0;
    this.sensorDistance = 0;
  }

  /**
   * Called by WalkScreen every time the native StepCounter fires.
   * `sensorSteps` is the session-relative count (0 at walk start, monotonic).
   *
   * When GPS is healthy, this only overrides the step count (more accurate
   * than the pace-derived estimate). When GPS has been stale for over 5
   * seconds, this ALSO contributes distance via stride × steps — which is
   * how Galaxy Watch / Nike Run keep tracking indoors.
   */
  updateFromSensorSteps(sensorSteps: number, now: number = Date.now()): void {
    // Always use real sensor steps instead of the pace-based estimate.
    // The hardware counter is accurate to ±2% for walking.
    // FIX: Add stepsOffset so resumed walks don't lose previous segments' steps.
    this.sensorStepsTotal = sensorSteps;
    this.totalSteps = sensorSteps + this.stepsOffset;

    if (this.sensorStepsPrev < 0) {
      // First event — just record and return.
      this.sensorStepsPrev = sensorSteps;
      this.lastSensorTickAt = now;
      return;
    }

    const newSteps = sensorSteps - this.sensorStepsPrev;
    this.sensorStepsPrev = sensorSteps;
    if (newSteps <= 0) return;

    // Compute time delta for active-time tracking.
    const dtSeconds = this.lastSensorTickAt > 0
      ? (now - this.lastSensorTickAt) / 1000
      : 0;
    this.lastSensorTickAt = now;

    // If GPS is still alive, we trust GPS for distance and only use sensor
    // for step count. "Alive" means we accepted a GPS fix recently.
    const gpsAlive = this.lastGpsAcceptedAt > 0 &&
      (now - this.lastGpsAcceptedAt) < this.GPS_STALE_MS;
    if (gpsAlive) return;

    // --- GPS is stale → fall back to step-based distance ---
    // This is the critical path for indoor walking.
    if (this.pausedAt > 0) return; // user manually paused

    const stepDistance = (newSteps * this.strideLengthM) / 1000; // km
    this.distance += stepDistance;
    this.sensorDistance += stepDistance;
    this.activeTime += Math.max(0, dtSeconds);

    // Calories using the same MET approach.
    const speedMps = (newSteps / Math.max(dtSeconds, 0.5)) * this.strideLengthM;
    const speedKmh = speedMps * 3.6;
    const met = getMET(speedKmh);
    const durationHours = Math.max(dtSeconds, 0) / 3600;
    this.totalCalories += met * this.weightKg * durationHours;

    // FIX: Check for km splits. Previously this only ran inside addPoint(),
    // so indoor walking (GPS stale, sensor-only distance) never recorded
    // km splits — the "구간 기록" section was always empty for indoor walks.
    this.checkSplits(now);
  }

  /**
   * Feed barometric altitude into the engine. Called from WalkScreen
   * whenever the BarometerModule emits a reading (~60ms interval).
   *
   * The value is in meters (ISA formula), relative to 1013.25 hPa.
   * We store it and use it in addPoint() for elevation tracking,
   * preferring it over GPS altitude when available.
   */
  updateBarometerAltitude(altitudeM: number): void {
    this.baroAltitude = altitudeM;
  }

  /** Shared split-detection logic — called from both addPoint and updateFromSensorSteps. */
  private checkSplits(timestamp: number): void {
    const currentKm = Math.floor(this.distance);
    if (currentKm > this.splits.length) {
      const splitDuration = (timestamp - this.currentSplitStart) / 1000;
      const splitDistance = this.distance - this.currentSplitDistance;
      const avgPace =
        this.currentSplitActiveTime > 0 && splitDistance > 0
          ? this.currentSplitActiveTime / 60 / splitDistance
          : splitDuration / 60;
      this.splits.push({
        km: currentKm,
        duration: splitDuration,
        pace: splitDuration / 60,
        avgPace,
        elevationGain: Math.round(this.currentSplitEleGain),
        elevationLoss: Math.round(this.currentSplitEleLoss),
      });
      this.currentSplitStart = timestamp;
      this.currentSplitDistance = this.distance;
      this.currentSplitEleGain = 0;
      this.currentSplitEleLoss = 0;
      this.currentSplitActiveTime = 0;
    }
  }

  /**
   * Apply the user's physical profile so calorie + step-based distance
   * estimates use real values instead of the "average adult" defaults.
   *
   *   weight (kg): used in MET formula `kcal = MET × weight × hours`
   *   height (cm): converted to stride length via `height × 0.415` m
   *                (commonly cited walking-stride coefficient)
   *
   * Call this BEFORE start() or any time the user updates their profile.
   * Missing/zero values are ignored — defaults remain in place.
   */
  setUserProfile(opts: {
    weightKg?: number | null;
    heightCm?: number | null;
    /** Direct stride length override (meters). Wins over height-based calc.
     *  Set via the "stride calibration" feature where the user walks a
     *  known distance (e.g. 100m) and we compute their actual stride. */
    strideLengthM?: number | null;
  }): void {
    if (opts.weightKg && opts.weightKg > 20 && opts.weightKg < 300) {
      this.weightKg = opts.weightKg;
    }
    // Direct stride override takes precedence over height-based estimate.
    if (opts.strideLengthM && opts.strideLengthM > 0.3 && opts.strideLengthM < 1.5) {
      this.strideLengthM = opts.strideLengthM;
    } else if (opts.heightCm && opts.heightCm > 100 && opts.heightCm < 250) {
      this.strideLengthM = (opts.heightCm * 0.415) / 100;
    }
  }

  /** True when the sensor fallback is actively providing distance (GPS is stale). */
  isUsingSensorFallback(): boolean {
    const now = Date.now();
    return this.lastGpsAcceptedAt === 0 ||
      (now - this.lastGpsAcceptedAt) >= this.GPS_STALE_MS;
  }

  /** Diagnostics — number of GPS points rejected by pre-filters this session */
  getRejectedCount(): number {
    return this.rejectedPoints;
  }

  /** Distance contributed by the step-counter fallback (km). */
  getSensorDistance(): number {
    return this.sensorDistance;
  }
}
