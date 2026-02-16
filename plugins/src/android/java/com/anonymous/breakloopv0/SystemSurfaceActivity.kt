package com.anonymous.breakloopv0

import android.app.Application
import android.content.Context
import android.content.Intent
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.WindowManager
import com.facebook.react.ReactApplication
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.anonymous.breakloopv0.BuildConfig
import expo.modules.ReactActivityDelegateWrapper

/**
 * SystemSurfaceActivity - OS-Level System Surface
 * 
 * CONCEPTUAL ROLE (IMPORTANT):
 * This activity is conceptually a neutral "System Surface" that hosts OS-level UI.
 * It is NOT exclusively for interventions - it hosts MULTIPLE independent flows:
 * 
 * 1. Quick Task Flow (Emergency bypass)
 * 2. Intervention Flow (Conscious process)
 * 
 * The activity itself is INFRASTRUCTURE, not semantics.
 * JavaScript (OS Trigger Brain) decides which flow to render inside this surface.
 * 
 * For full architecture, see: docs/SYSTEM_SURFACE_ARCHITECTURE.md
 * 
 * WHY A DEDICATED ACTIVITY?
 * - Appears on top of other apps with full-screen takeover
 * - Allows the app to wake from killed state directly into OS-level UI
 * - Clean separation: MainActivity = main app UI, SystemSurfaceActivity = OS-level UI
 * - Prevents user from accidentally seeing tabs/settings during interruption
 * 
 * KEY ARCHITECTURAL CHOICES:
 * 
 * 1. launchMode = "singleTask"
 *    - Ensures only one instance of SystemSurfaceActivity exists
 *    - If already running, brings existing instance to foreground instead of creating new one
 *    - Prevents stacking multiple intervention screens
 * 
 * 2. excludeFromRecents = true
 *    - Hides this activity from Android's recent apps list
 *    - Users don't see "SystemSurface" as a separate app task
 *    - Reinforces that this is a temporary interruption, not a standalone app
 * 
 * 3. taskAffinity = "" (empty)
 *    - Separates system surface task from main app task
 *    - Prevents system surface from being grouped with MainActivity in task switcher
 *    - Allows system surface to close cleanly without affecting main app state
 * 
 * 4. Theme.Intervention (transparent/minimal)
 *    - No splash screen or loading UI flash
 *    - Immediately shows React Native content once ready
 *    - Provides smooth, non-disruptive entrance
 * 
 * HOW JS REMAINS THE DECISION AUTHORITY:
 * - Native code ONLY decides WHEN to wake the app (monitored app detected)
 * - Native code launches SystemSurfaceActivity with triggering app info
 * - React Native boots and OS Trigger Brain runs as usual
 * - JS decides: Should intervention start? Which screen? What flow?
 * - JS dispatches BEGIN_INTERVENTION and drives the state machine
 * - Native code has ZERO intervention business logic
 * 
 * LIFECYCLE:
 * - Launched by ForegroundDetectionService when monitored app detected
 * - React Native initializes and renders intervention flow
 * - User completes intervention or dismisses
 * - Activity finishes and user returns to previously opened app
 * - Does NOT leave main app open in background
 * 
 * PHASE F3.5 SCOPE:
 * - Activity creation and configuration
 * - Launch from AccessibilityService
 * - React Native integration (same runtime, intervention-only rendering)
 * - Does NOT include overlay windows or system alert permissions yet
 */
class SystemSurfaceActivity : ReactActivity() {

    private var audioManager: AudioManager? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    
    // Lifecycle Tracking
    private var currentSessionId: String? = null
    private var currentWakeReason: String? = null  // PR1: Stable wakeReason tracking
    private var currentApp: String? = null         // PR1: Stable app tracking
    private var finishReason: String = "ACTIVITY_DESTROYED" // Default reason
    private var isClosing: Boolean = false // M4 Hardening: Loop prevention

