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
        // private var cachedQuickTaskQuota: Int = 1 // REPLACED BY quotaStore / cachedQuotaState 
        
        @JvmStatic
        fun isInterventionPreserved(app: String): Boolean {
            val value = preservedInterventionFlags[app] == true
            Log.e(LogTags.QT_STATE, "[PRESERVE_READ] app=$app value=$value caller=isInterventionPreserved")
            return value
        }

        enum class QuickTaskState {
            IDLE, DECISION, ACTIVE, POST_CHOICE, INTERVENTION_ACTIVE
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
        
        @JvmStatic
        fun getQuickTaskStateForApp(app: String): String {
            return quickTaskMap[app]?.state?.name ?: "UNKNOWN"
        }
        
        private val monitoredLock = Any()
        
        // Native Config Stores
        private lateinit var quotaStore: QuickTaskQuotaStore
        private lateinit var monitoredStore: MonitoredAppsStore
        private lateinit var intentionStore: IntentionStore
        private val serviceScope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO + kotlinx.coroutines.SupervisorJob())
        
        // Volatile In-Memory Cache (Native Authority)
        @Volatile private var cachedQuotaState: QuotaState = QuotaState(1L, 0L, 1L)
        @Volatile private var cachedMonitoredApps: Set<String> = emptySet()
        @Volatile private var cachedIntentions: Map<String, Long> = emptyMap()


        
        private val quickTaskMap = mutableMapOf<String, QuickTaskEntry>()
        private val preservedInterventionFlags = mutableMapOf<String, Boolean>()
        private const val PREFS_QUICK_TASK_STATE = "quick_task_state_v1"
        private const val PREFS_INTERVENTION_PRESERVED = "intervention_preserved_v1"
        private var underlyingApp: String? = null
        // dynamicMonitoredApps replaced by cachedMonitoredApps
        private const val PREFS_MONITORED_APPS = "monitored_apps_native_v1" // DEPRECATED
        private const val KEY_MONITORED_APPS = "monitored_apps_set" // DEPRECATED
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
        private val surfaceRecoveryHandler = Handler(Looper.getMainLooper())
        private var surfaceRecoveryRunnable: Runnable? = null
        @Volatile private var lastWindowStateChangedPkg: String? = null
        @Volatile private var lastReplayAtMap = mutableMapOf<String, Long>()
        
        @Volatile private var mismatchStartMs: Long = 0L
        @Volatile private var hardRecoveryScheduled: Boolean = false
        private val showInterventionLastEmittedAt = java.util.concurrent.ConcurrentHashMap<String, Long>()

        private const val LOG_TAG_QT = "QT_STATE"

        @JvmStatic
        fun setSystemSurfaceActive(active: Boolean, reason: String = "unknown") {
            isSystemSurfaceActive = active
            if (active) {
                systemSurfaceActiveTimestamp = System.currentTimeMillis()
                mismatchStartMs = 0 // Reset when we confirm active
                // Cancel any pending recovery when surface is confirmed active
                surfaceRecoveryRunnable?.let {
                    surfaceRecoveryHandler.removeCallbacks(it)
                    surfaceRecoveryRunnable = null
                    Log.d(LogTags.SURFACE_RECOVERY, "[SURFACE_RECOVERY] debounceCancel reason=SET_ACTIVE_TRUE")
                }
            } else {
                systemSurfaceActiveTimestamp = 0
                finishRequestedAt = null
                mismatchStartMs = 0
            }
            Log.e(LogTags.SURFACE_FLAG, "[SURFACE_FLAG] setActive=$active reason=$reason pid=${android.os.Process.myPid()}")
        }

        @JvmStatic
        fun onSurfaceExit(reason: String, instanceId: Int? = null, triggeringApp: String? = null, overrideApp: String? = null) {
            val resolvedApp = overrideApp ?: underlyingApp ?: triggeringApp
            
            val entry = resolvedApp?.let { quickTaskMap[it] }
            val stateBefore = entry?.state?.name ?: "IDLE"

            Log.e(LogTags.SURFACE_FLAG, "[SURFACE_EXIT] reason=$reason app=$resolvedApp instanceId=$instanceId stateBefore=$stateBefore pid=${android.os.Process.myPid()}")
            
            // 1. Reset flag (Single source of truth)
            setSystemSurfaceActive(false, "EXIT_$reason")
            
            // 2. V3: Handle Preservation vs. Reset
            resolvedApp?.let { app ->
                val preserved = preservedInterventionFlags[app] == true
                Log.e(LogTags.QT_STATE, "[PRESERVE_READ] app=$app value=$preserved caller=onSurfaceExit")
                Log.e(LogTags.SURFACE_FLAG, "[SURFACE_EXIT_CHECK] app=$app state=${entry?.state} preservedFlag=$preserved")
                
                if (entry?.state == QuickTaskState.INTERVENTION_ACTIVE && preserved) {
                    Log.e(LogTags.QT_STATE, "[SURFACE_EXIT] Preserving INTERVENTION_ACTIVE for $app (background resume pending)")
                    // Keep state as INTERVENTION_ACTIVE
                } else if (preserved) {
                    // DEFENSIVE: If preserved is true, even if state isn't INTERVENTION_ACTIVE, KEEP IT
                    Log.e(LogTags.QT_STATE, "[SURFACE_EXIT] STICKY_PRESERVE: app=$app has preserved=true but state=${entry?.state}. Keeping flag.")
                } else {
                    cleanupTransientStateIfNeeded(app)
                    if (entry?.state == QuickTaskState.INTERVENTION_ACTIVE) {
                        Log.e(LogTags.QT_STATE, "[STATE_WRITE] app=$app state=${entry.state} -> IDLE (surface_exit_not_preserved)")
                        entry.state = QuickTaskState.IDLE
                        Log.i(TAG, "[SURFACE_EXIT] Resetting INTERVENTION_ACTIVE -> IDLE (not preserved) for $app")
                    }
                    Log.e(LogTags.QT_STATE, "[PRESERVE_WRITE] app=$app value=REMOVE caller=onSurfaceExit")
                    preservedInterventionFlags.remove(app)
                }
            }
            
            // 3. Clear session references
            underlyingApp = null
        }

        @JvmStatic
        fun onSystemSurfaceOpened() {
            setSystemSurfaceActive(true, "ON_CREATE")
            finishRequestedAt = null
            Log.e(LogTags.SS_CANARY, "[SURFACE] Surface ACTIVE")
            Log.d(TAG, "[QT][SURFACE] Surface ACTIVE")
        }

        @JvmStatic
        fun onSystemSurfaceDestroyed() {
            onSurfaceExit("ON_DESTROY")
            Log.e(LogTags.SS_CANARY, "[SURFACE] Surface DESTROYED")
        }

        @JvmStatic
        fun onSessionClosed(session: SessionManager.Session, reason: String) {
            val app = session.pkg
            
            // 1. Check Preservation
            val preserved = preservedInterventionFlags[app] == true
            if (preserved) {
                Log.e(LogTags.QT_STATE, "[SESSION_CLOSE] SKIPPING reset for $app (preserved=true) sessionId=${session.sessionId} reason=$reason")
                return
            }

            // 2. State Reset
            // We trust the SessionManager: if this session was just ended, we MUST reset its app's state if it's still running.
            val entry = quickTaskMap[app]
            val didReset: Boolean
            
            if (entry != null && entry.state != QuickTaskState.IDLE) {
                // Force IDLE (Synchronous Logical End)
                // Log BEFORE write for clarity if needed, but existing pattern is AFTER in most places.
                // Keeping existing pattern: [STATE_WRITE]
                Log.e(LogTags.QT_STATE, "[STATE_WRITE] app=$app state=${entry.state} -> IDLE (session_closed)")
                entry.state = QuickTaskState.IDLE
                didReset = true
            } else {
                didReset = false
            }

            Log.i(TAG, "[SESSION_CLOSE] closed sessionId=${session.sessionId} pkg=$app reason=$reason reset=$didReset")
        }
        
        private fun cleanupTransientStateIfNeeded(app: String) {
            val entry = quickTaskMap[app] ?: return
            
            // Reset DECISION (pre-UI transient state) to IDLE.
            if (entry.state == QuickTaskState.DECISION) {
                Log.e(LogTags.QT_STATE, "[CLEANUP] Resetting stuck state DECISION -> IDLE for $app")
                entry.state = QuickTaskState.IDLE
                entry.postChoiceShown = false
                entry.expiresAt = null
                cancelNativeTimer(app)
            } else if (entry.state == QuickTaskState.POST_CHOICE) {
                Log.d(LOG_TAG_QT, "[CLEANUP] Keeping POST_CHOICE for $app")
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

        // DEPRECATED: JS should not drive quota. It can only set max quota.
        @JvmStatic
        fun updateQuickTaskQuota(quota: Int) {
            // Log.w(TAG, "[DEPRECATED] updateQuickTaskQuota ignored. Native authority in place.")
            // No-op to prevent corruption of native state
        }
        
        @JvmStatic
        fun setQuickTaskMaxQuota(max: Int) {
            serviceScope.launch {
                val newState = quotaStore.setMaxQuota(max.toLong())
                cachedQuotaState = newState
                Log.e(LogTags.QT_STATE, "[CONFIG] Updated Max Quota: max=${newState.maxPer15m} remaining=${newState.remaining}")
            }
        }
        
        @JvmStatic
        fun updateMonitoredAppsCache(apps: Set<String>) {
            cachedMonitoredApps = apps
            Log.e(LogTags.SERVICE_LIFE, "[MONITORED_APPS] Cache updated immediately count=${apps.size}")
        }

        @JvmStatic
        fun updateMonitoredApps(apps: Set<String>, context: android.content.Context? = null) {
            // 1. Update Cache Immediately (Live Update)
            updateMonitoredAppsCache(apps)
            
            // 2. Persist Async
            serviceScope.launch {
                monitoredStore.setMonitoredApps(apps)
                Log.e(LogTags.SERVICE_LIFE, "[MONITORED_APPS] Persisted to DataStore count=${apps.size}")
            }
        }

        @JvmStatic
        fun setIntention(app: String, durationMs: Long) {
            val now = System.currentTimeMillis()
            val until = now + durationMs
            
            // 1. Update Cache Immediately
            val currentMap = HashMap(cachedIntentions)
            currentMap[app] = until
            cachedIntentions = currentMap
            Log.e(LogTags.QT_STATE, "[INTENTION] Set for $app duration=${durationMs}ms until=$until")
            
            // 2. Persist Async
            serviceScope.launch {
                intentionStore.setIntention(app, until)
            }
        }

        @JvmStatic
        fun clearIntention(app: String) {
            // 1. Update Cache Immediately
            val currentMap = HashMap(cachedIntentions)
            if (currentMap.remove(app) != null) {
                cachedIntentions = currentMap
                Log.e(LogTags.QT_STATE, "[INTENTION] Cleared for $app")
                
                // 2. Persist Async
                serviceScope.launch {
                    intentionStore.clearIntention(app)
                }
            }
        }
        
        @JvmStatic
        fun getIntentionRemainingMs(app: String): Long {
            val until = cachedIntentions[app] ?: 0L
            val now = System.currentTimeMillis()
            return kotlin.math.max(0L, until - now)
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

        private fun handleMonitoredAppEntry(app: String, context: android.content.Context, source: String = "NORMAL", force: Boolean = false) {
            val now = System.currentTimeMillis()
            var entry = quickTaskMap[app] // var because we might mutate it (reset IDLE)

            // Probe A: Definitive Entry State Log
            val preserved = preservedInterventionFlags[app] == true
            var state = entry?.state ?: QuickTaskState.IDLE
            
            // Phase-2 Watchdog: Reset stuck DECISION state (Native Authority recovery)
            if (state == QuickTaskState.DECISION) {
                val entryStart = entry?.decisionStartedAtMs ?: 0L
                val age = now - entryStart
                val overlayState = SessionManager.getOverlayState()
                
                if (age > 5000 && overlayState == SessionManager.OverlayState.INACTIVE) {
                    Log.w(LogTags.QT_STATE, "[DECISION_WD] reset pkg=$app ageMs=$age reason=NO_ACK overlayState=$overlayState")
                    entry?.state = QuickTaskState.IDLE
                    state = QuickTaskState.IDLE
                }
            }
            
            Log.e(LogTags.ENTRY_START, "[ENTRY] app=$app preservedFlag=$preserved state=$state source=$source pid=${android.os.Process.myPid()}")

            // NATIVE REFILL CHECK (Synchronous Check, Async Write)
            // 1. Check window expiry against cache
            val currentState = cachedQuotaState
            var remaining = currentState.remaining
            
            if (now - currentState.windowStartMs >= (15 * 60 * 1000L)) {
                // Window expired -> REFILL
                remaining = currentState.maxPer15m // Reset to max
                
                // Update Cache Immediately
                cachedQuotaState = QuotaState(currentState.maxPer15m, now, remaining)
                Log.e(LogTags.QT_STATE, "[QUOTA_REFILL] Window expired. Refilled to $remaining")
                
                // Persist Async
                serviceScope.launch {
                    try {
                         // We re-read snapshot to avoid race, or just trust our calc. 
                         // Store logic handles it safely if we call checkRefillAndGetRemaining
                         val finalState = quotaStore.checkRefillAndGetRemaining(now, currentState)
                         // Sync back to cache just in case
                         cachedQuotaState = finalState
                    } catch (e: Exception) { Log.e(TAG, "Failed to persist refill", e) }
                }
            }
            
            // BUILD SNAPSHOT (PURE READ)
            val intentionUntil = cachedIntentions[app] ?: 0L
            var intentionRemaining = if (intentionUntil > now) intentionUntil - now else 0L
            
            // Lazy Expiry Pruning
            if (intentionUntil > 0 && intentionRemaining == 0L) {
               // It was set but expired. Optimistically remove from RAM cache.
               // We don't block for persistence here, and we don't trigger a full persist unless necessary.
               // For now, let's just use the value 0. The store's restore() will clean up disk next boot.
               // Or we can fire and forget:
               serviceScope.launch {
                   clearIntention(app) // This logs and persists
               }
            }

                val quitRemaining = (quitSuppressionUntil[app] ?: 0L) - now
                val wakeRemaining = (suppressWakeUntil[app] ?: 0L) - now

                val snapshot = DecisionGate.GateSnapshot(
                isMonitored = true, // We are in handleMonitoredAppEntry
                qtRemaining = remaining.toInt(),
                isSystemSurfaceActive = isSystemSurfaceActive,
                quickTaskState = state,
                intentionRemainingMs = intentionRemaining,
                isInterventionPreserved = preserved,
                lastInterventionEmittedAt = showInterventionLastEmittedAt[app] ?: 0L,
                isQuitSuppressed = quitRemaining > 0,
                quitSuppressionRemainingMs = kotlin.math.max(0L, quitRemaining),
                isWakeSuppressed = wakeRemaining > 0,
                wakeSuppressionRemainingMs = kotlin.math.max(0L, wakeRemaining),
                isForceEntry = force
            )

            // EVALUATE DECISION (PURE)
            val (action, reason) = DecisionGate.evaluate(app, now, snapshot)

            // LOG DECISION
            Log.e(LogTags.DECISION_GATE, "[DECISION_GATE] pkg=$app action=$action reason=$reason qtRemaining=${snapshot.qtRemaining} quickTaskState=${snapshot.quickTaskState} systemSurfaceActive=${snapshot.isSystemSurfaceActive} suppressed=${snapshot.isQuitSuppressed || snapshot.isWakeSuppressed} preserved=${snapshot.isInterventionPreserved}")

            // EXECUTE ACTION (SIDE EFFECTS)
            when (action) {
                is DecisionGate.GateAction.StartIntervention -> {
                    // Start Session
                    val decision = SessionManager.tryStart(app, SessionManager.Kind.INTERVENTION, now)
                    
                    if (decision is SessionManager.StartDecision.Start) {
                        showInterventionLastEmittedAt[app] = now
                        
                        // Pass sessionId via extras
                        val params = Arguments.createMap().apply {
                            putString("sessionId", decision.sessionId)
                        }

                        if (snapshot.isInterventionPreserved) {
                            Log.e(LogTags.ENTRY_START, "[PRESERVE_ENTRY] app=$app preserved=true -> resumeMode=RESUME")
                            params.putString("resumeMode", "RESUME")
                            emitQuickTaskCommand("SHOW_INTERVENTION", app, context, params)
                            return
                        } else if (snapshot.quickTaskState == QuickTaskState.INTERVENTION_ACTIVE) {
                            Log.e(LogTags.QT_STATE, "[RESUME] Resuming intervention for $app")
                            params.putString("resumeMode", "RESUME")
                            emitQuickTaskCommand("SHOW_INTERVENTION", app, context, params)
                            return
                        }
                        // Fallback
                        emitQuickTaskCommand("SHOW_INTERVENTION", app, context, params)
                    } else {
                        // Suppressed by SessionManager
                        val reason = (decision as SessionManager.StartDecision.Suppress).reason
                        Log.e(LogTags.ENTRY_BLOCK, "[SESSION_BLOCK] app=$app reason=$reason")
                    }
                }
                
                is DecisionGate.GateAction.StartQuickTask -> {
                    // StartQuickTask implies we passed all suppressions, so we clear them
                     if (!force) { // Logic from before: "if (!force) ... remove ... else remove" -> effectively always remove if we proceed
                         quitSuppressionUntil.remove(app)
                         recheckAttempts.remove(app)
                     } else {
                         Log.e(TAG, "[QT_ENTRY] Forced entry for $app (source: $source) - Bypassing suppressions")
                         quitSuppressionUntil.remove(app)
                         recheckAttempts.remove(app)
                     }

                    underlyingApp = app
                    
                    // Reset if we were in INTERVENTION_ACTIVE but not preserved (Logic moved from inline)
                    if (snapshot.quickTaskState == QuickTaskState.INTERVENTION_ACTIVE && !snapshot.isInterventionPreserved) {
                         Log.i(TAG, "[RESET] Intervention active but not preserved for $app -> Resetting to IDLE")
                         Log.e(LogTags.QT_STATE, "[STATE_WRITE] app=$app state=${entry?.state} -> IDLE (entry_not_preserved)")
                         entry?.state = QuickTaskState.IDLE
                         entry = quickTaskMap[app] // Refresh ref
                         Log.e(LogTags.QT_STATE, "[PRESERVE_WRITE] app=$app value=REMOVE caller=handleMonitoredAppEntry_reset")
                         preservedInterventionFlags.remove(app)
                    }
                    
                    // Hardening (Recovery): If we are in POST_CHOICE but UI is not visible, relaunch it with gating.
                    // This block was previously executed BEFORE the "Start New Decision" block.
                    // But "StartQuickTask" action means we are ELIGIBLE for a NEW session (or recovery).
                    // The Gate Logic returns STATE_NOT_IDLE if in POST_CHOICE. 
                    // So if we are here, we are NOT in POST_CHOICE, OR the Gate allowed it.
                    // Wait, Gate returns STATE_NOT_IDLE_POST_CHOICE if in POST_CHOICE, effectively blocking StartQuickTask?
                    // Original code:
                    // if (entry?.state == QuickTaskState.POST_CHOICE) { ... logic ... return }
                    // if (entry == null || entry.state == QuickTaskState.IDLE) { ... Start ... }
                    
                    // IF Gate returned StartQuickTask, it means state IS IDLE (or effectively IDLE).
                    // So we proceed to start new.
                    
                    // Create entry if needed
                    // Start Session
                    val decision = SessionManager.tryStart(app, SessionManager.Kind.QUICK_TASK, now)

                    if (decision is SessionManager.StartDecision.Start) {
                        val activeEntry = entry ?: QuickTaskEntry(app, QuickTaskState.IDLE).also { quickTaskMap[app] = it }
                        activeEntry.state = QuickTaskState.DECISION
                        activeEntry.decisionStartedAtMs = now
                         
                        Log.e(LogTags.DECISION_GATE, "[DECISION_GATE] ACTION: SHOW_QUICK_TASK_DIALOG pkg=$app sessionId=${decision.sessionId}")
                        
                        // COMMIT POINT: Decrement Quota
                        val newRemaining = remaining - 1
                        cachedQuotaState = cachedQuotaState.copy(remaining = newRemaining)
                        Log.e(LogTags.QT_STATE, "[QUOTA_USE] Decremented quota. New remaining: $newRemaining")
                        
                        serviceScope.launch {
                            try {
                                quotaStore.decrementQuota()
                            } catch (e: Exception) { Log.e(TAG, "Failed to persist quota decrement", e) }
                        }
                        
                        val params = Arguments.createMap().apply {
                            putString("sessionId", decision.sessionId)
                        }
                        emitQuickTaskCommand("SHOW_QUICK_TASK_DIALOG", app, context, params)
                    } else {
                         // Suppressed by SessionManager
                        val reason = (decision as SessionManager.StartDecision.Suppress).reason
                        Log.e(LogTags.ENTRY_BLOCK, "[SESSION_BLOCK] app=$app reason=$reason")
                    }
                }

                is DecisionGate.GateAction.NoAction -> {
                    // Handle specific side effects (e.g. logging blocks, handling unstable rechecks)
                    
                    // 1. Post Choice Recovery (Special Case where logic was "Block entry, but maybe recover")
                    if (snapshot.quickTaskState == QuickTaskState.POST_CHOICE) {
                         // Original logic:
                         /*
                        if (!isSystemSurfaceActive) {
                            // ... throttle logic ...
                            emitQuickTaskCommand("SHOW_POST_QUICK_TASK_CHOICE", app, context)
                        } else {
                             Log.e(LogTags.ENTRY_BLOCK, "[ENTRY_BLOCK] pkg=$app reason=SURFACE_ALREADY_ACTIVE source=$source")
                        }
                        return
                        */
                        if (!snapshot.isSystemSurfaceActive) {
                             if (entry != null) {
                                  val throttleMs = 10_000L
                                  val suppressMs = 20_000L
                                  if (now < entry.suppressRecoveryUntilMs) {
                                      Log.e(LogTags.ENTRY_BLOCK, "[ENTRY_BLOCK] pkg=$app reason=RECOVERY_SUPPRESSED source=$source")
                                      return
                                  }
                                  if (now - entry.lastRecoveryLaunchAtMs < throttleMs) {
                                      Log.e(LogTags.ENTRY_BLOCK, "[ENTRY_BLOCK] pkg=$app reason=RECOVERY_THROTTLED source=$source age=${now - entry.lastRecoveryLaunchAtMs}ms")
                                      return
                                  }
                                  // Recovery Session (POST_CHOICE)
                                  val decision = SessionManager.tryStart(app, SessionManager.Kind.POST_CHOICE_RECOVERY, now)
                                  
                                  if (decision is SessionManager.StartDecision.Start) {
                                      Log.e(LogTags.QT_ENTRY_E, "[RECOVERY_LAUNCH] app=$app (Decision Point) sessionId=${decision.sessionId}")
                                      Log.e(LogTags.SS_CANARY, "[RECOVERY_LAUNCH] app=$app")
                                      entry.lastRecoveryLaunchAtMs = now
                                      entry.suppressRecoveryUntilMs = now + suppressMs
                                      
                                      val params = Arguments.createMap().apply {
                                          putString("sessionId", decision.sessionId)
                                      }
                                      emitQuickTaskCommand("SHOW_POST_QUICK_TASK_CHOICE", app, context, params)
                                  } else {
                                      Log.e(LogTags.ENTRY_BLOCK, "[SESSION_BLOCK] app=$app reason=ACTIVE_SESSION_EXISTS")
                                  }
                             }
                        } else {
                            Log.e(LogTags.ENTRY_BLOCK, "[ENTRY_BLOCK] pkg=$app reason=SURFACE_ALREADY_ACTIVE source=$source")
                        }
                        return
                    }

                    // 2. Unstable Recheck Logic (From original block: "if (!force)...")
                    if (!force && snapshot.isQuitSuppressed) { // Gate would return SUPPRESSION_QUIT
                         if (reason.startsWith(DecisionGate.Reason.SUPPRESSION_QUIT)) { // Confirm it's the quit suppression
                             val suppressUntil = quitSuppressionUntil[app]
                             if (suppressUntil != null) {
                                 // Logic: if now >= suppressUntil -> remove (Gate says NoAction, but maybe it just expired?)
                                 // Gate Logic: if (now < expire) -> suppressed.
                                 // If Gate says suppressed, it means now < expire.
                                 
                                 val isStable = (lastForegroundPackage == app) && (now - lastForegroundChangeTime >= 200)
                                 if (!isStable) {
                                     Log.e(LogTags.ENTRY_BLOCK, "[ENTRY_BLOCK] pkg=$app reason=UNSTABLE source=$source details=stability_delay_active")
                                     scheduleDeferredRecheck(app, context)
                                     return
                                 }
                             }
                         }
                    } else if (snapshot.isQuitSuppressed) {
                         // Gate said NoAction, but maybe expected expired?
                         // If Gate said SUPPRESSION_QUIT, it means it's valid.
                         // But if Gate said SUPPRESSION_QUIT, and we are NOT forced, we handle unstable.
                         // What if Gate said NoAction for another reason?
                    }

                    // 3. Quota Zero Emission
                    if (reason == DecisionGate.Reason.QUOTA_ZERO) {
                        Log.e(LogTags.DECISION_GATE, "[DECISION_GATE] ACTION: NO_QUICK_TASK (Quota Zero) pkg=$app")
                        Log.e(LogTags.ENTRY_BLOCK, "[ENTRY_BLOCK] pkg=$app reason=QUOTA_ZERO source=$source")
                        emitQuickTaskCommand("NO_QUICK_TASK_AVAILABLE", app, context)
                    }
                    
                    // 4. Entry Block Logging (General)
                    // Original: Log.e(LogTags.ENTRY_BLOCK, "[ENTRY_BLOCK] pkg=$app reason=... source=$source")
                    // We can map Gate reasons to these logs if strict parity needed.
                    // E.g. UNSTABLE handled above.
                }
            }
        }

        private fun emitQuickTaskCommand(command: String, app: String, context: android.content.Context, extraParams: com.facebook.react.bridge.WritableMap? = null) {
            val reactContext = AppMonitorService.getReactContext()
            if (reactContext == null || !reactContext.hasActiveReactInstance()) return
            
            // OPTION 1: NATIVE LAUNCH AUTHORITY (Bypass JS Bridge for Surface Launch)
            // If the command is to SHOW UI, we launch the Activity DIRECTLY from Native.
            // This guarantees sessionId integrity and eliminates the JS bridge race condition.
            if (command == "SHOW_INTERVENTION" || command == "SHOW_QUICK_TASK_DIALOG" || command == "SHOW_POST_QUICK_TASK_CHOICE") {
                val sid = extraParams?.getString("sessionId")
                val resumeMode = if (extraParams?.hasKey("resumeMode") == true) extraParams.getString("resumeMode") else null
                
                Log.i(TAG, "[NATIVE_LAUNCH] Direct launch for $command app=$app sessionId=$sid")
                
                val intent = Intent(context, SystemSurfaceActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
                    putExtra(SystemSurfaceActivity.EXTRA_WAKE_REASON, command)
                    putExtra(SystemSurfaceActivity.EXTRA_TRIGGERING_APP, app)
                    putExtra("sessionId", sid)
                    if (resumeMode != null) putExtra("resumeMode", resumeMode)
                }
                context.startActivity(intent)
            }

            val params = Arguments.createMap().apply {
                putString("command", command)
                putString("app", app)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
                
                // V3: Manual merge for simple params (avoiding missing merge() method)
                if (extraParams != null) {
                    if (extraParams.hasKey("resumeMode")) {
                        putString("resumeMode", extraParams.getString("resumeMode"))
                    }
                    if (extraParams.hasKey("sessionId")) {
                        putString("sessionId", extraParams.getString("sessionId"))
                    }
                }
            }
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("QUICK_TASK_COMMAND", params)
        }

        @JvmStatic
        fun setInterventionPreserved(app: String, preserved: Boolean, context: android.content.Context) {
            Log.e(LogTags.QT_STATE, "[PRESERVE_WRITE] app=$app value=$preserved caller=setInterventionPreserved")
            preservedInterventionFlags[app] = preserved
            Log.e(LogTags.QT_STATE, "[PRESERVE] set app=$app preserved=$preserved")
            
            val prefs = context.getSharedPreferences(PREFS_INTERVENTION_PRESERVED, android.content.Context.MODE_PRIVATE)
            if (preserved) {
                prefs.edit().putBoolean(app, true).apply()
            } else {
                prefs.edit().remove(app).apply()
            }
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
                    } else if (state == QuickTaskState.INTERVENTION_ACTIVE) {
                        // Keep INTERVENTION_ACTIVE during boot restoration if it was saved
                        quickTaskMap[app] = QuickTaskEntry(app, state, expiresAt)
                    } else {
                        prefs.edit().remove(app).apply()
                    }
                } catch (e: Exception) {}
            }

            // Restore preserved flags
            val presPrefs = context.getSharedPreferences(PREFS_INTERVENTION_PRESERVED, android.content.Context.MODE_PRIVATE)
            presPrefs.all.forEach { (app, value) ->
                if (value is Boolean && value) {
                    preservedInterventionFlags[app] = true
                    // Ensure state consistency: if preserved, must be in INTERVENTION_ACTIVE state
                    val entry = quickTaskMap.getOrPut(app) { QuickTaskEntry(app, QuickTaskState.IDLE) }
                    if (entry.state != QuickTaskState.INTERVENTION_ACTIVE) {
                        entry.state = QuickTaskState.INTERVENTION_ACTIVE
                        Log.i(TAG, "[RESTORE] Restoring preserved state for $app")
                    }
                }
            }
            
            // Restore monitored apps from disk
            val monPrefs = context.getSharedPreferences(PREFS_MONITORED_APPS, android.content.Context.MODE_PRIVATE)
            val storedApps = monPrefs.getStringSet(KEY_MONITORED_APPS, null)
                if (storedApps != null) {
                    val restored = HashSet(storedApps)
                    updateMonitoredAppsCache(restored)
                    Log.e(LogTags.SERVICE_LIFE, "[MONITORED_APPS] restored count=${restored.size} pid=${android.os.Process.myPid()}")
                } else {
                Log.w(LogTags.SERVICE_LIFE, "[MONITORED_APPS] No apps found on disk during restoration")
            }
        }

        fun onQuickTaskAccepted(app: String, durationMs: Long, context: android.content.Context) {
            val entry = quickTaskMap[app] ?: return
            entry.state = QuickTaskState.ACTIVE
            entry.expiresAt = System.currentTimeMillis() + durationMs
            // DEPRECATED: cachedQuickTaskQuota decrement moved to commit point (StartQuickTask)
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
            // V3: Set state to INTERVENTION_ACTIVE so it survives surface exit preservation checks
            quickTaskMap[app]?.let { entry ->
                Log.e(LogTags.QT_STATE, "[STATE_WRITE] app=$app state=${entry.state} -> INTERVENTION_ACTIVE (switch_to_intervention)")
                entry.state = QuickTaskState.INTERVENTION_ACTIVE
                entry.expiresAt = null
            }
        }

        @JvmStatic
        fun onPostChoiceContinue(app: String, context: android.content.Context) {
            finalizePostChoiceExplicitly(app)
            emitFinishSystemSurface(context)
        }

        @JvmStatic
        fun onPostChoiceQuit(app: String, context: android.content.Context) {
            finalizePostChoiceExplicitly(app)
            
            // 1️⃣ On POST_QUIT for app X: Start suppression
            quitSuppressionUntil[app] = System.currentTimeMillis() + 1500
            Log.e(TAG, "[QT][SUPPRESS] Quit suppression started for $app")
            
            suppressWakeUntil.remove(app)
            emitFinishSystemSurface(context)
        }

        private fun finalizePostChoiceExplicitly(app: String) {
            val entry = quickTaskMap[app] ?: return
            Log.d(LOG_TAG_QT, "[FINALIZE_EXPLICIT] app=$app current_state=${entry.state} -> Resetting to IDLE")
            entry.state = QuickTaskState.IDLE
            entry.postChoiceShown = false
            entry.expiresAt = null
            cancelNativeTimer(app)
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
            
            val isForeground = getEffectiveForegroundApp() == app
            Log.d(LOG_TAG_QT, "[TIMER_EXPIRED] app=$app state=${entry.state} isForeground=$isForeground")
            
            if (entry.state != QuickTaskState.ACTIVE) return
            
            val context = AppMonitorService.getReactContext()?.applicationContext ?: return
            if (isForeground) {
                // Preserving existing logic: Post Choice seems to depend on having quota? 
                // Or maybe this was a bug I'm preserving? User said "Do not change user-facing behavior".
                // Logic: If quota > 0, show Post Choice. If 0, finish.
                if (cachedQuotaState.remaining > 0) {
                    Log.d(LOG_TAG_QT, "[TRANSITION] app=$app ACTIVE -> POST_CHOICE")
                    entry.state = QuickTaskState.POST_CHOICE
                    entry.expiresAt = null
                    entry.postChoiceShown = true
                    emitQuickTaskCommand("SHOW_POST_QUICK_TASK_CHOICE", app, context)
                } else {
                    Log.d(LOG_TAG_QT, "[TRANSITION] app=$app ACTIVE -> IDLE (no quota)")
                    entry.state = QuickTaskState.IDLE
                    emitQuickTaskCommand("NO_QUICK_TASK_AVAILABLE", app, context)
                }
            } else {
                Log.d(LOG_TAG_QT, "[TRANSITION] app=$app ACTIVE -> IDLE (background)")
                entry.state = QuickTaskState.IDLE
                entry.expiresAt = null
            }
            activeTimerRunnables.remove(app)
        }

        private fun checkWatchdog() {
            // Watchdog logic moved to SystemSurfaceManager for consolidated control.
            // ForegroundDetectionService now only manages per-app QuickTask state.
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
        
        // Init Stores
        quotaStore = QuickTaskQuotaStore(applicationContext)
        monitoredStore = MonitoredAppsStore(applicationContext)
        intentionStore = IntentionStore(applicationContext)
        
        // SS_BUILD Fingerprint in Service
        val procName = if (android.os.Build.VERSION.SDK_INT >= 28) Application.getProcessName() else "unknown"
        val fingerprint = "[SERVICE_START] debug=${BuildConfig.DEBUG} proc=$procName pid=${android.os.Process.myPid()} thread=${Thread.currentThread().name}"
        Log.e(LogTags.SS_BUILD, fingerprint)
        
        Log.e(LogTags.QT_DEV, "🔥 NATIVE_BUILD_CANARY: ${NativeBuildCanary.BUILD_VERSION}")
        
        // Reset Active flag on service start to recover from zombie process states
        setSystemSurfaceActive(false, "SERVICE_CONNECTED")
        
        restoreFromDisk(applicationContext)
        
        // LOAD CONFIG FROM DATASTORE (Native Authority)
        serviceScope.launch {
            // Load Quota
            val quotaState = quotaStore.getSnapshot()
            cachedQuotaState = quotaState
            Log.e(LogTags.QT_STATE, "[CONFIG] Loaded Quota: max=${quotaState.maxPer15m} remaining=${quotaState.remaining} windowStart=${quotaState.windowStartMs}")
            
            // Load Monitored Apps
            val apps = monitoredStore.getMonitoredApps()
            cachedMonitoredApps = apps
            Log.e(LogTags.SERVICE_LIFE, "[CONFIG] Loaded Monitored Apps: count=${apps.size}")

            // Load Intentions
            intentionStore.restore()
            cachedIntentions = intentionStore.getSnapshot()
            Log.e(LogTags.SERVICE_LIFE, "[CONFIG] Loaded Intentions: count=${cachedIntentions.size}")
        }
        
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
        val eventType = event.eventType
        
        // USE VOLATILE CACHE (Non-blocking)
        val isMonitored = cachedMonitoredApps.contains(packageName)
        val dynCount = cachedMonitoredApps.size
        
        if (dynCount == 0) {
            Log.w(TAG, "[MONITOR_EMPTY] cachedMonitoredApps is EMPTY! Checking backup...")
        }

        val lowerPkg = packageName.lowercase()
        val isLauncher = lowerPkg.contains("launcher")
        val isSystemUI = lowerPkg.contains("systemui")
        val isOurApp = packageName == "com.anonymous.breakloopnative"
        Log.e(TAG, "[FG_EVT] pkg=$packageName isMonitored=$isMonitored isLauncher=$isLauncher isSystemUI=$isSystemUI isOurApp=$isOurApp")
        val surfaceActive = isSystemSurfaceActive
        
        // Audit-focused logging: Restricted to WINDOW_STATE_CHANGED to avoid log flooding
        val isWindowStateChanged = eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
        val isCanaryApp = packageName == "com.instagram.android" || 
                          packageName == "com.xingin.xhs" || 
                          packageName == "com.zhiliaoapp.musically" || 
                          packageName == "com.twitter.android"

        // Decisive Log: Explain why entry triggered or was blocked
        if (isWindowStateChanged && (isMonitored || surfaceActive || dynCount == 0 || isCanaryApp)) {
            val typeStr = AccessibilityEvent.eventTypeToString(eventType)
            Log.e(LogTags.QT_GUARD, "[QT_GUARD] type=$typeStr pkg=$packageName monitored=$isMonitored surfaceActive=$surfaceActive dynCount=$dynCount pid=${android.os.Process.myPid()}")
        }

        if (isMonitored && !surfaceActive) {
            handleMonitoredAppEntry(packageName, applicationContext)
        } else if (surfaceActive && isWindowStateChanged) {
            val OUR_PKG = "com.anonymous.breakloopnative"
            val now = System.currentTimeMillis()
            
            // Deterministic Mismatch Tracking (Requirement 1)
            if (packageName != OUR_PKG) {
                if (mismatchStartMs == 0L) {
                    mismatchStartMs = now
                    Log.e(LogTags.SURFACE_RECOVERY, "[SURFACE_RECOVERY] mismatchStart fg=$packageName pid=${android.os.Process.myPid()}")
                } else if (now - mismatchStartMs > 800) {
                    val duration = now - mismatchStartMs
                    Log.e(LogTags.SURFACE_RECOVERY, "[SURFACE_RECOVERY] hardFire fg=$packageName durationMs=$duration pid=${android.os.Process.myPid()}")
                    
                    // Unified exit path
                    onSurfaceExit("MISMATCH_TIMEOUT", overrideApp = packageName) // Resets underlyingApp's state
                    SystemSurfaceManager.finish(SystemSurfaceManager.REASON_SURFACE_RECOVERY)
                    
                    mismatchStartMs = 0L
                    
                    // Package Picker for Replay (Requirement 4)
                    val candidate = pickReplayCandidate(packageName)
                    if (candidate != null) {
                        triggerReplayDelayed(candidate, 150)
                    }
                    return
                }
            } else {
                mismatchStartMs = 0L
            }

            // Debounced Recovery Logic (Soft Recovery - remains for transitions)
            val SYSTEM_UI = "com.android.systemui"
            val PERM_CONTROLLER = "com.android.permissioncontroller"
            val LAUNCHER = "com.hihonor.android.launcher"
            val GOOGLE_INPUT = "com.google.android.inputmethod.latin"
            val G_SEARCH = "com.google.android.googlequicksearchbox"

            val isAllowedPkg = packageName == OUR_PKG || 
                              packageName == SYSTEM_UI || 
                              packageName == PERM_CONTROLLER || 
                              packageName == LAUNCHER ||
                              packageName == GOOGLE_INPUT ||
                              packageName == G_SEARCH ||
                              packageName.contains("systemui") ||
                              packageName.contains("ime")

            if (isAllowedPkg) {
                if (packageName == OUR_PKG && surfaceRecoveryRunnable != null) {
                    surfaceRecoveryHandler.removeCallbacks(surfaceRecoveryRunnable!!)
                    surfaceRecoveryRunnable = null
                    Log.e(LogTags.SURFACE_RECOVERY, "[SURFACE_RECOVERY] debounceCancel reason=RETURN_TO_SURFACE")
                }
            } else {
                // Task A: Debounced Soft Recovery (Fallback)
                if (surfaceRecoveryRunnable == null) {
                    Log.e(LogTags.SURFACE_RECOVERY, "[SURFACE_RECOVERY] debounceStart fg=$packageName allowlisted=false pid=${android.os.Process.myPid()}")
                    
                    val runnable = Runnable {
                        val currentFG = currentForegroundApp ?: ""
                        val finalPkg = pickReplayCandidate(currentFG)
                        
                        val isMonitoredAtFire = finalPkg?.let { cachedMonitoredApps.contains(it) } ?: false
                        
                        Log.e(LogTags.SURFACE_RECOVERY, "[SURFACE_RECOVERY] debounceFire fg=$currentFG replay=$isMonitoredAtFire pid=${android.os.Process.myPid()}")
                        
                        onSurfaceExit("RECOVERY_DEBOUNCE_FIRE", overrideApp = finalPkg)
                        SystemSurfaceManager.finish(SystemSurfaceManager.REASON_SURFACE_RECOVERY)
                        
                        if (isMonitoredAtFire && finalPkg != null) {
                            triggerReplayDelayed(finalPkg, 150)
                        }
                        
                        surfaceRecoveryRunnable = null
                    }
                    surfaceRecoveryRunnable = runnable
                    surfaceRecoveryHandler.postDelayed(runnable, 500)
                }
            }
        } else if (!surfaceActive) {
            mismatchStartMs = 0L
        }
        
        if (isWindowStateChanged) {
            lastWindowStateChangedPkg = packageName
        }
        updateCurrentForegroundApp(packageName)
    }

    private fun pickReplayCandidate(currentPkg: String): String? {
        val OUR_PKG = "com.anonymous.breakloopnative"
        val lastWsc = lastWindowStateChangedPkg ?: ""
        
        fun isTransient(pkg: String): Boolean {
            if (pkg == "" || pkg == OUR_PKG) return true
            val lower = pkg.lowercase()
            return lower.contains("launcher") || 
                   lower.contains("systemui") || 
                   lower.contains("permissioncontroller") || 
                   lower.contains("ime") || 
                   lower.contains("inputmethod") ||
                   lower.contains("googlequicksearchbox")
        }

        if (!isTransient(currentPkg)) return currentPkg
        if (!isTransient(lastWsc)) return lastWsc
        return null
    }

    private fun triggerReplayDelayed(packageName: String, delayMs: Long) {
        val isMonitored = cachedMonitoredApps.contains(packageName)
        if (!isMonitored) return

        surfaceRecoveryHandler.postDelayed({
            if (!isSystemSurfaceActive) {
                val lastReplay = lastReplayAtMap[packageName] ?: 0L
                val now = System.currentTimeMillis()
                if (now - lastReplay > 2000) {
                    lastReplayAtMap[packageName] = now
                    Log.e(LogTags.SURFACE_RECOVERY, "[RECOVERY_REPLAY] pkg=$packageName force=true source=RECOVERY_REPLAY")
                    handleMonitoredAppEntry(packageName, applicationContext, source = "RECOVERY_REPLAY", force = true)
                } else {
                    Log.w(LogTags.SURFACE_RECOVERY, "[SURFACE_RECOVERY] Replay throttled for $packageName")
                }
            }
        }, delayMs)
    }

    override fun onInterrupt() {}
    override fun onUnbind(intent: Intent?): Boolean {
        isServiceConnected = false
        return super.onUnbind(intent)
    }
}
