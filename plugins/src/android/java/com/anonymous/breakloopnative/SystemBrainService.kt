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

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * SystemBrainService - Mechanical Event Delivery Service
 * 
 * ARCHITECTURE:
 * This service is a PURE MECHANICAL EVENT DELIVERY LAYER.
 * It forwards events from native to System Brain JS (headless task).
 * 
 * RESPONSIBILITIES (MECHANICAL ONLY):
 * - Receive Intent with event data from ForegroundDetectionService
 * - Create HeadlessJsTaskConfig for "SystemEvent" task
 * - Forward event data to System Brain JS
 * - Acquire wake lock for background execution
 * - Release resources after task completion
 * 
 * FORBIDDEN (NO SEMANTIC LOGIC):
 * - ❌ NO decision making (when to intervene, which flow to show)
 * - ❌ NO state management (timers, counters, flags)
 * - ❌ NO semantic interpretation (Quick Task vs Intention)
 * - ❌ NO business logic (OS Trigger Brain runs in JS)
 * 
 * EVENT TYPES FORWARDED:
 * - TIMER_SET: A timer was stored (mechanical notification)
 * - TIMER_EXPIRED: A timer reached its expiration timestamp (mechanical notification)
 * - FOREGROUND_CHANGED: Foreground app changed (mechanical notification)
 * 
 * System Brain JS receives these mechanical events and makes ALL semantic decisions.
 * 
 * LIFECYCLE:
 * - Service started by Intent from ForegroundDetectionService
 * - Runs briefly to invoke headless task
 * - Automatically stops after task completion
 * - Does NOT run continuously
 * - Does NOT maintain state between invocations
 */
class SystemBrainService : HeadlessJsTaskService() {

    companion object {
        private const val TAG = "SystemBrainService"
        
        // Intent extra keys (mechanical data only)
        const val EXTRA_EVENT_TYPE = "eventType"
        const val EXTRA_PACKAGE_NAME = "packageName"
        const val EXTRA_TIMESTAMP = "timestamp"
        const val EXTRA_EXPIRES_AT = "expiresAt"  // For TIMER_SET events
        const val EXTRA_TIMER_TYPE = "timerType"  // For TIMER_SET events (QUICK_TASK or INTENTION)
    }

    /**
     * Create HeadlessJsTaskConfig for System Brain event.
     * 
     * This is the ONLY method that contains logic - pure mechanical forwarding.
     * Extracts event data from Intent and packages it for JS consumption.
     * 
     * @param intent Intent containing event data
     * @return HeadlessJsTaskConfig for "SystemEvent" task, or null if invalid
     */
    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        if (intent == null) {
            Log.w(TAG, "⚠️ Received null intent, cannot create task config")
            return null
        }
        
        // CRITICAL: Check if React Native is initialized before starting headless task
        // This prevents "Cannot start headless task, CatalystInstance not available" crash
        try {
            // Use reactContext protected property from HeadlessJsTaskService base class
            val context = reactContext
            if (context == null) {
                Log.w(TAG, "⚠️ React Native not initialized yet (reactContext is null), retrying headless task in 1 second")
                
                // Retry the event after a delay instead of dropping it
                Handler(Looper.getMainLooper()).postDelayed({
                    try {
                        startService(intent)
                        Log.d(TAG, "   Retried headless task after RN initialization delay")
                    } catch (e: Exception) {
                        Log.e(TAG, "   Failed to retry headless task: ${e.message}")
                    }
                }, 1000)
                
                return null
            }
            // Check if React Native has an active instance
            // hasActiveReactInstance() exists on ReactContext (abstract class)
            val hasActiveInstance = try {
                context.hasActiveReactInstance()
            } catch (e: NoSuchMethodError) {
                // Fallback: if method doesn't exist, assume it's ready if context exists
                true
            }
            if (!hasActiveInstance) {
                Log.w(TAG, "⚠️ React Native not initialized yet (no active instance), retrying headless task in 1 second")
                
                // Retry the event after a delay instead of dropping it
                Handler(Looper.getMainLooper()).postDelayed({
                    try {
                        startService(intent)
                        Log.d(TAG, "   Retried headless task after RN initialization delay")
                    } catch (e: Exception) {
                        Log.e(TAG, "   Failed to retry headless task: ${e.message}")
                    }
                }, 1000)
                
                return null
            }
        } catch (e: Exception) {
            Log.w(TAG, "⚠️ Error checking React Native initialization: ${e.message}, retrying headless task in 1 second")
            
            // Retry the event after a delay instead of dropping it
            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    startService(intent)
                    Log.d(TAG, "   Retried headless task after RN initialization delay")
                } catch (e: Exception) {
                    Log.e(TAG, "   Failed to retry headless task: ${e.message}")
                }
            }, 1000)
            
            return null
        }
        
        val extras = intent.extras
        if (extras == null) {
            Log.w(TAG, "⚠️ Intent has no extras, cannot create task config")
            return null
        }
        
        // Extract mechanical event data
        val eventType = extras.getString(EXTRA_EVENT_TYPE)
        val packageName = extras.getString(EXTRA_PACKAGE_NAME)
        val timestamp = extras.getLong(EXTRA_TIMESTAMP, 0L)
        
        if (eventType == null || packageName == null || timestamp == 0L) {
            Log.w(TAG, "⚠️ Missing required event data: type=$eventType, package=$packageName, timestamp=$timestamp")
            return null
        }
        
        // Package event data for System Brain JS
        val taskData = Arguments.createMap().apply {
            putString("type", eventType)
            putString("packageName", packageName)
            putDouble("timestamp", timestamp.toDouble())
            
            // For TIMER_SET events, include expiration timestamp and timer type
            if (eventType == "TIMER_SET") {
                val expiresAt = extras.getLong(EXTRA_EXPIRES_AT, 0L)
                if (expiresAt > 0) {
                    putDouble("expiresAt", expiresAt.toDouble())
                }
                
                // Include explicit timer type (QUICK_TASK or INTENTION)
                val timerType = extras.getString(EXTRA_TIMER_TYPE)
                if (timerType != null) {
                    putString("timerType", timerType)
                }
            }
        }
        
        Log.i(TAG, "📤 Forwarding mechanical event to System Brain JS: $eventType for $packageName")
        
        // Create task config for System Brain headless task
        // Task name MUST match AppRegistry.registerHeadlessTask() in src/systemBrain/index.ts
        return HeadlessJsTaskConfig(
            "SystemEvent",           // Task name (registered in JS)
            taskData,                // Event data (mechanical only)
            10000,                   // Timeout: 10 seconds (should be plenty for event processing)
            true                     // Allow in foreground (events can occur anytime)
        )
    }
    
    /**
     * Called when headless task starts.
     * Pure logging, no logic.
     */
    override fun onHeadlessJsTaskStart(taskId: Int) {
        super.onHeadlessJsTaskStart(taskId)
        Log.d(TAG, "🚀 System Brain headless task started (taskId: $taskId)")
    }
    
    /**
     * Called when headless task finishes.
     * Pure logging, no logic.
     */
    override fun onHeadlessJsTaskFinish(taskId: Int) {
        super.onHeadlessJsTaskFinish(taskId)
        Log.d(TAG, "✅ System Brain headless task finished (taskId: $taskId)")
    }
}
