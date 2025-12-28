package com.anonymous.breakloopnative

import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments

class AppMonitorModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    init {
        // Pass React context to the service so it can emit events
        AppMonitorService.setReactContext(reactContext)
    }
    
    override fun getName(): String {
        return "AppMonitorModule"
    }

    @ReactMethod
    fun startMonitoring(promise: Promise) {
        try {
            android.util.Log.d("AppMonitorModule", "startMonitoring called")
            
            // Check if Usage Stats permission is granted
            if (!AppMonitorService.hasUsageStatsPermission(reactApplicationContext)) {
                android.util.Log.w("AppMonitorModule", "Usage Stats permission not granted")
                val result: WritableMap = Arguments.createMap()
                result.putBoolean("success", false)
                result.putString("message", "Usage Stats permission not granted")
                promise.resolve(result)
                return
            }
            
            android.util.Log.d("AppMonitorModule", "Usage Stats permission granted, starting service")
            
            val intent = Intent(reactApplicationContext, AppMonitorService::class.java)
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
            
            val result: WritableMap = Arguments.createMap()
            result.putBoolean("success", true)
            result.putString("message", "App monitoring started")
            promise.resolve(result)
            
            android.util.Log.d("AppMonitorModule", "Monitoring service start command sent")
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to start monitoring: ${e.message}", e)
            android.util.Log.e("AppMonitorModule", "Failed to start monitoring", e)
        }
    }

    @ReactMethod
    fun stopMonitoring(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, AppMonitorService::class.java)
            reactApplicationContext.stopService(intent)
            
            val result: WritableMap = Arguments.createMap()
            result.putBoolean("success", true)
            result.putString("message", "App monitoring stopped")
            promise.resolve(result)
            
            android.util.Log.d("AppMonitorModule", "Monitoring service stopped")
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to stop monitoring: ${e.message}", e)
            android.util.Log.e("AppMonitorModule", "Failed to stop monitoring", e)
        }
    }

    @ReactMethod
    fun isMonitoring(promise: Promise) {
        promise.resolve(AppMonitorService.isRunning)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for NativeEventEmitter - stub implementation
        // Event emission happens via DeviceEventEmitter, so this can be a no-op
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for NativeEventEmitter - stub implementation
        // Event emission happens via DeviceEventEmitter, so this can be a no-op
    }

    @ReactMethod
    fun openUsageAccessSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to open Usage Access settings: ${e.message}", e)
        }
    }

    /**
     * PHASE F3.5 - Get triggering app from InterventionActivity Intent
     * 
     * Called by React Native on mount to determine if this is an intervention launch.
     * Returns the package name of the monitored app that triggered the intervention,
     * or null if not launched from InterventionActivity or no trigger info available.
     * 
     * @param promise Resolves with triggering app package name (String) or null
     */
    @ReactMethod
    fun getInitialTriggeringApp(promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            if (activity is InterventionActivity) {
                val triggeringApp = activity.intent?.getStringExtra(InterventionActivity.EXTRA_TRIGGERING_APP)
                android.util.Log.d("AppMonitorModule", "getInitialTriggeringApp: $triggeringApp")
                promise.resolve(triggeringApp)
            } else {
                // Not in InterventionActivity, return null
                android.util.Log.d("AppMonitorModule", "getInitialTriggeringApp: Not in InterventionActivity")
                promise.resolve(null)
            }
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to get triggering app", e)
            promise.reject("ERROR", "Failed to get triggering app: ${e.message}", e)
        }
    }

    /**
     * PHASE F3.5 - Finish InterventionActivity when intervention completes
     * 
     * Called by React Native when intervention state transitions to 'idle'.
     * Explicitly finishes InterventionActivity so user returns to previously opened app
     * without MainActivity being resumed.
     */
    @ReactMethod
    fun finishInterventionActivity() {
        try {
            val activity = reactApplicationContext.currentActivity
            if (activity is InterventionActivity) {
                android.util.Log.i("AppMonitorModule", "Finishing InterventionActivity")
                activity.finish()
            } else {
                android.util.Log.d("AppMonitorModule", "finishInterventionActivity: Not in InterventionActivity, ignoring")
            }
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to finish InterventionActivity", e)
        }
    }
    
    override fun invalidate() {
        super.invalidate()
        // Clean up React context reference when module is invalidated
        AppMonitorService.setReactContext(null)
    }
}