    companion object {
        private const val TAG = "SystemSurfaceActivity"
        
        /**
         * Intent extra key for the package name that triggered the intervention
         * Used by JS to identify which monitored app was detected
         */
        const val EXTRA_TRIGGERING_APP = "triggeringApp"
        
        /**
         * Intent extra key for WAKE REASON.
         * 
         * This is the CRITICAL mechanism for semantic separation.
         * Native code sets WHY the System Surface is being launched.
         * JavaScript reads this to decide WHAT to do.
         * 
         * Possible values:
         * - "MONITORED_APP_FOREGROUND" - Normal monitored app detected, run priority chain
         * - "INTENTION_EXPIRED" - Intention timer expired while app in foreground
         * - "DEV_DEBUG" - Developer-triggered wake for testing
         * 
         * REMOVED: "QUICK_TASK_EXPIRED" - Quick Task expiration is now silent (no UI)
         * 
         * IMPORTANT: JavaScript MUST check this FIRST before running any logic.
         */
        const val EXTRA_WAKE_REASON = "wakeReason"
        const val EXTRA_SESSION_ID = "sessionId"
        const val EXTRA_RESUME_MODE = "resumeMode"
        
        // Canonical Wake Reason Values (Native → JS Contract)
        const val WAKE_REASON_SHOW_QUICK_TASK = "SHOW_QUICK_TASK"
        const val WAKE_REASON_SHOW_INTERVENTION = "SHOW_INTERVENTION"
        const val WAKE_REASON_SHOW_POST_QUICK_TASK_CHOICE = "SHOW_POST_QUICK_TASK_CHOICE"
        
        // Legacy wake reasons (backward compatibility)
        const val WAKE_REASON_MONITORED_APP = "MONITORED_APP_FOREGROUND"
        const val WAKE_REASON_INTENTION_EXPIRED = "INTENTION_EXPIRED"
        const val WAKE_REASON_QUICK_TASK_EXPIRED = "QUICK_TASK_EXPIRED_FOREGROUND"
    }

    private var uiMounted = false
    private val LOG_TAG_LIFE = "SS_LIFE"

