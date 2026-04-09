package com.roamiapp

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Real-time step counter backed by Android's Sensor.TYPE_STEP_COUNTER.
 *
 * The TYPE_STEP_COUNTER sensor is a low-power hardware counter that is
 * maintained by the OS even when the device is asleep. Its value is a
 * cumulative count of steps taken since the last device reboot, so we
 * capture the initial value on start() and report deltas to JS.
 *
 * Why we use this instead of GPS-derived step estimates:
 *   - GPS step estimation depends on pace buckets and is wrong when the
 *     user is indoors (no GPS fix, engine stays at zero distance).
 *   - The hardware counter runs on a dedicated sensor hub on most
 *     modern Android devices (<1mW), far more battery-efficient than
 *     keeping accelerometer polling in userspace.
 *   - Galaxy Watch, Fitbit, Apple Watch, caschewalk etc. all use the
 *     equivalent sensor as their PRIMARY indoor distance source.
 *
 * JS API (via NativeModules.StepCounter):
 *   - start(): Promise<{ available: boolean }>
 *   - stop(): void
 *   - getSteps(): Promise<number>   // current session total
 *
 * Event: "StepCounterUpdate" with { steps: number }
 */
class StepCounterModule(private val reactCtx: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactCtx), SensorEventListener {

    private val sensorManager =
        reactCtx.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private val stepSensor: Sensor? =
        sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

    // Sensor emits a cumulative-since-boot count. We snapshot the first
    // value we see and subtract it from every subsequent reading so JS
    // receives a session-relative count.
    private var initialCount: Float = -1f
    private var sessionSteps: Int = 0
    private var running = false

    override fun getName(): String = "StepCounter"

    @ReactMethod
    fun start(promise: Promise) {
        if (sensorManager == null || stepSensor == null) {
            val result: WritableMap = Arguments.createMap()
            result.putBoolean("available", false)
            promise.resolve(result)
            return
        }
        // Reset session state every time start() is called so callers
        // can begin a fresh counting window (e.g. a new walk).
        initialCount = -1f
        sessionSteps = 0
        if (!running) {
            // SENSOR_DELAY_UI ≈ 60ms max latency; plenty for per-step updates.
            sensorManager.registerListener(
                this,
                stepSensor,
                SensorManager.SENSOR_DELAY_UI,
            )
            running = true
        }
        val result: WritableMap = Arguments.createMap()
        result.putBoolean("available", true)
        promise.resolve(result)
    }

    @ReactMethod
    fun stop() {
        if (running && sensorManager != null) {
            sensorManager.unregisterListener(this)
            running = false
        }
    }

    @ReactMethod
    fun getSteps(promise: Promise) {
        promise.resolve(sessionSteps)
    }

    // Required on newer React Native versions to avoid
    // "NativeEventEmitter warnings" when subscribing from JS.
    @ReactMethod
    fun addListener(eventName: String) {
        // no-op; registration happens via emitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // no-op
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type != Sensor.TYPE_STEP_COUNTER) return
        val total = event.values[0]
        if (initialCount < 0f) {
            initialCount = total
        }
        val current = (total - initialCount).toInt().coerceAtLeast(0)
        if (current == sessionSteps) {
            // Same step count as the previous sample — no new step taken.
            return
        }
        sessionSteps = current
        try {
            val params: WritableMap = Arguments.createMap()
            params.putInt("steps", sessionSteps)
            reactCtx
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("StepCounterUpdate", params)
        } catch (_: Exception) {
            // Bridge might be tearing down mid-unmount; swallow.
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // Not needed for step counter.
    }
}
