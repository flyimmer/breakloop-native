# Native Implementation TODO - Post Quick Task Choice Screen

This document outlines the native Kotlin implementation required to complete the Post Quick Task Choice Screen feature.

**Status:** JS/TS implementation complete ✅ | Native implementation pending ⏳

## 🎯 What Needs to Be Done (Kotlin)

### 1. Add `getSystemSurfaceIntentExtras()` Method

**File:** `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`

**Purpose:** Return Intent extras (wakeReason + triggeringApp) to SystemSurfaceRoot during bootstrap

**Method Signature:**
```kotlin
@ReactMethod
fun getSystemSurfaceIntentExtras(promise: Promise) {
    try {
        val extras = InterventionActivity.getIntentExtras()
        if (extras != null) {
            val map = Arguments.createMap()
            map.putString("wakeReason", extras.wakeReason)
            map.putString("triggeringApp", extras.triggeringApp)
            promise.resolve(map)
        } else {
            promise.resolve(null)
        }
    } catch (e: Exception) {
        promise.reject("ERROR", "Failed to get intent extras: ${e.message}")
    }
}
```

**Note:** This assumes `InterventionActivity` has a static method to expose Intent extras.

### 2. Store Intent Extras in InterventionActivity

**File:** `plugins/src/android/java/com/anonymous/breakloopnative/InterventionActivity.kt`

**Purpose:** Make Intent extras accessible to AppMonitorModule

**Implementation:**
```kotlin
class InterventionActivity : ReactActivity() {
    companion object {
        private var currentWakeReason: String? = null
        private var currentTriggeringApp: String? = null
        
        data class IntentExtras(
            val wakeReason: String,
            val triggeringApp: String
        )
        
        fun getIntentExtras(): IntentExtras? {
            return if (currentWakeReason != null && currentTriggeringApp != null) {
                IntentExtras(currentWakeReason!!, currentTriggeringApp!!)
            } else {
                null
            }
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Extract Intent extras
        currentWakeReason = intent.getStringExtra("WAKE_REASON")
        currentTriggeringApp = intent.getStringExtra("TRIGGERING_APP")
        
        Log.d("InterventionActivity", "Intent extras: wakeReason=$currentWakeReason, triggeringApp=$currentTriggeringApp")
    }
    
    override fun onDestroy() {
        super.onDestroy()
        // Clear static fields when Activity is destroyed
        currentWakeReason = null
        currentTriggeringApp = null
    }
}
```

### 3. Update Wake Reason Generation

**File:** `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`

**No changes needed!** System Brain already generates `POST_QUICK_TASK_CHOICE` wake reason via `decisionEngine.ts`.

**Verification:** Check that native code passes wake reason strings through unmodified from `launchSystemSurface(wakeReason, triggeringApp)` call.

## 🧪 Testing Steps

### Phase 1: Verify Intent Extras Plumbing
1. Add debug logs in `InterventionActivity.onCreate()` to print wake reason and triggering app
2. Launch SystemSurface from System Brain with any wake reason
3. Verify logs show correct values

### Phase 2: Verify JS Bridge
1. Add debug logs in `AppMonitorModule.getSystemSurfaceIntentExtras()`
2. Call method from SystemSurfaceRoot bootstrap
3. Verify method returns correct wake reason and triggering app

### Phase 3: Verify Choice Screen
1. Start Quick Task in a monitored app (e.g., Instagram)
2. Let it expire while app is in foreground
3. Verify PostQuickTaskChoiceScreen appears (not intervention screen)
4. Tap "Continue using this app" with quota remaining
5. Verify QuickTaskDialogScreen appears
6. Tap "Quit this app" 
7. Verify app closes and home screen appears

### Phase 4: Edge Cases
1. Quick Task expires in background → Verify choice screen does NOT appear
2. Quota exhausted → Verify "Continue" goes to intervention
3. Back button → Verify triggers "Quit" action
4. Multiple rapid expirations → Verify no duplicate screens

## ⚠️ Known Issues to Watch For

1. **Static Field Memory Leaks:** Ensure `currentWakeReason` and `currentTriggeringApp` are cleared in `onDestroy()`
2. **Race Condition:** Ensure Intent extras are read synchronously in `onCreate()` before React Native initializes
3. **Null Handling:** Ensure `getSystemSurfaceIntentExtras()` returns null gracefully if extras are missing
4. **Activity Reuse:** If SystemSurfaceActivity is reused (not disposable), Intent extras may be stale

## 📋 Validation Checklist

- [ ] `getSystemSurfaceIntentExtras()` method added to AppMonitorModule
- [ ] Method returns `{ wakeReason, triggeringApp }` correctly
- [ ] Method returns `null` when extras are missing
- [ ] InterventionActivity stores Intent extras in static fields
- [ ] Static fields cleared on Activity destroy
- [ ] Wake reason `POST_QUICK_TASK_CHOICE` correctly passed through
- [ ] PostQuickTaskChoiceScreen appears when Quick Task expires in foreground
- [ ] "Quit this app" closes app without intervention
- [ ] "Continue using this app" routes correctly based on quota
- [ ] No duplicate screens or race conditions
- [ ] All debug logs removed before commit

## 🚀 Ready to Test

Once all checklist items are complete, the feature is ready for end-to-end testing. The JS/TS implementation is already complete and waiting for native integration.

## 📝 Related Files

- **JS/TS Implementation:** `docs/POST_QUICK_TASK_CHOICE_IMPLEMENTATION.md`
- **Screen Component:** `app/screens/conscious_process/PostQuickTaskChoiceScreen.tsx`
- **Decision Engine:** `src/systemBrain/decisionEngine.ts` (generates wake reason)
- **SystemSurfaceRoot:** `app/roots/SystemSurfaceRoot.tsx` (routing logic)
