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
    const val BUILD_VERSION = 27
    const val VERSION_NAME = "V3-Intervention-Preservation"
    // Added debug logs and boot timeout failsafe for SystemSurfaceActivity
}