    override fun onCreate(savedInstanceState: Bundle?) {
        val triggeringApp = intent?.getStringExtra(EXTRA_TRIGGERING_APP)
        val wakeReason = intent?.getStringExtra(EXTRA_WAKE_REASON)
        val sessionId = intent?.getStringExtra(EXTRA_SESSION_ID)
        val instanceId = System.identityHashCode(this)
        
        NativeBuildCanary.logBuildInfo()
        
        // INTENT LOGGING (Critical for debugging wake reason routing)
        Log.e("INTENT", "[INTENT] wakeReason=$wakeReason app=$triggeringApp sessionId=$sessionId instanceId=$instanceId")
        
        // SS_BUILD Fingerprint in Activity
        val procName = if (android.os.Build.VERSION.SDK_INT >= 28) Application.getProcessName() else "unknown"
        val fingerprint = "[ACTIVITY_START] debug=${BuildConfig.DEBUG} proc=$procName pid=${android.os.Process.myPid()} thread=${Thread.currentThread().name}"
        Log.e(LogTags.SS_BUILD, fingerprint)

        val debugInfo = "isDebug=${BuildConfig.DEBUG} pid=${android.os.Process.myPid()} taskId=$taskId"
        Log.e(LogTags.SS_BOOT, "[onCreate] instanceId=$instanceId wakeReason=$wakeReason app=$triggeringApp $debugInfo")
        Log.e(LogTags.SS_CANARY, "[LIFE] onCreate instanceId=$instanceId app=$triggeringApp taskId=$taskId")
        Log.d(LOG_TAG_LIFE, "[onCreate] instanceId=$instanceId wakeReason=$wakeReason app=$triggeringApp taskId=$taskId")


        Log.i(TAG, "🎯 SystemSurfaceActivity created")
        
        // PR1: Store fields for stable access in onDestroy (avoid stale intent)
        currentSessionId = sessionId
        currentWakeReason = wakeReason
        currentApp = triggeringApp
        
        // Register with Manager
        SystemSurfaceManager.register(this, sessionId)
        
        // Signal native service that surface is now active (Lifecycle Gate)
        ForegroundDetectionService.onSystemSurfaceOpened(triggeringApp, sessionId, instanceId)
        
        // Log the triggering app if provided
        triggeringApp?.let {
            Log.i(TAG, "  └─ Triggered by: $it")
        }
        
        super.onCreate(savedInstanceState)
        
        // UI Mounted - Right after super.onCreate where React root view is initialized
        uiMounted = true
        Log.e(LogTags.SS_BOOT, "UI_MOUNTED instanceId=$instanceId reason=$wakeReason app=$triggeringApp")
        
        // Notify Manager to cancel boot watchdog
        SystemSurfaceManager.notifyUiMounted(instanceId, wakeReason, triggeringApp)
        
        Log.d(TAG, "SystemSurfaceActivity initialized - React Native will load intervention UI")
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        
        val triggeringApp = intent.getStringExtra(EXTRA_TRIGGERING_APP)
        val wakeReason = intent.getStringExtra(EXTRA_WAKE_REASON)
        val sessionId = intent.getStringExtra(EXTRA_SESSION_ID)
        val resumeMode = intent.getBundleExtra("extras")?.getString("resumeMode")
        val instanceId = System.identityHashCode(this)
        val intentNonce = System.currentTimeMillis() // Simple monotonic nonce
        
        // PR1: Update stored fields (NOT reading from stale intent in onDestroy)
        currentSessionId = sessionId
        currentWakeReason = wakeReason
        currentApp = triggeringApp
        
        // INTENT LOGGING (Critical for debugging wake reason routing)
        Log.e("INTENT", "[INTENT] wakeReason=$wakeReason app=$triggeringApp sessionId=$sessionId instanceId=$instanceId")
        
        // Notify service of new surface session
        ForegroundDetectionService.onSystemSurfaceOpened(triggeringApp, currentSessionId, instanceId)
        
        Log.d(LOG_TAG_LIFE, "[onNewIntent] instanceId=$instanceId wakeReason=$wakeReason app=$triggeringApp sessionId=$sessionId resumeMode=$resumeMode flags=${intent.flags} nonce=$intentNonce taskId=$taskId")
        Log.e("SS_BOOT", "onNewIntent wakeReason=$wakeReason app=$triggeringApp resumeMode=$resumeMode flags=${intent.flags} nonce=$intentNonce taskId=$taskId")

        // Emit signal to JS (Delegated to AppMonitorModule)
        try {
             Log.d(TAG, "⚡ Delegating emission to AppMonitorModule nonce=$intentNonce")
             
             val params = com.facebook.react.bridge.Arguments.createMap().apply {
                putDouble("intentNonce", intentNonce.toDouble())
                putString("triggeringAppHint", triggeringApp)
                putString("wakeReasonHint", wakeReason)
                putString("sessionIdHint", sessionId)
             }
             
             AppMonitorModule.emitSystemSurfaceNewIntentSignal(params)
             
             Log.e(LOG_TAG_LIFE, "[emitNewIntent] DELEGATED_TO_MODULE success=true")

        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to emit onSystemSurfaceNewIntent (Delegation Error)", e)
            Log.e(LOG_TAG_LIFE, "[emitNewIntent] EXCEPTION_DELEGATION ${e.message}")
        }
    }

    override fun getMainComponentName(): String = "main"

    override fun createReactActivityDelegate(): ReactActivityDelegate {
        return ReactActivityDelegateWrapper(
            this,
            BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
            object : DefaultReactActivityDelegate(
                this,
                mainComponentName,
                fabricEnabled
            ) {}
        )
    }

        // onDestory Removed - Replaced by new implementation below


    override fun onPause() {
        super.onPause()
        val instanceId = System.identityHashCode(this)
        Log.d(LOG_TAG_LIFE, "[onPause] instanceId=$instanceId isFinishing=$isFinishing")
        Log.d(TAG, "SystemSurfaceActivity paused")
        releaseAudioFocus()
        
        // Hardening: If we are paused and not finishing, something might be covering us
        // but we don't clear the flag here yet because transitions can pause/resume.
    }

