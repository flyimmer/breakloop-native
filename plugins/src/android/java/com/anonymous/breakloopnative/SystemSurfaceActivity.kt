package com.anonymous.breakloopnative

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
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.anonymous.breakloopnative.SystemSurfaceManager
import com.anonymous.breakloopnative.BuildConfig
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
        
        // Wake reason values
        // Phase 1 (transitional - will be deprecated)
        const val WAKE_REASON_MONITORED_APP = "MONITORED_APP_FOREGROUND"
        const val WAKE_REASON_INTENTION_EXPIRED = "INTENTION_EXPIRED"
        
        // Phase 2 (explicit wake reasons - System Brain pre-decides UI)
        const val WAKE_REASON_SHOW_QUICK_TASK = "SHOW_QUICK_TASK_DIALOG"
        const val WAKE_REASON_START_INTERVENTION = "START_INTERVENTION_FLOW"
        const val WAKE_REASON_QUICK_TASK_EXPIRED = "QUICK_TASK_EXPIRED_FOREGROUND"
    }

    private var uiMounted = false

    override fun onCreate(savedInstanceState: Bundle?) {
        val triggeringApp = intent?.getStringExtra(EXTRA_TRIGGERING_APP)
        val wakeReason = intent?.getStringExtra(EXTRA_WAKE_REASON)
        Log.e("SS_BOOT", "onCreate wakeReason=$wakeReason app=$triggeringApp intent=$intent flags=${intent?.flags}")

        Log.i(TAG, "🎯 SystemSurfaceActivity created")
        
        // Register with Manager
        SystemSurfaceManager.register(this)
        
        // Signal native service that surface is now active (Lifecycle Gate)
        ForegroundDetectionService.onSystemSurfaceOpened()
        
        // Log the triggering app if provided
        triggeringApp?.let {
            Log.i(TAG, "  └─ Triggered by: $it")
        }
        
        super.onCreate(savedInstanceState)
        
        // UI Mounted - Right after super.onCreate where React root view is initialized
        uiMounted = true
        Log.e("SS_BOOT", "UI_MOUNTED reason=$wakeReason app=$triggeringApp")

        // Boot timeout failsafe
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            if (!uiMounted) {
                Log.e("SS_BOOT", "BOOT_TIMEOUT_FINISH (no UI mounted) reason=$wakeReason app=$triggeringApp")
                finish()
            }
        }, 1200)
        
        Log.d(TAG, "SystemSurfaceActivity initialized - React Native will load intervention UI")
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        
        val triggeringApp = intent.getStringExtra(EXTRA_TRIGGERING_APP)
        val wakeReason = intent.getStringExtra(EXTRA_WAKE_REASON)
        Log.e("SS_BOOT", "onNewIntent wakeReason=$wakeReason app=$triggeringApp flags=${intent.flags}")
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

    override fun onDestroy() {
        Log.i(TAG, "❌ SystemSurfaceActivity destroyed")
        
        // Signal native service that surface is now destroyed (Lifecycle Gate)
        ForegroundDetectionService.onSystemSurfaceDestroyed()
        
        // Unregister from Manager
        SystemSurfaceManager.unregister(this)
        
        // Paranoid Cleanup (Guardrail C)
        try {
            window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            Log.i(TAG, "[SystemSurfaceActivity] onDestroy cleanup complete")
        } catch (e: Exception) {
            Log.w(TAG, "Cleanup warning: ${e.message}")
        }
        
        super.onDestroy()
    }

    override fun onPause() {
        super.onPause()
        Log.d(TAG, "SystemSurfaceActivity paused")
        releaseAudioFocus()
    }

    override fun onResume() {
        super.onResume()
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
