package com.anonymous.breakloopv0

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.lang.ref.WeakReference

/**
 * SystemSurfaceManager - Singleton Activity Manager
 * 
 * RESPONSIBILITY:
 * - Owns the WeakReference to SystemSurfaceActivity
 * - Provides reliable main-thread finish() capability
 * - Single source of truth for activity existence
 */
object SystemSurfaceManager {
    private const val TAG = "SystemSurfaceManager"
    private const val LOG_TAG_WD = "SS_WD"
    
    // Auth reasons for finish
    const val REASON_JS_REQUEST = "REASON_JS_REQUEST"
    const val REASON_NATIVE_DECISION = "REASON_NATIVE_DECISION"
    const val REASON_WATCHDOG_TIMEOUT = "REASON_WATCHDOG_TIMEOUT"
    const val REASON_UI_NOT_MOUNTED_FAILSAFE = "REASON_UI_NOT_MOUNTED_FAILSAFE"
    const val REASON_OS_LIFECYCLE = "REASON_OS_LIFECYCLE"
    const val REASON_SURFACE_RECOVERY = "REASON_SURFACE_RECOVERY"
    
    private var activityRef: WeakReference<SystemSurfaceActivity>? = null
    private var currentInstanceId: Int? = null
    private var currentWakeReason: String? = null
    private var currentApp: String? = null
    private var createdAt: Long = 0
    private var watchdogRunnable: Runnable? = null
    private val handler = Handler(Looper.getMainLooper())
    
    // M4 Hardening: Idempotency set for closing sessions
    // specific replacement for newKeySet compatibility
    private val closingSessions = java.util.Collections.newSetFromMap(java.util.concurrent.ConcurrentHashMap<String, Boolean>())

    /**
     * Register activity instance (called from onCreate)
     */
    fun register(activity: SystemSurfaceActivity, sessionId: String?) {
        val instanceId = System.identityHashCode(activity)
        activityRef = WeakReference(activity)
        currentInstanceId = instanceId
        createdAt = System.currentTimeMillis()
        currentWakeReason = activity.intent.getStringExtra("wakeReason")
        currentApp = activity.intent.getStringExtra("triggeringApp")
        
        Log.i(TAG, "✅ Registered SystemSurfaceActivity instanceId=$instanceId reason=$currentWakeReason app=$currentApp")
        Log.d(LogTags.SS_WD, "[REGISTER] instanceId=$instanceId wakeReason=$currentWakeReason app=$currentApp")
        
        // Notify SessionManager
        if (sessionId != null) {
            SessionManager.onOverlayShown(sessionId)
        } else {
             Log.w(TAG, "⚠️ register called without sessionId - SessionManager state might be out of sync")
        }
        
        // Auto-schedule primary boot watchdog (2s)
        // This is cancelled by notifyUiMounted() when React UI finishes mounting.
        scheduleWatchdog(2_000, "PrimaryBootWatcher")
    }

    /**
     * Notify that UI is mounted - cancels the boot watchdog.
     */
    fun notifyUiMounted(instanceId: Int, wakeReason: String?, app: String?) {
        if (currentInstanceId == instanceId) {
            Log.i(TAG, "✨ UI MOUNTED - Cancelling boot watchdog for instanceId=$instanceId")
            Log.e(LogTags.SS_WD, "[WD_CANCEL] reason=UI_MOUNTED instanceId=$instanceId wakeReason=$wakeReason app=$app")
            cancelWatchdog()
        } else {
            Log.w(TAG, "⚠️ notifyUiMounted ignored - instanceId mismatch (current=$currentInstanceId, provided=$instanceId)")
        }
    }

    /**
     * Unregister activity instance (called from onDestroy)
     */
    fun unregister(activity: SystemSurfaceActivity, sessionId: String?, reason: String = "ACTIVITY_DESTROYED") {
        val current = activityRef?.get()
        if (current === activity) {
            val instanceId = System.identityHashCode(activity)
            if (!activity.isFinishing) {
                Log.e(LogTags.SS_WD, "[OS_KILL] instanceId=$instanceId destroyed by OS without finish() request")
            }
            cancelWatchdog()
            activityRef = null
            Log.i(TAG, "🧹 Unregistered SystemSurfaceActivity instanceId=$instanceId reason=$reason")
            
            // Notify SessionManager
             if (sessionId != null) {
                SessionManager.endSession(sessionId, reason)
             }
        }
    }

