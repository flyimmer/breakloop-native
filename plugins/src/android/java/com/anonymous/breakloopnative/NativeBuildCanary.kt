package com.anonymous.breakloopnative

/**
 * Native Build Canary
 *
 * PURPOSE:
 * Provides a deterministic way to verify that native Kotlin code changes
 * are actually running on the device.
 *
 * USAGE RULE (CRITICAL):
 * - Whenever ANY Kotlin file is changed, manually increment or change BUILD_ID
 * - Do NOT automate this value
 * - This is the ONLY trusted signal that native code has been updated
 *
 * DEBUGGING RULE:
 * Never debug Kotlin logic unless the Native Build Canary proves the code is running.
 * If an old BUILD_ID appears in logcat:
 *   → Native code is stale
 *   → APK reinstall is required
 *   → Logic debugging must stop immediately
 *
 * This is for development only.
 */
object NativeBuildCanary {
    // Increment this number to trigger a fresh native build
    const val BUILD_VERSION = 68 // Quick Task expiry fix: lastRealForegroundPkg tracking
    const val VERSION_NAME = "V3-Native-Authority-Stores"
    // Added lastRealForegroundPkg fallback with 30s age check + comprehensive QT_EXPIRE_FG diagnostic
    
    fun logBuildInfo() {
        android.util.Log.e("NATIVE_BUILD_CANARY", "🔥 Native build active: $BUILD_VERSION ($VERSION_NAME)")
    }
}
