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
 * 
 * WHY ACCESSIBILITYSERVICE?
 * - Provides reliable real-time detection of app switches
 * - Works even when BreakLoop app is closed or killed
 * - Does not require polling (event-driven)
 * - More battery-efficient than UsageStatsManager polling
 * - Can detect window state changes immediately
 * 
 * PRIVACY CONSIDERATIONS:
 * - This service ONLY reads the package name of the foreground app
 * - It does NOT read any content, text, or user data from other apps
 * - It does NOT capture any keystrokes or UI interactions
 * - The detected package names are used solely for mindfulness intervention
 * - Users must explicitly grant this permission in Android Settings
 * 
 * PHASE F3.5 STATUS:
 * - Detects foreground app changes in real-time
 * - Launches SystemSurfaceActivity (NOT MainActivity) when monitored app detected
 * - Passes triggering app package name to SystemSurfaceActivity
 * - Native code decides WHEN to wake app, JS decides IF and HOW to intervene
 * - Does NOT contain any intervention business logic
 * - Future phases will add monitored apps list checking
 * 
 * LIFECYCLE:
 * - Service starts when user enables it in Android Accessibility Settings
 * - Runs independently of the BreakLoop app UI
 * - Continues running even if the app is killed
 * - Can only be stopped by user disabling it in Settings
 */
class ForegroundDetectionService : AccessibilityService() {