    /**
     * M4 Hardening: Logical End Before Physical Finish
     * Single choke point for all close requests.
     */
    fun requestClose(sessionId: String, reason: String) {
        if (!closingSessions.add(sessionId)) {
            Log.w(TAG, "[SESSION_CLOSE] Ignored duplicate requestClose for sessionId=$sessionId reason=$reason")
            return
        }

        try {
            // 1. Logical Close (Synchronous)
            // We tell SessionManager to end. It returns the session object if it was valid/active.
            val session = SessionManager.endSession(sessionId, reason)

            // 2. State Reset (Synchronous)
            // If the session was valid, we reset the app state immediately.
            if (session != null) {
                ForegroundDetectionService.onSessionClosed(session, reason)
            }

            // 3. Physical Close
            // We trigger the activity finish. This runs independently of session state.
            finish(reason)
            
        } finally {
            // Cleanup after a short delay to allow physical destroy to complete? 
            // actually, strictly speaking we should remove it only when destroyed, but for simple idempotency
            // covering the "race" window, removing it here is fine because endSession is already atomic.
            // The set protects against *concurrent* calls to requestClose.
            closingSessions.remove(sessionId)
        }
    }

    /**
     * Force finish the activity on main thread
     * 
     * @param reason Debug reason for the finish
     * @return true if finish was called on a valid activity
     */
    fun finish(reason: String): Boolean {
        val activity = activityRef?.get()
        val instanceId = currentInstanceId ?: -1
        val ageMs = if (createdAt > 0) System.currentTimeMillis() - createdAt else 0
        
        Log.e(LogTags.SS_WD, "[FINISH_REQ] reason=$reason instanceId=$instanceId ageMs=$ageMs wakeReason=$currentWakeReason app=$currentApp")
        
        if (activity != null && !activity.isFinishing) {
            Log.i(TAG, "⚡ FINISH REQUESTED ($reason) -> Closing SystemSurfaceActivity instanceId=$instanceId")
            
            // Schedule finish verification watchdog (3s)
            // If the activity doesn't destroy and unregister within 3s, this will fire.
            scheduleWatchdog(3_000, "FinishVerification")
            
            handler.post {
                try {
                    activity.finish()
                    // No overridePendingTransition here to keep it simple/system-default
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error finishing activity: ${e.message}")
                } finally {
                    // Unified state cleanup on finish
                    ForegroundDetectionService.onSurfaceExit("FINISH_EXEC_$reason", instanceId, surfaceApp = currentApp)
                    
                     // Explicit session close (backup for unregister)
                     val sid = SessionManager.getCurrentSessionId()
                     if (sid != null) {
                         SessionManager.endSession(sid, "FINISH_CALLED_$reason")
                     }
                }
            }
            return true
        } else {
            if (activity == null) {
                Log.w(TAG, "⚠️ finish($reason) ignored - Activity is null")
                ForegroundDetectionService.onSurfaceExit("FINISH_NULL_$reason", instanceId, surfaceApp = currentApp)
            } else {
                Log.w(TAG, "⚠️ finish($reason) ignored - Activity already finishing")
                ForegroundDetectionService.onSurfaceExit("FINISH_ALREADY_$reason", instanceId, surfaceApp = currentApp)
            }
            return false
        }
    }

    fun scheduleWatchdog(timeoutMs: Long, because: String) {
        cancelWatchdog()
        val instanceId = currentInstanceId ?: return
        val wakeReason = currentWakeReason
        val app = currentApp
        
        Log.d(LogTags.SS_WD, "[WD_SCHEDULE] timeoutMs=$timeoutMs because=$because instanceId=$instanceId")
        
        val runnable = Runnable {
            watchdogFire(timeoutMs, instanceId, wakeReason, app)
        }
        watchdogRunnable = runnable
        handler.postDelayed(runnable, timeoutMs)
    }

    fun cancelWatchdog() {
        watchdogRunnable?.let {
            handler.removeCallbacks(it)
            Log.d(LogTags.SS_WD, "[WD_CANCEL] instanceId=$currentInstanceId")
        }
        watchdogRunnable = null
    }

    private fun watchdogFire(timeoutMs: Long, instanceId: Int, wakeReason: String?, app: String?) {
        Log.e(LogTags.SS_WD, "[WD_FIRE] timeoutMs=$timeoutMs instanceId=$instanceId wakeReason=$wakeReason app=$app")
        finish(REASON_WATCHDOG_TIMEOUT)
    }

    /**
     * Check if activity is currently alive
     */
    fun isAlive(): Boolean {
        val activity = activityRef?.get()
        return activity != null && !activity.isFinishing && !activity.isDestroyed
    }
}
