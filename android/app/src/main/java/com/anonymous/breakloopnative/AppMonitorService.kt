package com.anonymous.breakloopnative

import android.app.*
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Foreground service that monitors foreground app changes
 * and emits events to React Native via DeviceEventEmitter
 */
class AppMonitorService : Service() {
    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "AppMonitorChannel"
        private const val POLL_INTERVAL_MS = 2000L // Check every 2 seconds (for debugging)
        
        var isRunning = false
            private set
        
        private var reactContext: ReactApplicationContext? = null
        
        fun setReactContext(context: ReactApplicationContext?) {
            reactContext = context
        }
        
        /**
         * Check if Usage Stats permission is granted
         */
        fun hasUsageStatsPermission(context: Context): Boolean {
            val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val currentTime = System.currentTimeMillis()
            val stats = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                currentTime - 1000 * 10,
                currentTime
            )
            return stats != null && stats.isNotEmpty()
        }
    }
    
    private val handler = Handler(Looper.getMainLooper())
    private var lastForegroundApp: String? = null
    private lateinit var usageStatsManager: UsageStatsManager
    
    private val monitorRunnable = object : Runnable {
        override fun run() {
            checkForegroundApp()
            handler.postDelayed(this, POLL_INTERVAL_MS)
        }
    }
    
    override fun onCreate() {
        super.onCreate()
        android.util.Log.d("AppMonitorService", "onCreate called")
        usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        createNotificationChannel()
        isRunning = true
        android.util.Log.d("AppMonitorService", "Service created, isRunning = true")
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        android.util.Log.d("AppMonitorService", "onStartCommand called")
        
        try {
            // Start as foreground service with notification
            val notification = createNotification()
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ requires foreground service type
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            
            android.util.Log.d("AppMonitorService", "Foreground service started with notification")
            
            // Start monitoring
            handler.post(monitorRunnable)
            android.util.Log.d("AppMonitorService", "Monitoring runnable posted")
            
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorService", "Error in onStartCommand", e)
        }
        
        return START_STICKY
    }
    
    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(monitorRunnable)
        isRunning = false
        android.util.Log.d("AppMonitorService", "Service stopped")
    }
    
    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "App Monitor Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitoring foreground app usage"
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    private fun createNotification(): Notification {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_IMMUTABLE
        )
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("BreakLoop Active")
            .setContentText("Monitoring app usage")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }
    
    private fun checkForegroundApp() {
        android.util.Log.d("AppMonitorService", "checkForegroundApp called")
        
        try {
            val currentTime = System.currentTimeMillis()
            val usageStatsList = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                currentTime - 10000, // Last 10 seconds
                currentTime
            )
            
            android.util.Log.d("AppMonitorService", "Usage stats size: ${usageStatsList?.size ?: 0}")
            
            if (usageStatsList.isNullOrEmpty()) {
                android.util.Log.w("AppMonitorService", "No usage stats available")
                return
            }
            
            // Find the most recently used app
            // NOTE: Android UsageStats may report the last used app when returning to launcher.
            // This is a known limitation of the UsageStats API. App exits are inferred reliably
            // when another app enters foreground, so the OS Trigger Brain logic remains correct.
            val currentApp = usageStatsList
                .maxByOrNull { it.lastTimeUsed }
                ?.packageName
            
            android.util.Log.d("AppMonitorService", "Current app: $currentApp, Last app: $lastForegroundApp")
            
            // Emit event if foreground app changed
            if (currentApp != null && currentApp != lastForegroundApp) {
                android.util.Log.d("AppMonitorService", "Foreground app changed: $lastForegroundApp -> $currentApp")
                lastForegroundApp = currentApp
                emitForegroundAppChanged(currentApp, currentTime)
            } else if (currentApp != null) {
                // HEARTBEAT: Emit periodic event every 2s for debugging (silent - no log)
                // This enables JS to check ALL monitored app intention timers.
                // Per OS Trigger Contract: "t_monitored counts down independently of which app is in foreground"
                // TODO: Change to 30s for production
                emitForegroundAppChanged(currentApp, currentTime)
            }
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorService", "Error checking foreground app", e)
        }
    }
    
    private fun emitForegroundAppChanged(packageName: String, timestamp: Long) {
        val context = reactContext
        if (context == null) {
            android.util.Log.w("AppMonitorService", "ReactContext is null, cannot emit event")
            return
        }
        
        if (!context.hasActiveReactInstance()) {
            android.util.Log.w("AppMonitorService", "No active React instance")
            return
        }
        
        try {
            val params: WritableMap = Arguments.createMap().apply {
                putString("packageName", packageName)
                putDouble("timestamp", timestamp.toDouble())
            }
            
            context
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onForegroundAppChanged", params)
            
            android.util.Log.d("AppMonitorService", "Event emitted: $packageName")
        } catch (e: Exception) {
            android.util.Log.e("AppMonitorService", "Error emitting event", e)
        }
    }
}

