package com.anonymous.breakloopnative

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
    
    private var activityRef: WeakReference<SystemSurfaceActivity>? = null

    /**
     * Register activity instance (called from onCreate)
     */
    fun register(activity: SystemSurfaceActivity) {
        activityRef = WeakReference(activity)
        Log.i(TAG, "✅ Registered SystemSurfaceActivity instance")
    }

    /**
     * Unregister activity instance (called from onDestroy)
     */
    fun unregister(activity: SystemSurfaceActivity) {
        val current = activityRef?.get()
        if (current === activity) {
            activityRef = null
            Log.i(TAG, "🧹 Unregistered SystemSurfaceActivity instance")
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
        
        if (activity != null && !activity.isFinishing) {
            Log.i(TAG, "⚡ FINISH REQUESTED ($reason) -> Closing SystemSurfaceActivity")
            
            Handler(Looper.getMainLooper()).post {
                try {
                    activity.finish()
                    // No overridePendingTransition here to keep it simple/system-default
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error finishing activity: ${e.message}")
                }
            }
            return true
        } else {
            if (activity == null) {
                Log.w(TAG, "⚠️ finish($reason) ignored - Activity is null")
            } else {
                Log.w(TAG, "⚠️ finish($reason) ignored - Activity already finishing")
            }
            return false
        }
    }

    /**
     * Check if activity is currently alive
     */
    fun isAlive(): Boolean {
        val activity = activityRef?.get()
        return activity != null && !activity.isFinishing && !activity.isDestroyed
    }
}
