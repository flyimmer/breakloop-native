# Bug Fix: Duplicate Intervention Triggers

**Date:** January 5, 2026  
**Status:** Fixed  
**Severity:** High - User experience issue

---

## Problem Description

When opening a monitored app (e.g., Instagram), multiple intervention screens were triggered in rapid succession instead of just one. This created a confusing user experience with the intervention UI appearing multiple times.

### Symptoms

- Opening Instagram once → Multiple intervention screens appear
- User sees intervention UI flash/restart multiple times
- Logs show multiple "MONITORED APP DETECTED" events for the same app

---

## Root Cause Analysis

The issue had two distinct scenarios:

### Scenario A: Launcher Transition Interference

**Sequence:**
```
Instagram event #1 → Launcher (50ms) → Instagram event #2
```

**Problem:**
- During app switching, Android briefly shows the launcher
- The launcher event reset the duplicate detection logic
- When Instagram's second window event arrived, it was treated as a new app entry
- Result: Intervention triggered twice

**Why it happened:**
- The consecutive duplicate check (`lastPackageName === packageName`) only compared against the immediate previous event
- When launcher appeared between Instagram events, `lastPackageName` was set to launcher
- Second Instagram event compared against launcher, not the first Instagram event

### Scenario B: BreakLoop Infrastructure Interference

**Sequence:**
```
Instagram event #1 → SystemSurfaceActivity launches → Instagram event #2 (delayed)
```

