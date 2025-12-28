package com.anonymous.breakloopnative

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.util.Log
import android.view.accessibility.AccessibilityEvent

/**
 * AccessibilityService for detecting foreground app changes
 * 
 * WHY ACCESSIBILITYSERVICE?
 * - Provides reliable real-time detection of app switches
 * - Works even when BreakLoop app is closed or killed
 * - Does not require polling (event-driven)
 * - More battery-efficient than UsageStatsManager polling
 * - Can detect window state changes immediately
 * 
 * PRIVACY CONSIDERATIONS:
 * - This service ONLY reads the package name of the foreground app
 * - It does NOT read any content, text, or user data from other apps
 * - It does NOT capture any keystrokes or UI interactions
 * - The detected package names are used solely for mindfulness intervention
 * - Users must explicitly grant this permission in Android Settings
 * 
 * PHASE F1/F2 STATUS:
 * - Phase F1: Detection-only implementation with event-driven app switching
 * - Phase F2 (Refactored): Raw event reporting - launcher filtering moved to JS layer
 * - Currently logs ALL detected package names for debugging (including launchers)
 * - Native layer only suppresses duplicate consecutive events
 * - Semantic filtering (launcher handling) done in OS Trigger Brain
 * - Does NOT trigger overlays or intervention UI yet
 * - Does NOT communicate with React Native yet
 * - Future phases will connect this to the intervention system
 * 
 * LIFECYCLE:
 * - Service starts when user enables it in Android Accessibility Settings
 * - Runs independently of the BreakLoop app UI
 * - Continues running even if the app is killed
 * - Can only be stopped by user disabling it in Settings
 */
class ForegroundDetectionService : AccessibilityService() {

    companion object {
        private const val TAG = "ForegroundDetection"
        
        /**
         * Track if the service is currently running
         * Used to check service status from other components
         */
        @Volatile
        var isServiceConnected = false
            private set
    }

    /**
     * Last detected foreground package name
     * Used to avoid duplicate logging of the same app
     */
    private var lastPackageName: String? = null

    /**
     * Called when the service is connected and ready
     * This happens when user enables the service in Settings
     */
    override fun onServiceConnected() {
        super.onServiceConnected()
        
        Log.i(TAG, "✅ ForegroundDetectionService connected and ready")
        isServiceConnected = true
        
        // Configure the service to receive window state change events
        val info = AccessibilityServiceInfo().apply {
            // We only want window state changes (app switches)
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            
            // We don't need to retrieve any window content
            // This minimizes privacy concerns
            flags = AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            
            // Receive events from all packages
            packageNames = null
            
            // No delay - we want real-time detection
            notificationTimeout = 0
            
            // Low feedback type since we're just monitoring
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
        }
        
        serviceInfo = info
        
        Log.d(TAG, "Service configuration applied - listening for window state changes")
    }

    /**
     * Called when accessibility events occur
     * This is where we detect foreground app changes
     * 
     * RAW EVENT REPORTING (Phase F2 Refactored):
     * This service reports ALL foreground app changes, including launcher events.
     * Semantic filtering (e.g., ignoring launchers) is handled in the OS Trigger Brain
     * at the JavaScript layer, where business logic belongs.
     * 
     * Native layer responsibility:
     * - Detect raw OS-level foreground changes
     * - Suppress duplicate consecutive events (same package repeatedly)
     * - Report all meaningful transitions
     * 
     * @param event The accessibility event containing app switch information
     */
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        
        // We only care about window state changes (app switches)
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            return
        }
        
        // Extract the package name of the foreground app
        val packageName = event.packageName?.toString()
        
        if (packageName.isNullOrEmpty()) {
            Log.d(TAG, "⚠️ Window state changed but package name is null/empty")
            return
        }
        
        // Suppress duplicate consecutive events (native-level normalization)
        // This prevents spamming when the same app emits multiple window events
        if (packageName == lastPackageName) {
            return
        }
        
        // Update last detected package
        lastPackageName = packageName
        
        // Log ALL foreground changes (including launchers)
        // Semantic filtering happens in OS Trigger Brain
        Log.i(TAG, "📱 Foreground app changed: $packageName")
        
        // Additional debug info
        val className = event.className?.toString() ?: "unknown"
        val timestamp = System.currentTimeMillis()
        
        Log.d(TAG, "  └─ Class: $className")
        Log.d(TAG, "  └─ Time: $timestamp")
        
        // TODO Phase F3: Send this information to React Native
        // TODO Phase F4: Check if packageName is in monitored apps list
        // TODO Phase F5: Trigger intervention overlay if needed
    }

    /**
     * Called when accessibility service is interrupted
     * This is rare but can happen during system updates or reconfigurations
     */
    override fun onInterrupt() {
        Log.w(TAG, "⚠️ ForegroundDetectionService interrupted")
    }

    /**
     * Called when the service is disconnected
     * This happens when user disables the service in Settings
     */
    override fun onDestroy() {
        super.onDestroy()
        isServiceConnected = false
        lastPackageName = null
        Log.i(TAG, "❌ ForegroundDetectionService destroyed")
    }

    /**
     * Called when service is unbound
     * Clean up any resources here
     */
    override fun onUnbind(intent: android.content.Intent?): Boolean {
        isServiceConnected = false
        Log.d(TAG, "Service unbound")
        return super.onUnbind(intent)
    }
}

