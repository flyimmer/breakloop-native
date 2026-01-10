package com.anonymous.breakloopnative

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import android.util.Base64
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.Arguments
import java.io.ByteArrayOutputStream
import java.lang.ref.WeakReference

class AppMonitorModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    companion object {
        /**
         * Static reference to SystemSurfaceActivity for reliable cancellation.
         * Uses WeakReference to prevent memory leaks if activity is destroyed by Android.
         */
        private var systemSurfaceActivityRef: WeakReference<SystemSurfaceActivity>? = null
        
        /**
         * Store a reference to SystemSurfaceActivity when it's created.
         * Called from SystemSurfaceActivity.onCreate()
         */
        fun setSystemSurfaceActivity(activity: SystemSurfaceActivity) {
            systemSurfaceActivityRef = WeakReference(activity)
            android.util.Log.i("AppMonitorModule", "📌 SystemSurfaceActivity reference stored")
        }
        
        /**
         * Clear the reference when SystemSurfaceActivity is destroyed.
         * Called from SystemSurfaceActivity.onDestroy()
         */
        fun clearSystemSurfaceActivity() {
            systemSurfaceActivityRef = null
            android.util.Log.i("AppMonitorModule", "🧹 SystemSurfaceActivity reference cleared")
        }
    }
    
    init {
        // Pass React context to the service so it can emit events
        AppMonitorService.setReactContext(reactContext)
    }
    
    override fun getName(): String {
        return "AppMonitorModule"
    }

    /**
     * Get the current runtime context (which Activity we're in)
     * 
     * Returns:
     * - "MAIN_APP" if running in MainActivity
     * - "SYSTEM_SURFACE" if running in SystemSurfaceActivity
     * 
     * This is used by RuntimeContextProvider to determine which root component to render.
     * 
     * @param promise Resolves with "MAIN_APP" or "SYSTEM_SURFACE"
     */
    @ReactMethod
    fun getRuntimeContext(promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            val context = when (activity) {
                is SystemSurfaceActivity -> "SYSTEM_SURFACE"
                is MainActivity -> "MAIN_APP"
                else -> "MAIN_APP" // Default to MAIN_APP if activity is null or unknown
            }
            
            android.util.Log.d("AppMonitorModule", "getRuntimeContext: $context (activity: ${activity?.javaClass?.simpleName})")
            promise.resolve(context)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to get runtime context", e)
            promise.resolve("MAIN_APP") // Default to MAIN_APP on error
        }
    }

    /**
     * Get Intent extras from SystemSurfaceActivity
     * 
     * This is used during bootstrap initialization to read:
     * - triggeringApp: The monitored app that triggered the wake
     * - wakeReason: Why SystemSurfaceActivity was launched
     * 
     * Per system_surface_bootstrap.md (t9):
     * JS reads these extras to run OS Trigger Brain in the correct context.
     * 
     * @param promise Resolves with map containing triggeringApp and wakeReason, or null if not in SystemSurfaceActivity
     */
    @ReactMethod
    fun getSystemSurfaceIntentExtras(promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            
            // Only works in SystemSurfaceActivity
            if (activity !is SystemSurfaceActivity) {
                android.util.Log.w("AppMonitorModule", "getSystemSurfaceIntentExtras called but not in SystemSurfaceActivity")
                promise.resolve(null)
                return
            }
            
            val intent = activity.intent
            val extras = Arguments.createMap()
            
            val triggeringApp = intent.getStringExtra(SystemSurfaceActivity.EXTRA_TRIGGERING_APP)
            val wakeReason = intent.getStringExtra(SystemSurfaceActivity.EXTRA_WAKE_REASON)
            
            if (triggeringApp != null) {
                extras.putString("triggeringApp", triggeringApp)
            }
            
            if (wakeReason != null) {
                extras.putString("wakeReason", wakeReason)
            }
            
            android.util.Log.d("AppMonitorModule", "getSystemSurfaceIntentExtras: triggeringApp=$triggeringApp, wakeReason=$wakeReason")
            promise.resolve(extras)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to get SystemSurface Intent extras", e)
            promise.reject("GET_INTENT_EXTRAS_ERROR", "Failed to get Intent extras: ${e.message}", e)
        }
    }

    /**
     * Convert Drawable to base64 string for React Native Image component
     * 
     * @param drawable The app icon drawable
     * @param size The desired size in pixels (default: 48dp converted to px)
     * @return Base64 encoded PNG string, or null if conversion fails
     */
    private fun drawableToBase64(drawable: Drawable?, size: Int = 192): String? {
        if (drawable == null) return null
        
        return try {
            // Convert dp to px (assuming ~3x density)
            val bitmap = when (drawable) {
                is BitmapDrawable -> drawable.bitmap
                else -> {
                    // Create a bitmap from the drawable
                    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
                    val canvas = Canvas(bitmap)
                    drawable.setBounds(0, 0, canvas.width, canvas.height)
                    drawable.draw(canvas)
                    bitmap
                }
            }
            
            // Resize if needed
            val resizedBitmap = if (bitmap.width != size || bitmap.height != size) {
                Bitmap.createScaledBitmap(bitmap, size, size, true)
            } else {
                bitmap
            }
            
            // Convert to PNG and encode as base64
            val outputStream = ByteArrayOutputStream()
            resizedBitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
            val byteArray = outputStream.toByteArray()
            Base64.encodeToString(byteArray, Base64.NO_WRAP)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to convert drawable to base64: ${e.message}")
            null
        }
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
     * Check if the accessibility service (ForegroundDetectionService) is enabled
     * 
     * This checks if the user has enabled BreakLoop's accessibility service in Android Settings.
     * The service must be manually enabled by the user in Settings > Accessibility.
     * 
     * @param promise Resolves with boolean indicating if service is enabled
     */
    @ReactMethod
    fun isAccessibilityServiceEnabled(promise: Promise) {
        try {
            val accessibilityManager = reactApplicationContext.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
            val enabledServices = Settings.Secure.getString(
                reactApplicationContext.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            )
            
            if (enabledServices.isNullOrEmpty()) {
                promise.resolve(false)
                return
            }
            
            // Build the component name for our accessibility service
            val serviceComponentName = ComponentName(
                reactApplicationContext.packageName,
                ForegroundDetectionService::class.java.name
            )
            val serviceId = serviceComponentName.flattenToString()
            
            // Check if our service is in the enabled services list
            val isEnabled = enabledServices.split(':').contains(serviceId)
            
            android.util.Log.d("AppMonitorModule", "Accessibility service enabled: $isEnabled (serviceId: $serviceId)")
            promise.resolve(isEnabled)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to check accessibility service status", e)
            promise.reject("ERROR", "Failed to check accessibility service status: ${e.message}", e)
        }
    }

    /**
     * Open the Accessibility Settings screen
     * 
     * Opens Android's Accessibility Settings where the user can enable BreakLoop's service.
     * 
     * @param promise Resolves with true if settings screen was opened successfully
     */
    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to open Accessibility settings: ${e.message}", e)
        }
    }

    /**
     * PHASE F3.5 - Get triggering app from SystemSurfaceActivity Intent
     * 
     * Called by React Native on mount to determine if this is an intervention launch.
     * Returns the package name of the monitored app that triggered the intervention,
     * or null if not launched from SystemSurfaceActivity or no trigger info available.
     * 
     * Fixed: Use reactApplicationContext.currentActivity instead of currentActivity
     * 
     * @param promise Resolves with triggering app package name (String) or null
     */
    @ReactMethod
    fun getInitialTriggeringApp(promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            if (activity is SystemSurfaceActivity) {
                val triggeringApp = activity.intent?.getStringExtra(SystemSurfaceActivity.EXTRA_TRIGGERING_APP)
                android.util.Log.d("AppMonitorModule", "getInitialTriggeringApp: $triggeringApp")
                promise.resolve(triggeringApp)
            } else {
                // Not in SystemSurfaceActivity, return null
                android.util.Log.d("AppMonitorModule", "getInitialTriggeringApp: Not in SystemSurfaceActivity")
                promise.resolve(null)
            }
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to get triggering app", e)
            promise.reject("ERROR", "Failed to get triggering app: ${e.message}", e)
        }
    }

    /**
     * PHASE F3.5 - Finish SystemSurfaceActivity when intervention completes
     * 
     * Called by React Native when intervention state transitions to 'idle'.
     * Explicitly finishes SystemSurfaceActivity so user returns to previously opened app
     * without MainActivity being resumed.
     */
    @ReactMethod
    fun finishInterventionActivity() {
        // Phase-2 Architecture: Native performs ONE mechanical action only
        // JavaScript decides semantics (what happens next)
        // REMOVED: App launching, Thread.sleep(), task movement
        val activity = reactApplicationContext.currentActivity
        if (activity is SystemSurfaceActivity) {
            android.util.Log.i("AppMonitorModule", "Finishing SystemSurfaceActivity")
            activity.finish()
        } else {
            android.util.Log.w("AppMonitorModule", "finishInterventionActivity called but not in SystemSurfaceActivity")
        }
    }

    /**
     * Get the wake reason from SystemSurfaceActivity Intent.
     * 
     * CRITICAL: JavaScript MUST check this FIRST before running any logic.
     * 
     * Possible return values:
     * Phase 1 (transitional):
     * - "MONITORED_APP_FOREGROUND" - Normal monitored app detected, run priority chain
     * - "INTENTION_EXPIRED" - Intention timer expired while app in foreground
     * 
     * Phase 2 (explicit wake reasons):
     * - "SHOW_QUICK_TASK_DIALOG" - System Brain decided to show Quick Task dialog
     * - "START_INTERVENTION_FLOW" - System Brain decided to start Intervention flow
     * - "QUICK_TASK_EXPIRED_FOREGROUND" - Quick Task expired, show Intervention
     * 
     * Other:
     * - "DEV_DEBUG" - Developer-triggered wake for testing
     * - null - Not in SystemSurfaceActivity or no wake reason set
     * 
     * @param promise Resolves with wake reason string or null
     */
    @ReactMethod
    fun getWakeReason(promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            if (activity is SystemSurfaceActivity) {
                val wakeReason = activity.intent.getStringExtra(SystemSurfaceActivity.EXTRA_WAKE_REASON)
                android.util.Log.i("AppMonitorModule", "getWakeReason: $wakeReason")
                promise.resolve(wakeReason)
            } else {
                android.util.Log.d("AppMonitorModule", "getWakeReason: Not in SystemSurfaceActivity")
                promise.resolve(null)
            }
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to get wake reason", e)
            promise.resolve(null)
        }
    }
    
    /**
     * Launch SystemSurfaceActivity from System Brain JS.
     * 
     * This allows the event-driven headless runtime to trigger UI when needed.
     * System Brain decides WHEN and WHY, native handles HOW.
     * 
     * @param wakeReason - Wake reason string (e.g., "QUICK_TASK_EXPIRED_FOREGROUND", "INTENTION_EXPIRED_FOREGROUND")
     * @param triggeringApp - Package name of the app that triggered the wake
     */
    @ReactMethod
    fun launchSystemSurface(wakeReason: String, triggeringApp: String) {
        android.util.Log.d("AppMonitorModule", "📱 System Brain requested SystemSurface launch: $wakeReason for $triggeringApp")
        
        // Phase-2 Architecture: SystemSurfaceActivity must be DISPOSABLE and NEVER REUSED
        // Each launch creates a fresh Activity instance with fresh Intent extras
        // REMOVED FLAG_ACTIVITY_CLEAR_TOP to prevent Activity reuse
        // 
        // Modal Task Launch: POST_QUICK_TASK_CHOICE is a blocking obligation, not an overlay
        // FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS makes it a modal system task that survives
        // launcher interactions (swipe up, search) without being destroyed by Android
        val intent = Intent(reactApplicationContext, SystemSurfaceActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
            putExtra(SystemSurfaceActivity.EXTRA_WAKE_REASON, wakeReason)
            putExtra(SystemSurfaceActivity.EXTRA_TRIGGERING_APP, triggeringApp)
        }
        
        android.util.Log.i("AppMonitorModule", "🆕 Launching fresh SystemSurfaceActivity (disposable)")
        reactApplicationContext.startActivity(intent)
    }

    /**
     * Update monitored apps list in ForegroundDetectionService
     * 
     * Called from React Native when user changes monitored apps in Settings.
     * Updates the native service's monitored apps list so it knows which apps to intercept.
     * 
     * @param packageNames Array of package names to monitor
     * @param promise Promise to resolve when update is complete
     */
    @ReactMethod
    fun setMonitoredApps(packageNames: com.facebook.react.bridge.ReadableArray, promise: Promise) {
        try {
            val apps = mutableSetOf<String>()
            for (i in 0 until packageNames.size()) {
                packageNames.getString(i)?.let { apps.add(it) }
            }
            
            android.util.Log.i("AppMonitorModule", "Updating monitored apps list: $apps")
            ForegroundDetectionService.updateMonitoredApps(apps)
            
            val result: WritableMap = Arguments.createMap()
            result.putBoolean("success", true)
            result.putInt("count", apps.size)
            promise.resolve(result)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to update monitored apps", e)
            promise.reject("UPDATE_FAILED", "Failed to update monitored apps: ${e.message}", e)
        }
    }

    /**
     * Store intention timer in SharedPreferences
     * 
     * NOTE: This is kept for backward compatibility but is NO LONGER used by native layer.
     * JavaScript is the ONLY authority for t_intention (semantic ownership).
     * 
     * @param packageName Package name of the app (e.g., "com.instagram.android")
     * @param expiresAt Timestamp when timer expires (milliseconds since epoch)
     */
    @ReactMethod
    fun storeIntentionTimer(packageName: String, expiresAt: Double) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("intention_timers", android.content.Context.MODE_PRIVATE)
            val key = "intention_timer_$packageName"
            val expiresAtLong = expiresAt.toLong()
            
            prefs.edit().putLong(key, expiresAtLong).apply()
            
            val remainingSec = (expiresAtLong - System.currentTimeMillis()) / 1000
            android.util.Log.i("AppMonitorModule", "Stored intention timer for $packageName (expires in ${remainingSec}s) [NOTE: Native no longer checks this]")
            
            // Emit MECHANICAL event to System Brain JS with explicit timer type
            emitSystemEventToSystemBrain("TIMER_SET", packageName, System.currentTimeMillis(), expiresAtLong, "INTENTION")
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to store intention timer", e)
        }
    }
    
    /**
     * Set wake suppression flag
     * 
     * This tells native: "Do not launch SystemSurfaceActivity before this timestamp"
     * 
     * SEMANTIC OWNERSHIP:
     * - JavaScript makes semantic decision (e.g., "user wants 1-min intention timer")
     * - JavaScript sets mechanical flag: "don't wake before X"
     * - Native reads mechanical flag, has ZERO semantic knowledge
     * - Native doesn't know WHY suppression exists (intention timer, quick task, etc.)
     * - Native only knows: "Don't wake before this timestamp"
     * 
     * @param packageName Package name (e.g., "com.instagram.android")
     * @param suppressUntil Timestamp (milliseconds) - don't wake before this time
     */
    @ReactMethod
    fun setSuppressSystemSurfaceUntil(packageName: String, suppressUntil: Double) {
        try {
            val suppressUntilLong = suppressUntil.toLong()
            
            // Store in static map for ForegroundDetectionService to read
            ForegroundDetectionService.setSuppressWakeUntil(packageName, suppressUntilLong)
            
            val remainingSec = (suppressUntilLong - System.currentTimeMillis()) / 1000
            android.util.Log.i("AppMonitorModule", "🚫 Wake suppression set for $packageName (${remainingSec}s)")
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "❌ Failed to set wake suppression", e)
        }
    }
    
    /**
     * Store Quick Task timer in SharedPreferences
     * This allows ForegroundDetectionService to check if Quick Task is active
     * and skip launching InterventionActivity.
     * 
     * IMPORTANT: Quick Task timer is stored per-app. When active, the native layer
     * should NOT launch InterventionActivity for that app.
     * 
     * @param packageName Package name of the app (e.g., "com.instagram.android")
     * @param expiresAt Timestamp when timer expires (milliseconds since epoch)
     * @param promise Promise to resolve when timer is stored successfully
     */
    @ReactMethod
    fun storeQuickTaskTimer(packageName: String, expiresAt: Double, promise: Promise) {
        try {
            android.util.Log.i("QuickTaskTimer", "storeQuickTaskTimer called for $packageName expiresAt=$expiresAt")
            
            val prefs = reactApplicationContext.getSharedPreferences("quick_task_timers", android.content.Context.MODE_PRIVATE)
            val key = "quick_task_timer_$packageName"
            val expiresAtLong = expiresAt.toLong()
            
            prefs.edit().putLong(key, expiresAtLong).apply()
            
            // Also notify the ForegroundDetectionService
            ForegroundDetectionService.setQuickTaskTimer(packageName, expiresAtLong)
            
            val remainingSec = (expiresAtLong - System.currentTimeMillis()) / 1000
            android.util.Log.i("AppMonitorModule", "🚀 Stored Quick Task timer for $packageName (expires in ${remainingSec}s)")
            
            // Emit MECHANICAL event to System Brain JS with explicit timer type
            emitSystemEventToSystemBrain("TIMER_SET", packageName, System.currentTimeMillis(), expiresAtLong, "QUICK_TASK")
            
            android.util.Log.i("QuickTaskTimer", "TIMER_SET emitted")
            
            // Resolve promise to signal success to JavaScript
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "❌ Failed to store Quick Task timer", e)
            promise.reject("STORE_TIMER_FAILED", "Failed to store Quick Task timer: ${e.message}", e)
        }
    }
    
    /**
     * Emit system event to System Brain JS via HeadlessTask.
     * 
     * This ensures single event delivery path (no duplication).
     * 
     * @param eventType - Event type ("TIMER_SET", "TIMER_EXPIRED", etc.)
     * @param packageName - Package name
     * @param timestamp - Event timestamp
     * @param expiresAt - Optional expiration timestamp (for TIMER_SET)
     */
    private fun emitSystemEventToSystemBrain(
        eventType: String, 
        packageName: String, 
        timestamp: Long,
        expiresAt: Long? = null,
        timerType: String? = null
    ) {
        try {
            android.util.Log.i("AppMonitorModule", "🔵 About to emit $eventType to SystemBrainService")
            
            val intent = Intent(reactApplicationContext, SystemBrainService::class.java).apply {
                putExtra(SystemBrainService.EXTRA_EVENT_TYPE, eventType)
                putExtra(SystemBrainService.EXTRA_PACKAGE_NAME, packageName)
                putExtra(SystemBrainService.EXTRA_TIMESTAMP, timestamp)
                if (expiresAt != null) {
                    putExtra(SystemBrainService.EXTRA_EXPIRES_AT, expiresAt)
                }
                if (timerType != null) {
                    putExtra(SystemBrainService.EXTRA_TIMER_TYPE, timerType)
                }
            }
            
            android.util.Log.i("AppMonitorModule", "🔵 Intent created, calling startService()...")
            
            // Start the HeadlessTaskService
            // This will invoke System Brain JS headless task
            reactApplicationContext.startService(intent)
            
            android.util.Log.i("AppMonitorModule", "✅ startService() called successfully")
            android.util.Log.i("AppMonitorModule", "📤 Emitted mechanical event to System Brain: $eventType for $packageName" + 
                if (timerType != null) " (timerType: $timerType)" else "")
            
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "❌ Failed to emit SystemEvent to System Brain", e)
        }
    }

    /**
     * Clear Quick Task timer from SharedPreferences
     * Called when Quick Task expires or is cancelled.
     * 
     * @param packageName Package name of the app
     * @param promise Promise to resolve when timer is cleared successfully
     */
    @ReactMethod
    fun clearQuickTaskTimer(packageName: String, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("quick_task_timers", android.content.Context.MODE_PRIVATE)
            val key = "quick_task_timer_$packageName"
            
            prefs.edit().remove(key).apply()
            
            // Also notify the ForegroundDetectionService
            ForegroundDetectionService.clearQuickTaskTimer(packageName)
            
            android.util.Log.i("AppMonitorModule", "🧹 Cleared Quick Task timer for $packageName")
            
            // Resolve promise to signal success to JavaScript
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "❌ Failed to clear Quick Task timer", e)
            promise.reject("CLEAR_TIMER_FAILED", "Failed to clear Quick Task timer: ${e.message}", e)
        }
    }
    
    /**
     * Launch the Android Home screen
     * Used when Quick Task expires to send user back to home
     */
    @ReactMethod
    fun launchHomeScreen() {
        try {
            android.util.Log.i("AppMonitorModule", "🏠 Launching home screen")
            
            // Create intent to launch home screen
            val homeIntent = Intent(Intent.ACTION_MAIN)
            homeIntent.addCategory(Intent.CATEGORY_HOME)
            homeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(homeIntent)
            
            android.util.Log.i("AppMonitorModule", "✅ Home screen launched")
            
            // Also finish the SystemSurfaceActivity if we're in it
            val activity = reactApplicationContext.currentActivity
            if (activity is SystemSurfaceActivity) {
                android.util.Log.i("AppMonitorModule", "🔄 Finishing SystemSurfaceActivity after launching home")
                activity.finish()
            }
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "❌ Failed to launch home screen", e)
        }
    }

    /**
     * Finish SystemSurfaceActivity without launching home screen.
     * 
     * Use this when:
     * - User sets intention timer (wants to use the monitored app)
     * - User starts alternative activity (activity timer screen)
     * 
     * The monitored app or previous activity will naturally come to foreground.
     * 
     * This is a MECHANICAL ACTION - JavaScript decides WHEN to finish (semantics).
     */
    @ReactMethod
    fun finishSystemSurfaceActivity() {
        try {
            android.util.Log.i("AppMonitorModule", "🏁 Finishing SystemSurfaceActivity (no home launch)")
            
            // Finish SystemSurfaceActivity using stored reference
            val activity = systemSurfaceActivityRef?.get()
            if (activity != null && !activity.isFinishing) {
                android.util.Log.i("AppMonitorModule", "🔄 Finishing SystemSurfaceActivity via static reference")
                activity.finish()
                android.util.Log.i("AppMonitorModule", "✅ SystemSurfaceActivity finished, monitored app will surface")
            } else {
                android.util.Log.w("AppMonitorModule", "⚠️ SystemSurfaceActivity reference is null or already finishing")
            }
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "❌ Failed to finish SystemSurfaceActivity", e)
        }
    }

    /**
     * Cancel intervention and close SystemSurfaceActivity, then launch home screen.
     * 
     * Use this when:
     * - User cancels intervention (back button, switches away)
     * - User completes full intervention with reflection
     * 
     * Uses static reference to reliably finish SystemSurfaceActivity even when currentActivity is null.
     * 
     * This is a MECHANICAL ACTION - JavaScript decides WHEN to cancel (semantics).
     */
    @ReactMethod
    fun cancelInterventionActivity() {
        try {
            android.util.Log.i("AppMonitorModule", "🚫 Cancelling intervention activity")
            
            // Finish SystemSurfaceActivity using stored reference
            val activity = systemSurfaceActivityRef?.get()
            if (activity != null && !activity.isFinishing) {
                android.util.Log.i("AppMonitorModule", "🔄 Finishing SystemSurfaceActivity via static reference")
                activity.finish()
            } else {
                android.util.Log.w("AppMonitorModule", "⚠️ SystemSurfaceActivity reference is null or already finishing")
            }
            
            // Launch home screen
            val homeIntent = Intent(Intent.ACTION_MAIN)
            homeIntent.addCategory(Intent.CATEGORY_HOME)
            homeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(homeIntent)
            
            android.util.Log.i("AppMonitorModule", "✅ Intervention cancelled, home screen launched")
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "❌ Failed to cancel intervention", e)
        }
    }

    /**
     * Launch a specific app by package name
     * Used to return user to monitored app after intervention completes
     * 
     * @param packageName Package name of the app to launch (e.g., "com.instagram.android")
     */
    @ReactMethod
    fun launchApp(packageName: String) {
        try {
            val packageManager = reactApplicationContext.packageManager
            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
            
            if (launchIntent != null) {
                android.util.Log.i("AppMonitorModule", "Launching app: $packageName")
                // Clear task flags to ensure the app comes to foreground properly
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                reactApplicationContext.startActivity(launchIntent)
                android.util.Log.i("AppMonitorModule", "Launch intent sent for: $packageName")
            } else {
                android.util.Log.w("AppMonitorModule", "Cannot launch app: $packageName (no launch intent found)")
            }
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to launch app: $packageName", e)
        }
    }

    /**
     * Get list of all installed apps on the device
     * Returns apps with package names and display names, excluding system apps
     * 
     * @param promise Resolves with array of app objects: [{ packageName: string, appName: string }]
     */
    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val packageManager = reactApplicationContext.packageManager
            
            // FIRST: Test if we can access Instagram directly
            android.util.Log.e("AppMonitorModule", "========== TESTING DIRECT ACCESS ==========")
            try {
                val instagramInfo = packageManager.getPackageInfo("com.instagram.android", 0)
                android.util.Log.e("AppMonitorModule", "✅ Instagram FOUND via direct query: ${instagramInfo.packageName}")
            } catch (e: Exception) {
                android.util.Log.e("AppMonitorModule", "❌ Instagram NOT accessible via direct query: ${e.message}")
            }
            
            // Get ALL installed packages with multiple flags to ensure we get everything
            val flags = PackageManager.GET_META_DATA or 
                       PackageManager.MATCH_DISABLED_COMPONENTS or
                       PackageManager.MATCH_DISABLED_UNTIL_USED_COMPONENTS or
                       PackageManager.MATCH_UNINSTALLED_PACKAGES
            val installedPackages = packageManager.getInstalledPackages(flags)
            
            android.util.Log.e("AppMonitorModule", "========== GET INSTALLED APPS START ==========")
            android.util.Log.e("AppMonitorModule", "Total packages found: ${installedPackages.size}")
            
            val appsArray: WritableArray = Arguments.createArray()
            var processedCount = 0
            var skippedNullAppInfo = 0
            var skippedSystemApps = 0
            var instagramFound = false
            var tiktokFound = false
            
            for (packageInfo in installedPackages) {
                val pkgName = packageInfo.packageName
                
                val appInfo = packageInfo.applicationInfo
                if (appInfo == null) {
                    skippedNullAppInfo++
                    continue
                }
                
                // Filter out pure system apps
                // FLAG_SYSTEM = app is in system partition
                // FLAG_UPDATED_SYSTEM_APP = system app that user updated (keep these!)
                val isSystemApp = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0
                val isUpdatedSystemApp = (appInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0
                
                // Skip pure system apps (but keep updated system apps like Chrome, Gmail)
                if (isSystemApp && !isUpdatedSystemApp) {
                    skippedSystemApps++
                    continue
                }
                
                // Check for Instagram/TikTok after filtering
                if (pkgName.contains("instagram", ignoreCase = true)) {
                    android.util.Log.w("AppMonitorModule", ">>> INSTAGRAM FOUND: $pkgName")
                    instagramFound = true
                }
                if (pkgName.contains("tiktok", ignoreCase = true) || pkgName.contains("musically", ignoreCase = true)) {
                    android.util.Log.w("AppMonitorModule", ">>> TIKTOK FOUND: $pkgName")
                    tiktokFound = true
                }
                
                // Get app label (display name)
                val appName = try {
                    val label = packageManager.getApplicationLabel(appInfo).toString()
                    if (label.isBlank()) pkgName else label
                } catch (e: Exception) {
                    android.util.Log.w("AppMonitorModule", "Failed to get label for $pkgName: ${e.message}")
                    pkgName
                }
                
                // Get app icon and convert to base64
                val iconBase64 = try {
                    val icon = packageManager.getApplicationIcon(appInfo)
                    drawableToBase64(icon)
                } catch (e: Exception) {
                    android.util.Log.w("AppMonitorModule", "Failed to get icon for $pkgName: ${e.message}")
                    null
                }
                
                // Create app object
                val appMap: WritableMap = Arguments.createMap()
                appMap.putString("packageName", pkgName)
                appMap.putString("appName", appName)
                if (iconBase64 != null) {
                    appMap.putString("icon", iconBase64)
                }
                
                appsArray.pushMap(appMap)
                processedCount++
            }
            
            android.util.Log.e("AppMonitorModule", "Processed: $processedCount user apps")
            android.util.Log.e("AppMonitorModule", "Skipped: $skippedSystemApps system apps, $skippedNullAppInfo null appInfo")
            android.util.Log.e("AppMonitorModule", "Instagram found: $instagramFound")
            android.util.Log.e("AppMonitorModule", "TikTok found: $tiktokFound")
            
            // WORKAROUND: If Instagram was not found in the list, try to add it manually
            if (!instagramFound) {
                android.util.Log.w("AppMonitorModule", "Instagram NOT in list, attempting manual add...")
                try {
                    val instagramInfo = packageManager.getPackageInfo("com.instagram.android", 0)
                    val instagramAppInfo = instagramInfo.applicationInfo
                    if (instagramAppInfo != null) {
                        val appName = packageManager.getApplicationLabel(instagramAppInfo).toString()
                        val iconBase64 = try {
                            val icon = packageManager.getApplicationIcon(instagramAppInfo)
                            drawableToBase64(icon)
                        } catch (e: Exception) {
                            null
                        }
                        val appMap: WritableMap = Arguments.createMap()
                        appMap.putString("packageName", "com.instagram.android")
                        appMap.putString("appName", appName)
                        if (iconBase64 != null) {
                            appMap.putString("icon", iconBase64)
                        }
                        appsArray.pushMap(appMap)
                        android.util.Log.e("AppMonitorModule", "✅ Instagram MANUALLY ADDED: $appName")
                    }
                } catch (e: Exception) {
                    android.util.Log.e("AppMonitorModule", "❌ Failed to manually add Instagram: ${e.message}")
                }
            }
            
            // Same for TikTok
            if (!tiktokFound) {
                android.util.Log.w("AppMonitorModule", "TikTok NOT in list, attempting manual add...")
                val tiktokPackages = listOf("com.zhiliaoapp.musically", "com.ss.android.ugc.tiktok")
                for (pkg in tiktokPackages) {
                    try {
                        val tiktokInfo = packageManager.getPackageInfo(pkg, 0)
                        val tiktokAppInfo = tiktokInfo.applicationInfo
                        if (tiktokAppInfo != null) {
                            val appName = packageManager.getApplicationLabel(tiktokAppInfo).toString()
                            val iconBase64 = try {
                                val icon = packageManager.getApplicationIcon(tiktokAppInfo)
                                drawableToBase64(icon)
                            } catch (e: Exception) {
                                null
                            }
                            val appMap: WritableMap = Arguments.createMap()
                            appMap.putString("packageName", pkg)
                            appMap.putString("appName", appName)
                            if (iconBase64 != null) {
                                appMap.putString("icon", iconBase64)
                            }
                            appsArray.pushMap(appMap)
                            android.util.Log.e("AppMonitorModule", "✅ TikTok MANUALLY ADDED: $appName")
                            break
                        }
                    } catch (e: Exception) {
                        // Try next package name
                    }
                }
            }
            
            android.util.Log.e("AppMonitorModule", "Returning ${appsArray.size()} apps to React Native")
            android.util.Log.e("AppMonitorModule", "========== GET INSTALLED APPS END ==========")
            
            promise.resolve(appsArray)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to get installed apps", e)
            promise.reject("ERROR", "Failed to get installed apps: ${e.message}", e)
        }
    }
    
    override fun invalidate() {
        super.invalidate()
        // Clean up React context reference when module is invalidated
        AppMonitorService.setReactContext(null)
    }
}

