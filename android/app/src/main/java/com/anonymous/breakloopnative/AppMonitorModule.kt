package com.anonymous.breakloopnative

import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableArray
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
     * Fixed: Use reactApplicationContext.currentActivity instead of currentActivity
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

    /**
     * Store intention timer in SharedPreferences
     * This allows ForegroundDetectionService to check if intervention should be skipped
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
            android.util.Log.i("AppMonitorModule", "Stored intention timer for $packageName (expires in ${remainingSec}s)")
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorModule", "Failed to store intention timer", e)
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
                
                // Create app object
                val appMap: WritableMap = Arguments.createMap()
                appMap.putString("packageName", pkgName)
                appMap.putString("appName", appName)
                
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
                        val appMap: WritableMap = Arguments.createMap()
                        appMap.putString("packageName", "com.instagram.android")
                        appMap.putString("appName", appName)
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
                            val appMap: WritableMap = Arguments.createMap()
                            appMap.putString("packageName", pkg)
                            appMap.putString("appName", appName)
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

