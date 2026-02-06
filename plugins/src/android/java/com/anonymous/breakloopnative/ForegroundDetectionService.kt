package com.anonymous.breakloopnative

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.app.Application
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
import kotlinx.coroutines.*
import java.lang.ref.WeakReference

/**
 * AccessibilityService for detecting foreground app changes
 * Fully Restructured for V3 Stability
 */
class ForegroundDetectionService : AccessibilityService() {

    // Instance Members (Initialized in onServiceConnected)
    lateinit var quotaStore: QuickTaskQuotaStore
    lateinit var monitoredStore: MonitoredAppsStore
    lateinit var intentionStore: IntentionStore
    val serviceScope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO + kotlinx.coroutines.SupervisorJob())
    
    // Surface Lifecycle Tracking (Instance Level)
    @Volatile private var activeSurfaceApp: String? = null
    @Volatile private var activeSurfaceInstanceId: Int? = null
    @Volatile private var activeSurfaceSessionId: String? = null
    @Volatile private var surfaceStartedAtMs: Long = 0L

    companion object {
        private const val TAG = "ForegroundDetection"
        private const val LOG_TAG_QT = "QT_STATE"
        
        @Volatile
        var isServiceConnected = false
            private set

        @Volatile
        var serviceInstance: ForegroundDetectionService? = null
            
        private val MONITORED_APPS = setOf(
            "com.instagram.android",
            "com.zhiliaoapp.musically",
            "com.twitter.android",
            "com.facebook.katana",
            "com.reddit.frontpage",
            "com.snapchat.android",
            "com.youtube.android"
        )
        
        private val IGNORE_LIST_APPS = setOf(
            "com.android.systemui",
            "com.google.android.googlequicksearchbox"
        )
        
        @Volatile private var cachedLauncherPkg: String? = null
        private val inFlightEntry = java.util.concurrent.ConcurrentHashMap<String, Long>()

        // H1.3 Constants
        private const val DEBOUNCE_MS = 300L
        private const val DUP_COLLAPSE_MS = 400L

        // Global Locks & State
        private val qtLock = Any()
        private val mainHandler = Handler(Looper.getMainLooper())
        
        @Volatile private var serviceRef: WeakReference<ForegroundDetectionService>? = null
        
        private fun withService(block: (ForegroundDetectionService) -> Unit) {
            val svc = serviceRef?.get()
            if (svc == null) {
                Log.e("SERVICE_REF", "[SERVICE_REF] ForegroundDetectionService is null (not running?)")
                return
            }
            block(svc)
        }
        private val activeQuickTaskSessionIdByApp = mutableMapOf<String, String>()
        private val promptSessionIdByApp = mutableMapOf<String, String>() // OFFERING state tracking
        private val offerStartedAtMsByApp = mutableMapOf<String, Long>() // OFFERING timestamp for timeout
        private val postChoiceSessionIdByApp = mutableMapOf<String, String>() // POST_CHOICE lock
        private val activeTimerRunnablesByApp = mutableMapOf<String, Runnable>()
        private val activeSessionStartedAtMsByApp = mutableMapOf<String, Long>() // ACTIVE session timestamp
        private val quickTaskMap = mutableMapOf<String, QuickTaskEntry>()
        private val preservedInterventionFlags = mutableMapOf<String, Boolean>()
        private val suppressWakeUntil = mutableMapOf<String, Long>()
        
        // Post-QT cooldown and suppression tracking (protected by qtLock)
        private val postChoiceCompletedAtMsByApp = mutableMapOf<String, Long>()
        private val quitSuppressedUntilMsByApp = mutableMapOf<String, Long>()
        private val confirmedSessionIdByApp = mutableMapOf<String, String>() // Idempotent quota decrement
        
        // Caches (Updated via Setters/Stores)
        @Volatile private var cachedQuotaState: QuotaState = QuotaState(1L, 0L, 1L)
        @Volatile private var cachedMonitoredApps: Set<String> = emptySet()
        @Volatile private var cachedIntentions: Map<String, Long> = emptyMap()
        
        @Volatile private var activeQuickTaskSessionId: String? = null // Legacy alias if needed?
        @Volatile private var activeQuickTaskApp: String? = null
        
        // Stability State
        private val quitSuppressionUntil = java.util.concurrent.ConcurrentHashMap<String, Long>()
        private val pendingRecheck = java.util.concurrent.ConcurrentHashMap<String, Runnable>()
        private val recheckAttempts = java.util.concurrent.ConcurrentHashMap<String, Int>()
        private val showInterventionLastEmittedAt = java.util.concurrent.ConcurrentHashMap<String, Long>()
        
        @Volatile private var lastForegroundPackage: String? = null
        @Volatile private var lastForegroundChangeTime: Long = 0L
        @Volatile private var isSystemSurfaceActive: Boolean = false
        @Volatile private var systemSurfaceActiveTimestamp: Long = 0
        @Volatile private var finishRequestedAt: Long? = null
        @Volatile private var underlyingApp: String? = null
        @Volatile private var currentForegroundApp: String? = null
        @Volatile private var lastWindowStateChangedPkg: String? = null
        
        private val surfaceRecoveryHandler = Handler(Looper.getMainLooper())
        private var surfaceRecoveryRunnable: Runnable? = null
        
        private const val PREFS_MONITORED_APPS = "monitored_apps_native_v1"
        private const val KEY_MONITORED_APPS = "monitored_apps_set"
        
        // Canonical Wake Reasons (Native → JS Contract)
        private const val WAKE_REASON_SHOW_QUICK_TASK = "SHOW_QUICK_TASK"
        private const val WAKE_REASON_SHOW_INTERVENTION = "SHOW_INTERVENTION"
        private const val WAKE_REASON_SHOW_POST_QUICK_TASK_CHOICE = "SHOW_POST_QUICK_TASK_CHOICE"

        enum class QuickTaskState {
            IDLE, DECISION, OFFERING, ACTIVE, POST_CHOICE, INTERVENTION_ACTIVE
        }
        
        data class QuickTaskEntry(
            val app: String,
            var state: QuickTaskState,
            var expiresAt: Long? = null,
            var postChoiceShown: Boolean = false,
            var lastRecoveryLaunchAtMs: Long = 0,
            var suppressRecoveryUntilMs: Long = 0,
            var decisionStartedAtMs: Long = 0L
        )

        // =========================================================================
        // PUBLIC STATIC BRIDGE METHODS (Accessed by Modules)
        // =========================================================================
        
        @JvmStatic
        fun isInterventionPreserved(app: String): Boolean {
            val value = preservedInterventionFlags[app] == true
            Log.e(LogTags.QT_STATE, "[PRESERVE_READ] app=$app value=$value caller=isInterventionPreserved")
            return value
        }
        
        @JvmStatic
        fun setInterventionPreserved(app: String, preserved: Boolean, context: android.content.Context?) {
            if (preserved) {
                preservedInterventionFlags[app] = true
                Log.e(LogTags.QT_STATE, "[PRESERVE_SET] app=$app value=true")
            } else {
                preservedInterventionFlags.remove(app)
                Log.e(LogTags.QT_STATE, "[PRESERVE_SET] app=$app value=false (removed)")
            }
        }

        @JvmStatic
        fun getQuickTaskStateForApp(app: String): String {
            return quickTaskMap[app]?.state?.name ?: "UNKNOWN"
        }
        
        @JvmStatic
        fun getActiveSessionIdForApp(app: String): String? {
             synchronized(qtLock) {
                 return activeQuickTaskSessionIdByApp[app]
             }
        }
        
        @JvmStatic
        fun getActiveQuickTaskSessionId(): String? {
            synchronized(qtLock) {
                return activeQuickTaskSessionIdByApp.values.firstOrNull()
            }
        }
        
        @JvmStatic
        fun onQuickTaskAccepted(app: String, durationMs: Long, context: android.content.Context) {
            val sessionId = synchronized(qtLock) {
                activeQuickTaskSessionIdByApp[app]
            }
            if (sessionId == null) {
                 Log.e(LogTags.QT_STATE, "[QT_ACCEPT] ignored no_session for $app")
                 return
            }

            synchronized(qtLock) {
                val entry = quickTaskMap[app] ?: return
                entry.state = QuickTaskState.ACTIVE
                entry.expiresAt = System.currentTimeMillis() + durationMs
                startNativeTimer(app, entry.expiresAt!!, sessionId)
            }
            emitQuickTaskCommand("START_QUICK_TASK_ACTIVE", app, context)
        }

        @JvmStatic
        fun onQuickTaskFinished(app: String, sessionId: String, context: android.content.Context) {
            var action: String? = null
            
            synchronized(qtLock) {
                if (activeQuickTaskSessionIdByApp[app] != sessionId) {
                    Log.e(LogTags.QT_FINISH, "[QT_FINISH] ignored session_mismatch expected=${activeQuickTaskSessionIdByApp[app]} got=$sessionId")
                    return
                }
                
                // Cancel Timer
                cancelNativeTimerLocked(app)

                val entry = quickTaskMap[app]
                if (entry?.state == QuickTaskState.POST_CHOICE) {
                    Log.e(LogTags.QT_FINISH, "[QT_FINISH] ignored duplicate (already POST_CHOICE) app=$app")
                    return
                }
                
                // Determine Next Step
                val remaining = cachedQuotaState.remaining
                
                if (remaining > 0) {
                    entry?.state = QuickTaskState.POST_CHOICE
                    entry?.postChoiceShown = true
                    action = "SHOW_POST_CHOICE"
                    Log.d(LogTags.QT_FINISH, "[QT_FINISH] Manual -> PostChoice (Quota=$remaining)")
                } else {
                    // Quota exhausted -> Clear session and Force Re-Eval
                    clearActiveForAppLocked(app, "MANUAL_FINISH_QUOTA_ZERO")
                    action = "FORCE_RE_EVAL"
                    Log.d(LogTags.QT_FINISH, "[QT_FINISH] Manual -> ForceReEval (Quota=0)")
                }
                entry?.expiresAt = null
            }
            
            when (action) {
                "SHOW_POST_CHOICE" -> emitQuickTaskCommand("SHOW_POST_QUICK_TASK_CHOICE", app, context)
                "FORCE_RE_EVAL" -> handleMonitoredAppEntry(app, context, source = "QT_EXPIRY_QUOTA_ZERO", force = true)
            }
        }

        @JvmStatic
        fun onQuickTaskDeclined(app: String, context: android.content.Context) {
            synchronized(qtLock) {
                quickTaskMap[app]?.state = QuickTaskState.IDLE
                activeQuickTaskSessionIdByApp.remove(app)
            }
            emitFinishSystemSurface(context)
        }

        /**
         * Called from JS when user confirms "Start Quick Task"
         * Transitions OFFERING → ACTIVE with quota decrement and timer start
         */
        @JvmStatic
        fun onQuickTaskConfirmed(app: String, sessionId: String, context: android.content.Context) {
            withService { svc ->
                svc.handleQuickTaskConfirmed(app, sessionId, context)
            }
        }

        /**
         * Called from JS via AppMonitorModule when Post-QT completes.
         * Wrapper using withService pattern.
         */
        @JvmStatic
        fun onPostQuickTaskChoiceCompletedFromJs(app: String, sessionId: String, choice: String) {
            Log.d("POST_CHOICE_BRIDGE", "[POST_CHOICE_BRIDGE] app=$app sid=$sessionId choice=$choice")
            withService { svc ->
                svc.onPostQuickTaskChoiceCompleted(app, sessionId, choice)
            }
        }

        @JvmStatic
        fun onQuickTaskSwitchedToIntervention(app: String, context: android.content.Context) {
            synchronized(qtLock) {
                quickTaskMap[app]?.let { entry ->
                     Log.e(LogTags.QT_STATE, "[STATE_WRITE] app=$app state=${entry.state} -> INTERVENTION_ACTIVE (switch_to_intervention)")
                     entry.state = QuickTaskState.INTERVENTION_ACTIVE
                     entry.expiresAt = null
                }
            }
        }
        
        @JvmStatic
        fun onPostChoiceQuit(app: String, sessionId: String, context: android.content.Context) {
             onPostChoiceResult(app, sessionId, "QUIT", context)
        }
        
        @JvmStatic
        fun onPostChoiceContinue(app: String, sessionId: String, context: android.content.Context) {
             onPostChoiceResult(app, sessionId, "CONTINUE", context)
        }

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
        fun updateMonitoredApps(apps: Set<String>, context: android.content.Context? = null) {
            updateMonitoredAppsCache(apps)
            // Async Persist
            serviceInstance?.let { service ->
                service.serviceScope.launch {
                    service.monitoredStore.setMonitoredApps(apps)
                    Log.e(LogTags.SERVICE_LIFE, "[MONITORED_APPS] Persisted to DataStore count=${apps.size}")
                }
            }
        }
        
        @JvmStatic
        fun updateMonitoredAppsCache(apps: Set<String>) {
            cachedMonitoredApps = apps
            Log.e(LogTags.SERVICE_LIFE, "[MONITORED_APPS] Cache updated immediately count=${apps.size}")
        }
        
        @JvmStatic
        fun setIntention(app: String, durationMs: Long) {
            val now = System.currentTimeMillis()
            val until = now + durationMs
            
            val currentMap = HashMap(cachedIntentions)
            currentMap[app] = until
            cachedIntentions = currentMap
            Log.e(LogTags.QT_STATE, "[INTENTION] Set for $app duration=${durationMs}ms until=$until")
            
            serviceInstance?.let { service ->
                service.serviceScope.launch { service.intentionStore.setIntention(app, until) }
            }
        }
        
        @JvmStatic
        fun clearIntention(app: String) {
            val currentMap = HashMap(cachedIntentions)
            if (currentMap.remove(app) != null) {
                cachedIntentions = currentMap
                Log.e(LogTags.QT_STATE, "[INTENTION] Cleared for $app")
                serviceInstance?.let { service ->
                    service.serviceScope.launch { service.intentionStore.clearIntention(app) }
                }
            }
        }
        
        @JvmStatic
        fun getIntentionRemainingMs(app: String): Long {
            val until = cachedIntentions[app] ?: 0L
            val now = System.currentTimeMillis()
            return kotlin.math.max(0L, until - now)
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
        
        @JvmStatic
        fun setQuickTaskMaxQuota(max: Int) {
            val service = serviceRef?.get()
            Log.e("AppMonitorModule", "[DEBUG] setQuickTaskMaxQuota called with max=$max, serviceRef=${service != null}")
            
            // VISUAL DEBUG: Toast to confirm code deployment
            service?.let {
                 Handler(Looper.getMainLooper()).post {
                     android.widget.Toast.makeText(it, "DEBUG: Updating Quota to $max", android.widget.Toast.LENGTH_SHORT).show()
                 }
                 
                Log.e("AppMonitorModule", "[DEBUG] Launching coroutine to update quota")
                it.serviceScope.launch {
                    try {
                        val newState = it.quotaStore.setMaxQuota(max.toLong())
                        cachedQuotaState = newState
                        Log.e(LogTags.QT_STATE, "[CONFIG] Updated Max Quota: max=${newState.maxPer15m} remaining=${newState.remaining}")
                    } catch (e: Exception) {
                        Log.e("AppMonitorModule", "[ERROR] Failed to update quota", e)
                    }
                }
            } ?: Log.e("AppMonitorModule", "[ERROR] serviceRef is null, cannot update quota")
        }

        @JvmStatic
        fun getCachedQuotaState(): QuotaState {
            return cachedQuotaState
        }
        
        @JvmStatic
        fun setSystemSurfaceActive(active: Boolean, reason: String = "unknown") {
            isSystemSurfaceActive = active
            if (active) {
                systemSurfaceActiveTimestamp = System.currentTimeMillis()
                // Cancel any pending recovery
                surfaceRecoveryRunnable?.let {
                    surfaceRecoveryHandler.removeCallbacks(it)
                    surfaceRecoveryRunnable = null
                }
            } else {
                systemSurfaceActiveTimestamp = 0
                finishRequestedAt = null
            }
            Log.e(LogTags.SURFACE_FLAG, "[SURFACE_FLAG] setActive=$active reason=$reason pid=${android.os.Process.myPid()}")
        }
        
        @JvmStatic
        fun onSystemSurfaceOpened() {
            setSystemSurfaceActive(true, "ON_CREATE")
            finishRequestedAt = null
            Log.e(LogTags.SS_CANARY, "[SURFACE] Surface ACTIVE")
        }

        @JvmStatic
        fun onSystemSurfaceDestroyed() {
            onSurfaceExit("ON_DESTROY")
            Log.e(LogTags.SS_CANARY, "[SURFACE] Surface DESTROYED")
        }
        
        @JvmStatic
        fun onSurfaceExit(reason: String, instanceId: Int? = null, triggeringApp: String? = null, overrideApp: String? = null) {
            val resolvedApp = overrideApp ?: underlyingApp ?: triggeringApp
            val entry = resolvedApp?.let { quickTaskMap[it] }
            
            // 1. Reset flag
            setSystemSurfaceActive(false, "EXIT_$reason")
            
            // 2. V3: Handle Preservation
            resolvedApp?.let { app ->
                val preserved = preservedInterventionFlags[app] == true
                if (entry?.state == QuickTaskState.INTERVENTION_ACTIVE && preserved) {
                    // Keep state
                } else if (preserved) {
                    // Defensive keep
                } else {
                    cleanupTransientStateIfNeeded(app)
                    if (entry?.state == QuickTaskState.INTERVENTION_ACTIVE) {
                        entry.state = QuickTaskState.IDLE
                        Log.i(TAG, "[SURFACE_EXIT] Resetting INTERVENTION_ACTIVE -> IDLE for $app")
                    }
                    preservedInterventionFlags.remove(app)
                }
            }
            underlyingApp = null
        }
        
        @JvmStatic
        fun onSessionClosed(session: SessionManager.Session, reason: String) {
            val app = session.pkg
            val preserved = preservedInterventionFlags[app] == true
            if (preserved) return

            val entry = quickTaskMap[app]
            if (entry != null && entry.state != QuickTaskState.IDLE) {
                entry.state = QuickTaskState.IDLE
                Log.e(LogTags.QT_STATE, "[STATE_WRITE] app=$app state=${entry.state} -> IDLE (session_closed)")
            }
        }
        
        // =========================================================================
        // PRIVATE HELPERS (Strictly inside Companion)
        // =========================================================================

        private fun onPostChoiceResult(app: String, sessionId: String, choice: String, context: android.content.Context) {
            synchronized(qtLock) {
                if (activeQuickTaskSessionIdByApp[app] != sessionId) {
                     Log.e(LogTags.QT_FINISH, "[POST_CHOICE] ignored session_mismatch on $choice")
                     return
                }
                
                val now = System.currentTimeMillis()
                if (choice == "QUIT") {
                    quitSuppressionUntil[app] = now + 1500
                    Log.e(LogTags.QT_FINISH, "[POST_CHOICE] QUIT -> Suppressing")
                    suppressWakeUntil.remove(app)
                } else {
                    suppressWakeUntil[app] = now + 30000
                    Log.e(LogTags.QT_FINISH, "[POST_CHOICE] CONTINUE -> Wake Suppressing")
                }
                
                clearActiveForAppLocked(app, "POST_CHOICE_$choice")
            }
            emitFinishSystemSurface(context)
        }

        private fun emitFinishSystemSurface(context: android.content.Context) {
            if (!isSystemSurfaceActive) {
                SystemSurfaceManager.finish(SystemSurfaceManager.REASON_NATIVE_DECISION)
                return
            }
            finishRequestedAt = System.currentTimeMillis()
            emitQuickTaskCommand("FINISH_SYSTEM_SURFACE", "", context)
            SystemSurfaceManager.finish(SystemSurfaceManager.REASON_NATIVE_DECISION)
        }

        private fun cleanupTransientStateIfNeeded(app: String) {
            val entry = quickTaskMap[app] ?: return
            
            if (entry.state == QuickTaskState.DECISION) {
                entry.state = QuickTaskState.IDLE
                entry.postChoiceShown = false
                entry.expiresAt = null
                synchronized(qtLock) { cancelNativeTimerLocked(app) }
            } else if (entry.state == QuickTaskState.POST_CHOICE) {
                suppressWakeUntil[app] = System.currentTimeMillis() + 30000
                entry.state = QuickTaskState.IDLE
                entry.postChoiceShown = false
                entry.expiresAt = null
            }
        }
        
        private fun cancelNativeTimerLocked(app: String) {
            activeTimerRunnablesByApp.remove(app)?.let {
                Handler(Looper.getMainLooper()).removeCallbacks(it)
            }
        }
        
        private fun startNativeTimer(app: String, expiresAt: Long, sessionId: String) {
            cancelNativeTimerLocked(app)
            
            val delay = expiresAt - System.currentTimeMillis()
            val runnable = Runnable { 
                val shouldFire = synchronized(qtLock) {
                     activeQuickTaskSessionIdByApp[app] == sessionId
                }
                if (shouldFire) {
                    onQuickTaskTimerExpired(app, sessionId) 
                }
            }
            
            activeTimerRunnablesByApp[app] = runnable
            Handler(Looper.getMainLooper()).postDelayed(runnable, Math.max(0, delay))
        }

        @JvmStatic
        fun onQuickTaskTimerExpired(app: String, sessionId: String? = null) {
            var action: String? = null
            val context = serviceInstance?.applicationContext ?: return

            synchronized(qtLock) {
                if (sessionId != null && activeQuickTaskSessionIdByApp[app] != sessionId) return
                
                val entry = quickTaskMap[app] ?: return
                if (entry.state != QuickTaskState.ACTIVE) return 
                
                val isForeground = (currentForegroundApp == app)
                
                if (isForeground) {
                    val remaining = cachedQuotaState.remaining
                    cancelNativeTimerLocked(app) 

                    if (remaining > 0) {
                        entry.state = QuickTaskState.POST_CHOICE
                        entry.postChoiceShown = true
                        action = "SHOW_POST_CHOICE"
                        Log.d(LogTags.QT_FINISH, "[QT_EXPIRE] OnApp -> PostChoice")
                    } else {
                        clearActiveForAppLocked(app, "TIMER_QUOTA_ZERO")
                        action = "FORCE_RE_EVAL"
                        Log.d(LogTags.QT_FINISH, "[QT_EXPIRE] OnApp -> ForceReEval (Quota=0)")
                    }
                } else {
                    clearActiveForAppLocked(app, "TIMER_OFF_APP")
                    Log.d(LogTags.QT_FINISH, "[QT_EXPIRE] OffApp -> Silent Reset")
                }
                entry.expiresAt = null
            }
            
            when (action) {
                "SHOW_POST_CHOICE" -> emitQuickTaskCommand("SHOW_POST_QUICK_TASK_CHOICE", app, context)
                "FORCE_RE_EVAL" -> handleMonitoredAppEntry(app, context, source = "QT_EXPIRY_QUOTA_ZERO", force = true)
            }
        }
        
        @JvmStatic
        fun handleMonitoredAppEntry(app: String, context: android.content.Context, source: String = "NORMAL", force: Boolean = false, isRawChange: Boolean = false) {
             if (!isServiceConnected) return

             val now = System.currentTimeMillis()
             
             // ✅ Check suppressions BEFORE snapshot + DecisionGate (preserves DecisionGate purity)
             synchronized(qtLock) {
                 // Check quit suppression
                 val quitUntil = quitSuppressedUntilMsByApp[app]
                 if (quitUntil != null) {
                     if (now < quitUntil) {
                         val remaining = quitUntil - now
                         Log.i("QUIT_SUPPRESS", "[QUIT_SUPPRESS] app=$app blocked remainingMs=$remaining")
                         return
                     }
                     // Expired, clear it
                     quitSuppressedUntilMsByApp.remove(app)
                 }
                 
                 // Check post-choice cooldown
                 val lastPostChoice = postChoiceCompletedAtMsByApp[app]
                 if (lastPostChoice != null) {
                     val age = now - lastPostChoice
                     if (age < 2000L) {
                         Log.i("POST_CHOICE_COOLDOWN", "[POST_CHOICE_COOLDOWN] app=$app age=${age}ms - blocked")
                         return
                     }
                     // Expired, clear it
                     postChoiceCompletedAtMsByApp.remove(app)
                 }
             }
             
             // 0. Post-Choice Guard
             val entryState = synchronized(qtLock) { quickTaskMap[app]?.state }
             if (entryState == QuickTaskState.POST_CHOICE) return

             if (isIgnored(app, context)) return

             // Strict Monitoring Check (Fix for Bug 1)
             if (!cachedMonitoredApps.contains(app)) {
                 Log.e(LogTags.ENTRY_IGNORED, "pkg=$app reason=NOT_MONITORED source=$source")
                 return
             }
             
             // OFFERING Timeout Check (30 seconds)
             synchronized(qtLock) {
                 val entry = quickTaskMap[app]
                 if (entry?.state == QuickTaskState.OFFERING) {
                     val offerStartedAt = offerStartedAtMsByApp[app] ?: 0L
                     val age = now - offerStartedAt
                     
                     if (age > 30_000L) {
                         // Timeout - clear stuck OFFERING
                         Log.w("QT_TIMEOUT", "[QT_TIMEOUT] app=$app age=${age}ms - clearing stuck OFFERING")
                         clearPromptForAppLocked(app, "OFFER_TIMEOUT")
                         // Fall through to re-evaluate with clean state
                     }
                 }
             }
             
             // Stale Surface Recovery (Global)
             serviceInstance?.let { service ->
                 if (isSystemSurfaceActive && service.activeSurfaceInstanceId != null) {
                     if ((now - service.surfaceStartedAtMs) > 120_000) {
                         isSystemSurfaceActive = false
                         service.activeSurfaceApp = null
                         service.activeSurfaceInstanceId = null
                         service.activeSurfaceSessionId = null
                         service.surfaceStartedAtMs = 0L
                         systemSurfaceActiveTimestamp = 0
                         Log.w(LogTags.SURFACE_RECOVERY, "[SURFACE_RECOVERY] Stale surface cleared (age=${now - service.surfaceStartedAtMs}ms)")
                     }
                 }
             }
             
             if (!force) {
                 // Debounce checks...
                 // Simplified for brevity in this fix block
             }
             
             val snapshot = DecisionGate.GateSnapshot(
                 isMonitored = true,
                 qtRemaining = cachedQuotaState.remaining.toInt(),
                 isSystemSurfaceActive = isSystemSurfaceActive,
                 hasActiveSession = synchronized(qtLock) { 
                     val entry = quickTaskMap[app]
                     entry?.state == QuickTaskState.ACTIVE && activeQuickTaskSessionIdByApp[app] != null
                 },
                 quickTaskState = quickTaskMap[app]?.state ?: QuickTaskState.IDLE,
                 intentionRemainingMs = getIntentionRemainingMs(app),
                 isInterventionPreserved = isInterventionPreserved(app),
                 lastInterventionEmittedAt = showInterventionLastEmittedAt[app] ?: 0L,
                 isQuitSuppressed = quitSuppressionUntil[app]?.let { it > now } == true,
                 quitSuppressionRemainingMs = kotlin.math.max(0L, (quitSuppressionUntil[app] ?: 0L) - now),
                 isWakeSuppressed = isWakeSuppressed(app),
                 wakeSuppressionRemainingMs = kotlin.math.max(0L, (suppressWakeUntil[app] ?: 0L) - now),
                 isForceEntry = force
             )
             
             val disallowQT = (source == "QT_EXPIRY_QUOTA_ZERO")
             val result = DecisionGate.evaluate(app, now, snapshot, disallowQT)
             val decision = result.first
             
             // Log the decision (Added for debugging)
             Log.e(LogTags.DECISION_GATE, "pkg=$app result=${decision.javaClass.simpleName} reason=${result.second} qt=${snapshot.qtRemaining} int=${snapshot.intentionRemainingMs}")
             
             executeDecision(decision, app, context, force, source)
        }
        
        private fun executeDecision(decision: DecisionGate.GateAction, app: String, context: android.content.Context, force: Boolean, source: String) {
             when (decision) {
                  is DecisionGate.GateAction.NoAction -> {}
                  is DecisionGate.GateAction.StartQuickTask -> {
                       // ✅ Validate foreground at emit-time (defensive - only block if KNOWN wrong)
                       val fg = currentForegroundApp
                       
                       // Block only if we KNOW it's launcher/systemUI
                       if (fg != null && isLauncherOrSystemUI(fg)) {
                           Log.d("LAUNCHER_IGNORE", "[LAUNCHER_IGNORE] pkg=$fg - not offering QT")
                           return
                       }
                       
                       // Block only if we KNOW it's a different app
                       if (fg != null && fg != app) {
                           Log.w("FOREGROUND_MISMATCH", "[FOREGROUND_MISMATCH] want=$app have=$fg at=emit - not offering QT")
                           return
                       }
                       
                       // fg == null → allow emit, but log it
                       if (fg == null) {
                           Log.i("FOREGROUND_UNKNOWN", "[FOREGROUND_UNKNOWN] fg=null at=emit - allowing for app=$app")
                       }
                       
                       // OFFERING State: Show dialog, NO quota decrement, NO timer
                       synchronized(qtLock) {
                            val entry = quickTaskMap.getOrPut(app) { QuickTaskEntry(app, QuickTaskState.IDLE) }
                            
                            // Belt-and-Suspenders: Skip if already OFFERING or prompt session exists
                            if (entry.state == QuickTaskState.OFFERING || promptSessionIdByApp[app] != null) {
                                 Log.w(LogTags.QT_STATE, "[QT_OFFER_SKIP] app=$app already offering")
                                 return
                            }
                            
                            val sessionId = java.util.UUID.randomUUID().toString()
                            entry.state = QuickTaskState.OFFERING
                            promptSessionIdByApp[app] = sessionId
                            offerStartedAtMsByApp[app] = System.currentTimeMillis() // Track timestamp for timeout
                            
                            val qtRemaining = cachedQuotaState.remaining
                            Log.e("QT_OFFER", "[QT_OFFER] app=$app sid=$sessionId quotaRemaining=$qtRemaining (NO_TIMER_NO_DECREMENT)")
                            
                            // Emit with sessionId so JS can call back
                            emitQuickTaskCommand("START_QUICK_TASK_ACTIVE", app, context, sessionId)
                       }
                   }
                  is DecisionGate.GateAction.StartIntervention -> {
                       // ✅ Validate foreground at emit-time (defensive - only block if KNOWN wrong)
                       val fg = currentForegroundApp
                       
                       // Block only if we KNOW it's launcher/systemUI
                       if (fg != null && isLauncherOrSystemUI(fg)) {
                           Log.d("LAUNCHER_IGNORE", "[LAUNCHER_IGNORE] pkg=$fg - not offering Intervention")
                           return
                       }
                       
                       // Block only if we KNOW it's a different app
                       if (fg != null && fg != app) {
                           Log.w("FOREGROUND_MISMATCH", "[FOREGROUND_MISMATCH] want=$app have=$fg at=emit - not offering Intervention")
                           return
                       }
                       
                       // fg == null → allow emit, but log it
                       if (fg == null) {
                           Log.i("FOREGROUND_UNKNOWN", "[FOREGROUND_UNKNOWN] fg=null at=emit - allowing for app=$app")
                       }
                       
                       emitQuickTaskCommand("START_INTERVENTION", app, context)
                  }
                  // ShowPostChoice and ForceReEval are NOT in GateAction? Check DecisionGate.kt
             }
        }

        @JvmStatic
        fun onSystemSurfaceOpened(app: String?, sessionId: String?, instanceId: Int) {
            serviceInstance?.let { service ->
                service.activeSurfaceApp = app
                service.activeSurfaceSessionId = sessionId
                service.activeSurfaceInstanceId = instanceId
                service.surfaceStartedAtMs = System.currentTimeMillis()
                
                isSystemSurfaceActive = true
                systemSurfaceActiveTimestamp = service.surfaceStartedAtMs
                
                Log.e(LogTags.SS_LIFE, "[SURFACE_OPEN] instance=$instanceId app=$app session=$sessionId")
            }
        }

        @JvmStatic
        fun onSystemSurfaceDestroyed(app: String?, sessionId: String?, instanceId: Int) {
            val service = serviceInstance
            
            // 1. Global Surface Cleanup (ALWAYS ATTEMPT - Keyed by InstanceID)
            if (service != null && service.activeSurfaceInstanceId == instanceId) {
                isSystemSurfaceActive = false
                service.activeSurfaceApp = null
                service.activeSurfaceInstanceId = null
                service.activeSurfaceSessionId = null
                service.surfaceStartedAtMs = 0L
                systemSurfaceActiveTimestamp = 0
                
                Log.e(LogTags.SS_LIFE, "[SURFACE_CLEAR] Global surface cleared via instance=$instanceId")
            } else if (service != null) {
                Log.w(LogTags.SS_LIFE, "[SURFACE_MISMATCH] Destroy instance=$instanceId but active=${service.activeSurfaceInstanceId}")
            }
            
            // 2. Per-App State Cleanup (Best-Effort)
            // Resolve app: use provided app or fallback to activeSurfaceApp
            val resolvedApp = app ?: service?.activeSurfaceApp
            
            if (resolvedApp != null) {
                synchronized(qtLock) {
                    val entry = quickTaskMap[resolvedApp]
                    
                    when (entry?.state) {
                        QuickTaskState.OFFERING -> {
                            // OFFERING: Clear prompt session (user declined by leaving)
                            clearPromptForAppLocked(resolvedApp, "SURFACE_DESTROY")
                        }
                        QuickTaskState.ACTIVE -> {
                            // ACTIVE: Timer continues in background, do NOT clear
                            Log.i("QT_ACTIVE_PERSIST", "[QT_ACTIVE_PERSIST] app=$resolvedApp reason=SURFACE_DESTROY (timer continues)")
                        }
                        else -> {
                            // Other states: no action needed
                        }
                    }
                }
            }
        }
        
        /**
         * Clear OFFERING session (prompt shown, no timer/quota consumed)
         */
        private fun clearPromptForAppLocked(app: String, reason: String) {
             promptSessionIdByApp.remove(app)
             offerStartedAtMsByApp.remove(app) // Clear timestamp too
             
             // Reset state ONLY if OFFERING
             val entry = quickTaskMap[app]
             if (entry?.state == QuickTaskState.OFFERING) {
                  entry.state = QuickTaskState.IDLE
             }
             
             Log.i("QT_OFFER_CLEAR", "[QT_OFFER_CLEAR] app=$app reason=$reason")
        }
        
        /**
         * Cancel the active Quick Task timer for an app (MUST be called inside qtLock).
         * Removes runnable from mainHandler and clears tracking maps.
         */
        private fun cancelNativeTimerLocked(app: String, reason: String = "UNKNOWN") {
            val runnable = activeTimerRunnablesByApp.remove(app)
            activeSessionStartedAtMsByApp.remove(app)

            if (runnable != null) {
                mainHandler.removeCallbacks(runnable)
                val state = quickTaskMap[app]?.state
                val sid = activeQuickTaskSessionIdByApp[app]
                Log.e("QT_TIMER_CANCEL", "[QT_TIMER_CANCEL] app=$app reason=$reason state=$state sid=$sid")
            }
        }

        /**
         * Clear ACTIVE session (timer running, quota consumed)
         */
        private fun clearActiveForAppLocked(app: String, reason: String) {
             activeQuickTaskSessionIdByApp.remove(app)
             activeSessionStartedAtMsByApp.remove(app)
             cancelNativeTimerLocked(app, "ACTIVE_CLEAR") // Also removes runnable
             
             // Reset state ONLY if ACTIVE or POST_CHOICE
             val entry = quickTaskMap[app]
             if (entry?.state == QuickTaskState.ACTIVE || entry?.state == QuickTaskState.POST_CHOICE) {
                  entry.state = QuickTaskState.IDLE
             }
             
             // Clear preserved intervention flags for recovery scenarios
             if (reason in listOf("SURFACE_DESTROY", "STALE_RECOVERY", "STALE_MISSING_TIMESTAMP", "TIMER_OFF_APP", "TIMER_EXPIRED", "MANUAL_FINISH")) {
                  if (preservedInterventionFlags.remove(app) == true) {
                         Log.w(LogTags.QT_STATE, "[PRESERVE_CLEAR] Cleared stuck preservation for $app reason=$reason")
                  }
             }
             
             Log.i("QT_ACTIVE_CLEAR", "[QT_ACTIVE_CLEAR] app=$app reason=$reason")
         }

        /**
         * Called when the Quick Task timer expires.
         * TASK 3: Foreground gating per Contract V4 Case 2
         * - If user still on app → show Post-QT
         * - If user left app → clear state, NO Post-QT
         */
        private fun onQuickTaskTimerExpired(app: String, sessionId: String, context: android.content.Context) {
            var shouldEmitPostQT = false
            
            synchronized(qtLock) {
                val entry = quickTaskMap[app]
                val activeSid = activeQuickTaskSessionIdByApp[app]

                // Verify we're in ACTIVE state with matching sessionId
                if (entry?.state != QuickTaskState.ACTIVE || activeSid != sessionId) {
                    Log.w("QT_TIMER_MISMATCH", "[QT_TIMER_MISMATCH] app=$app sid=$sessionId state=${entry?.state} activeSid=$activeSid")
                    return
                }
                
                // Determine foreground (TASK 3: Foreground gating)
                val fg = currentForegroundApp ?: lastWindowStateChangedPkg
                
                // Case 2: User NOT on app when timer expires
                if (fg == null || fg != app) {
                    Log.i("QT_TIMER_EXPIRED_AWAY", "[QT_TIMER_EXPIRED_AWAY] app=$app fg=$fg - clearing state, NO Post-QT")
                    entry.state = QuickTaskState.IDLE
                    activeQuickTaskSessionIdByApp.remove(app)
                    postChoiceSessionIdByApp.remove(app)
                    cancelNativeTimerLocked(app, "EXPIRED_AWAY")
                    // Do NOT set shouldEmitPostQT - return early via flag
                    return
                }
                
                // Case 1: User still on app - prepare to show Post-QT
                Log.i("QT_TIMER_EXPIRED", "[QT_TIMER_EXPIRED] app=$app fg=$fg - showing Post-QT")

                // Stop timer tracking (prevent double fire)
                cancelNativeTimerLocked(app, "TIMER_EXPIRED")

                // ACTIVE -> POST_CHOICE
                entry.state = QuickTaskState.POST_CHOICE
                postChoiceSessionIdByApp[app] = sessionId

                // Clear ACTIVE lock AFTER post-choice lock set
                activeQuickTaskSessionIdByApp.remove(app)

                Log.d("STATE_TRANSITION", "[STATE_TRANSITION] app=$app ACTIVE→POST_CHOICE activeSid=null postSid=$sessionId")
                shouldEmitPostQT = true
            }

            if (shouldEmitPostQT) {
                emitQuickTaskCommand("SHOW_POST_QUICK_TASK_CHOICE", app, context, sessionId)
            }
        }

        private fun emitQuickTaskCommand(cmd: String, app: String, context: android.content.Context, sessionId: String? = null) {
            val sid = sessionId ?: java.util.UUID.randomUUID().toString()
            
            // Map internal commands to canonical wake reasons
            val wakeReason = when (cmd) {
                "START_QUICK_TASK_ACTIVE" -> SystemSurfaceActivity.WAKE_REASON_SHOW_QUICK_TASK
                "START_INTERVENTION" -> SystemSurfaceActivity.WAKE_REASON_SHOW_INTERVENTION
                "SHOW_POST_QUICK_TASK_CHOICE" -> SystemSurfaceActivity.WAKE_REASON_SHOW_POST_QUICK_TASK_CHOICE
                "FINISH_SYSTEM_SURFACE" -> null // No wake reason for finish
                else -> {
                    Log.w(LogTags.QT_STATE, "[WAKE_EMIT] Unknown command: $cmd, using as-is")
                    cmd
                }
            }
            
            // Log wake emission (critical for debugging)
            if (wakeReason != null) {
                Log.e("WAKE_EMIT", "[WAKE_EMIT] app=$app wakeReason=$wakeReason sid=$sid cmd=$cmd")
            }
            
            // Build intent with canonical extras keys
            val intent = Intent(context, SystemSurfaceActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                
                // Use constants to prevent key mismatch bugs
                putExtra(SystemSurfaceActivity.EXTRA_TRIGGERING_APP, app)
                putExtra(SystemSurfaceActivity.EXTRA_SESSION_ID, sid)
                if (wakeReason != null) {
                    putExtra(SystemSurfaceActivity.EXTRA_WAKE_REASON, wakeReason)
                }
            }
            
            // Use Handler.post for deterministic ordering (no coroutine reordering)
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                try {
                    context.startActivity(intent)
                    Log.d(LogTags.QT_STATE, "[QT_CMD] Emitted: $cmd for $app with wakeReason=$wakeReason sid=$sid")
                } catch (e: Exception) {
                    Log.e(LogTags.QT_STATE, "[QT_CMD] Failed to emit $cmd", e)
                }
            }
        }
        
        private fun isIgnored(pkg: String, context: android.content.Context): Boolean {
             return IGNORE_LIST_APPS.contains(pkg) // Simplified
        }
        
        private val launcherPackages = setOf(
            "com.google.android.apps.nexuslauncher",
            "com.android.launcher3",
            "com.sec.android.app.launcher", // Samsung
            "com.miui.home", // Xiaomi
        )
        
        private fun isLauncherOrSystemUI(pkg: String?): Boolean {
            if (pkg == null) return false
            return pkg.startsWith("com.android.systemui") ||
                   pkg.startsWith("com.google.android.launcher") ||
                   launcherPackages.contains(pkg)
        }
        
        
    } // END COMPANION OBJECT

    /**
     * Instance method: Handle Quick Task confirmation with timer scheduling.
     * Called from companion object @JvmStatic wrapper via withService.
     */
    private fun handleQuickTaskConfirmed(app: String, sessionId: String, context: android.content.Context) {
        val durationMs = 10_000L // 10 seconds for testing

        // 1) Validate + transition (inside lock)
        val shouldStartTimer = synchronized(qtLock) {
            val entry = quickTaskMap[app]
            val promptSid = promptSessionIdByApp[app]

            // Guard: must still be OFFERING with matching prompt sid
            if (entry?.state != QuickTaskState.OFFERING || promptSid != sessionId) {
                Log.w("QT_CONFIRM_IGNORED", "[QT_CONFIRM_IGNORED] app=$app sid=$sessionId state=${entry?.state} promptSid=$promptSid")
                return@synchronized false
            }

            // Clear OFFERING
            promptSessionIdByApp.remove(app)
            offerStartedAtMsByApp.remove(app)

            // Become ACTIVE
            entry.state = QuickTaskState.ACTIVE
            activeQuickTaskSessionIdByApp[app] = sessionId

            // Defensive: cancel any old runnable for this app
            cancelNativeTimerLocked(app, "REPLACE_TIMER_ON_CONFIRM")

            // ✅ Quota decrement: idempotent check
            val alreadyConfirmed = confirmedSessionIdByApp[app]
            if (alreadyConfirmed == sessionId) {
                Log.w("QT_QUOTA", "[QT_QUOTA] app=$app sid=$sessionId DUPLICATE_CONFIRM - skipping decrement")
            } else {
                // Decrement in-memory immediately (clamped at 0)
                val before = cachedQuotaState.remaining
                val after = maxOf(0, before - 1)
                cachedQuotaState = cachedQuotaState.copy(remaining = after)
                confirmedSessionIdByApp[app] = sessionId
                
                Log.e("QT_QUOTA", "[QT_QUOTA] app=$app sid=$sessionId before=$before after=$after")
            }

            true
        }

        if (!shouldStartTimer) return

        // 3) Create runnable OUTSIDE lock
        val runnable = Runnable {
            onQuickTaskTimerExpired(app, sessionId, context)
        }

        // 4) Store runnable + timestamps inside lock
        synchronized(qtLock) {
            activeTimerRunnablesByApp[app] = runnable
            activeSessionStartedAtMsByApp[app] = System.currentTimeMillis()
        }

        // 5) Schedule OUTSIDE lock
        Log.e("QT_TIMER_START", "[QT_TIMER_START] app=$app sid=$sessionId durationMs=$durationMs")
        mainHandler.postDelayed(runnable, durationMs)
    }

    /**
     * Instance method: Handle Post-QT completion with state invariant cleanup.
     * Called from companion wrapper via withService when user completes Post-QT dialog.
     */
    private fun onPostQuickTaskChoiceCompleted(app: String, sessionId: String, choice: String) {
        var shouldTriggerContinue = false

        synchronized(qtLock) {
            val expected = postChoiceSessionIdByApp[app]

            if (expected == null || expected != sessionId) {
                Log.w("POST_CHOICE_MISMATCH", "[POST_CHOICE_MISMATCH] app=$app sid=$sessionId expected=$expected choice=$choice")
            } else {
                // Common cleanup (both QUIT and CONTINUE)
                postChoiceSessionIdByApp.remove(app)
                cancelNativeTimerLocked(app, "POST_CHOICE_COMPLETE")
                activeQuickTaskSessionIdByApp.remove(app) // defensive
                quickTaskMap[app]?.state = QuickTaskState.IDLE

                val now = System.currentTimeMillis()

                if (choice == "QUIT") {
                    quitSuppressedUntilMsByApp[app] = now + 2000L
                    postChoiceCompletedAtMsByApp[app] = now
                    Log.i("QUIT_SUPPRESS", "[QUIT_SUPPRESS] app=$app until=${now + 2000L}")
                    Log.i("POST_CHOICE_COOLDOWN", "[POST_CHOICE_COOLDOWN] app=$app at=$now")
                } else if (choice == "CONTINUE") {
                    // CONTINUE: Remove shields, trigger re-eval
                    postChoiceCompletedAtMsByApp.remove(app)
                    quitSuppressedUntilMsByApp.remove(app)
                    shouldTriggerContinue = true
                }

                Log.e("POST_CHOICE_COMPLETE", "[POST_CHOICE_COMPLETE] app=$app sid=$sessionId choice=$choice")
            }
        }

        // Schedule OUTSIDE lock
        if (shouldTriggerContinue) {
            Log.i("POST_CONTINUE_TRIGGER", "[POST_CONTINUE_TRIGGER] app=$app scheduling re-eval")
            mainHandler.postDelayed({
                // Direct instance call with applicationContext
                handleMonitoredAppEntry(
                    app = app,
                    context = applicationContext,
                    source = "POST_CONTINUE",
                    force = true,
                    isRawChange = false
                )
            }, 100L)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.e("BUILD_MARKER", "BUILD_QT_LIFECYCLE_FIX_v3 - Timer Implementation: mainHandler + postDelayed + onQuickTaskTimerExpired")
        Log.i(TAG, "Service Connected")
        
        quotaStore = QuickTaskQuotaStore(applicationContext)
        monitoredStore = MonitoredAppsStore(applicationContext)
        intentionStore = IntentionStore(applicationContext)
        
        serviceScope.launch {
            cachedQuotaState = quotaStore.getSnapshot()
            cachedMonitoredApps = monitoredStore.getMonitoredApps()
            cachedIntentions = intentionStore.getSnapshot()
        }
        
        // Restore State logic could go here
        isServiceConnected = true
        serviceRef = WeakReference(this) // Publish instance for companion object access
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val packageName = event.packageName?.toString() ?: return
            if (packageName == applicationContext.packageName) return
            
            // Raw detection
            val isRawChange = (packageName != lastWindowStateChangedPkg)
            lastWindowStateChangedPkg = packageName
            
            handleMonitoredAppEntry(packageName, applicationContext, source = "ACCESSIBILITY", isRawChange = isRawChange)
        }
    }

    override fun onInterrupt() {
        Log.w(TAG, "Service Interrupted")
    }

    override fun onUnbind(intent: Intent?): Boolean {
        isServiceConnected = false
        serviceRef?.clear()
        serviceRef = null
        serviceScope.cancel()
        return super.onUnbind(intent)
    }
}
