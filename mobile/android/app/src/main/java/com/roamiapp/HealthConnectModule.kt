package com.roamiapp

import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class HealthConnectModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "HealthConnectModule"

    @ReactMethod
    fun openPermissions() {
        try {
            val intent = Intent("android.health.connect.action.MANAGE_HEALTH_PERMISSIONS")
            intent.putExtra("android.intent.extra.PACKAGE_NAME", "com.roamiapp")
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            // Fallback: open Health Connect home
            try {
                val intent = Intent("android.health.connect.action.HEALTH_HOME_SETTINGS")
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
            } catch (e2: Exception) {
                // Last fallback: open app settings
                val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                intent.data = android.net.Uri.parse("package:com.roamiapp")
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
            }
        }
    }
}