    override fun onStop() {
        super.onStop()
        val instanceId = System.identityHashCode(this)
        Log.d(LOG_TAG_LIFE, "[onStop] instanceId=$instanceId isFinishing=$isFinishing")
        
        // Hardening: If the activity is stopped but not finishing, it's definitely not in foreground.
        // We clear the flag to allow future triggers if the user switched away.
        if (!isFinishing) {
            val triggeringApp = intent?.getStringExtra(EXTRA_TRIGGERING_APP)
            Log.e(LogTags.SURFACE_RECOVERY, "[SURFACE_RECOVERY] reason=ACTIVITY_STOPPED_NOT_FINISHING instanceId=$instanceId")
            // Redundant cleanup removed. requestClose handles it.
            
            // ZOMBIE PREVENTION (FIX):
            // If we are stopped and NOT changing configurations (e.g. rotation), we MUST finish.
            // Otherwise, we leave a zombie session in SessionManager that blocks future launches.
            if (!isChangingConfigurations && !isClosing) {
                // M4 Hardening: Logical End Before Physical Finish
                val sessionId = currentSessionId
                if (sessionId != null) {
                    isClosing = true
                    Log.i("SURFACE_LIFECYCLE", "[SURFACE_LIFECYCLE] onStop triggering requestClose sessionId=$sessionId")
                    SystemSurfaceManager.requestClose(sessionId, "ACTIVITY_STOP_FINISH")
                } else {
                    // Fallback if no session (shouldn't happen in valid flow, but just in case)
                     finishReason = "ACTIVITY_STOP_FINISH_NO_SESSION"
                     finish()
                }
            }
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        Log.i(TAG, "[LIFE] onDestroy reason=$finishReason isFinishing=$isFinishing")
        
        // Always notify service of destruction (Ghost Busting)
        // PR1: Use stored fields (stable, not stale intent)
        val instanceId = System.identityHashCode(this)
        
        ForegroundDetectionService.onSystemSurfaceDestroyed(
            app = currentApp,
            sessionId = currentSessionId,
            wakeReason = currentWakeReason,
            instanceId = instanceId
        )
    }

    override fun onResume() {
        super.onResume()
        val instanceId = System.identityHashCode(this)
        Log.d(LOG_TAG_LIFE, "[onResume] instanceId=$instanceId")
        Log.d(TAG, "SystemSurfaceActivity resumed")
        requestAudioFocus()
    }

    /**
     * Request audio focus to pause background audio during intervention
     * 
     * Uses AUDIOFOCUS_GAIN_TRANSIENT to politely request temporary audio focus.
     * Background apps (like Instagram, Spotify) will pause their audio automatically.
     * Audio will resume when we release focus.
     */
    private fun requestAudioFocus() {
        audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Android 8.0+ - Use AudioFocusRequest
            audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setOnAudioFocusChangeListener { focusChange ->
                    Log.d(TAG, "Audio focus changed: $focusChange")
                }
                .build()
            
            val result = audioManager?.requestAudioFocus(audioFocusRequest!!)
            if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                Log.i(TAG, "✅ Audio focus granted - background audio paused")
            } else {
                Log.w(TAG, "⚠️ Audio focus request failed")
            }
        } else {
            // Android 7.1 and below - Use deprecated API
            @Suppress("DEPRECATION")
            val result = audioManager?.requestAudioFocus(
                null,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
            )
            if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                Log.i(TAG, "✅ Audio focus granted (legacy API)")
            }
        }
    }

    /**
     * Release audio focus when SystemSurface finishes
     * 
     * Allows background apps to resume their audio playback.
     */
    private fun releaseAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let {
                audioManager?.abandonAudioFocusRequest(it)
                Log.d(TAG, "Audio focus released")
            }
        } else {
            @Suppress("DEPRECATION")
            audioManager?.abandonAudioFocus(null)
            Log.d(TAG, "Audio focus released (legacy API)")
        }
        
        audioManager = null
        audioFocusRequest = null
    }
}