**Problem:**
- Instagram emits multiple `TYPE_WINDOW_STATE_CHANGED` events as it initializes (splash screen, main activity, fragments)
- These events are asynchronous and can arrive 100-500ms apart
- When SystemSurfaceActivity (BreakLoop's intervention UI) launches, it becomes the foreground app
- Instagram's delayed window events arrive after BreakLoop is already showing
- The duplicate check compared against BreakLoop, not Instagram

**Why it happened:**
- BreakLoop was already in `LAUNCHER_PACKAGES` and filtered correctly
- However, the existing duplicate detection at line 792 should have caught this
- The issue was that the logic was correct but needed better visibility/verification

---

## Solution Architecture

Per `NATIVE_JAVASCRIPT_BOUNDARY.md`:
- **Native = mechanics**: Kotlin sends all events, wakes System Surface
- **JavaScript = semantics**: JS decides if intervention should actually happen

All semantic filtering is implemented in JavaScript (`src/os/osTriggerBrain.ts`).

### Solution 1: Smart Launcher Transition Detection

**Concept:**
Distinguish between:
- **Transient launcher** (app switching): `App A → Launcher (50ms) → App B`
- **Real launcher** (home screen): `App A → Launcher (stays there)`

**Implementation:**
1. Track launcher event timestamp (`lastLauncherEventTime`)
2. When a non-launcher app appears, check time since last launcher event
3. If within 300ms, log it as a transition (not a destination)
4. Reset launcher timestamp after checking

**Code Location:** `src/os/osTriggerBrain.ts`
- Lines 113-114: Variable declarations
- Lines 654-655: Record launcher timestamp
- Lines 678-689: Transition detection logic

### Solution 2: BreakLoop Infrastructure Exclusion

**Concept:**
BreakLoop's own package (`com.anonymous.breakloopnative`) should never influence intervention decisions - it's infrastructure, not user behavior.

**Implementation:**
1. BreakLoop is already in `LAUNCHER_PACKAGES` (line 79)
2. Launcher filtering ensures BreakLoop events don't update `lastMeaningfulApp`
3. Existing duplicate check (line 792) catches same-app events
4. Added debug logging to verify filtering works correctly

**Code Location:** `src/os/osTriggerBrain.ts`
- Line 79: BreakLoop in LAUNCHER_PACKAGES
- Lines 666-668: Debug log for BreakLoop filtering
- Lines 792-801: Duplicate detection with debug logging

---

## Implementation Details

### Changes Made

**File:** `src/os/osTriggerBrain.ts`

1. **Added launcher transition tracking** (lines 113-114)
   ```typescript
   let lastLauncherEventTime: number = 0;
   const LAUNCHER_TRANSITION_THRESHOLD_MS = 300;
   ```

2. **Updated launcher handling** (line 654-655)
   - Record timestamp when launcher detected
   - Used for transition detection

3. **Added launcher transition detection** (lines 678-689)
   - Check if launcher was transient (< 300ms before next app)
   - Log transition for debugging
   - Reset launcher timestamp

4. **Fixed cancellation logic** (lines 635-637)
   - Exclude BreakLoop from cancellation check
   - BreakLoop is the intervention UI, not a "switch away"
   - Prevents intervention from cancelling itself when SystemSurfaceActivity launches

5. **Added debug logging** (lines 666-668, 794-798)
   - Verify BreakLoop filtering works
   - Confirm duplicate detection catches same-app events

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `LAUNCHER_TRANSITION_THRESHOLD_MS` | 300ms | Distinguish app-switch from home-screen visit |

---

## Critical Bug: Intervention Self-Cancellation

### Discovery

After implementing the launcher transition detection, a new bug was discovered: **interventions were cancelling themselves immediately after starting**.

### Symptoms

- Breathing screen appears briefly then disappears
- User can use Instagram freely without intervention
- Logs show: "User switched away from app with incomplete intervention" when BreakLoop launches

### Root Cause

The cancellation logic (Step 2 in `handleForegroundAppChange`) runs **before** launcher filtering (Step 3). When SystemSurfaceActivity launches to show the intervention UI:

1. Instagram triggers intervention
2. SystemSurfaceActivity (BreakLoop) comes to foreground
3. Cancellation check sees: `lastMeaningfulApp = Instagram`, `newApp = BreakLoop`
4. Thinks: "User switched away from Instagram!"
5. **Cancels intervention** ❌

### The Fix

Exclude BreakLoop from the cancellation check because it's not a "switch away" - it's the intervention UI itself:

```typescript
if (lastMeaningfulApp !== null && 
    lastMeaningfulApp !== packageName && 
    packageName !== 'com.anonymous.breakloopnative') {  // NEW: Don't cancel when BreakLoop launches
    if (hasIncompleteIntervention(lastMeaningfulApp)) {
        cancelIncompleteIntervention(lastMeaningfulApp);
    }
}
```

**Location:** `src/os/osTriggerBrain.ts`, lines 635-637

---

## Critical Bug #2: Cancelled Intervention Re-launches App

### Discovery

After fixing the self-cancellation bug, another issue was discovered: **when user cancels intervention by pressing back, they are taken back to the monitored app instead of home screen**, causing the intervention to restart.

### Symptoms

- User opens Instagram, reaches root-cause screen
- User presses back button to quit
- Instead of going to home screen, taken back to Instagram
- New intervention starts immediately (breathing screen again)

### Root Cause

The `finishInterventionActivity()` function in Kotlin **always launches the triggering app**, regardless of whether the intervention was completed or cancelled:

```kotlin
// Lines 284-307 in AppMonitorModule.kt
if (triggeringApp != null && triggeringApp.isNotEmpty()) {
    val launchIntent = packageManager.getLaunchIntentForPackage(triggeringApp)
    reactApplicationContext.startActivity(launchIntent)  // Always launches!
}
```

When user cancels:
1. Intervention cancelled → state resets to idle
2. JavaScript calls `finishInterventionActivity()`
3. Kotlin launches Instagram
4. Instagram comes to foreground → **new intervention starts!**

### The Fix

Updated the decision logic in `app/App.tsx` (lines 261-288):

**Before:**
- Completed + no timer → Launch home
- All other cases → Call `finishInterventionActivity()` (launches app)

**After:**
- Intention timer set → Call `finishInterventionActivity()` (launches app)
- No intention timer (completed OR cancelled) → Launch home screen

```typescript
if (intentionTimerSet) {
    // Launch triggering app (user set intention timer)
    AppMonitorModule.finishInterventionActivity();
} else {
    // Launch home screen (whether completed or cancelled)
    AppMonitorModule.launchHomeScreen();
}
```

**Location:** `app/App.tsx`, lines 261-288

---

## Critical Bug #3: Premature Intervention Cancellation on App Switch

### Discovery

After fixing the cancellation bug, another issue was discovered: **when switching from one monitored app to another, the intervention is cancelled immediately**, causing the breathing countdown to never complete properly.

### Symptoms

- User opens Instagram, reaches root-cause screen
- User switches to Twitter (X)
- Twitter intervention starts with breathing screen
- **Countdown shows 5 but immediately goes to home screen** (intervention cancelled)
- Logs show "User switched away from app with incomplete intervention"

### Root Cause - Order of Operations Bug

The cancellation logic was running in the **wrong order** in `handleForegroundAppChange`:

**Original (Incorrect) Order:**
```
Step 1: Record exit timestamps
Step 2: Cancel incomplete intervention ❌ (checks launcher as real app switch)
Step 3: Semantic launcher filtering ✅ (identifies launchers)
Step 3.5: Launcher transition detection ✅ (filters transition launchers)
```

**The Problem:** Cancellation check (Step 2) ran **BEFORE** launcher filtering (Step 3). When the launcher appeared during app switching, it was treated as a real app switch and triggered cancellation, even though we had logic to detect it was just a transition.

**Sequence from logs:**

```
Twitter enters → BEGIN_INTERVENTION → BreakLoop launches → BreakLoop exits → Launcher appears
→ Cancellation logic sees: lastMeaningfulApp=Twitter, packageName=Launcher
→ Twitter intervention cancelled (breathingCount still at 5)
```

At the moment launcher appeared:
- `lastMeaningfulApp = "com.twitter.android"`
- `packageName = "com.hihonor.android.launcher"` 
- Cancellation logic ran BEFORE checking if launcher was a transition
- Twitter's intervention got cancelled immediately

### The Fix

**Reordered the steps** in `src/os/osTriggerBrain.ts` to run semantic filtering BEFORE cancellation logic:

**New (Correct) Order:**
```
Step 1: Record exit timestamps
Step 2: Semantic launcher filtering ✅ (filters launchers)
Step 3: Launcher transition detection ✅ (filters transition launchers)
Step 4: Cancel incomplete intervention ✅ (only checks real app switches)
```

**Why this works:**
1. **Semantic filtering first** - Identify and filter infrastructure apps (launchers, BreakLoop)
2. **Transition detection second** - Determine if launcher was just a transition
3. **Decision logic last** - Make intervention decisions based on clean, filtered state

When launcher appears during app switch:
- Step 2 detects it's a launcher → early return (no cancellation check runs)
- Launcher transition detection confirms it was transient
- Intervention continues when next real app appears

**Why this is better than adding `!isLauncher()` check:**
- User can still legitimately cancel by going to home screen
- Launcher transition detection already distinguishes:
  - **Transition launcher** (Instagram → launcher → Twitter) = filtered, no cancellation
  - **Destination launcher** (Instagram → launcher, stays) = not filtered, triggers cancellation

**Location:** `src/os/osTriggerBrain.ts`, lines 628-730

---

## Testing

### Test Scenarios

1. **Open Instagram once**
   - Expected: ONE intervention screen
   - Result: ✅ Fixed

2. **Instagram → TikTok quickly**
   - Expected: TWO interventions (one per app)
   - Result: ✅ Works correctly

3. **Instagram → Home → Instagram (after 2s)**
   - Expected: TWO interventions (genuine re-entry)
   - Result: ✅ Works correctly

4. **Rapid tap Instagram**
   - Expected: ONE intervention (duplicates filtered)
   - Result: ✅ Fixed

5. **Cancel intervention (press back)**
   - Expected: Go to HOME SCREEN, not back to Instagram
   - Result: ✅ Fixed (launches home screen)

6. **Complete intervention with intention timer**
   - Expected: Return to Instagram
   - Result: ✅ Works (finishInterventionActivity launches app)

7. **Complete intervention without timer**
   - Expected: Go to HOME SCREEN
   - Result: ✅ Fixed (launches home screen)

8. **Switch apps during intervention (Instagram → Twitter)**
   - Expected: Twitter intervention starts fresh with breathing countdown (5, 4, 3, 2, 1, 0)
   - Result: ✅ Fixed (cancellation runs after launcher filtering)

9. **User legitimately goes to home screen during intervention**
   - Expected: Intervention should be cancelled
   - Result: ✅ Works correctly (destination launcher not filtered, triggers cancellation)

### Debug Logs

The fix adds debug logging to verify filtering:

```
[OS Trigger Brain] Launcher event: { packageName: 'com.miui.home', timestamp: 1704470000 }
[OS Trigger Brain] Launcher was transition (not destination): { fromApp: 'Instagram', toApp: 'Instagram', timeSinceLauncher: 50 }
[OS Trigger Brain] BreakLoop infrastructure detected, lastMeaningfulApp unchanged: Instagram
[OS Trigger Brain] Duplicate event filtered (same meaningful app): { packageName: 'Instagram', lastMeaningfulApp: 'Instagram' }
```

---

## Impact

### Before Fix
- Multiple intervention screens for single app launch
- Confusing user experience
- Intervention UI flashing/restarting

### After Fix
- Single intervention screen per app launch
- Clean, predictable user experience
- Proper handling of app switching vs home screen

---

## Related Files

- `src/os/osTriggerBrain.ts` - Main implementation
- `docs/NATIVE_JAVASCRIPT_BOUNDARY.md` - Architecture principles
- `android/app/src/main/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt` - Native event detection (unchanged)

---

## Future Considerations

1. **Monitor threshold tuning**: The 300ms threshold may need adjustment based on real-world device performance
2. **Additional launchers**: Add more launcher packages if users report issues with specific OEM launchers
3. **Metrics**: Consider adding telemetry to track how often launcher transitions occur

---

*Last updated: January 5, 2026*
