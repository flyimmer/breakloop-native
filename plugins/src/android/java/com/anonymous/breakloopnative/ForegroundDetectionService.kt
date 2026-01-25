package com.anonymous.breakloopnative

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContext
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * AccessibilityService for detecting foreground app changes
 */
class ForegroundDetectionService : AccessibilityService() {

    companion object {
        private const val TAG = "ForegroundDetection"
        
        @Volatile
        var isServiceConnected = false
            private set
            
        private val MONITORED_APPS = setOf(
            "com.instagram.android",
            "com.zhiliaoapp.musically",
            "com.twitter.android",
            "com.facebook.katana",
            "com.reddit.frontpage",
            "com.snapchat.android",
            "com.youtube.android"
        )
        
        private val activeTimerRunnables = mutableMapOf<String, Runnable>()
        private var cachedQuickTaskQuota: Int = 1 
        
        enum class QuickTaskState {
            IDLE, DECISION, ACTIVE, POST_CHOICE
        }
        
        data class QuickTaskEntry(
            val app: String,
            var state: QuickTaskState,
            var expiresAt: Long? = null,
            var postChoiceShown: Boolean = false
        )
        
        private val quickTaskMap = mutableMapOf<String, QuickTaskEntry>()
        private const val PREFS_QUICK_TASK_STATE = "quick_task_state_v1"
        private var underlyingApp: String? = null
        private var dynamicMonitoredApps = mutableSetOf<String>()
        private val suppressWakeUntil = mutableMapOf<String, Long>()

        @Volatile
        private var isSystemSurfaceActive: Boolean = false
        @Volatile
        private var systemSurfaceActiveTimestamp: Long = 0
        @Volatile
        private var finishRequestedAt: Long? = null
        
        // Stability-Based Quit Re-entry Suppression
        private val quitSuppressionUntil = java.util.concurrent.ConcurrentHashMap<String, Long>()
        private val pendingRecheck = java.util.concurrent.ConcurrentHashMap<String, Runnable>()
        @Volatile private var lastForegroundPackage: String? = null
        @Volatile private var lastForegroundChangeTime: Long = 0L
        private val recheckAttempts = java.util.concurrent.ConcurrentHashMap<String, Int>()
        private val mainHandler = Handler(Looper.getMainLooper())

        @JvmStatic
        fun setSystemSurfaceActive(active: Boolean) {
            isSystemSurfaceActive = active
            if (active) {
                systemSurfaceActiveTimestamp = System.currentTimeMillis()
            } else {
                systemSurfaceActiveTimestamp = 0
                finishRequestedAt = null
            }
        }

        @JvmStatic
        fun onSystemSurfaceOpened() {
            setSystemSurfaceActive(true)
            finishRequestedAt = null
            Log.d(TAG, "[QT][SURFACE] Surface ACTIVE")
        }

        @JvmStatic
        fun onSystemSurfaceDestroyed() {
            setSystemSurfaceActive(false)
            finishRequestedAt = null
            underlyingApp?.let { finalizePostChoiceIfNeeded(it) }
        }
        
        private fun finalizePostChoiceIfNeeded(app: String) {
            val entry = quickTaskMap[app] ?: return
            if (entry.state == QuickTaskState.POST_CHOICE || entry.state == QuickTaskState.DECISION) {
                entry.state = QuickTaskState.IDLE
                entry.postChoiceShown = false
                entry.expiresAt = null
                cancelNativeTimer(app)
            }
        }
    
        private fun getEffectiveForegroundApp(): String? {
            return if (isSystemSurfaceActive) underlyingApp else currentForegroundApp
        }
        
        @Volatile
        private var currentForegroundApp: String? = null
        
        @JvmStatic
        fun updateCurrentForegroundApp(app: String?) {
            // Track foreground stability
            if (app != lastForegroundPackage) {
                lastForegroundPackage = app
                lastForegroundChangeTime = System.currentTimeMillis()
            }
            currentForegroundApp = app
        }

        @JvmStatic
        fun updateQuickTaskQuota(quota: Int) {
            cachedQuickTaskQuota = quota
        }

        @JvmStatic
        fun updateMonitoredApps(apps: Set<String>) {
            dynamicMonitoredApps.clear()
            dynamicMonitoredApps.addAll(apps)
        }

        private fun cancelNativeTimer(app: String) {
            activeTimerRunnables.remove(app)?.let {
                Handler(Looper.getMainLooper()).removeCallbacks(it)
            }
        }

        @JvmStatic
        fun isWakeSuppressed(packageName: String): Boolean {
            val suppressUntil = suppressWakeUntil[packageName] ?: return false
            if (System.currentTimeMillis() < suppressUntil) return true
            suppressWakeUntil.remove(packageName)
            return false
        }

        @JvmStatic
        fun hasValidQuickTaskTimer(packageName: String): Boolean {
             val entry = quickTaskMap[packageName] ?: return false
             return entry.state == QuickTaskState.ACTIVE && (entry.expiresAt ?: 0) > System.currentTimeMillis()
        }

        @JvmStatic
        fun setSuppressWakeUntil(packageName: String, suppressUntil: Long) {
            suppressWakeUntil[packageName] = suppressUntil
        }

        private fun scheduleDeferredRecheck(app: String, context: android.content.Context) {
            if (pendingRecheck.containsKey(app)) return

            val runnable = Runnable {
                pendingRecheck.remove(app)
                
                if (currentForegroundApp != app) {
                    quitSuppressionUntil.remove(app)
                    recheckAttempts.remove(app)
                    return@Runnable
                }

                val now = System.currentTimeMillis()
                val until = quitSuppressionUntil[app] ?: 0
                val isStable = (lastForegroundPackage == app) && (now - lastForegroundChangeTime >= 200)
                val attempts = (recheckAttempts[app] ?: 0) + 1
                recheckAttempts[app] = attempts

                if (now < until && !isStable) {
                    Log.e(TAG, "[QT][SUPPRESS] Still unstable (attempt $attempts), rescheduling re-check for $app")
                    mainHandler.postDelayed({ scheduleDeferredRecheck(app, context) }, 200)
                    return@Runnable
                } else {
                    Log.e(TAG, "[QT][SUPPRESS] Stability reached or suppression expired for $app after $attempts attempts")
                    quitSuppressionUntil.remove(app)
                    recheckAttempts.remove(app)
                    handleMonitoredAppEntry(app, context)
                }
            }

            pendingRecheck[app] = runnable
            mainHandler.postDelayed(runnable, 200)
        }

        private fun handleMonitoredAppEntry(app: String, context: android.content.Context) {
            // 3️⃣ Entry decision gate (core logic)
            val now = System.currentTimeMillis()
            val suppressUntil = quitSuppressionUntil[app]

            if (suppressUntil != null) {
                if (now >= suppressUntil) {
                    quitSuppressionUntil.remove(app)
                    recheckAttempts.remove(app)
                } else {
                    val isStable = (lastForegroundPackage == app) &&
                                   (now - lastForegroundChangeTime >= 200)

                    if (!isStable) {
                        Log.e(TAG, "[QT][SUPPRESS] Ignoring unstable re-entry for $app")
                        scheduleDeferredRecheck(app, context)
                        return
                    }
                    
                    // Proceeding with stable entry, clear suppression
                    quitSuppressionUntil.remove(app)
                    recheckAttempts.remove(app)
                }
            }

            underlyingApp = app
            val entry = quickTaskMap[app]
            if (entry?.state == QuickTaskState.POST_CHOICE) return
            if (entry == null || entry.state == QuickTaskState.IDLE) {
                val activeEntry = entry ?: QuickTaskEntry(app, QuickTaskState.IDLE).also { quickTaskMap[app] = it }
                activeEntry.state = QuickTaskState.DECISION
                if (cachedQuickTaskQuota > 0) {
                    emitQuickTaskCommand("SHOW_QUICK_TASK_DIALOG", app, context)
                } else {
                    emitQuickTaskCommand("NO_QUICK_TASK_AVAILABLE", app, context)
                }
            }
        }

        private fun emitQuickTaskCommand(command: String, app: String, context: android.content.Context) {
            val reactContext = AppMonitorService.getReactContext()
            if (reactContext == null || !reactContext.hasActiveReactInstance()) return
            val params = Arguments.createMap().apply {
                putString("command", command)
                putString("app", app)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("QUICK_TASK_COMMAND", params)
        }

        @JvmStatic
        fun restoreFromDisk(context: android.content.Context) {
            val prefs = context.getSharedPreferences(PREFS_QUICK_TASK_STATE, android.content.Context.MODE_PRIVATE)
            val now = System.currentTimeMillis()
            prefs.all.forEach { (app, value) ->
                try {
                    val json = org.json.JSONObject(value as String)
                    val state = QuickTaskState.valueOf(json.getString("state"))
                    val expiresAt = if (json.has("expiresAt")) json.getLong("expiresAt") else null
                    if (state == QuickTaskState.ACTIVE && expiresAt != null && expiresAt > now) {
                        quickTaskMap[app] = QuickTaskEntry(app, state, expiresAt)
                        startNativeTimer(app, expiresAt)
                    } else {
                        prefs.edit().remove(app).apply()
                    }
                } catch (e: Exception) {}
            }
        }

        @JvmStatic
        fun onQuickTaskAccepted(app: String, durationMs: Long, context: android.content.Context) {
            val entry = quickTaskMap[app] ?: return
            entry.state = QuickTaskState.ACTIVE
            entry.expiresAt = System.currentTimeMillis() + durationMs
            if (cachedQuickTaskQuota > 0) cachedQuickTaskQuota--
            startNativeTimer(app, entry.expiresAt!!)
            emitQuickTaskCommand("START_QUICK_TASK_ACTIVE", app, context)
        }

        @JvmStatic
        fun onQuickTaskDeclined(app: String, context: android.content.Context) {
            quickTaskMap[app]?.state = QuickTaskState.IDLE
            emitFinishSystemSurface(context)
        }

        @JvmStatic
        fun onQuickTaskSwitchedToIntervention(app: String, context: android.content.Context) {
            // User chose the full process (Intervention)
            // Reset Quick Task state to IDLE but do NOT close the SystemSurface
            // because the JS flow (Intervention) will now render on the same surface.
            quickTaskMap[app]?.let { entry ->
                Log.i(TAG, "[QT] Switched to Intervention for $app (state: ${entry.state} -> IDLE)")
                entry.state = QuickTaskState.IDLE
                entry.expiresAt = null
            }
        }

        @JvmStatic
        fun onPostChoiceContinue(app: String, context: android.content.Context) {
            finalizePostChoiceIfNeeded(app)
            emitFinishSystemSurface(context)
        }

        @JvmStatic
        fun onPostChoiceQuit(app: String, context: android.content.Context) {
            finalizePostChoiceIfNeeded(app)
            
            // 1️⃣ On POST_QUIT for app X: Start suppression
            quitSuppressionUntil[app] = System.currentTimeMillis() + 1500
            Log.e(TAG, "[QT][SUPPRESS] Quit suppression started for $app")
            
            suppressWakeUntil.remove(app)
            emitFinishSystemSurface(context)
        }

        private fun emitFinishSystemSurface(context: android.content.Context) {
            if (!isSystemSurfaceActive) {
                SystemSurfaceManager.finish("ForceFinish")
                return
            }
            finishRequestedAt = System.currentTimeMillis()
            emitQuickTaskCommand("FINISH_SYSTEM_SURFACE", "", context)
            SystemSurfaceManager.finish("NativeCommand")
        }

        private fun startNativeTimer(app: String, expiresAt: Long) {
            cancelNativeTimer(app)
            val delay = expiresAt - System.currentTimeMillis()
            val runnable = Runnable { onQuickTaskTimerExpired(app) }
            activeTimerRunnables[app] = runnable
            Handler(Looper.getMainLooper()).postDelayed(runnable, Math.max(0, delay))
        }

        @JvmStatic
        fun onQuickTaskTimerExpired(app: String) {
            val entry = quickTaskMap[app] ?: return
            if (entry.state != QuickTaskState.ACTIVE) return
            val isForeground = getEffectiveForegroundApp() == app
            val context = AppMonitorService.getReactContext()?.applicationContext ?: return
            if (isForeground) {
                if (cachedQuickTaskQuota > 0) {
                    entry.state = QuickTaskState.POST_CHOICE
                    entry.expiresAt = null
                    entry.postChoiceShown = true
                    emitQuickTaskCommand("SHOW_POST_QUICK_TASK_CHOICE", app, context)
                } else {
                    entry.state = QuickTaskState.IDLE
                    emitQuickTaskCommand("NO_QUICK_TASK_AVAILABLE", app, context)
                }
            } else {
                entry.state = QuickTaskState.IDLE
                entry.expiresAt = null
            }
            activeTimerRunnables.remove(app)
        }

        private fun checkWatchdog() {
            val now = System.currentTimeMillis()
            if (isSystemSurfaceActive && systemSurfaceActiveTimestamp > 0 && now - systemSurfaceActiveTimestamp > 30_000) {
                SystemSurfaceManager.finish("Watchdog_Timeout")
                setSystemSurfaceActive(false)
            }
            val reqTime = finishRequestedAt
            if (reqTime != null && isSystemSurfaceActive && now - reqTime > 3_000) {
                SystemSurfaceManager.finish("Watchdog_FinishVerify")
                setSystemSurfaceActive(false)
            }
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private val periodicCheckRunnable = object : Runnable {
        override fun run() {
            checkWatchdog()
            handler.postDelayed(this, 5000)
        }
    }

    override fun onCreate() {
        super.onCreate()
        handler.post(periodicCheckRunnable)
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(periodicCheckRunnable)
        isServiceConnected = false
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        isServiceConnected = true
        Log.e("QT_DEV", "🔥 NATIVE_BUILD_CANARY: ${NativeBuildCanary.BUILD_VERSION}")
        restoreFromDisk(applicationContext)
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                        AccessibilityEvent.TYPE_VIEW_SCROLLED or
                        AccessibilityEvent.TYPE_VIEW_CLICKED or
                        AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
            flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
                   AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
        }
        serviceInfo = info
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val packageName = event?.packageName?.toString() ?: return
        Log.e("FG_RAW", "Event: ${AccessibilityEvent.eventTypeToString(event.eventType)} Package: $packageName")
        if (dynamicMonitoredApps.contains(packageName) && !isSystemSurfaceActive) {
            handleMonitoredAppEntry(packageName, applicationContext)
        }
        updateCurrentForegroundApp(packageName)
    }

    override fun onInterrupt() {}
    override fun onUnbind(intent: Intent?): Boolean {
        isServiceConnected = false
        return super.onUnbind(intent)
    }
}
