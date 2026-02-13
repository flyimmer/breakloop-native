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
import android.widget.Toast
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.Arguments
import java.io.ByteArrayOutputStream
import java.lang.ref.WeakReference

class AppMonitorModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    companion object {
        // Activity reference management is now handled exclusively by SystemSurfaceManager
        
        // Static reference to the module instance for event emission
        private var instance: WeakReference<AppMonitorModule>? = null

        /**
         * Emit the onSystemSurfaceNewIntent signal from SystemSurfaceActivity.
         * Delegated here because this module has a valid ReactApplicationContext.
         */
        fun emitSystemSurfaceNewIntentSignal(params: WritableMap) {
            val module = instance?.get()
            if (module != null) {
                try {
                    module.reactApplicationContext
                        .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("onSystemSurfaceNewIntent", params)
                    android.util.Log.d("AppMonitorModule", "⚡ delegateEmit success")
                } catch (e: Exception) {
                    android.util.Log.e("AppMonitorModule", "❌ delegateEmit failed", e)
                }
            } else {
                android.util.Log.w("AppMonitorModule", "⚠️ delegateEmit ignored: module instance null")
            }
        }
    }
    
    init {
        // Pass React context to the service so it can emit events
        AppMonitorService.setReactContext(reactContext)
        instance = WeakReference(this)
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
            
            android.util.Log.e(LogTags.SS_CANARY, "[RUNTIME_CONTEXT] getRuntimeContext: $context (activity: ${activity?.javaClass?.simpleName})")
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
            if (triggeringApp != null) {
                extras.putString(SystemSurfaceActivity.EXTRA_TRIGGERING_APP, triggeringApp)
            }

            val wakeReason = intent.getStringExtra(SystemSurfaceActivity.EXTRA_WAKE_REASON)
            if (wakeReason != null) {
                extras.putString(SystemSurfaceActivity.EXTRA_WAKE_REASON, wakeReason)
            }

            val resumeMode = intent.getStringExtra(SystemSurfaceActivity.EXTRA_RESUME_MODE) // V3: Extract resumeMode
            if (resumeMode != null) {
                extras.putString(SystemSurfaceActivity.EXTRA_RESUME_MODE, resumeMode)
            }
            
            val sessionId = intent.getStringExtra(SystemSurfaceActivity.EXTRA_SESSION_ID)
            if (sessionId != null) {
                extras.putString(SystemSurfaceActivity.EXTRA_SESSION_ID, sessionId)
            }
            
            android.util.Log.d("AppMonitorModule", "getSystemSurfaceIntentExtras: triggeringApp=$triggeringApp, wakeReason=$wakeReason, resumeMode=$resumeMode")
            promise.resolve(extras)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to get SystemSurface Intent extras", e)
            promise.reject("GET_INTENT_EXTRAS_ERROR", "Failed to get Intent extras: ${e.message}", e)
        }
    }

    /**
     * Report Quick Task Confirmed (User tapped "Start Quick Task")
     * Transitions OFFERING → ACTIVE with quota decrement and timer start
     */
    @ReactMethod
    fun reportQuickTaskConfirmed(app: String, sessionId: String) {
        try {
            val context = reactApplicationContext
            ForegroundDetectionService.onQuickTaskConfirmed(app, sessionId, context)
            android.util.Log.d("AppMonitorModule", "reportQuickTaskConfirmed: app=$app sessionId=$sessionId")
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to report Quick Task confirmed", e)
        }
    }

    /**
     * Quick Task Confirm (TASK 1B: Alias for reportQuickTaskConfirmed)
     * Transitions OFFERING → ACTIVE with quota decrement and timer start
     */
    @ReactMethod
    fun quickTaskConfirm(packageName: String, sessionId: String, promise: Promise) {
        try {
            ForegroundDetectionService.onQuickTaskConfirmed(packageName, sessionId, reactApplicationContext)
            promise.resolve(null)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to confirm Quick Task", e)
            promise.reject("QT_CONFIRM_ERROR", "Failed to confirm Quick Task", e)
        }
    }

    /**
     * Report Post-QT Quit (User chose "Quit [App]")
     * Clears POST_CHOICE lock and allows new QT offers.
     */
    @ReactMethod
    fun quickTaskPostQuit(app: String, sessionId: String) {
        try {
            android.util.Log.d("AppMonitorModule", "quickTaskPostQuit: app=$app sessionId=$sessionId")
            ForegroundDetectionService.onPostQuickTaskChoiceCompletedFromJs(app, sessionId, "QUIT")
            finishInterventionActivity()
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to report Post-QT quit", e)
        }
    }

    /**
     * Report Post-QT Continue (User chose "I want to use [App] more")
     * Clears POST_CHOICE lock and closes dialog.
     */
    @ReactMethod
    fun quickTaskPostContinue(app: String, sessionId: String) {
        try {
            android.util.Log.d("AppMonitorModule", "quickTaskPostContinue: app=$app sessionId=$sessionId")
            ForegroundDetectionService.onPostQuickTaskChoiceCompletedFromJs(app, sessionId, "CONTINUE")
            finishInterventionActivity()
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to report Post-QT continue", e)
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
     * Get localized app name from package name
     * 
     * @param packageName Package name of the app
     * @param promise Resolves with app label (String) or null
     */
    @ReactMethod
    fun getAppLabel(packageName: String, promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val appInfo = pm.getApplicationInfo(packageName, 0)
            val label = pm.getApplicationLabel(appInfo).toString()
            promise.resolve(label)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to get app label for $packageName", e)
            promise.resolve(null)
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
     * V3: Set the intervention preservation flag for a given app.
     */
    @ReactMethod
    fun setInterventionPreserved(app: String, preserved: Boolean, promise: Promise) {
        try {
            android.util.Log.e("SS_PRESERVE", "[SET_PRESERVED] app=$app preserved=$preserved")
            ForegroundDetectionService.setInterventionPreserved(app, preserved, reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to set intervention preserved flag for $app", e)
            promise.reject("SET_PRESERVED_FAILED", "Failed to set intervention preserved flag: ${e.message}", e)
        }
    }
    
    /**
     * Notify native that intervention completed for an app.
     * Must be called BEFORE surface close to ensure atomic state cleanup.
     */
    @ReactMethod
    fun onInterventionCompleted(app: String, sessionId: String) {
        try {
            android.util.Log.i("INT_COMPLETED", "[INT_COMPLETED_BRIDGE] app=$app sid=$sessionId")
            ForegroundDetectionService.onInterventionCompleted(app, sessionId, reactApplicationContext)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed: onInterventionCompleted", e)
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
    fun launchSystemSurface(wakeReason: String, triggeringApp: String, extras: com.facebook.react.bridge.ReadableMap? = null) {
        val overlayState = SessionManager.getOverlayState()
        android.util.Log.d("AppMonitorModule", "📱 JS requested launchSystemSurface (Legacy): $wakeReason for $triggeringApp state=$overlayState")

        // HARD GUARD: Native Launch Authority Enabled (v50+)
        // We strictly ignore JS launch requests to prevent double-launches and enforce native lifecycle control.
        android.util.Log.w("AppMonitorModule", "[DEPRECATION_NOTICE] legacy JS launch ignored (native authority enabled)")
        
        /* 
         * LEGACY CODE (DISABLED):
         * 
        val intent = Intent(reactApplicationContext, SystemSurfaceActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
            putExtra(SystemSurfaceActivity.EXTRA_WAKE_REASON, wakeReason)
            putExtra(SystemSurfaceActivity.EXTRA_TRIGGERING_APP, triggeringApp)
            
            var resumeModeLogged = "null"
            val isPreserved = if (triggeringApp != null) ForegroundDetectionService.isInterventionPreserved(triggeringApp) else false
            
            if (isPreserved) {
                putExtra("resumeMode", "RESUME")
                resumeModeLogged = "RESUME_FORCED"
            } else if (extras != null) {
                if (extras.hasKey("resumeMode")) {
                    val mode = extras.getString("resumeMode")
                    putExtra("resumeMode", mode)
                    resumeModeLogged = mode ?: "null"
                }

                if (extras.hasKey("sessionId")) {
                    val sid = extras.getString("sessionId")
                    putExtra("sessionId", sid)
                }
            }
            // Probe B: Intent Extras Log (DEPRECATED PATH)
            // Log.e("SS_INTENT", "...") - Moved to SystemSurfaceActivity and ForegroundDetectionService
        }
        
        android.util.Log.i("AppMonitorModule", "🆕 Launching fresh SystemSurfaceActivity (disposable)")
        reactApplicationContext.startActivity(intent)
        */
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
            ForegroundDetectionService.updateMonitoredApps(apps, reactApplicationContext)
            
            val result: WritableMap = Arguments.createMap()
            result.putBoolean("success", true)
            result.putInt("count", apps.size)
            promise.resolve(result)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to update monitored apps", e)
            promise.reject("UPDATE_FAILED", "Failed to update monitored apps: ${e.message}", e)
        }
    }



    @ReactMethod
    fun setQuickTaskQuotaPer15m(quota: Int, promise: Promise) {
        try {
            android.util.Log.e("AppMonitorModule", "setQuickTaskQuotaPer15m: $quota")
             
            ForegroundDetectionService.setQuickTaskMaxQuota(quota)
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to set quick task quota", e)
            promise.reject("SET_QUOTA_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun setQuickTaskWindowDuration(durationMs: Int, promise: Promise) {
        try {
            android.util.Log.i("AppMonitorModule", "setQuickTaskWindowDuration: $durationMs")
             
            ForegroundDetectionService.setQuickTaskWindowDuration(durationMs.toLong())
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to set quick task window duration", e)
            promise.reject("SET_WINDOW_DURATION_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun getQuickTaskQuota(promise: Promise) {
        try {
            val state = ForegroundDetectionService.getCachedQuotaState()
            val map = com.facebook.react.bridge.Arguments.createMap().apply {
                putDouble("max", state.maxPerWindow.toDouble())
                putDouble("remaining", state.remaining.toDouble())
                putDouble("windowStartMs", state.windowStartMs.toDouble())
                putDouble("windowEndMs", state.windowEndMs.toDouble())
                putDouble("windowDurationMs", state.windowDurationMs.toDouble())
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("GET_QUOTA_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun setQuickTaskDurationForApp(appPackage: String, durationMs: Int, promise: Promise) {
        try {
            val durationMsLong = durationMs.toLong()
            ForegroundDetectionService.setQuickTaskDurationForApp(appPackage, durationMsLong)
            android.util.Log.e("AppMonitorModule", "[DEBUG] setQuickTaskDurationForApp: app=$appPackage durationMs=$durationMs")
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to set quick task duration for app", e)
            promise.reject("SET_DURATION_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun getMonitoredApps(promise: Promise) {
        try {
            val apps = ForegroundDetectionService.getMonitoredApps()
            val array = com.facebook.react.bridge.Arguments.createArray()
            apps.forEach { array.pushString(it) }
            promise.resolve(array)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to get monitored apps", e)
            promise.reject("GET_MONITORED_APPS_FAILED", e.message, e)
        }
    }

    /**
     * Store intention timer in SharedPreferences AND schedule native timer.
     * 
     * CRITICAL: expiresAt is the SINGLE SOURCE OF TRUTH for idempotency.
     * State update and timer scheduling happen ATOMICALLY via instance method.
     * 
     * @param packageName Package name of the app (e.g., "com.instagram.android")
     * @param expiresAt Timestamp when timer expires (milliseconds since epoch)
     */
    @ReactMethod
    fun storeIntentionTimer(packageName: String, expiresAt: Double) {
        try {
            // DIAGNOSTIC: Log raw value to detect unit mismatch
            android.util.Log.i("INTENTION_BRIDGE_RAW", "[INTENTION_BRIDGE_RAW] pkg=$packageName expiresAtRaw=$expiresAt type=${expiresAt.javaClass.simpleName}")
            
            // 1) Legacy SharedPreferences storage (for backward compat)
            val prefs = reactApplicationContext.getSharedPreferences("intention_timers", android.content.Context.MODE_PRIVATE)
            val key = "intention_timer_$packageName"
            val expiresAtLong = expiresAt.toLong()
            prefs.edit().putLong(key, expiresAtLong).apply()
            
            // 2) Calculate duration for logging
            val durationMs = expiresAtLong - System.currentTimeMillis()
            val remainingSec = durationMs / 1000
            android.util.Log.i("AppMonitorModule", "Intention timer for $packageName until=$expiresAtLong (${remainingSec}s)")
            
            if (durationMs <= 0) {
                android.util.Log.w("AppMonitorModule", "Intention already expired for $packageName, clearing")
                ForegroundDetectionService.clearIntention(packageName)
                return
            }
            
            // ✅ 3) ATOMIC state update + timer scheduling via companion method
            ForegroundDetectionService.scheduleIntentionTimer(packageName, expiresAtLong, reactApplicationContext)
            
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to store intention timer", e)
        }
    }

    /**
     * V3.5: Native Intention Store API
     * Explicitly set/clear intention suppression for DecisionGate.
     */
    @ReactMethod
    fun setIntention(packageName: String, durationMs: Double, promise: Promise) {
        try {
             val durationLong = durationMs.toLong()
             ForegroundDetectionService.setIntention(packageName, durationLong)
             promise.resolve(true)
        } catch (e: Exception) {
             android.util.Log.e("AppMonitorModule", "Failed to set intention", e)
             promise.reject("Error", e)
        }
    }

    @ReactMethod
    fun clearIntention(packageName: String, promise: Promise) {
        try {
             ForegroundDetectionService.clearIntention(packageName)
             promise.resolve(true)
        } catch (e: Exception) {
             android.util.Log.e("AppMonitorModule", "Failed to clear intention", e)
             promise.reject("Error", e)
        }
    }
    
    @ReactMethod
    fun getIntentionRemainingMs(packageName: String, promise: Promise) {
        try {
             val remaining = ForegroundDetectionService.getIntentionRemainingMs(packageName)
             promise.resolve(remaining.toDouble())
        } catch (e: Exception) {
             promise.reject("Error", e)
        }
    }

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
        android.util.Log.i("AppMonitorModule", "🏁 Finishing SystemSurfaceActivity (JS_Request)")
        
        // Delegate to Manager
        val success = SystemSurfaceManager.finish(SystemSurfaceManager.REASON_JS_REQUEST)
        
        if (success) {
            android.util.Log.i("AppMonitorModule", "✅ SystemSurfaceActivity finish requested")
        } else {
            android.util.Log.w("AppMonitorModule", "⚠️ SystemSurfaceActivity finish ignored (not running/already finishing)")
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
            android.util.Log.i("AppMonitorModule", "🚫 Cancelling intervention activity (JS_Cancel)")
            
            // Delegate to Manager
            SystemSurfaceManager.finish(SystemSurfaceManager.REASON_JS_REQUEST)
            
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
    private fun showToast(message: String) {
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(reactApplicationContext, message, Toast.LENGTH_LONG).show()
        }
    }

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val packageManager = reactApplicationContext.packageManager
            
            // NEW APPROACH: Use launcher intent query to discover ALL user-launchable apps
            // This is Android 11+ compliant and matches OneSec's behavior
            // Requires <queries><intent> declaration in AndroidManifest.xml
            android.util.Log.e("AppMonitorModule", "========== LAUNCHER INTENT DISCOVERY START ==========")
            
            val launcherIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            
            // Query all activities that respond to launcher intent
            // This returns ALL apps the user can launch from the launcher
            val launcherApps = packageManager.queryIntentActivities(launcherIntent, 0)
            
            android.util.Log.e("AppMonitorModule", "Found ${launcherApps.size} launcher apps")
            
            val appsArray: WritableArray = Arguments.createArray()
            val packagesSeen = mutableSetOf<String>()  // Deduplicate packages
            var processedCount = 0
            var skippedSystemApps = 0
            var instagramFound = false
            var tiktokFound = false
            var xhsFound = false
            
            // Process each launcher app
            for (resolveInfo in launcherApps) {
                val activityInfo = resolveInfo.activityInfo ?: continue
                val pkgName = activityInfo.packageName
                
                // Skip if we've already processed this package
                if (packagesSeen.contains(pkgName)) {
                    continue
                }
                packagesSeen.add(pkgName)
                
                // Minimal negative heuristics: Exclude only clearly non-user-facing packages
                val systemPrefixes = listOf("android.", "com.android.", "com.google.android.")
                val isSystemPackage = systemPrefixes.any { pkgName.startsWith(it) }
                
                if (isSystemPackage) {
                    // Whitelist important user-facing system apps
                    val allowedSystemApps = listOf(
                        "com.android.chrome",
                        "com.android.vending",
                        "com.google.android.youtube",
                        "com.google.android.apps.maps",
                        "com.google.android.gm"  // Gmail
                    )
                    if (!allowedSystemApps.contains(pkgName)) {
                        android.util.Log.d("AppMonitorModule", "SKIP $pkgName: system package")
                        skippedSystemApps++
                        continue
                    }
                }
                
                // Exclude vendor/overlay/service packages
                val isNonUserFacing = pkgName.startsWith("vendor.") ||
                                     pkgName.startsWith("com.qualcomm.") ||
                                     pkgName.contains(".overlay.") ||
                                     pkgName.endsWith("service") ||
                                     pkgName.endsWith("server")
                
                if (isNonUserFacing) {
                    android.util.Log.d("AppMonitorModule", "SKIP $pkgName: non-user-facing")
                    skippedSystemApps++
                    continue
                }
                
                // Get app info
                val appInfo = try {
                    activityInfo.applicationInfo
                } catch (e: Exception) {
                    android.util.Log.w("AppMonitorModule", "Failed to get appInfo for $pkgName: ${e.message}")
                    continue
                }
                
                // Get app label using ResolveInfo.loadLabel() - this is the official way
                val appName = try {
                    val label = resolveInfo.loadLabel(packageManager).toString()
                    if (label.isBlank()) pkgName else label
                } catch (e: Exception) {
                    android.util.Log.w("AppMonitorModule", "Failed to get label for $pkgName: ${e.message}")
                    pkgName
                }
                
                // Get app icon using ResolveInfo.loadIcon() - this is the official way
                val iconBase64 = try {
                    val icon = resolveInfo.loadIcon(packageManager)
                    drawableToBase64(icon)
                } catch (e: Exception) {
                    android.util.Log.w("AppMonitorModule", "Failed to get icon for $pkgName: ${e.message}")
                    null
                }
                
                // Track Instagram/TikTok/XHS
                if (pkgName.contains("instagram", ignoreCase = true)) {
                    android.util.Log.e("AppMonitorModule", "✅ FOUND Instagram: $pkgName")
                    instagramFound = true
                }
                if (pkgName.contains("tiktok", ignoreCase = true) || 
                    pkgName.contains("musically", ignoreCase = true) || 
                    pkgName.contains("aweme", ignoreCase = true)) {
                    android.util.Log.e("AppMonitorModule", "✅ FOUND TikTok: $pkgName")
                    tiktokFound = true
                }
                if (pkgName.contains("xhs", ignoreCase = true) || 
                    pkgName.contains("xiaohongshu", ignoreCase = true) || 
                    pkgName.contains("xingin", ignoreCase = true)) {
                    android.util.Log.e("AppMonitorModule", "✅ FOUND XHS: $pkgName")
                    xhsFound = true
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
                android.util.Log.d("AppMonitorModule", "INCLUDE $pkgName: $appName")
            }
            
            android.util.Log.e("AppMonitorModule", "========== LAUNCHER DISCOVERY COMPLETE ==========")
            android.util.Log.e("AppMonitorModule", "Total launcher apps: ${launcherApps.size}")
            android.util.Log.e("AppMonitorModule", "Processed: $processedCount apps")
            android.util.Log.e("AppMonitorModule", "Skipped: $skippedSystemApps system/non-user-facing apps")
            android.util.Log.e("AppMonitorModule", "Instagram found: $instagramFound")
            android.util.Log.e("AppMonitorModule", "TikTok found: $tiktokFound")
            android.util.Log.e("AppMonitorModule", "XHS found: $xhsFound")
            android.util.Log.e("AppMonitorModule", "Returning ${appsArray.size()} apps to React Native")
            android.util.Log.e("AppMonitorModule", "==========================================")
            
            promise.resolve(appsArray)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to get installed apps", e)
            promise.reject("ERROR", "Failed to get installed apps: ${e.message}", e)
        }
    }
    
    /**
     * Update cached Quick Task quota in Native
     * 
     * PHASE 4.1: Entry decision authority
     * 
     * Called by JS when quota changes (user settings, usage, etc.)
     * Native caches this value for runtime entry decisions
     * 
     * IMPORTANT: This is a runtime cache ONLY, NOT a second source of truth
     * Must be synced on: app start, quota change, Quick Task usage
     * 
     * @param quota Current global Quick Task quota (n_quickTask)
     * @param promise Resolves when quota is updated
     */
    @ReactMethod
    fun updateQuickTaskQuota(quota: Int, promise: Promise) {
        // Log rate-limited warning
        android.util.Log.d("AppMonitorModule", "[DEPRECATED] updateQuickTaskQuota call ignored. Use setQuickTaskQuotaPer15m.")
        // Resolve success so JS doesn't crash
        promise.resolve(true)
    }
    
    /**
     * Notify Native that SystemSurface is active/inactive
     * 
     * PHASE 4.1: Lifecycle guard for entry decisions
     * 
     * Called by JS when SystemSurface launches or finishes
     * Prevents duplicate entry decisions while UI is showing
     * 
     * @param active true if SystemSurface is active, false if finished
     * @param promise Resolves when state is updated
     */
    @ReactMethod
    fun setSystemSurfaceActive(active: Boolean, promise: Promise) {
        try {
            ForegroundDetectionService.setSystemSurfaceActive(active)
            android.util.Log.i("AppMonitorModule", "🎯 SystemSurface active: $active")
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to set SystemSurface active", e)
            promise.reject("SET_ACTIVE_ERROR", "Failed to set active state: ${e.message}", e)
        }
    }
    
    // ============================================================================
    // PHASE 4.2: User Intent Handlers (Call Skeleton Functions)
    // ============================================================================
    
    /**
     * User accepted Quick Task
     * PHASE 4.2: Intent from JS → calls skeleton function
     */
    @ReactMethod
    fun quickTaskAccept(app: String, durationMs: Double, promise: Promise) {
        try {
            val duration = durationMs.toLong()
            
            // Call skeleton function
            ForegroundDetectionService.onQuickTaskAccepted(app, duration, reactApplicationContext)
            
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to accept Quick Task", e)
            promise.reject("QUICK_TASK_ACCEPT_ERROR", e.message, e)
        }
    }

    /**
     * User declined Quick Task
     * PHASE 4.2: Intent from JS → calls skeleton function
     */
    @ReactMethod
    fun quickTaskDecline(app: String, promise: Promise) {
        try {
            // Call skeleton function
            ForegroundDetectionService.onQuickTaskDeclined(app, reactApplicationContext)
            
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to decline Quick Task", e)
            promise.reject("QUICK_TASK_DECLINE_ERROR", e.message, e)
        }
    }

    /**
     * User chose "Start Conscious Process"
     * PHASE 4.2: Intent from JS -> Native resets state but keeps surface open
     */
    @ReactMethod
    fun quickTaskSwitchToIntervention(app: String, promise: Promise) {
        try {
            android.util.Log.i("AppMonitorModule", "[QT][INTENT] SWITCH_TO_INTERVENTION app=$app")
            
            // Call skeleton function to reset native state machine
            ForegroundDetectionService.onQuickTaskSwitchedToIntervention(app, reactApplicationContext)
            
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to switch quick task to intervention", e)
            promise.reject("QUICK_TASK_SWITCH_ERROR", e.message, e)
        }
    }
    
    override fun invalidate() {
        super.invalidate()
        // Clean up React context reference when module is invalidated
        AppMonitorService.setReactContext(null)
    }
    
    @ReactMethod
    fun canaryLog(message: String) {
        android.util.Log.e("SS_CANARY", "[JS] $message")
    }
}

