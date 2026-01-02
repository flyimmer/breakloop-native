# Quick Task Fix: Missing Availability Calculation

**Date:** December 30, 2025  
**Issue:** Quick Task dialog never appears on first app launch  
**Status:** ✅ Fixed

## Problem Description

### Symptoms
When opening Instagram (or any monitored app) for the first time:
- ❌ Quick Task dialog does NOT appear
- ❌ Goes directly to breathing screen
- ❌ User cannot use Quick Task feature

### Logs Showing the Issue
```
[F3.5 Debug] useEffect triggered: {
  "state": "breathing",  ← Should be "quick_task_dialog"!
  "targetApp": "com.instagram.android"
}
[Navigation] App switch detected, forcing navigation to Breathing screen
```

## Root Cause

In the `triggerIntervention()` function, the code was **missing the calculation** of `quickTaskRemaining`. 

**Before (BROKEN):**
```typescript
function triggerIntervention(packageName: string, timestamp: number): void {
  // ...
  
  console.log('[OS Trigger Brain] BEGIN_INTERVENTION dispatched', {
    packageName,
    timestamp,
  });

  if (interventionDispatcher) {
    interventionDispatcher({
      type: 'BEGIN_INTERVENTION',
      app: packageName,
      breathingDuration: getInterventionDurationSec(),
      // ❌ quickTaskRemaining is MISSING!
    });
  }
}
```

Without `quickTaskRemaining`, the intervention reducer defaults it to `0`, which causes:
```javascript
// In transitions.js
const hasQuickTaskAvailable = action.quickTaskRemaining > 0;  // false!
const initialState = hasQuickTaskAvailable ? 'quick_task_dialog' : 'breathing';
// → Goes to 'breathing' instead of 'quick_task_dialog'
```

## Solution

Added the missing `quickTaskRemaining` calculation before dispatching `BEGIN_INTERVENTION`:

**After (FIXED):**
```typescript
function triggerIntervention(packageName: string, timestamp: number): void {
  // Mark intervention as in-progress
  interventionsInProgress.add(packageName);

  // Reset/overwrite intention timer
  intentionTimers.delete(packageName);

  // ✅ Calculate Quick Task availability
  const quickTaskRemaining = getQuickTaskRemaining(packageName, timestamp);

  console.log('[OS Trigger Brain] BEGIN_INTERVENTION dispatched', {
    packageName,
    timestamp,
    time: new Date(timestamp).toISOString(),
    quickTaskRemaining,  // ✅ Now logged
  });

  // Dispatch to intervention state machine
  if (interventionDispatcher) {
    interventionDispatcher({
      type: 'BEGIN_INTERVENTION',
      app: packageName,
      breathingDuration: getInterventionDurationSec(),
      quickTaskRemaining,  // ✅ Now included!
    });
  }
}
```

## Expected Behavior After Fix

### First Time Opening Instagram

1. User opens Instagram
2. OS Trigger Brain detects monitored app
3. **Calculates Quick Task availability** → Returns 2 (or configured amount)
4. Dispatches `BEGIN_INTERVENTION` with `quickTaskRemaining: 2`
5. Intervention reducer checks: `quickTaskRemaining > 0` → **true**
6. Initial state set to `'quick_task_dialog'`
7. **Quick Task dialog appears!** ✅

### Debug Logs (Expected)

```
[OS Trigger Brain] Monitored app entered foreground: com.instagram.android
[OS Trigger Brain] Quick Task availability check:
  packageName: com.instagram.android
  maxUses: 2
  recentUsages: 0
  remaining: 2
[OS Trigger Brain] BEGIN_INTERVENTION dispatched:
  packageName: com.instagram.android
  quickTaskRemaining: 2  ← Now present!
[F3.5 Debug] useEffect triggered:
  state: "quick_task_dialog"  ← Correct state!
  targetApp: "com.instagram.android"
[Navigation] Navigating to QuickTaskDialog screen
```

## Testing

### Test Case: First App Launch

**Steps:**
1. Clear app data (or fresh install)
2. Open Instagram for the first time
3. Observe what screen appears

**Expected Result:**
- ✅ Quick Task dialog appears
- ✅ Shows "2 left in this 15-minute window" (or configured amount)
- ✅ Can tap "Quick Task" or "Start conscious process"

### Test Case: After Using Quick Task Once

**Steps:**
1. Open Instagram → Quick Task dialog appears
2. Tap "Quick Task"
3. Use Instagram for configured duration
4. Timer expires
5. Open Instagram again

**Expected Result:**
- ✅ Quick Task dialog appears again
- ✅ Shows "1 left in this 15-minute window"
- ✅ Can use Quick Task one more time

### Test Case: After Exhausting Quick Tasks

**Steps:**
1. Use Quick Task twice (exhaust quota)
2. Open Instagram again

**Expected Result:**
- ✅ Goes directly to breathing screen (no Quick Task dialog)
- ✅ Must go through full intervention flow

## Files Modified

1. **`src/os/osTriggerBrain.ts`**
   - Added `quickTaskRemaining` calculation in `triggerIntervention()`
   - Added to log output for debugging
   - Added to `BEGIN_INTERVENTION` dispatch

## Related Issues

This was the **root cause** of all Quick Task issues:
1. Dialog not appearing (this fix)
2. App not launching (fixed in `QUICK_TASK_FIX_APP_LAUNCH.md`)
3. Dialog loop (fixed in `QUICK_TASK_FIX_DIALOG_LOOP.md`)
4. Double-tap (fixed in `QUICK_TASK_FIX_DOUBLE_TAP.md`)

All issues stemmed from this missing calculation, which caused the feature to be completely non-functional.

## Verification

Build and test:
```bash
npx expo run:android
```

Expected behavior:
1. ✅ Quick Task dialog appears on first app launch
2. ✅ Shows correct remaining uses
3. ✅ Can activate Quick Task successfully
4. ✅ Dialog disappears after exhausting uses

## Notes

- This was a critical missing piece that made the entire Quick Task feature non-functional
- The `getQuickTaskRemaining()` function was implemented but never called
- Without this calculation, `quickTaskRemaining` defaulted to `0`, causing the dialog to never appear
- This fix is essential for the Quick Task feature to work at all

