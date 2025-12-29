package com.anonymous.breakloopnative

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper

/**
 * InterventionActivity - Dedicated Activity for Intervention UI Only
 * 
 * WHY A DEDICATED ACTIVITY?
 * - Ensures ONLY the intervention experience is shown (no main app UI flash)
 * - Allows the app to wake from killed state directly into intervention
 * - Provides clean separation: MainActivity = main app UI, InterventionActivity = intervention only
 * - Prevents user from accidentally seeing tabs/settings when being interrupted
 * 
 * KEY ARCHITECTURAL CHOICES:
 * 
 * 1. launchMode = "singleTask"
 *    - Ensures only one instance of InterventionActivity exists
 *    - If already running, brings existing instance to foreground instead of creating new one
 *    - Prevents stacking multiple intervention screens
 * 
 * 2. excludeFromRecents = true
 *    - Hides this activity from Android's recent apps list
 *    - Users don't see "Intervention" as a separate app task
 *    - Reinforces that this is a temporary interruption, not a standalone app
 * 
 * 3. taskAffinity = "" (empty)
 *    - Separates intervention task from main app task
 *    - Prevents intervention from being grouped with MainActivity in task switcher
 *    - Allows intervention to close cleanly without affecting main app state
 * 
 * 4. Theme.Intervention (transparent/minimal)
 *    - No splash screen or loading UI flash
 *    - Immediately shows React Native content once ready
 *    - Provides smooth, non-disruptive entrance
 * 
 * HOW JS REMAINS THE DECISION AUTHORITY:
 * - Native code ONLY decides WHEN to wake the app (monitored app detected)
 * - Native code launches InterventionActivity with triggering app info
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
class InterventionActivity : ReactActivity() {

    companion object {
        private const val TAG = "InterventionActivity"
        
        /**
         * Intent extra key for the package name that triggered the intervention
         * Used by JS to identify which monitored app was detected
         */
        const val EXTRA_TRIGGERING_APP = "triggeringApp"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        Log.i(TAG, "🎯 InterventionActivity created")
        
        // Log the triggering app if provided
        intent?.getStringExtra(EXTRA_TRIGGERING_APP)?.let { triggeringApp ->
            Log.i(TAG, "  └─ Triggered by: $triggeringApp")
        }
        
        super.onCreate(savedInstanceState)
        
        Log.d(TAG, "InterventionActivity initialized - React Native will load intervention UI")
    }

    /**
     * Handle new Intent when activity is already running (singleInstance mode)
     * 
     * When InterventionActivity is already running and AccessibilityService
     * launches it again (e.g., user opens another monitored app), this method
     * is called instead of onCreate().
     * 
     * We update the Intent and send an event to React Native to trigger
     * a new intervention for the new app.
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent) // Update Intent for subsequent getIntent() calls
        
        intent.getStringExtra(EXTRA_TRIGGERING_APP)?.let { triggeringApp ->
            Log.i(TAG, "🔄 onNewIntent - New trigger: $triggeringApp")
            
            // Send event to React Native to trigger new intervention
            val reactContext = AppMonitorService.getReactContext()
            if (reactContext != null && reactContext.hasActiveReactInstance()) {
                try {
                    val params = com.facebook.react.bridge.Arguments.createMap().apply {
                        putString("packageName", triggeringApp)
                        putDouble("timestamp", System.currentTimeMillis().toDouble())
                    }
                    
                    reactContext
                        .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("onNewInterventionTrigger", params)
                    
                    Log.i(TAG, "  └─ Sent onNewInterventionTrigger event to React Native")
                } catch (e: Exception) {
                    Log.e(TAG, "  └─ Failed to send event to React Native", e)
                }
            } else {
                Log.w(TAG, "  └─ React context not available, cannot notify React Native")
            }
        }
    }

    /**
     * Returns the name of the React Native component to render
     * 
     * IMPORTANT: This returns "main" - the same root component as MainActivity.
     * However, the OS Trigger Brain will detect the intervention trigger and
     * automatically navigate to the intervention flow instead of showing tabs.
     * 
     * JS is the single source of truth for navigation logic.
     */
    override fun getMainComponentName(): String {
        Log.d(TAG, "Loading React Native root component: main")
        return "main"
    }

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

    /**
     * Handle back button behavior
     * 
     * For intervention flow, back button should:
     * - Allow navigation within intervention screens (breathing -> root-cause, etc.)
     * - Eventually exit intervention and return to previously opened app
     * - NOT navigate to MainActivity or show main app UI
     * 
     * JS handles intervention screen navigation via intervention state machine.
     * Native only handles the final exit when JS finishes the intervention.
     */
    override fun invokeDefaultOnBackPressed() {
        Log.d(TAG, "Back button pressed in InterventionActivity")
        
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
            // On older Android versions, move task to background
            if (!moveTaskToBack(false)) {
                super.invokeDefaultOnBackPressed()
            }
            return
        }
        
        // Use default back button implementation on Android S+
        super.invokeDefaultOnBackPressed()
    }

    override fun onDestroy() {
        Log.i(TAG, "❌ InterventionActivity destroyed")
        super.onDestroy()
    }

    override fun onPause() {
        super.onPause()
        Log.d(TAG, "InterventionActivity paused")
    }

    override fun onResume() {
        super.onResume()
        Log.d(TAG, "InterventionActivity resumed")
    }
}