    companion object {
        private const val TAG = "ForegroundDetection"
        
        /**
         * Track if the service is currently running
         * Used to check service status from other components
         */
        @Volatile
        var isServiceConnected = false
            private set
            
        /**
         * Hardcoded list of monitored apps for Phase F3.5
         * 
         * TODO Phase F4: Replace with dynamic list from JS
         * TODO Phase F4: Sync this list with user's settings in React Native
         * 
         * For now, using common social media / entertainment apps for testing
         */
        private val MONITORED_APPS = setOf(
            "com.instagram.android",
            "com.zhiliaoapp.musically",  // TikTok
            "com.twitter.android",
            "com.facebook.katana",
            "com.reddit.frontpage",
            "com.snapchat.android",
            "com.youtube.android"
        )
        
        /**
         * In-memory Quick Task timers per app.
         * Maps packageName -> expiration timestamp.
         * 
         * Set by JS via AppMonitorModule.storeQuickTaskTimer().
         * Checked before launching SystemSurfaceActivity.
         */
        private val quickTaskTimers = mutableMapOf<String, Long>()
        
        /**
         * Cached global Quick Task quota (n_quickTask)
         * 
         * PHASE 4.1: Entry decision authority
         * 
         * Source of truth: JavaScript product logic
         * Native caches this value for runtime entry decisions
         * 
         * Updated via AppMonitorModule.updateQuickTaskQuota()
         * Must be synced on: app start, quota change, Quick Task usage
         * 
         * IMPORTANT: This is a runtime cache ONLY, NOT a second source of truth
         */
        private var cachedQuickTaskQuota: Int = 1  // Default to 1 use
        
        /**
         * Quick Task state machine (per-app)
         * PHASE 4.2: Native owns ACTIVE phase
         * 
         * AUTHORITATIVE SKELETON - Do NOT add extra states or fields
         */
        enum class QuickTaskState {
            IDLE,          // No Quick Task active
            DECISION,      // Dialog shown, waiting for user intent
            ACTIVE,        // Timer running
            POST_CHOICE    // Timer expired in foreground, waiting for user choice
        }
        
        /**
         * Per-app Quick Task entry
         * AUTHORITATIVE SKELETON - Do NOT add extra fields
         */
        data class QuickTaskEntry(
            val app: String,
            var state: QuickTaskState,
            var expiresAt: Long? = null,  // Null except when ACTIVE
            var postChoiceShown: Boolean = false  // One-shot guard for POST_CHOICE UI
        )
        
        /**
         * Runtime authority - source of truth while running
         * Maps app package name -> Quick Task entry
         */
        private val quickTaskMap = mutableMapOf<String, QuickTaskEntry>()
        
        /**
         * SharedPreferences key for crash recovery backup
         */
        private const val PREFS_QUICK_TASK_STATE = "quick_task_state_v1"
        
        /**
         * Last detected foreground app (for expiration checks)
         * Updated by service instance, read by timer expiration
         */
        @Volatile
        private var currentForegroundApp: String? = null
        
        /**
         * Track last app we made an entry decision for
         * 
         * PHASE 4.1: Edge-triggered entry decisions
         * 
         * Prevents duplicate decisions on same app entry
         * Reset when SystemSurface finishes
         */
        private var lastDecisionApp: String? = null
        
        /**
         * Track if SystemSurface is currently active
         * 
         * PHASE 4.1: Lifecycle guard for entry decisions
         * 
         * Prevents emitting decisions while UI is already showing
         * Set by JS when SystemSurface launches/finishes
         */
        @Volatile
        private var isSystemSurfaceActive: Boolean = false
        
        /**
         * Timestamp when isSystemSurfaceActive was last set to true
         * Used for auto-recovery if flag gets stuck
         */
        @Volatile
        private var systemSurfaceActiveTimestamp: Long = 0
        
        /**
         * Wake suppression timestamps per app
         * 
         * Maps packageName -> suppressUntil timestamp
         * 
         * JavaScript sets this to say: "Don't launch SystemSurface before this time"
         * Native reads it to suppress unnecessary wakes
         * 
         * SEMANTIC OWNERSHIP:
         * - JavaScript makes semantic decision (e.g., intention timer)
         * - JavaScript sets mechanical flag: "don't wake before X"
         * - Native reads mechanical flag, has ZERO semantic knowledge
         * - Native doesn't know WHY suppression exists
         * - Native only knows: "Don't wake before this timestamp"
         */
        private val suppressWakeUntil = mutableMapOf<String, Long>()
        
        /**
         * Set Quick Task timer for an app.
         * Called from AppMonitorModule when user activates Quick Task.
         */
        @JvmStatic
        fun setQuickTaskTimer(packageName: String, expiresAt: Long) {
            quickTaskTimers[packageName] = expiresAt
        }
        
        /**
         * Clear Quick Task timer for an app.
         * Called from AppMonitorModule when Quick Task expires or is cancelled.
         */
        @JvmStatic
        fun clearQuickTaskTimer(packageName: String) {
            quickTaskTimers.remove(packageName)
            Log.i(TAG, "[QT][TIMER] CLEAR app=$packageName")
        }
        
        /**
         * Set wake suppression for an app
         * 
         * Called by JavaScript via AppMonitorModule when JavaScript makes a semantic
         * decision to suppress system-level UI (e.g., intention timer granted).
         * 
         * Native receives a mechanical instruction: "Don't wake before this timestamp"
         * Native has NO knowledge of WHY suppression exists.
         * 
         * @param packageName Package name
         * @param suppressUntil Timestamp - don't launch SystemSurface before this time
         */
        @JvmStatic
        fun setSuppressWakeUntil(packageName: String, suppressUntil: Long) {
            suppressWakeUntil[packageName] = suppressUntil
        }
        
        /**
         * Check if wake is suppressed for an app
         * 
         * Returns true if SystemSurface wake should be suppressed.
         * Automatically cleans up expired suppressions.
         * 
         * @param packageName Package name to check
         * @return true if wake should be suppressed
         */
        @JvmStatic
        fun isWakeSuppressed(packageName: String): Boolean {
            val suppressUntil = suppressWakeUntil[packageName] ?: return false
            val now = System.currentTimeMillis()
            
            if (now < suppressUntil) {
                return true
            } else {
                // Suppression expired - automatically clean up
                suppressWakeUntil.remove(packageName)
                return false
            }
        }
        
        /**
         * Check if there's a valid Quick Task timer for the given app.
         * 
         * @param packageName Package name to check
         * @return true if valid timer exists (not expired), false otherwise
         */
        @JvmStatic
        fun hasValidQuickTaskTimer(packageName: String): Boolean {
            val expiresAt = quickTaskTimers[packageName] ?: return false
            val now = System.currentTimeMillis()
            val isValid = now < expiresAt
            
            if (!isValid) {
                // Clean up expired timer
                quickTaskTimers.remove(packageName)
            }
            
            return isValid
        }
        
        /**
         * Dynamic list of monitored apps (synced from React Native).
         * Used to check if an app should trigger intervention.
         */
        private var dynamicMonitoredApps = mutableSetOf<String>()
        
        /**
         * Update the dynamic monitored apps list.
         * Called from AppMonitorModule when user changes monitored apps in Settings.
         */
        @JvmStatic
        fun updateMonitoredApps(apps: Set<String>) {
            dynamicMonitoredApps.clear()
            dynamicMonitoredApps.addAll(apps)
        }
        
        /**
         * Update cached Quick Task quota
         * 
         * PHASE 4.1: Entry decision authority
         * 
         * Called by JS when quota changes (user settings, usage, etc.)
         * Native caches this value for runtime entry decisions
         * 
         * @param quota Current global Quick Task quota (n_quickTask)
         */
        @JvmStatic
        fun updateQuickTaskQuota(quota: Int) {
            cachedQuickTaskQuota = quota
        }
        
        /**
         * Set SystemSurface active state
         * 
         * PHASE 4.1: Lifecycle guard for entry decisions
         * 
         * Called by JS when SystemSurface launches or finishes
         * Prevents duplicate entry decisions while UI is showing
         * 
         * @param active true if SystemSurface is active, false if finished
         */
        @JvmStatic
        fun setSystemSurfaceActive(active: Boolean) {
            isSystemSurfaceActive = active
            if (active) {
                systemSurfaceActiveTimestamp = System.currentTimeMillis()
            } else {
                systemSurfaceActiveTimestamp = 0
                lastDecisionApp = null  // Reset on surface close
            }
        }
        
        // ============================================================================
        // PHASE 4.2: State Machine Persistence (Crash Recovery)
        // ============================================================================
        
        /**
         * Persist single entry to SharedPreferences (crash recovery backup)
         * Called after each state transition
         */
        private fun persistState(entry: QuickTaskEntry, context: android.content.Context) {
            val prefs = context.getSharedPreferences(PREFS_QUICK_TASK_STATE, android.content.Context.MODE_PRIVATE)
            val json = org.json.JSONObject().apply {
                put("app", entry.app)
                put("state", entry.state.name)
                if (entry.expiresAt != null) {
                    put("expiresAt", entry.expiresAt)
                }
            }
            prefs.edit().putString(entry.app, json.toString()).apply()
        }
        
        /**
         * Clear persisted state for app
         */
        private fun clearPersistedState(app: String, context: android.content.Context) {
            val prefs = context.getSharedPreferences(PREFS_QUICK_TASK_STATE, android.content.Context.MODE_PRIVATE)
            prefs.edit().remove(app).apply()
        }
        
        /**
         * Restore from disk (crash recovery)
         * Called on service start
         * 
         * CRITICAL: This must be called early in service lifecycle
         */
        @JvmStatic
        fun restoreFromDisk(context: android.content.Context) {
            val prefs = context.getSharedPreferences(PREFS_QUICK_TASK_STATE, android.content.Context.MODE_PRIVATE)
            val now = System.currentTimeMillis()
            
            prefs.all.forEach { (app, value) ->
                try {
                    val json = org.json.JSONObject(value as String)
                    val state = QuickTaskState.valueOf(json.getString("state"))
                    val expiresAt = if (json.has("expiresAt")) json.getLong("expiresAt") else null
                    
                    // Only restore ACTIVE entries with valid expiration
                    if (state == QuickTaskState.ACTIVE && expiresAt != null && expiresAt > now) {
                        val entry = QuickTaskEntry(app, state, expiresAt)
                        quickTaskMap[app] = entry
                        restartTimer(app, expiresAt)
                    } else {
                        // Stale or non-ACTIVE state, clear it
                        clearPersistedState(app, context)
                    }
                } catch (e: Exception) {
                    clearPersistedState(app, context)
                }
            }
        }
        
        /**
         * Restart timer after crash recovery
         * Uses same expiration logic as normal timer start
         */
        private fun restartTimer(app: String, expiresAt: Long) {
            val delay = expiresAt - System.currentTimeMillis()
            if (delay > 0) {
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    onQuickTaskTimerExpired(app)
                }, delay)
            } else {
                // Already expired, handle immediately
                onQuickTaskTimerExpired(app)
            }
        }
        
        // ============================================================================
        // PHASE 4.2: User Intent Handlers (SKELETON FUNCTIONS)
        // ============================================================================
        
        /**
         * User accepted Quick Task
         * SKELETON FUNCTION - Do NOT modify signature
         */
        @JvmStatic
        fun onQuickTaskAccepted(app: String, durationMs: Long, context: android.content.Context) {
            val entry = quickTaskMap[app] ?: return

            entry.state = QuickTaskState.ACTIVE
            entry.expiresAt = System.currentTimeMillis() + durationMs
            val expiresAtTime = entry.expiresAt!!

            decrementGlobalQuota(context)
            persistState(entry, context)

            startNativeTimer(app, expiresAtTime)
            emitStartQuickTaskActive(app, context)
            
            Log.i(TAG, "[QT][STATE] app=$app DECISION → ACTIVE")
            val expiresAtFormatted = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date(expiresAtTime))
            Log.i(TAG, "[QT][TIMER] START app=$app expiresAt=$expiresAtFormatted")
        }

        /**
         * User declined Quick Task
         * SKELETON FUNCTION - Do NOT modify signature
         */
        @JvmStatic
        fun onQuickTaskDeclined(app: String, context: android.content.Context) {
            quickTaskMap.remove(app)
            clearPersistedState(app, context)
            emitFinishSystemSurface(context)
            
            Log.i(TAG, "[QT][STATE] app=$app DECISION → IDLE")
        }

        /**
         * User chose to continue after POST_CHOICE
         * SKELETON FUNCTION - Do NOT modify signature
         */
        @JvmStatic
        fun onPostChoiceContinue(app: String, context: android.content.Context) {
            quickTaskMap.remove(app)
            clearPersistedState(app, context)

            if (cachedQuickTaskQuota > 0) {
                quickTaskMap[app] = QuickTaskEntry(app, QuickTaskState.DECISION)
                persistState(quickTaskMap[app]!!, context)
                emitShowQuickTaskDialog(app, context)
                Log.i(TAG, "[QT][STATE] app=$app POST_CHOICE → DECISION")
            } else {
                emitNoQuickTaskAvailable(app, context)
                Log.i(TAG, "[QT][STATE] app=$app POST_CHOICE → IDLE")
            }
        }

        /**
         * User chose to quit after POST_CHOICE
         * SKELETON FUNCTION - Do NOT modify signature
         */
        @JvmStatic
        fun onPostChoiceQuit(app: String, context: android.content.Context) {
            quickTaskMap.remove(app)
            clearPersistedState(app, context)
            emitFinishSystemSurface(context)
            
            Log.i(TAG, "[QT][STATE] app=$app POST_CHOICE → IDLE")
        }

        /**
         * Decrement global quota atomically
         * Native owns quota decrement (Phase 4.2 Decision 4)
         */
        private fun decrementGlobalQuota(context: android.content.Context) {
            if (cachedQuickTaskQuota > 0) {
                cachedQuickTaskQuota--
                emitQuotaUpdate(cachedQuickTaskQuota, context)
            }
        }
        
        // ============================================================================
        // PHASE 4.2: Timer Management (SKELETON FUNCTIONS)
        // ============================================================================
        
        /**
         * Start native timer
         * Called when transitioning to ACTIVE
         */
        private fun startNativeTimer(app: String, expiresAt: Long) {
            val delay = expiresAt - System.currentTimeMillis()
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                onQuickTaskTimerExpired(app)
            }, delay)
        }

        /**
         * Timer expiration handler
         * SKELETON FUNCTION - Do NOT modify logic
         * 
         * Key guarantees:
         * - JS never decides expiration behavior
         * - Foreground truth is native-only
         * - Background expiration is silent
         */
        @JvmStatic
        fun onQuickTaskTimerExpired(app: String) {
            val entry = quickTaskMap[app] ?: return

            // Verify state is ACTIVE (guard against stale timers)
            if (entry.state != QuickTaskState.ACTIVE) {
                return
            }

            // Native tracks foreground independently (Phase 4.2 Decision 3)
            val isForeground = isAppForeground(app)

            if (isForeground) {
                // App is foreground → show POST_CHOICE
                entry.state = QuickTaskState.POST_CHOICE
                entry.expiresAt = null
                entry.postChoiceShown = false  // Reset guard for new POST_CHOICE
                
                // Need context for persistence - get from service instance
                // This will be called from service context
                val context = AppMonitorService.getReactContext()?.applicationContext
                if (context != null) {
                    persistState(entry, context)
                    emitShowPostQuickTaskChoice(app, context)
                }
                
                Log.i(TAG, "[QT][TIMER] EXPIRE app=$app foreground=true")
                Log.i(TAG, "[QT][STATE] app=$app ACTIVE → POST_CHOICE")
            } else {
                // App is background → silent cleanup
                quickTaskMap.remove(app)
                
                val context = AppMonitorService.getReactContext()?.applicationContext
                if (context != null) {
                    clearPersistedState(app, context)
                }
                
                Log.i(TAG, "[QT][TIMER] EXPIRE app=$app foreground=false")
                Log.i(TAG, "[QT][STATE] app=$app ACTIVE → IDLE")
            }
        }

        /**
         * Check if app is currently in foreground
         * Native tracks this independently (no JS dependency)
         */
        private fun isAppForeground(app: String): Boolean {
            return currentForegroundApp == app
        }
        
        /**
         * Update current foreground app
         * Called by service instance when foreground changes
         */
        @JvmStatic
        fun updateCurrentForegroundApp(app: String?) {
            currentForegroundApp = app
        }
        
        // ============================================================================
        // PHASE 4.2: Command Emission Methods
        // ============================================================================
        
        /**
         * Emit: Show Quick Task dialog
         */
        private fun emitShowQuickTaskDialog(app: String, context: android.content.Context) {
            emitQuickTaskCommand("SHOW_QUICK_TASK_DIALOG", app, context)
        }

        /**
         * Emit: Start Quick Task ACTIVE phase
         */
        private fun emitStartQuickTaskActive(app: String, context: android.content.Context) {
            emitQuickTaskCommand("START_QUICK_TASK_ACTIVE", app, context)
        }

        /**
         * Emit: Show POST_CHOICE screen
         */
        private fun emitShowPostQuickTaskChoice(app: String, context: android.content.Context) {
            emitQuickTaskCommand("SHOW_POST_QUICK_TASK_CHOICE", app, context)
        }

        /**
         * Emit: Finish SystemSurface
         */
        private fun emitFinishSystemSurface(context: android.content.Context) {
            emitQuickTaskCommand("FINISH_SYSTEM_SURFACE", "", context)
        }

        /**
         * Emit: No Quick Task available (quota exhausted)
         */
        private fun emitNoQuickTaskAvailable(app: String, context: android.content.Context) {
            emitQuickTaskCommand("NO_QUICK_TASK_AVAILABLE", app, context)
        }

        /**
         * Base command emitter
         */
        private fun emitQuickTaskCommand(command: String, app: String, context: android.content.Context) {
            val reactContext = AppMonitorService.getReactContext()
            if (reactContext == null || !reactContext.hasActiveReactInstance()) {
                return
            }
            
            val params = com.facebook.react.bridge.Arguments.createMap().apply {
                putString("command", command)
                putString("app", app)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            
            reactContext
                .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("QUICK_TASK_COMMAND", params)
        }

        /**
         * Emit quota update to JS
         * Native decrements, JS displays (Phase 4.2 Decision 4)
         */
        private fun emitQuotaUpdate(newQuota: Int, context: android.content.Context) {
            val reactContext = AppMonitorService.getReactContext()
            if (reactContext == null || !reactContext.hasActiveReactInstance()) {
                return
            }
            
            val params = com.facebook.react.bridge.Arguments.createMap().apply {
                putInt("quota", newQuota)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            
            reactContext
                .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("QUICK_TASK_QUOTA_UPDATE", params)
        }
        
        // ============================================================================
        // PHASE 4.2: Entry Decision (SKELETON FUNCTION)
        // ============================================================================
        
        /**
         * Entry decision for monitored app foreground
         * SKELETON FUNCTION - Phase 4.1 + 4.2 compatible
         * 
         * Important:
         * - No JS state consulted
         * - No lastDecisionApp
         * - No suppression
         * - Every foreground entry is a decision
         */
        @JvmStatic
        fun onMonitoredAppForeground(app: String, context: android.content.Context) {
            val entry = quickTaskMap[app]
            val hasTimer = entry?.state == QuickTaskState.ACTIVE

            when (entry?.state) {
                QuickTaskState.ACTIVE -> {
                    // ACTIVE phase persists, no entry dialog
                    return
                }
                QuickTaskState.POST_CHOICE -> {
                    // POST_CHOICE one-shot: only emit UI once per expiration
                    if (!entry.postChoiceShown) {
                        entry.postChoiceShown = true  // Mark as shown
                        persistState(entry, context)   // Persist the flag
                        emitShowPostQuickTaskChoice(app, context)
                    }
                    return
                }
                else -> {
                    // IDLE or DECISION or null → make entry decision
                    if (cachedQuickTaskQuota > 0) {
                        quickTaskMap[app] = QuickTaskEntry(app, QuickTaskState.DECISION)
                        persistState(quickTaskMap[app]!!, context)
                        emitShowQuickTaskDialog(app, context)
                        Log.i(TAG, "[QT][ENTRY] app=$app quota=$cachedQuickTaskQuota hasTimer=$hasTimer → DECISION=SHOW_QUICK_TASK")
                    } else {
                        emitNoQuickTaskAvailable(app, context)
                        Log.i(TAG, "[QT][ENTRY] app=$app quota=0 hasTimer=$hasTimer → DECISION=NO_QUICK_TASK")
                    }
                }
            }
        }
    }

    /**
     * Last detected foreground package name
     * Used to avoid duplicate logging of the same app
     */
    private var lastPackageName: String? = null
    
    /**
     * Handler for periodic timer expiration checks
     */
    private val handler = Handler(Looper.getMainLooper())
    
    /**
     * Flag to prevent duplicate timer check starts
     */
    private var timerCheckStarted = false
    
    /**
     * Runnable for checking timer expirations periodically
     * 
     * Checks:
     * - Wake suppression expirations (mechanical flag set by JavaScript)
     * - Quick Task timer expirations (mechanical timer)
     * 
     * Both are MECHANICAL checks - native detects expiration, JavaScript decides semantics.
     */
    private val timerCheckRunnable = object : Runnable {
        private var runCount = 0
        
        override fun run() {
            runCount++
            
            checkWakeSuppressionExpirations()  // Check wake suppression flags
            checkQuickTaskTimerExpirations()   // Check Quick Task timers
            
            // Schedule next check in 1 second for accurate expiration detection
            handler.postDelayed(this, 1000)
        }
    }

    /**
     * Start timer check mechanism if not already started.
     * 
     * Defensive initialization with guards:
     * - Prevents duplicate starts
     * - Checks handler initialization
     * - Logs failures loudly
     * 
     * Called from multiple entry points for reliability:
     * - onCreate() (defensive backup)
     * - onServiceConnected() (primary)
     */
    private fun startTimerCheckIfNeeded() {
        synchronized(this) {
            if (timerCheckStarted) {
                return
            }
            
            try {
                handler.post(timerCheckRunnable)
                timerCheckStarted = true
            } catch (e: Exception) {
                // Silent failure - timer check will retry on next service connection
            }
        }
    }
    
    /**
     * Called when service is created
     * Defensive timer check start as backup
     */
    override fun onCreate() {
        super.onCreate()
        
        // Defensive timer check start (backup initialization point)
        startTimerCheckIfNeeded()
    }
    
    /**
     * Called when the service is connected and ready
     * This happens when user enables the service in Settings
     */
    override fun onServiceConnected() {
        super.onServiceConnected()
        
        isServiceConnected = true
        
        // PHASE 4.2: Restore Quick Task state from disk (crash recovery)
        // CRITICAL: This must be called early in service lifecycle
        restoreFromDisk(applicationContext)
        
        // Configure the service to receive window state changes AND user interaction events
        val info = AccessibilityServiceInfo().apply {
            // Event types: Window state changes + user interactions
            // CRITICAL: Must include interaction events for Quick Task enforcement
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                        AccessibilityEvent.TYPE_VIEW_SCROLLED or
                        AccessibilityEvent.TYPE_VIEW_CLICKED or
                        AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
            
            // Flags: MUST include FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
            // Without this flag, Instagram/TikTok/YouTube scroll events will NOT be delivered
            flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
                   AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
            
            // Receive events from all packages
            packageNames = null
            
            // No delay - we want real-time detection
            notificationTimeout = 0
            
            // Low feedback type since we're just monitoring
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
        }
        
        serviceInfo = info
        
        // Start periodic timer expiration checks (primary initialization point)
        startTimerCheckIfNeeded()
    }

    /**
     * Called when accessibility events occur
     * This is where we detect foreground app changes
     * 
     * PHASE F3.5 BEHAVIOR:
     * - Detects when a MONITORED app comes to foreground
     * - Launches SystemSurfaceActivity (NOT MainActivity)
     * - Passes triggering app package name via Intent extra
     * - Native code decides WHEN to wake app
     * - JS (OS Trigger Brain) decides IF and HOW to intervene
     * 
     * Native layer responsibility:
     * - Detect raw OS-level foreground changes
     * - Suppress duplicate consecutive events (same package repeatedly)
     * - Check if package is in monitored list
     * - Launch SystemSurfaceActivity if monitored app detected
     * 
     * JavaScript responsibility:
     * - Evaluate if intervention should occur (Quick Task window, etc.)
     * - Decide which intervention flow to show
     * - Manage intervention state machine
     * - Navigate through intervention screens
     * - Determine when to exit intervention
     * 
     * @param event The accessibility event containing app switch information
     */
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        
        val packageName = event.packageName?.toString()
        if (packageName.isNullOrEmpty()) return
        
        // Handle user interaction events (for expired Quick Task enforcement)
        // Native emits these events UNCONDITIONALLY - System Brain decides what to do
        val isInteractionEvent = when (event.eventType) {
            AccessibilityEvent.TYPE_VIEW_SCROLLED,
            AccessibilityEvent.TYPE_VIEW_CLICKED,
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> true
            else -> false
        }
        
        if (isInteractionEvent && packageName == lastPackageName) {
            // Emit USER_INTERACTION_FOREGROUND for ALL interaction events
            // ❌ DO NOT check expiredQuickTasks (semantic state)
            // ❌ DO NOT decide whether enforcement is needed
            // ✅ Emit mechanical event unconditionally - System Brain decides
            emitSystemEvent("USER_INTERACTION_FOREGROUND", packageName, System.currentTimeMillis())
            return  // Don't process as foreground change
        }
        
        // Handle window state changes (app switches)
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            return
        }
        
        // Update last detected package
        lastPackageName = packageName
        
        // Emit app discovery event for AppDiscoveryModule
        // This allows JavaScript to discover apps as they're opened
        emitAppDiscoveryEvent(packageName)
        
        // PHASE 4.2: Update foreground app for timer expiration checks
        updateCurrentForegroundApp(packageName)
        
        // Emit event to JavaScript for ALL apps (including launchers)
        // This allows JavaScript to track exits and cancel incomplete interventions
        emitForegroundAppChangedEvent(packageName)
        
        // Emit FOREGROUND_CHANGED to System Brain (for lastMeaningfulApp tracking)
        // This MUST happen for ALL apps BEFORE launching SystemSurface
        // so that System Brain knows the current foreground app when making decisions
        emitSystemEvent("FOREGROUND_CHANGED", packageName, System.currentTimeMillis())
        
        // Check if this is a monitored app (for launching intervention)
        // Use dynamicMonitoredApps (synced from JavaScript) instead of hardcoded MONITORED_APPS
        if (dynamicMonitoredApps.contains(packageName)) {
            // PHASE 4.2: Call skeleton entry decision function
            onMonitoredAppForeground(packageName, applicationContext)
        }
    }
    
    /**
     * Emit foreground app changed event to JavaScript.
     * Called for ALL apps (including launchers) so JavaScript can track exits.
     * 
     * This allows JavaScript to:
     * - Detect when user switches to home screen
     * - Record exit timestamps for all apps
     * - Cancel incomplete interventions when user switches away
     * 
     * @param packageName Package name of the foreground app
     */
    private fun emitForegroundAppChangedEvent(packageName: String) {
        try {
            val reactContext = AppMonitorService.getReactContext()
            if (reactContext == null) {
                return
            }
            
            val params = Arguments.createMap().apply {
                putString("packageName", packageName)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onForegroundAppChanged", params)
        } catch (e: Exception) {
            // Silent failure - event emission is best-effort
        }
    }
    
    /**
     * Emit app discovery event for AppDiscoveryModule
     * 
     * Called when TYPE_WINDOW_STATE_CHANGED is detected.
     * Allows JavaScript to discover apps as they're opened (accessibility source).
     * 
     * @param packageName Package name of the discovered app
     */
    private fun emitAppDiscoveryEvent(packageName: String) {
        try {
            val reactContext = AppMonitorService.getReactContext()
            if (reactContext == null) {
                return
            }
            
            val params = Arguments.createMap().apply {
                putString("packageName", packageName)
                putString("source", "accessibility")
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onAppDiscovered", params)
        } catch (e: Exception) {
            // Silent failure - event emission is best-effort
        }
    }
    
    /**
     * Emit Quick Task entry decision event to System Brain
     * 
     * PHASE 4.1: Entry decision authority
     * 
     * Native has decided whether Quick Task is available for this app entry.
     * System Brain will execute this decision as a COMMAND (no re-evaluation).
     * 
     * @param packageName App package name
     * @param decision "SHOW_QUICK_TASK_DIALOG" or "NO_QUICK_TASK_AVAILABLE"
     */
    private fun emitQuickTaskDecisionEvent(packageName: String, decision: String) {
        val reactContext = AppMonitorService.getReactContext()
        if (reactContext != null && reactContext.hasActiveReactInstance()) {
            try {
                val params = Arguments.createMap().apply {
                    putString("packageName", packageName)
                    putString("decision", decision)
                    putDouble("timestamp", System.currentTimeMillis().toDouble())
                }
                
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("QUICK_TASK_DECISION", params)
            } catch (e: Exception) {
                // Silent failure - event emission is best-effort
            }
        }
    }
    
    /**
     * NOTE: hasValidIntentionTimer() has been REMOVED.
     * 
     * SEMANTIC OWNERSHIP:
     * - JavaScript is the ONLY authority for t_intention
     * - Native MUST NOT check, evaluate, or suppress based on t_intention
     * - Native provides mechanical wake service only
     * 
     * This respects the architectural boundary:
     * - Native decides WHEN to wake (mechanics)
     * - JavaScript decides WHAT to show and WHY (semantics)
     */
    
    /**
     * Launch SystemSurfaceActivity to show intervention UI
     * 
     * INTENT FLAGS EXPLAINED:
     * 
     * FLAG_ACTIVITY_NEW_TASK:
     * - Required when starting activity from a Service (not an Activity context)
     * - Creates activity in a new task (required for non-activity contexts)
     * 
     * FLAG_ACTIVITY_CLEAR_TOP:
     * - If SystemSurfaceActivity already exists, brings it to front
     * - Clears any activities above it in the stack
     * - Combined with singleInstance launchMode, ensures clean state
     * 
     * FLAG_ACTIVITY_SINGLE_TOP:
     * - If activity is already at top of stack, reuses existing instance
     * - Calls onNewIntent() instead of creating new instance
     * - Prevents duplicate intervention screens
     * 
     * Together these flags ensure:
     * - Clean wake from killed state
     * - No duplicate intervention screens
     * - Proper isolation from MainActivity
     * - User sees ONLY intervention UI, not main app
     * 
     * WAKE SUPPRESSION:
     * - JavaScript sets mechanical flag: "don't wake before timestamp X"
     * - Native reads flag and suppresses wake
     * - Native has ZERO semantic knowledge (doesn't know about intention timers)
     * 
     * @param triggeringApp Package name of the app that triggered intervention
     */
    private fun launchInterventionActivity(triggeringApp: String) {
        // HIGHEST PRIORITY: Check wake suppression flag
        // JavaScript sets this to say: "Don't wake before this time"
        // Native doesn't know WHY (intention timer, etc.) - just that wake is suppressed
        if (isWakeSuppressed(triggeringApp)) {
            return
        }
        
        // Check Quick Task timer
        if (hasValidQuickTaskTimer(triggeringApp)) {
            return
        }
        
        try {
            val intent = Intent(this, SystemSurfaceActivity::class.java).apply {
                // Pass the triggering app to JS
                putExtra(SystemSurfaceActivity.EXTRA_TRIGGERING_APP, triggeringApp)
                
                // Set wake reason - this tells JS to run normal priority chain
                putExtra(SystemSurfaceActivity.EXTRA_WAKE_REASON, SystemSurfaceActivity.WAKE_REASON_MONITORED_APP)
                
                // Required flags for launching from Service context
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT) // Ensure SystemSurfaceActivity appears on top
                addFlags(Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT) // Force activity to foreground
            }
            
            startActivity(intent)
        } catch (e: Exception) {
            // Silent failure - activity launch is best-effort
        }
    }

    /**
     * Called when accessibility service is interrupted
     * This is rare but can happen during system updates or reconfigurations
     */
    override fun onInterrupt() {
        // Silent - service interruption is handled automatically
    }

    /**
     * Called when the service is disconnected
     * This happens when user disables the service in Settings
     */
    
    /**
     * Check if any wake suppressions have expired
     * 
     * MECHANICAL EXPIRATION DETECTION:
     * - Checks all suppression flags periodically
     * - If expired AND app is foreground: Launch SystemSurface
     * - If expired AND app is background: Just clean up
     * 
     * Native provides mechanical detection, JavaScript makes semantic decisions.
     * 
     * This runs every 1 second to catch expirations even when no foreground
     * events occur (user stays in same app continuously).
     * 
     * CRITICAL: Only launches SystemSurface if expired app is CURRENT foreground app.
     * This ensures intervention only triggers when user is actively using the app.
     */
    private fun checkWakeSuppressionExpirations() {
        try {
            val now = System.currentTimeMillis()
            val currentForegroundApp = lastPackageName
            val expiredApps = mutableListOf<String>()
            
            // Find all expired suppressions
            for ((packageName, suppressUntil) in suppressWakeUntil) {
                if (now >= suppressUntil) {
                    expiredApps.add(packageName)
                }
            }
            
            // Process expired suppressions
            for (packageName in expiredApps) {
                // Remove from map
                suppressWakeUntil.remove(packageName)
                
                // CRITICAL: Only launch SystemSurface if this is the CURRENT foreground app
                // This ensures intervention only triggers when user is actively using the app
                val isForeground = packageName == currentForegroundApp
                
                if (isForeground) {
                    launchInterventionActivity(packageName)
                }
            }
            
        } catch (e: Exception) {
            // Silent failure - expiration check will retry on next cycle
        }
    }
    
    /**
     * Check if any Quick Task timers have expired (SILENT cleanup).
     * 
     * IMPORTANT: Expiration is SILENT - no UI shown, no activity launched.
     * Expired timers are simply removed from memory.
     * Normal intervention rules resume on next app trigger.
     * 
     * Called periodically (every 1 second) to detect and clean up expired timers.
     */
    /**
     * Emit mechanical system event to System Brain JS.
     * 
     * MECHANICAL ONLY: Native reports what happened, not what it means.
     * System Brain JS classifies semantic meaning.
     * 
     * Uses Intent to start SystemBrainService (HeadlessTaskService).
     * This is the proper way to invoke headless tasks from a Service context.
     * 
     * @param eventType - Mechanical event type ("TIMER_SET", "TIMER_EXPIRED", "FOREGROUND_CHANGED")
     * @param packageName - Package name of the app
     * @param timestamp - Timestamp of the event
     * @param expiresAt - Expiration timestamp (only for TIMER_SET events)
     */
    private fun emitSystemEvent(
        eventType: String, 
        packageName: String, 
        timestamp: Long,
        expiresAt: Long? = null
    ) {
        try {
            val intent = Intent(this, SystemBrainService::class.java).apply {
                putExtra(SystemBrainService.EXTRA_EVENT_TYPE, eventType)
                putExtra(SystemBrainService.EXTRA_PACKAGE_NAME, packageName)
                putExtra(SystemBrainService.EXTRA_TIMESTAMP, timestamp)
                if (expiresAt != null) {
                    putExtra(SystemBrainService.EXTRA_EXPIRES_AT, expiresAt)
                }
            }
            
            // Start the HeadlessTaskService
            // This will invoke System Brain JS headless task
            startService(intent)
            
        } catch (e: Exception) {
            // Silent failure - event emission is best-effort
        }
    }
    
    private fun checkQuickTaskTimerExpirations() {
        try {
            val now = System.currentTimeMillis()
            val expiredApps = mutableListOf<String>()
            
            // Find all expired timers
            for ((packageName, expiresAt) in quickTaskTimers) {
                val remainingMs = expiresAt - now
                if (remainingMs <= 0) {
                    expiredApps.add(packageName)
                }
            }
            
            // Process expired timers - emit MECHANICAL events (no semantic labels)
            for (packageName in expiredApps) {
                // Remove from map
                quickTaskTimers.remove(packageName)
                
                // Emit MECHANICAL event to System Brain JS
                emitSystemEvent("TIMER_EXPIRED", packageName, now)
            }
            
        } catch (e: Exception) {
            // Silent failure - expiration check will retry on next cycle
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        isServiceConnected = false
        lastPackageName = null
        
        // Stop periodic timer checks
        handler.removeCallbacks(timerCheckRunnable)
    }

    /**
     * Called when service is unbound
     * Clean up any resources here
     */
    override fun onUnbind(intent: android.content.Intent?): Boolean {
        isServiceConnected = false
        return super.onUnbind(intent)
    }
}
