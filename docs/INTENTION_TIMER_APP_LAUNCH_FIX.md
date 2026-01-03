# Intention Timer App Launch Fix

**Date:** January 3, 2026  
**Issue:** When user selects intention timer (e.g., 5 minutes), the app returns to home screen instead of launching the target app (Instagram)

## Problem Description

When a user opens a monitored app (e.g., Instagram) and chooses to set an intention timer (5/15/30/45/60 minutes), the system correctly:
1. ✅ Sets the intention timer in `osTriggerBrain`
2. ✅ Stores the timer in native SharedPreferences
3. ✅ Transitions intervention state to `idle`

However, the system incorrectly:
4. ❌ Launches home screen instead of the target app
5. ❌ User must manually reopen Instagram to use it

**Expected behavior:** User should be immediately returned to Instagram to use it for the selected duration.

## Root Cause

The issue was in the intervention completion logic in `App.tsx` (lines 218-259). When the intervention state transitions to `idle`, the code **always** launches the home screen, without distinguishing between:

1. **Intention timer set** → User should access the app immediately
2. **Full intervention completed** → User should return to home screen

The reducer was also clearing `targetApp` when `SET_INTENTION_TIMER` was dispatched, making it impossible to know which app to launch.

## Solution

### 1. Add `intentionTimerSet` flag to intervention state

**File:** `src/core/intervention/state.js`

Added new flag to track whether the user selected an intention timer:

```javascript
export const createInitialInterventionContext = () => ({
  state: 'idle',
  targetApp: null,
  breathingCount: 3,
  selectedCauses: [],
  selectedAlternative: null,
  actionTimer: 0,
  wasCanceled: false,
  intentionTimerSet: false, // NEW: Track if intention timer was set
});
```

### 2. Preserve `targetApp` when intention timer is set

**File:** `src/core/intervention/transitions.js`

Modified `SET_INTENTION_TIMER` case to:
- Keep `targetApp` (instead of clearing it)
- Set `intentionTimerSet: true` flag

```javascript
case 'SET_INTENTION_TIMER':
  return {
    ...context,
    state: 'idle',
    targetApp: context.targetApp, // PRESERVE target app
    breathingCount: 0,
    selectedCauses: [],
    selectedAlternative: null,
    actionTimer: 0,
    intentionTimerSet: true, // SET flag
  };
```

### 3. Clear flag on new intervention or completion

Updated these cases to reset `intentionTimerSet: false`:
- `BEGIN_INTERVENTION` - Starting new intervention
- `RESET_INTERVENTION` - Canceling intervention
- `FINISH_REFLECTION` - Completing full intervention

### 4. Launch correct screen based on flag

**File:** `app/App.tsx` (lines 218-259)

Modified intervention completion logic:

```typescript
if (state === 'idle' && previousStateRef.current !== 'idle') {
  const intentionTimerSet = interventionState.intentionTimerSet;
  const appToLaunch = intentionTimerSet ? targetApp : previousTargetAppRef.current;
  
  if (intentionTimerSet && appToLaunch) {
    // Finish InterventionActivity - native code will launch the target app
    // finishInterventionActivity() reads triggeringApp from Intent extras
    AppMonitorModule.finishInterventionActivity();
  } else {
    // Return to home screen (full intervention completed)
    AppMonitorModule.launchHomeScreen();
  }
}
```

## Testing

### Test Case 1: Intention Timer (5 minutes)

**Steps:**
1. Open Instagram
2. Intervention triggers
3. Complete breathing countdown
4. Select "I really need to use it"
5. Choose "5m" duration

**Expected Result:**
- ✅ Instagram launches immediately
- ✅ User can use Instagram for 5 minutes
- ✅ Timer is set in OS Trigger Brain
- ✅ No intervention triggers during 5-minute window

### Test Case 2: Full Intervention (Alternative Activity)

**Steps:**
1. Open Instagram
2. Intervention triggers
3. Complete breathing countdown
4. Select root causes
5. Choose an alternative activity
6. Complete activity timer
7. Complete reflection

**Expected Result:**
- ✅ Home screen launches (not Instagram)
- ✅ User must manually reopen Instagram
- ✅ New intervention triggers on next open

### Test Case 3: Intention Timer Expiration

**Steps:**
1. Set 5-minute intention timer for Instagram
2. Use Instagram for 5 minutes
3. Wait for timer to expire

**Expected Result:**
- ✅ New intervention triggers after 5 minutes
- ✅ User must complete intervention or set new timer

## Files Modified

1. `src/core/intervention/state.js` - Added `intentionTimerSet` flag to initial state
2. `src/core/intervention/transitions.js` - Modified 4 action cases:
   - `BEGIN_INTERVENTION` - Clear flag
   - `SET_INTENTION_TIMER` - Set flag and preserve targetApp
   - `RESET_INTERVENTION` - Clear flag
   - `FINISH_REFLECTION` - Clear flag
3. `app/App.tsx` - Updated intervention completion logic to check flag and launch appropriate screen

## Impact

- ✅ Intention timer now works as expected
- ✅ User can immediately use app after setting timer
- ✅ Full intervention flow still returns to home screen
- ✅ No breaking changes to existing behavior
- ✅ All intervention flows tested and working

## Related Documentation

- `docs/SYSTEM_SURFACE_ARCHITECTURE.md` - System surface architecture
- `docs/APP_SWITCH_INTERVENTION_FIX.md` - Previous app switch fix
- `design/A2_EXIT_NORMALIZATION_IMPLEMENTATION.md` - Intention timer design
