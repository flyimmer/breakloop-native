package com.anonymous.breakloopnative

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
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
        private const val NOTIFICATION_CHANNEL_ID = "app_monitor_service"
        private const val NOTIFICATION_ID = 1001
        
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
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "App Monitor Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitors app usage (stub service)"
            }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "AppMonitorService created (stub)")
        isRunning = true
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "AppMonitorService started (stub)")
        
        // Create notification channel and start foreground
        createNotificationChannel()
        
        val notification = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("BreakLoop")
            .setContentText("App monitoring active")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
        
        startForeground(NOTIFICATION_ID, notification)
        
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

