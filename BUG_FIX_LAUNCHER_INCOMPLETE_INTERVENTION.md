# Bug Fix: Incomplete Intervention Not Cancelled When Switching to Launcher

**Date:** January 5, 2026  
**Status:** ✅ FIXED  
**Severity:** HIGH - Core functionality broken

---

## Problem Description

When a user is in the middle of an intervention (e.g., Alternatives screen) and switches to the home screen/launcher, then returns to the monitored app, the intervention state is preserved instead of being cancelled and restarted.

**Expected Behavior:**
1. User opens Instagram → Alternatives screen
2. User presses home button (or switches to another app via launcher)
3. **Intervention should be CANCELLED** (reset to idle)
4. User returns to Instagram
5. **Should:** Start NEW intervention from breathing screen (normal evaluation)

**Actual Behavior (BEFORE FIX):**
1. User opens Instagram → Alternatives screen
2. User presses home button
3. User returns to Instagram
4. **Bug:** Alternatives screen still showing (intervention state preserved)

**Why Root Cause → Twitter → Instagram worked:**
- Twitter IS a monitored app, so Kotlin emitted the event to JavaScript
- JavaScript received it and cancelled Instagram's intervention
- It worked correctly!

**Why Alternatives → Home → Instagram failed:**
- Home screen is NOT a monitored app
- Kotlin did NOT emit event to JavaScript
- JavaScript never knew you switched to home
- Instagram's intervention state was preserved

---

## Root Cause

**CRITICAL FINDING:** Kotlin was NOT emitting `onForegroundAppChanged` events for launcher/home screen apps!

### The Problem in Kotlin

Looking at `ForegroundDetectionService.kt` lines 269-277 (BEFORE FIX):

```kotlin
// Log all foreground changes for debugging
Log.i(TAG, "📱 Foreground app changed: $packageName")

// Check if this is a monitored app
if (MONITORED_APPS.contains(packageName)) {
    Log.i(TAG, "🎯 MONITORED APP DETECTED: $packageName")
    launchInterventionActivity(packageName)
} else {
    Log.d(TAG, "  └─ Not a monitored app, ignoring")
}
// ❌ NO EVENT EMITTED TO JAVASCRIPT FOR NON-MONITORED APPS
```

**What happened when you pressed home:**
1. Kotlin detected home screen (launcher) in foreground ✅
2. Kotlin logged "Foreground app changed: com.android.launcher" ✅
3. Kotlin checked if it's a monitored app → NO ✅
4. Kotlin logged "Not a monitored app, ignoring" ✅
5. **NO EVENT EMITTED TO JAVASCRIPT** ❌

**Result:** JavaScript never knew you switched to home screen, so it couldn't detect the exit and cancel the incomplete intervention!

### The Problem in JavaScript

The cancellation logic in `osTriggerBrain.ts` was placed AFTER the launcher filtering early return:

```typescript
Step 1: Record exit
Step 2: Launcher filtering → RETURN EARLY
Step 3: Cancel incomplete ← NEVER REACHED for launchers
```

Even if Kotlin had emitted the launcher event, JavaScript would have returned early before checking for incomplete interventions.

---

## The Fix

**Two-part fix:**

### Part 1: Kotlin - Emit ALL foreground app changes to JavaScript

Modified `ForegroundDetectionService.kt` to emit `onForegroundAppChanged` event for **ALL** apps (including launchers), not just monitored apps.

This allows JavaScript to:
- Detect when user switches to home screen
- Record exit timestamps for all apps
- Cancel incomplete interventions when user switches away

### Part 2: JavaScript - Move cancellation before launcher return

Moved the incomplete intervention cancellation check in `osTriggerBrain.ts` to run **BEFORE** the launcher early return.

This ensures cancellation logic runs even when switching to home screen/launcher.

---

## Implementation Details

### File 1: `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`

**⚠️ IMPORTANT:** Always edit the source file in `plugins/` directory, NOT in `android/app/`!
The `npm run sync:kotlin` command copies from `plugins/` to `android/app/`.

**Added imports:**
```kotlin
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
```

**Added helper function** (after line 278):
```kotlin
/**
 * Emit foreground app changed event to JavaScript.
 * Called for ALL apps (including launchers) so JavaScript can track exits.
 */
private fun emitForegroundAppChangedEvent(packageName: String) {
    try {
        val reactContext = AppMonitorService.getReactContext()
        if (reactContext == null) {
            Log.w(TAG, "React context not available, cannot emit event")
            return
        }
        
        val params = Arguments.createMap().apply {
            putString("packageName", packageName)
            putDouble("timestamp", System.currentTimeMillis().toDouble())
        }
        
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onForegroundAppChanged", params)
            
        Log.d(TAG, "  └─ Event emitted to JavaScript: $packageName")
    } catch (e: Exception) {
        Log.e(TAG, "Failed to emit foreground app changed event", e)
    }
}
```

