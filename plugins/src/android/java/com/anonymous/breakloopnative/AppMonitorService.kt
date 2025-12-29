package com.anonymous.breakloopnative

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext

/**
 * Stub AppMonitorService
 * 
 * This service is referenced by AppMonitorModule but is not actively used.
 * The app uses ForegroundDetectionService (AccessibilityService) instead.
 * 
 * This stub exists to satisfy compilation requirements.
 */
class AppMonitorService : Service() {
    
    companion object {
        private const val TAG = "AppMonitorService"
        
        @Volatile
        var isRunning = false
            private set
            
        private var reactContext: ReactApplicationContext? = null
        
        fun setReactContext(context: ReactApplicationContext?) {
            reactContext = context
        }
        
        fun getReactContext(): ReactApplicationContext? {
            return reactContext
        }
        
        fun hasUsageStatsPermission(context: android.content.Context): Boolean {
            // Stub implementation - always return true
            // Actual permission checking is handled by ForegroundDetectionService
            return true
        }
    }
    
    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "AppMonitorService created (stub)")
        isRunning = true
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "AppMonitorService started (stub)")
        return START_STICKY
    }
    
    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
    
    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "AppMonitorService destroyed (stub)")
        isRunning = false
    }
}

