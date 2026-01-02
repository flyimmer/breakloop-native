package com.anonymous.breakloopnative

/**
 * ⚠️ SOURCE FILE LOCATION ⚠️
 * 
 * This file is located in: plugins/src/android/java/com/anonymous/breakloopnative/
 * 
 * DO NOT EDIT the copy in android/app/src/main/java/ - it will be overwritten!
 * ALWAYS edit this file in the plugins/ directory.
 * 
 * The Expo build process copies this file to android/app/ automatically.
 */

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.os.Handler
import android.os.Looper
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
        
        /**
         * In-memory Quick Task timers per app.
         * Maps packageName -> expiration timestamp.
         * 
         * Set by JS via AppMonitorModule.storeQuickTaskTimer().
         * Checked before launching InterventionActivity.
         */
        private val quickTaskTimers = mutableMapOf<String, Long>()
        
        /**
         * Set Quick Task timer for an app.
         * Called from AppMonitorModule when user activates Quick Task.
         */
        @JvmStatic
        fun setQuickTaskTimer(packageName: String, expiresAt: Long) {
            quickTaskTimers[packageName] = expiresAt
            val remainingSec = (expiresAt - System.currentTimeMillis()) / 1000
            Log.i(TAG, "🚀 Quick Task timer set for $packageName (${remainingSec}s remaining)")
        }
        
        /**
         * Clear Quick Task timer for an app.
         * Called from AppMonitorModule when Quick Task expires or is cancelled.
         */
        @JvmStatic
        fun clearQuickTaskTimer(packageName: String) {
            quickTaskTimers.remove(packageName)
            Log.i(TAG, "🧹 Quick Task timer cleared for $packageName")
        }
        
        /**
         * Check if there's a valid Quick Task timer for the given app.
         * 
         * @param packageName Package name to check
         * @return true if valid timer exists (not expired), false otherwise
         */
        @JvmStatic
        fun hasValidQuickTaskTimer(packageName: String): Boolean {
            val expiresAt = quickTaskTimers[packageName] ?: return false
            val now = System.currentTimeMillis()
            val isValid = now < expiresAt
            
            if (isValid) {
                val remainingSec = (expiresAt - now) / 1000
                Log.i(TAG, "✅ Valid Quick Task timer for $packageName (${remainingSec}s remaining)")
            } else {
                // Clean up expired timer
                quickTaskTimers.remove(packageName)
                Log.d(TAG, "⏰ Quick Task timer expired for $packageName")
            }
            
            return isValid
        }
        
        /**
         * Dynamic list of monitored apps (synced from React Native).
         * Used to check if an app should trigger intervention.
         */
        private var dynamicMonitoredApps = mutableSetOf<String>()
        
        /**
         * Update the dynamic monitored apps list.
         * Called from AppMonitorModule when user changes monitored apps in Settings.
         */
        @JvmStatic
        fun updateMonitoredApps(apps: Set<String>) {
            dynamicMonitoredApps.clear()
            dynamicMonitoredApps.addAll(apps)
            Log.i(TAG, "📱 Monitored apps updated: $dynamicMonitoredApps")
        }
    }

    /**
     * Last detected foreground package name
     * Used to avoid duplicate logging of the same app
     */
    private var lastPackageName: String? = null
    
    /**
     * Handler for periodic timer expiration checks
     */
    private val handler = Handler(Looper.getMainLooper())
    
    /**
     * Runnable for checking timer expirations periodically
     */
    private val timerCheckRunnable = object : Runnable {
        override fun run() {
            checkIntentionTimerExpirations()
            checkQuickTaskTimerExpirations()
            // Schedule next check in 1 second for accurate Quick Task expiration
            handler.postDelayed(this, 1000)
        }
    }

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
        
        // Start periodic timer expiration checks
        handler.post(timerCheckRunnable)
        Log.d(TAG, "Started periodic timer expiration checks (every 1 second)")
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
     * Check if there's a valid intention timer for the given app
     * 
     * Intention timers are stored in SharedPreferences by the JS layer
     * Format: "intention_timer_{packageName}" -> expiration timestamp (Long)
     * 
     * @param packageName Package name to check
     * @return true if valid timer exists (not expired), false otherwise
     */
    private fun hasValidIntentionTimer(packageName: String): Boolean {
        try {
            val prefs = getSharedPreferences("intention_timers", MODE_PRIVATE)
            val key = "intention_timer_$packageName"
            val expiresAt = prefs.getLong(key, 0L)
            
            if (expiresAt == 0L) {
                // No timer set
                return false
            }
            
            val now = System.currentTimeMillis()
            val isValid = now <= expiresAt
            
            if (isValid) {
                val remainingSec = (expiresAt - now) / 1000
                Log.i(TAG, "✅ Valid intention timer exists for $packageName (${remainingSec}s remaining)")
            } else {
                Log.d(TAG, "⏰ Intention timer expired for $packageName")
                // Clean up expired timer
                prefs.edit().remove(key).apply()
            }
            
            return isValid
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error checking intention timer", e)
            return false
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
     * @param skipTimerCheck If true, skip the intention timer check (used when timer already expired)
     */
    private fun launchInterventionActivity(triggeringApp: String, skipTimerCheck: Boolean = false) {
        // HIGHEST PRIORITY: Check Quick Task timer FIRST
        // If Quick Task is active for this app, do NOT launch InterventionActivity
        if (hasValidQuickTaskTimer(triggeringApp)) {
            Log.i(TAG, "⏭️ Skipping intervention - Quick Task timer ACTIVE for $triggeringApp")
            return
        }
        
        // Check if there's a valid intention timer first (unless we're called from timer expiration check)
        if (!skipTimerCheck && hasValidIntentionTimer(triggeringApp)) {
            Log.i(TAG, "⏭️ Skipping intervention - valid intention timer exists for $triggeringApp")
            return
        }
        
        Log.i(TAG, "[Accessibility] Launching InterventionActivity with WAKE_REASON=MONITORED_APP_FOREGROUND for $triggeringApp")
        
        try {
            val intent = Intent(this, InterventionActivity::class.java).apply {
                // Pass the triggering app to JS
                putExtra(InterventionActivity.EXTRA_TRIGGERING_APP, triggeringApp)
                
                // Set wake reason - this tells JS to run normal priority chain
                putExtra(InterventionActivity.EXTRA_WAKE_REASON, InterventionActivity.WAKE_REASON_MONITORED_APP)
                
                // Required flags for launching from Service context
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT) // Ensure InterventionActivity appears on top
                addFlags(Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT) // Force activity to foreground
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
    /**
     * Check if any intention timers have expired and trigger interventions
     * 
     * This runs periodically (every 1 second) to catch timer expirations
     * even when the React Native app is backgrounded (JS timers don't fire reliably)
     * 
     * CRITICAL FIX: Only trigger intervention if the expired timer is for the
     * CURRENTLY FOREGROUND app. For background apps, just delete the timer -
     * intervention will trigger when user returns to that app.
     * 
     * This prevents cross-app interference where App A's expired timer
     * would trigger intervention while user is using App B.
     */
    private fun checkIntentionTimerExpirations() {
        try {
            val prefs = getSharedPreferences("intention_timers", MODE_PRIVATE)
            val allPrefs = prefs.all
            val now = System.currentTimeMillis()
            
            // Get the currently foreground app
            val currentForegroundApp = lastPackageName
            
            for ((key, value) in allPrefs) {
                if (!key.startsWith("intention_timer_")) {
                    continue
                }
                
                val packageName = key.substring("intention_timer_".length)
                val expiresAt = value as? Long ?: continue
                
                if (now > expiresAt) {
                    val expiredSec = (now - expiresAt) / 1000
                    
                    // CRITICAL CHECK: Only trigger intervention if this is the CURRENT foreground app
                    val isForeground = packageName == currentForegroundApp
                    
                    if (isForeground) {
                        Log.i(TAG, "⏰ Intention timer EXPIRED for FOREGROUND app $packageName (${expiredSec}s ago) — launching intervention")
                        
                        // Clear expired timer
                        prefs.edit().remove(key).apply()
                        
                        // Launch intervention for foreground app
                        launchInterventionActivity(packageName, skipTimerCheck = true)
                    } else {
                        Log.i(TAG, "⏰ Intention timer EXPIRED for BACKGROUND app $packageName (${expiredSec}s ago)")
                        Log.i(TAG, "  └─ Current foreground: $currentForegroundApp")
                        Log.i(TAG, "  └─ Deleting timer - intervention will trigger when user returns to $packageName")
                        
                        // Just delete the timer - DO NOT launch intervention
                        // When user returns to this app, launchInterventionActivity() will be called
                        // from onAccessibilityEvent() and will trigger intervention then
                        prefs.edit().remove(key).apply()
                    }
                }
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error checking intention timer expirations", e)
        }
    }
    
    /**
     * Launch InterventionActivity specifically for Quick Task expiration.
     * 
     * CRITICAL: Sets WAKE_REASON = QUICK_TASK_EXPIRED
     * JavaScript MUST check this and bypass the normal priority chain.
     * 
     * @param packageName Package name of the app whose Quick Task expired
     */
    private fun launchInterventionActivityForQuickTaskExpired(packageName: String) {
        Log.i(TAG, "[Quick Task Expired] Launching InterventionActivity with WAKE_REASON=QUICK_TASK_EXPIRED")
        
        try {
            val intent = Intent(this, InterventionActivity::class.java).apply {
                // Pass the package name (for reference only)
                putExtra(InterventionActivity.EXTRA_TRIGGERING_APP, packageName)
                
                // CRITICAL: Set wake reason so JS knows to bypass priority chain
                putExtra(InterventionActivity.EXTRA_WAKE_REASON, InterventionActivity.WAKE_REASON_QUICK_TASK_EXPIRED)
                
                // Required flags for launching from Service context
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                addFlags(Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT)
            }
            
            startActivity(intent)
            Log.d(TAG, "  └─ InterventionActivity launched for Quick Task expiration")
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to launch InterventionActivity for Quick Task expiration", e)
        }
    }
    
    /**
     * Check if any Quick Task timers have expired.
     * Called periodically (every 1 second) to detect expiration.
     * When expired, launches InterventionActivity to show QuickTaskExpiredScreen.
     */
    private fun checkQuickTaskTimerExpirations() {
        try {
            val now = System.currentTimeMillis()
            val expiredApps = mutableListOf<String>()
            
            // Find all expired timers
            for ((packageName, expiresAt) in quickTaskTimers) {
                if (now >= expiresAt) {
                    expiredApps.add(packageName)
                    val expiredSec = (now - expiresAt) / 1000
                    Log.i(TAG, "⏰ Quick Task timer EXPIRED for $packageName (expired ${expiredSec}s ago)")
                }
            }
            
            // Process expired timers
            for (packageName in expiredApps) {
                // Remove from map
                quickTaskTimers.remove(packageName)
                
                // Launch InterventionActivity with Quick Task expired flag
                // The React Native layer will detect this and navigate to QuickTaskExpiredScreen
                Log.i(TAG, "🚨 Launching InterventionActivity for expired Quick Task: $packageName")
                launchInterventionActivityForQuickTaskExpired(packageName)
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error checking Quick Task timer expirations", e)
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        isServiceConnected = false
        lastPackageName = null
        
        // Stop periodic timer checks
        handler.removeCallbacks(timerCheckRunnable)
        
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
