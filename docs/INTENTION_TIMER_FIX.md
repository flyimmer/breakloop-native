# Intention Timer Fix - Release User to Monitored App

## Problem

When the user selected a duration in the Intention Timer screen, the app would navigate back to the BreakLoop main menu instead of releasing the user to use the monitored app for the chosen time period.

**Expected Behavior:**
1. User selects a duration (e.g., 5m, 15m, 30m)
2. Intention timer is set in the OS Trigger Brain
3. Intervention state resets to `idle`
4. InterventionActivity finishes
5. User is released back to the monitored app
6. User can use the monitored app for the selected duration
7. When timer expires, intervention triggers again on next app entry

**Actual Behavior:**
1. User selects a duration
2. App navigates to MainTabs (BreakLoop main menu)
3. User is NOT released to the monitored app

## Root Cause

1. **Missing Action Handler**: The `SET_INTENTION_TIMER` action was not handled in the intervention reducer
2. **Missing OS Integration**: The IntentionTimerScreen did not call `setIntentionTimer()` in the OS Trigger Brain
3. **Missing Completion Signal**: The intervention was not marked as completed via `onInterventionCompleted()`
4. **Missing Navigation Handler**: The `timer` state was not handled in the navigation logic

## Solution

### 1. Added `SET_INTENTION_TIMER` Action Handler

**File:** `src/core/intervention/transitions.js`

Added a new case in the intervention reducer to handle `SET_INTENTION_TIMER`:

```javascript
case 'SET_INTENTION_TIMER':
  // User selected intention timer duration - reset to idle and release app
  // The OS Trigger Brain will handle setting the actual timer
  return {
    ...context,
    state: 'idle',
    targetApp: null,
    breathingCount: 0,
    selectedCauses: [],
    selectedAlternative: null,
    actionTimer: 0,
  };
```

This resets the intervention state to `idle`, which triggers the navigation handler to finish the InterventionActivity.

### 2. Integrated OS Trigger Brain in IntentionTimerScreen

**File:** `app/screens/conscious_process/IntentionTimerScreen.tsx`

Updated `handleSelectDuration()` to:
1. Call `setIntentionTimer()` to set the timer in the OS Trigger Brain
2. Call `onInterventionCompleted()` to mark intervention as completed
3. Dispatch `SET_INTENTION_TIMER` action to reset intervention state

```typescript
const handleSelectDuration = (durationMinutes: number) => {
  const currentTimestamp = Date.now();
  const durationMs = durationMinutes * 60 * 1000;

  // Set intention timer in OS Trigger Brain for the target app
  if (interventionState.targetApp) {
    setIntentionTimer(interventionState.targetApp, durationMs, currentTimestamp);
    
    // Mark intervention as completed so future expirations can trigger new interventions
    onInterventionCompleted(interventionState.targetApp);
  }

  // Dispatch action to reset intervention state to idle
  // This will trigger navigation handler to finish InterventionActivity
  // and release user back to the monitored app
  dispatchIntervention({
    type: 'SET_INTENTION_TIMER',
  });
};
```

### 3. Added Navigation Handler for `timer` State

**File:** `app/App.tsx`

Added navigation logic to show IntentionTimerScreen when state is `timer`:

```typescript
} else if (state === 'timer') {
  navigationRef.current.navigate('IntentionTimer');
```

### 4. Fixed Action Dispatching in Entry Points

**Files:**
- `app/screens/conscious_process/RootCauseScreen.tsx`
- `app/screens/conscious_process/AlternativesScreen.tsx`

Changed direct navigation calls to dispatch `PROCEED_TO_TIMER` action:

```typescript
// Before:
const handleNeedToUseIt = () => {
  navigation.navigate('IntentionTimer');
};

// After:
const handleNeedToUseIt = () => {
  dispatchIntervention({ type: 'PROCEED_TO_TIMER' });
};
```

This ensures the state machine is kept in sync with the navigation.

## Flow After Fix

### User Journey

1. **Intervention Triggered**: User opens Instagram → Breathing screen appears
2. **Root Cause Selection**: User selects causes OR clicks "I really need to use it"
3. **Intention Timer Screen**: User sees duration options (5m, 15m, 30m, 45m, 60m, Just 1 min)
4. **Duration Selection**: User taps a duration (e.g., "15m")
5. **OS Integration**:
   - `setIntentionTimer()` sets timer for Instagram (expires in 15 minutes)
   - `onInterventionCompleted()` marks intervention as completed
6. **State Reset**: Intervention state transitions to `idle`
7. **Activity Finish**: Navigation handler detects `idle` state → calls `finishInterventionActivity()`
8. **User Released**: InterventionActivity finishes → User returns to Instagram
9. **Timer Active**: User can use Instagram for 15 minutes
10. **Timer Expiration**: After 15 minutes, next Instagram entry triggers new intervention

### State Machine Flow

```
breathing → root-cause → timer (IntentionTimerScreen)
                            ↓
                      [User selects duration]
                            ↓
                    SET_INTENTION_TIMER action
                            ↓
                         idle state
                            ↓
                  finishInterventionActivity()
                            ↓
                   User released to app
```

## Testing Checklist

- [ ] Open monitored app (Instagram/TikTok)
- [ ] Breathing screen appears
- [ ] Click "I really need to use it" on Root Cause screen
- [ ] Intention Timer screen appears with duration options
- [ ] Select a duration (e.g., "5m")
- [ ] Verify: User is released back to the monitored app (NOT BreakLoop main menu)
- [ ] Verify: Console logs show intention timer set with correct duration
- [ ] Verify: Console logs show intervention completed
- [ ] Wait for timer to expire (or manually advance time)
- [ ] Re-open monitored app
- [ ] Verify: Intervention triggers again

## Related Files

### Modified Files
- `src/core/intervention/transitions.js` - Added `SET_INTENTION_TIMER` action handler
- `app/screens/conscious_process/IntentionTimerScreen.tsx` - Integrated OS Trigger Brain
- `app/App.tsx` - Added navigation handler for `timer` state
- `app/screens/conscious_process/RootCauseScreen.tsx` - Fixed action dispatching
- `app/screens/conscious_process/AlternativesScreen.tsx` - Fixed action dispatching

### Related Documentation
- `spec/Intervention_OS_Contract.docx` - OS Trigger Contract specification
- `design/A2_EXIT_NORMALIZATION_IMPLEMENTATION.md` - Intention timer design
- `docs/OS_TRIGGER_STEP_5E_SUMMARY.md` - Intention timer expiration logic
- `docs/APP_SWITCH_INTERVENTION_FIX.md` - App switch intervention independence

## Notes

- The intention timer is per-app (Instagram has its own timer, TikTok has its own timer)
- Timers persist across app exits (brief exits don't reset the timer)
- Timers are overwritten only when a new intervention is triggered
- When timer expires, intervention triggers on next app entry (or immediately if app is in foreground)
- The OS Trigger Brain checks for timer expiration every 5 seconds (see `App.tsx` useEffect)

## Date

December 29, 2025

