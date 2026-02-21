/**
 * AppDiscoveryModule
 * 
 * Multi-source app discovery for BreakLoop:
 * - Launcher: Fast seed from launcher intent query
 * - UsageStats: Async backfill from usage history
 * - Accessibility: Runtime discovery (handled by ForegroundDetectionService)
 * 
 * Discovery and metadata resolution are SEPARATE steps.
 * This module provides mechanical discovery only - no semantic decisions.
 */

package com.anonymous.breakloopnative

import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
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
import android.util.Base64
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.Arguments
import java.io.ByteArrayOutputStream

class AppDiscoveryModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    override fun getName(): String {
        return "AppDiscoveryModule"
    }
    
    @ReactMethod
    fun addListener(eventName: String) {
        // Required for NativeEventEmitter - stub implementation
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for NativeEventEmitter - stub implementation
    }
    
    /**
     * Convert Drawable to base64-encoded PNG string
     */
    private fun drawableToBase64(drawable: Drawable?, size: Int = 192): String? {
        if (drawable == null) return null
        
        return try {
            val bitmap = when (drawable) {
                is BitmapDrawable -> drawable.bitmap
                else -> {
                    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
                    val canvas = Canvas(bitmap)
                    drawable.setBounds(0, 0, canvas.width, canvas.height)
                    drawable.draw(canvas)
                    bitmap
                }
            }
            
            val outputStream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
            val byteArray = outputStream.toByteArray()
            Base64.encodeToString(byteArray, Base64.NO_WRAP)
        } catch (e: Exception) {
            android.util.Log.w("AppDiscoveryModule", "Failed to convert drawable to base64: ${e.message}")
            null
        }
    }
    
    /**
     * Discover apps via launcher intent query (fast seed)
     * 
     * Returns packageNames only - metadata resolved separately.
     * This is synchronous and fast.
     */
    @ReactMethod
    fun discoverLauncherApps(promise: Promise) {
        try {
            val packageManager = reactApplicationContext.packageManager
            
            android.util.Log.d("AppDiscoveryModule", "Discovering launcher apps...")
            
            val launcherIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            
            val launcherApps = packageManager.queryIntentActivities(launcherIntent, 0)
            val packagesSeen = mutableSetOf<String>()
            val result: WritableArray = Arguments.createArray()
            
            for (resolveInfo in launcherApps) {
                val packageName = resolveInfo.activityInfo?.packageName ?: continue
                
                // Deduplicate (multiple activities per app)
                if (packagesSeen.contains(packageName)) {
                    continue
                }
                packagesSeen.add(packageName)
                
                val appMap: WritableMap = Arguments.createMap()
                appMap.putString("packageName", packageName)
                result.pushMap(appMap)
            }
            
            android.util.Log.d("AppDiscoveryModule", "Found ${result.size()} launcher apps")
            promise.resolve(result)
        } catch (e: Exception) {
            android.util.Log.e("AppDiscoveryModule", "Failed to discover launcher apps", e)
            promise.reject("DISCOVERY_ERROR", "Failed to discover launcher apps: ${e.message}", e)
        }
    }
    
    /**
     * Discover apps via UsageStats (async backfill)
     * 
     * Requires PACKAGE_USAGE_STATS permission.
     * This may be slow (async operation).
     * 
     * @param daysBack Number of days to look back (default: 14)
     */
    @ReactMethod
    fun discoverUsageStatsApps(daysBack: Int, promise: Promise) {
        try {
            if (!hasUsageStatsPermission()) {
                promise.reject("NO_PERMISSION", "Usage stats permission required")
                return
            }
            
            android.util.Log.d("AppDiscoveryModule", "Discovering usage stats apps (last $daysBack days)...")
            
            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val endTime = System.currentTimeMillis()
            val startTime = endTime - (daysBack * 24 * 60 * 60 * 1000L)
            
            // Query usage stats
            val usageStats = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                startTime,
                endTime
            )
            
            val packagesSeen = mutableSetOf<String>()
            val result: WritableArray = Arguments.createArray()
            
            for (stat in usageStats) {
                val packageName = stat.packageName
                
                // Deduplicate
                if (packagesSeen.contains(packageName)) {
                    continue
                }
                packagesSeen.add(packageName)
                
                val appMap: WritableMap = Arguments.createMap()
                appMap.putString("packageName", packageName)
                result.pushMap(appMap)
            }
            
            android.util.Log.d("AppDiscoveryModule", "Found ${result.size()} apps from usage stats")
            promise.resolve(result)
        } catch (e: Exception) {
            android.util.Log.e("AppDiscoveryModule", "Failed to discover usage stats apps", e)
            promise.reject("DISCOVERY_ERROR", "Failed to discover usage stats apps: ${e.message}", e)
        }
    }
    
    /**
     * Check if UsageStats permission is granted
     */
    @ReactMethod
    fun hasUsageStatsPermission(promise: Promise) {
        try {
            val hasPermission = hasUsageStatsPermission()
            promise.resolve(hasPermission)
        } catch (e: Exception) {
            promise.reject("PERMISSION_CHECK_ERROR", "Failed to check usage stats permission: ${e.message}", e)
        }
    }
    
    private fun hasUsageStatsPermission(): Boolean {
        val appContext = reactApplicationContext.applicationContext
        val packageManager = appContext.packageManager
        val packageName = appContext.packageName
        val currentTime = System.currentTimeMillis()
        
        val usageStatsManager = appContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        
        return try {
            val stats = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                currentTime - 1000 * 60, // Last minute
                currentTime
            )
            
            // If we can query stats, permission is granted
            stats != null
        } catch (e: Exception) {
            false
        }
    }
    
    /**
     * Open UsageStats settings screen
     */
    @ReactMethod
    fun openUsageStatsSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("AppDiscoveryModule", "Failed to open usage stats settings", e)
            promise.reject("SETTINGS_ERROR", "Failed to open usage stats settings: ${e.message}", e)
        }
    }
    
    /**
     * Map Android ApplicationInfo.category integer to a stable English key string.
     *
     * Returns null for CATEGORY_UNDEFINED (-1) so the JS layer can fall back
     * to the static lookup table.
     */
    private fun categoryIntToKey(category: Int): String? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            when (category) {
                ApplicationInfo.CATEGORY_GAME        -> "game"
                ApplicationInfo.CATEGORY_AUDIO       -> "audio"
                ApplicationInfo.CATEGORY_VIDEO       -> "video"
                ApplicationInfo.CATEGORY_IMAGE       -> "image"
                ApplicationInfo.CATEGORY_SOCIAL      -> "social"
                ApplicationInfo.CATEGORY_NEWS        -> "news"
                ApplicationInfo.CATEGORY_MAPS        -> "maps"
                ApplicationInfo.CATEGORY_PRODUCTIVITY -> "productivity"
                else                                  -> null // CATEGORY_UNDEFINED or unknown
            }
        } else {
            null // API < 26: category not available
        }
    }

    /**
     * Resolve app metadata (icon + label + native category)
     *
     * MANDATORY step for every discovered app.
     * This does NOT require QUERY_ALL_PACKAGES.
     * Works even if app has no launcher activity.
     *
     * The `nativeCategory` field is present only on API 26+ and only when the
     * app developer declared a category in their manifest.  JS falls back to
     * the static lookup table when this field is null/absent.
     */
    @ReactMethod
    fun resolveAppMetadata(packageName: String, promise: Promise) {
        try {
            val packageManager = reactApplicationContext.packageManager

            val appInfo = packageManager.getApplicationInfo(packageName, 0)

            val label = packageManager.getApplicationLabel(appInfo).toString()
            val icon = packageManager.getApplicationIcon(appInfo)
            val iconBase64 = drawableToBase64(icon)

            // Resolve native category (API 26+, may be null for CATEGORY_UNDEFINED)
            val nativeCategoryKey: String? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                categoryIntToKey(appInfo.category)
            } else null

            val result: WritableMap = Arguments.createMap()
            result.putString("packageName", packageName)
            result.putString("label", label)
            result.putString("icon", iconBase64)
            result.putBoolean("resolved", true)
            // putString accepts null safely — JS side receives null when undefined
            result.putString("nativeCategory", nativeCategoryKey)

            android.util.Log.d(
                "AppDiscoveryModule",
                "Resolved metadata for $packageName: $label (category=$nativeCategoryKey)"
            )
            promise.resolve(result)
        } catch (e: PackageManager.NameNotFoundException) {
            // App uninstalled
            val result: WritableMap = Arguments.createMap()
            result.putString("packageName", packageName)
            result.putBoolean("resolved", false)
            result.putBoolean("uninstalled", true)

            android.util.Log.d("AppDiscoveryModule", "App uninstalled: $packageName")
            promise.resolve(result)
        } catch (e: Exception) {
            // Temporary failure - retry later
            val result: WritableMap = Arguments.createMap()
            result.putString("packageName", packageName)
            result.putBoolean("resolved", false)
            result.putString("error", e.message)

            android.util.Log.w("AppDiscoveryModule", "Failed to resolve metadata for $packageName: ${e.message}")
            promise.resolve(result)
        }
    }
}
