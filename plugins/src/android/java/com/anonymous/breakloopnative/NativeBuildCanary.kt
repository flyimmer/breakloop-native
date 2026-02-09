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
object NativeBuildCanary { // BUILD VERSION (increment for each native code change)
    // This helps verify that the latest native code is actually running on device
    // v69: POST_CONTINUE loop fixes (cooldown + session-aware SURFACE_DESTROY age guard)
    // v70: PR1 - Activity field tracking (currentWakeReason/currentApp) + metadata threading
    const val BUILD_VERSION = 77
    const val VERSION_NAME = "V3-Native-Authority-Stores"
    // Fix A: Set postChoiceCompletedAtMsByApp for CONTINUE. Fix B: Age guard for SURFACE_DESTROY
    
    fun logBuildInfo() {
        android.util.Log.e("NATIVE_BUILD_CANARY", "🔥 Native build active: $BUILD_VERSION ($VERSION_NAME)")
    }
}
