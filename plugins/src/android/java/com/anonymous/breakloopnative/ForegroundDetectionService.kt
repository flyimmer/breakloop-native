package com.anonymous.breakloopnative

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
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
 * PHASE F3.5 STATUS:
 * - Detects foreground app changes in real-time
 * - Launches InterventionActivity (NOT MainActivity) when monitored app detected
 * - Passes triggering app package name to InterventionActivity
 * - Native code decides WHEN to wake app, JS decides IF and HOW to intervene
 * - Does NOT contain any intervention business logic
 * - Future phases will add monitored apps list checking
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
            
        /**
         * Hardcoded list of monitored apps for Phase F3.5
         * 
         * TODO Phase F4: Replace with dynamic list from JS
         * TODO Phase F4: Sync this list with user's settings in React Native
         * 
         * For now, using common social media / entertainment apps for testing
         */
        private val MONITORED_APPS = setOf(
            "com.instagram.android",
            "com.zhiliaoapp.musically",  // TikTok
            "com.twitter.android",
            "com.facebook.katana",
            "com.reddit.frontpage",
            "com.snapchat.android",
            "com.youtube.android"
        )
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
     * PHASE F3.5 BEHAVIOR:
     * - Detects when a MONITORED app comes to foreground
     * - Launches InterventionActivity (NOT MainActivity)
     * - Passes triggering app package name via Intent extra
     * - Native code decides WHEN to wake app
     * - JS (OS Trigger Brain) decides IF and HOW to intervene
     * 
     * Native layer responsibility:
     * - Detect raw OS-level foreground changes
     * - Suppress duplicate consecutive events (same package repeatedly)
     * - Check if package is in monitored list
     * - Launch InterventionActivity if monitored app detected
     * 
     * JavaScript responsibility:
     * - Evaluate if intervention should occur (Quick Task window, etc.)
     * - Decide which intervention flow to show
     * - Manage intervention state machine
     * - Navigate through intervention screens
     * - Determine when to exit intervention
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
        
        // Log all foreground changes for debugging
        Log.i(TAG, "📱 Foreground app changed: $packageName")
        
        // Check if this is a monitored app
        if (MONITORED_APPS.contains(packageName)) {
            Log.i(TAG, "🎯 MONITORED APP DETECTED: $packageName")
            launchInterventionActivity(packageName)
        } else {
            Log.d(TAG, "  └─ Not a monitored app, ignoring")
        }
    }
    
    /**
     * Launch InterventionActivity to show intervention UI
     * 
     * INTENT FLAGS EXPLAINED:
     * 
     * FLAG_ACTIVITY_NEW_TASK:
     * - Required when starting activity from a Service (not an Activity context)
     * - Creates activity in a new task (required for non-activity contexts)
     * 
     * FLAG_ACTIVITY_CLEAR_TOP:
     * - If InterventionActivity already exists, brings it to front
     * - Clears any activities above it in the stack
     * - Combined with singleInstance launchMode, ensures clean state
     * 
     * FLAG_ACTIVITY_SINGLE_TOP:
     * - If activity is already at top of stack, reuses existing instance
     * - Calls onNewIntent() instead of creating new instance
     * - Prevents duplicate intervention screens
     * 
     * Together these flags ensure:
     * - Clean wake from killed state
     * - No duplicate intervention screens
     * - Proper isolation from MainActivity
     * - User sees ONLY intervention UI, not main app
     * 
     * @param triggeringApp Package name of the app that triggered intervention
     */
    private fun launchInterventionActivity(triggeringApp: String) {
        Log.i(TAG, "[Accessibility] Launching InterventionActivity for $triggeringApp")
        
        try {
            val intent = Intent(this, InterventionActivity::class.java).apply {
                // Pass the triggering app to JS
                putExtra(InterventionActivity.EXTRA_TRIGGERING_APP, triggeringApp)
                
                // Required flags for launching from Service context
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            
            startActivity(intent)
            Log.d(TAG, "  └─ InterventionActivity launched successfully")
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to launch InterventionActivity", e)
        }
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
