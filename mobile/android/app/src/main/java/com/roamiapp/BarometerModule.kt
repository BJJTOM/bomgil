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
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * BarometerModule — real-time barometric pressure for altitude estimation.
 *
 * Android's TYPE_PRESSURE sensor returns atmospheric pressure in hPa
 * (hectopascals / millibars). We convert to altitude using the
 * International Barometric Formula:
 *
 *   altitude = 44330 * (1 - (P / P0)^0.1903)
 *
 * where P0 = sea-level standard pressure (1013.25 hPa).
 *
 * This gives RELATIVE altitude changes accurate to ±0.5-1m, which is
 * 10-20x better than GPS altitude (±10-30m). The absolute value drifts
 * with weather, but for walk tracking we only need relative changes
 * within a single session.
 *
 * JS API (via NativeModules.Barometer):
 *   - start(): Promise<{ available: boolean }>
 *   - stop(): void
 *
 * Event: "BarometerUpdate" with { pressure: number, altitude: number }
 *
 * The sensor hub on most modern phones (including Galaxy S25) runs this
 * at <1mW — essentially free in terms of battery.
 */
class BarometerModule(private val reactCtx: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactCtx), SensorEventListener,
    com.facebook.react.bridge.LifecycleEventListener {

    init {
        reactCtx.addLifecycleEventListener(this)
    }

    override fun onHostResume() {}
    override fun onHostPause() {}
    override fun onHostDestroy() {
        // Auto-cleanup when the React activity is destroyed (hot reload, app kill).
        // Prevents sensor listener leak + unnecessary battery drain.
        stop()
    }

    private val sensorManager =
        reactCtx.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private val pressureSensor: Sensor? =
        sensorManager?.getDefaultSensor(Sensor.TYPE_PRESSURE)

    private var running = false
    // Sea-level reference pressure. We use the ISA standard (1013.25 hPa)
    // as our baseline. Since we only care about RELATIVE changes during
    // a walk session, the absolute accuracy doesn't matter — and the
    // relative accuracy of barometers is excellent (±0.12 hPa = ±1m).
    private val seaLevelPressure = SensorManager.PRESSURE_STANDARD_ATMOSPHERE

    override fun getName(): String = "Barometer"

    // Required by NativeEventEmitter on the JS side to suppress warnings.
    @ReactMethod
    fun addListener(eventName: String) { /* no-op */ }
    @ReactMethod
    fun removeListeners(count: Int) { /* no-op */ }

    @ReactMethod
    fun start(promise: Promise) {
        if (sensorManager == null || pressureSensor == null) {
            val result = Arguments.createMap()
            result.putBoolean("available", false)
            promise.resolve(result)
            return
        }
        if (running) {
            val result = Arguments.createMap()
            result.putBoolean("available", true)
            promise.resolve(result)
            return
        }

        // SENSOR_DELAY_UI (~60ms) is fast enough for walking. We don't
        // need SENSOR_DELAY_FASTEST since pressure changes slowly.
        sensorManager.registerListener(
            this,
            pressureSensor,
            SensorManager.SENSOR_DELAY_UI,
        )
        running = true

        val result = Arguments.createMap()
        result.putBoolean("available", true)
        promise.resolve(result)
    }

    @ReactMethod
    fun stop() {
        if (running) {
            sensorManager?.unregisterListener(this)
            running = false
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || event.sensor.type != Sensor.TYPE_PRESSURE) return

        val pressureHpa = event.values[0]
        // International Barometric Formula:
        // altitude = 44330 * (1 - (P / P0)^0.1903)
        val altitude = SensorManager.getAltitude(seaLevelPressure, pressureHpa)

        val params = Arguments.createMap()
        params.putDouble("pressure", pressureHpa.toDouble())
        params.putDouble("altitude", altitude.toDouble())

        try {
            reactCtx
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("BarometerUpdate", params)
        } catch (_: Exception) {
            // JS bridge not ready yet, silently ignore
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // Not used for pressure sensor
    }
}