**Modified `onAccessibilityEvent`** (lines 269-277):

**BEFORE:**
```kotlin
Log.i(TAG, "📱 Foreground app changed: $packageName")

if (MONITORED_APPS.contains(packageName)) {
    Log.i(TAG, "🎯 MONITORED APP DETECTED: $packageName")
    launchInterventionActivity(packageName)
} else {
    Log.d(TAG, "  └─ Not a monitored app, ignoring")
}
```

**AFTER:**
```kotlin
Log.i(TAG, "📱 Foreground app changed: $packageName")

// Emit event to JavaScript for ALL apps (including launchers)
emitForegroundAppChangedEvent(packageName)

if (MONITORED_APPS.contains(packageName)) {
    Log.i(TAG, "🎯 MONITORED APP DETECTED: $packageName")
    launchInterventionActivity(packageName)
} else {
    Log.d(TAG, "  └─ Not a monitored app, no intervention needed")
}
```

### File 2: `src/os/osTriggerBrain.ts`

**Moved cancellation block** from Step 3 to Step 2 (before launcher filtering):

**BEFORE:**
```
Step 1: Record exit (lines 593-604)
Step 2: Launcher filtering (lines 606-628) → RETURN EARLY
Step 3: Cancel incomplete (lines 630-645) ← NEVER REACHED
Step 4: Handle entry
Step 5: Intervention logic
```

**AFTER:**
```
Step 1: Record exit (lines 593-604)
Step 2: Cancel incomplete (MOVED HERE) ← RUNS EVEN FOR LAUNCHERS
Step 3: Launcher filtering (lines 606-628) → RETURN EARLY
Step 4: Handle entry
Step 5: Intervention logic
```

**Updated code** (lines 606-645):
```typescript
// ============================================================================
// Step 2: Cancel incomplete intervention if user switched away
// ============================================================================

// Check if user switched away from an app with incomplete intervention
// This runs BEFORE launcher filtering so it catches home screen switches
// Uses lastMeaningfulApp (not lastForegroundApp) to skip intermediate launchers
if (lastMeaningfulApp !== null && lastMeaningfulApp !== packageName) {
  // User switched from lastMeaningfulApp to packageName
  // Check if lastMeaningfulApp had an incomplete intervention
  if (hasIncompleteIntervention(lastMeaningfulApp)) {
    console.log('[OS Trigger Brain] User switched away from app with incomplete intervention:', {
      fromApp: lastMeaningfulApp,
      toApp: packageName,
    });
    cancelIncompleteIntervention(lastMeaningfulApp);
  }
}

// ============================================================================
// Step 3: Semantic launcher filtering
// ============================================================================

const isLauncherEvent = isLauncher(packageName);

if (isLauncherEvent) {
  // Launcher detected - log but don't treat as meaningful app
  // ... (rest of launcher filtering logic)
  return;
}
```

---

## How It Handles Intermediate Launchers

**Important:** Android often reports sequences like: `Instagram → Launcher → Twitter → Launcher`

The JavaScript code handles this correctly using `lastMeaningfulApp`:

### Example: Instagram (Alternatives) → Twitter via app switcher

```
Event 1: Launcher appears (brief)
  packageName = com.android.launcher3
  isLauncher = true
  Cancellation check: lastMeaningfulApp (Instagram) !== launcher
    → hasIncompleteIntervention(Instagram) = true
    → cancelIncompleteIntervention(Instagram) ✅
  Returns early (doesn't update lastMeaningfulApp)
  lastMeaningfulApp STILL = Instagram (but intervention cancelled)
  
Event 2: Twitter appears
  packageName = com.twitter.android
  isLauncher = false
  Cancellation check: lastMeaningfulApp (Instagram) !== Twitter
    → hasIncompleteIntervention(Instagram) = false (already cancelled)
    → No action needed
  Updates lastMeaningfulApp = Twitter
  Starts Twitter intervention
```

**Key insight:** The cancellation happens on the **first non-Instagram event** (which is the launcher), so by the time Twitter appears, Instagram's intervention is already cancelled.

---

## Key Behavioral Changes

### Scenario 1: Alternatives → Home → Instagram

**Before Fix:**
- User in Alternatives screen
- Presses home button
- Returns to Instagram
- **Bug:** Alternatives screen still showing

**After Fix:**
- User in Alternatives screen
- Presses home button → **Kotlin emits launcher event** → **JavaScript cancels intervention**
- Returns to Instagram
- **Fixed:** Quick Task dialog or new intervention from breathing

