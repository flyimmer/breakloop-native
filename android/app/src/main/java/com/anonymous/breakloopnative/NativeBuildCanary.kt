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
    // v81: PR9: POST_CHOICE persistence (visibility tracking, watchdog, offering gate, QUIT no-suppression)
    // v82: PR9 bridge fix: route QUIT/CONTINUE to new handlers
    // v83: Launcher detection fix: dynamic Intent resolution (fixes Honor launcher tracking bug)
    // v84: Fixed Window Refill: wall-clock aligned quota windows with configurable duration (15m-24h)
    // v85: Fixed Window Refill: quota display fix - read from native instead of AsyncStorage
    // v86: Intervention Completion Fix: native-authoritative completion with atomic cleanup + deterministic reevaluation
    // v87: Intention Timer FG Fix + FINISH Cleanup: 3-tier fallback (120s threshold) + FINISH_COMMAND guarded cleanup
    const val BUILD_VERSION = 87
    const val VERSION_NAME = "V3-Intention-Timer-FG-FINISH-Cleanup"
    
    fun logBuildInfo() {
        android.util.Log.e("NATIVE_BUILD_CANARY", "🔥 Native build active: $BUILD_VERSION ($VERSION_NAME)")
    }
}
