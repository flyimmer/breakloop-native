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
            var suppressRecoveryUntilMs: Long = 0
        )
        
        @JvmStatic
        fun getQuickTaskStateForApp(app: String): String {
            return quickTaskMap[app]?.state?.name ?: "UNKNOWN"
        }
        
        private val quickTaskMap = mutableMapOf<String, QuickTaskEntry>()
        private val preservedInterventionFlags = mutableMapOf<String, Boolean>()
        private const val PREFS_QUICK_TASK_STATE = "quick_task_state_v1"
        private const val PREFS_INTERVENTION_PRESERVED = "intervention_preserved_v1"
        private var underlyingApp: String? = null
        private var dynamicMonitoredApps = mutableSetOf<String>()
        private const val PREFS_MONITORED_APPS = "monitored_apps_native_v1"
        private const val KEY_MONITORED_APPS = "monitored_apps_set"
        private val suppressWakeUntil = mutableMapOf<String, Long>()
        private val monitoredLock = Any()

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

        @JvmStatic
        fun updateQuickTaskQuota(quota: Int) {
            cachedQuickTaskQuota = quota
        }

        @JvmStatic
        fun updateMonitoredApps(apps: Set<String>, context: android.content.Context? = null) {
            synchronized(monitoredLock) {
                dynamicMonitoredApps.clear()
                dynamicMonitoredApps.addAll(apps)
            }
            
            context?.let {
                val prefs = it.getSharedPreferences(PREFS_MONITORED_APPS, android.content.Context.MODE_PRIVATE)
                // Defensive copy for SharedPreferences putStringSet
                val defensiveApps = HashSet(apps)
                prefs.edit().putStringSet(KEY_MONITORED_APPS, defensiveApps).apply()
                Log.e(LogTags.SERVICE_LIFE, "[MONITORED_APPS] persisted count=${defensiveApps.size} pid=${android.os.Process.myPid()}")
            }
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
            val entry = quickTaskMap[app]
            
            // Probe A: Definitive Entry State Log
            val preserved = preservedInterventionFlags[app] == true
            val state = entry?.state ?: QuickTaskState.IDLE
            Log.e(LogTags.ENTRY_START, "[ENTRY] app=$app preservedFlag=$preserved state=$state source=$source pid=${android.os.Process.myPid()}")

            // V3: Early Preservation Override (Highest Priority)
            if (preservedInterventionFlags[app] == true) {
                 // DEBOUNCE: Suppress duplicate SHOW_INTERVENTION within 800ms
                 val lastEmitted = showInterventionLastEmittedAt[app] ?: 0L
                 if (now - lastEmitted < 800) {
                     Log.e(LogTags.ENTRY_START, "[SHOW_INT_DEBOUNCE] suppressed for $app (last=${now-lastEmitted}ms ago)")
                     return
                 }
                 showInterventionLastEmittedAt[app] = now

                 Log.e(LogTags.ENTRY_START, "[PRESERVE_ENTRY] app=$app preserved=true -> resumeMode=RESUME")
                 val extras = Arguments.createMap().apply {
                     putString("resumeMode", "RESUME")
                 }
                 emitQuickTaskCommand("SHOW_INTERVENTION", app, context, extras)
                 return
            }
            
            // AVOID CONFLICTS: Quick Task Eligibility Logic
            val qtState = entry?.state ?: QuickTaskState.IDLE
            val isSurfaceActive = isSystemSurfaceActive
            val quotaRemaining = cachedQuickTaskQuota
            val qSuppressMs = (quitSuppressionUntil[app] ?: 0L) - now
            val wSuppressMs = (suppressWakeUntil[app] ?: 0L) - now
            
            var qtEligible = true
            var eligReason = "ELIGIBLE"

            if (isSurfaceActive) {
                qtEligible = false
                eligReason = "SURFACE_ACTIVE"
            } else if (qtState != QuickTaskState.IDLE && qtState != QuickTaskState.POST_CHOICE) {
                // DECISION or ACTIVE state blocks re-entry unless cleaned up
                qtEligible = false
                eligReason = "STATE_NOT_IDLE_${qtState}"
            } else if (quotaRemaining <= 0) {
                qtEligible = false
                eligReason = "QUOTA_ZERO"
            } else if (qSuppressMs > 0 && !force) {
                qtEligible = false
                eligReason = "SUPPRESSION_QUIT_${qSuppressMs}ms"
            } else if (wSuppressMs > 0 && !force) {
                qtEligible = false
                eligReason = "SUPPRESSION_WAKE_${wSuppressMs}ms"
            }

            Log.e("DECISION_GATE", "[DECISION_GATE] app=$app qtElig=$qtEligible reason=$eligReason state=$qtState surfaceActive=$isSurfaceActive quota=$quotaRemaining underlying=$underlyingApp")

            // ENTRY_START: Decisive Log
            Log.e(LogTags.ENTRY_START, "[ENTRY_START] pkg=$app source=$source force=$force elig=$qtEligible reason=$eligReason pid=${android.os.Process.myPid()}")

            if (!force) {
                val suppressUntil = quitSuppressionUntil[app]
                if (suppressUntil != null) {
                    if (now >= suppressUntil) {
                        quitSuppressionUntil.remove(app)
                        recheckAttempts.remove(app)
                    } else {
                        val isStable = (lastForegroundPackage == app) && (now - lastForegroundChangeTime >= 200)
                        if (!isStable) {
                            Log.e(LogTags.ENTRY_BLOCK, "[ENTRY_BLOCK] pkg=$app reason=UNSTABLE source=$source details=stability_delay_active")
                            scheduleDeferredRecheck(app, context)
                            return
                        }
                        quitSuppressionUntil.remove(app)
                        recheckAttempts.remove(app)
                    }
                }
            } else {
                Log.e(TAG, "[QT_ENTRY] Forced entry for $app (source: $source) - Bypassing suppressions")
                quitSuppressionUntil.remove(app)
                recheckAttempts.remove(app)
            }

            underlyingApp = app
            
            // V3: Handle Interrupted Intervention Resumption
            if (entry?.state == QuickTaskState.INTERVENTION_ACTIVE) {
                val preserved = preservedInterventionFlags[app] == true
                Log.e(LogTags.QT_STATE, "[PRESERVE_READ] app=$app value=$preserved caller=handleMonitoredAppEntry_v3")
                Log.e(LogTags.ENTRY_START, "[ENTRY_DECISION] app=$app state=${entry.state} preserved=$preserved")
                
                if (preserved) {
                    Log.e(LogTags.QT_STATE, "[RESUME] Resuming intervention for $app")
                    val extras = Arguments.createMap().apply {
                        putString("resumeMode", "RESUME")
                    }
                    emitQuickTaskCommand("SHOW_INTERVENTION", app, context, extras)
                    return
                } else {
                    Log.i(TAG, "[RESET] Intervention active but not preserved for $app -> Resetting to IDLE")
                    Log.e(LogTags.QT_STATE, "[STATE_WRITE] app=$app state=${entry.state} -> IDLE (entry_not_preserved)")
                    entry.state = QuickTaskState.IDLE
                    Log.e(LogTags.QT_STATE, "[PRESERVE_WRITE] app=$app value=REMOVE caller=handleMonitoredAppEntry_reset")
                    preservedInterventionFlags.remove(app)
                    // Fall through to normal decision logic
                }
            }
            
            // Hardening (Recovery): If we are in POST_CHOICE but UI is not visible, relaunch it with gating.
            if (entry?.state == QuickTaskState.POST_CHOICE) {
                if (!isSystemSurfaceActive) {
                    val throttleMs = 10_000L
                    val suppressionMs = 20_000L
                    
                    if (now < entry.suppressRecoveryUntilMs) {
                        Log.e(LogTags.ENTRY_BLOCK, "[ENTRY_BLOCK] pkg=$app reason=RECOVERY_SUPPRESSED source=$source")
                        return
                    }
                    
                    if (now - entry.lastRecoveryLaunchAtMs < throttleMs) {
                        Log.e(LogTags.ENTRY_BLOCK, "[ENTRY_BLOCK] pkg=$app reason=RECOVERY_THROTTLED source=$source age=${now - entry.lastRecoveryLaunchAtMs}ms")
                        return
                    }
                    
                    Log.e(LogTags.QT_ENTRY_E, "[RECOVERY_LAUNCH] app=$app (Decision Point)")
                    Log.e(LogTags.SS_CANARY, "[RECOVERY_LAUNCH] app=$app")
                    entry.lastRecoveryLaunchAtMs = now
                    entry.suppressRecoveryUntilMs = now + suppressionMs
                    emitQuickTaskCommand("SHOW_POST_QUICK_TASK_CHOICE", app, context)
                } else {
                    Log.e(LogTags.ENTRY_BLOCK, "[ENTRY_BLOCK] pkg=$app reason=SURFACE_ALREADY_ACTIVE source=$source")
                }
                return
            }

            if (entry == null || entry.state == QuickTaskState.IDLE) {
                val activeEntry = entry ?: QuickTaskEntry(app, QuickTaskState.IDLE).also { quickTaskMap[app] = it }
                activeEntry.state = QuickTaskState.DECISION
                if (cachedQuickTaskQuota > 0) {
                    Log.e("DECISION_GATE", "[DECISION_GATE] ACTION: SHOW_QUICK_TASK_DIALOG pkg=$app")
                    emitQuickTaskCommand("SHOW_QUICK_TASK_DIALOG", app, context)
                } else {
                    Log.e("DECISION_GATE", "[DECISION_GATE] ACTION: NO_QUICK_TASK (Quota Zero) pkg=$app")
                    Log.e(LogTags.ENTRY_BLOCK, "[ENTRY_BLOCK] pkg=$app reason=QUOTA_ZERO source=$source")
                    emitQuickTaskCommand("NO_QUICK_TASK_AVAILABLE", app, context)
                }
            }
        }

        private fun emitQuickTaskCommand(command: String, app: String, context: android.content.Context, extraParams: com.facebook.react.bridge.WritableMap? = null) {
            val reactContext = AppMonitorService.getReactContext()
            if (reactContext == null || !reactContext.hasActiveReactInstance()) return
            val params = Arguments.createMap().apply {
                putString("command", command)
                putString("app", app)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
                
                // V3: Manual merge for simple params (avoiding missing merge() method)
                if (extraParams != null) {
                    if (extraParams.hasKey("resumeMode")) {
                        putString("resumeMode", extraParams.getString("resumeMode"))
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
                synchronized(monitoredLock) {
                    dynamicMonitoredApps.clear()
                    dynamicMonitoredApps.addAll(restored)
                }
                Log.e(LogTags.SERVICE_LIFE, "[MONITORED_APPS] restored count=${restored.size} pid=${android.os.Process.myPid()}")
            } else {
                Log.w(LogTags.SERVICE_LIFE, "[MONITORED_APPS] No apps found on disk during restoration")
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
                if (cachedQuickTaskQuota > 0) {
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
        
        // SS_BUILD Fingerprint in Service
        val procName = if (android.os.Build.VERSION.SDK_INT >= 28) Application.getProcessName() else "unknown"
        val fingerprint = "[SERVICE_START] debug=${BuildConfig.DEBUG} proc=$procName pid=${android.os.Process.myPid()} thread=${Thread.currentThread().name}"
        Log.e(LogTags.SS_BUILD, fingerprint)
        
        Log.e(LogTags.QT_DEV, "🔥 NATIVE_BUILD_CANARY: ${NativeBuildCanary.BUILD_VERSION}")
        
        // Reset Active flag on service start to recover from zombie process states
        setSystemSurfaceActive(false, "SERVICE_CONNECTED")
        
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
        val eventType = event.eventType
        
        val (isMonitored, dynCount) = synchronized(monitoredLock) {
            dynamicMonitoredApps.contains(packageName) to dynamicMonitoredApps.size
        }
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
                        
                        val isMonitoredAtFire = finalPkg?.let { synchronized(monitoredLock) { dynamicMonitoredApps.contains(it) } } ?: false
                        
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
        val isMonitored = synchronized(monitoredLock) { dynamicMonitoredApps.contains(packageName) }
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