### Scenario 2: Alternatives → Twitter (via app switcher)

**Before Fix:**
- User in Alternatives screen
- Switches to Twitter via app switcher
- Launcher appears briefly
- Returns to Instagram
- **Bug:** Alternatives screen still showing

**After Fix:**
- User in Alternatives screen
- Launcher appears briefly → **Kotlin emits launcher event** → **JavaScript cancels intervention**
- Twitter appears → Starts Twitter intervention
- Returns to Instagram
- **Fixed:** Quick Task dialog or new intervention from breathing

### Scenario 3: Alternative Activity (action_timer)

**Before and After (UNCHANGED - works correctly):**
- User doing alternative activity (action_timer state)
- Switches to home or another app
- Returns to Instagram
- **Correct:** Activity timer still showing (preserved, not cancelled)

---

## Testing Scenarios

### Test 1: Cancel incomplete intervention (Alternatives → Home)
1. Open Instagram → Complete breathing → Select causes → Alternatives screen
2. Press home button
3. Return to Instagram
4. **Expected:** Quick Task dialog or breathing screen (new intervention)
5. **Logs should show:** 
   - "Event emitted to JavaScript: com.android.launcher3"
   - "User switched away from app with incomplete intervention"
   - "Incomplete intervention cancelled"

### Test 2: Cancel incomplete intervention (Alternatives → Twitter)
1. Open Instagram → Alternatives screen
2. Switch to Twitter via app switcher (launcher appears briefly)
3. Return to Instagram
4. **Expected:** Quick Task dialog or breathing screen
5. **Logs should show:** Cancellation on launcher event

### Test 3: Preserve alternative activity
1. Open Instagram → Complete intervention → Start alternative activity (action_timer)
2. Press home button
3. Return to Instagram
4. **Expected:** Activity timer screen still showing (NOT cancelled)

### Test 4: Valid t_intention suppresses
1. Open Instagram → Set intention timer for 5 minutes
2. Instagram launches
3. Press home button
4. Return to Instagram (within 5 minutes)
5. **Expected:** No intervention (suppressed by valid t_intention)

### Test 5: Per-app independence
1. Instagram in Alternatives screen
2. Press home button
3. Open TikTok
4. **Expected:** Instagram intervention cancelled, TikTok starts its own intervention

---

## Files Modified

1. **`plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`** (source file)
   - Added imports: `Arguments`, `DeviceEventManagerModule`
   - Added `emitForegroundAppChangedEvent()` helper function (35 lines)
   - Modified `onAccessibilityEvent()` to emit events for ALL apps
   - **Note:** Changes automatically synced to `android/app/` via `npm run sync:kotlin`

2. **`src/os/osTriggerBrain.ts`**
   - Moved cancellation logic from Step 3 to Step 2 (before launcher filtering)
   - Updated comments to explain intermediate launcher handling

---

## Compliance with Spec

✅ **Per OS Trigger Contract V1:**

**"When the intervention for a monitored app has already been started, need to monitor:**
- **If** when the intention timer (t_intention) is chosen and t_intention is not over, **or** the "alternative activity" is started
- **Then:** the intervention shall not be started
- **Else:** the intervention shall be started again"

**Our Implementation:**
- ✅ If t_intention is valid → suppress (don't start intervention)
- ✅ If alternative activity started (action_timer) → preserve (don't cancel)
- ✅ If incomplete intervention (breathing, root-cause, alternatives, action, reflection) → cancel when user switches away
- ✅ When user returns with idle state → normal evaluation (may start intervention)
- ✅ Handles intermediate launcher transitions correctly

---

## Native-JavaScript Boundary Compliance

✅ **Compliant with `docs/NATIVE_JAVASCRIPT_BOUNDARY.md`:**

- **Native (Kotlin):** Reports ALL foreground app changes with timestamps (mechanics)
- **JavaScript:** Decides semantically what to do with each event (semantics)
- **JavaScript:** Decides to cancel incomplete interventions
- **JavaScript:** Decides to ignore launcher apps for intervention logic

**No semantic logic added to native layer** - it just reports raw events.

---

## Related Documentation

- `docs/NATIVE_JAVASCRIPT_BOUNDARY.md` - Native-JS boundary contract
- `docs/Trigger_logic_priority.md` - Trigger logic specification
- `spec/NATIVE_JAVASCRIPT_BOUNDARY.md` - Updated spec screenshots
- `BUG_FIX_INTENTION_TIMER_EXPIRY.md` - Previous bug fix (intention timer expiry)
- `BUG_FIX_INCOMPLETE_INTERVENTION_CANCELLATION.md` - Previous bug fix (incomplete intervention when switching to monitored apps)

---

**All implementation completed successfully on January 5, 2026.**
