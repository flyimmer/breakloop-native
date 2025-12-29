# App Switch During Intervention - Fix Documentation

## Problem Statement

**Issue:** When a user switches from one monitored app (e.g., Instagram) to another monitored app (e.g., TikTok) during an active intervention, the intervention state was NOT reset. This caused:

1. The intervention UI to show the wrong app name (still showing Instagram when on TikTok)
2. Root cause selections from Instagram to carry over to TikTok
3. Intervention state to mix between different apps
4. Confusing user experience where each app doesn't get its own independent intervention

**Expected Behavior:** Each monitored app should get its own independent intervention flow. When switching apps during an active intervention, the old intervention should be abandoned and a fresh intervention should start for the new app.

## Root Cause Analysis

The intervention system had two layers that needed coordination:

1. **Intervention State Machine** (`src/core/intervention/`):
   - Tracks intervention state (breathing, root-cause, alternatives, etc.)
   - Stores `targetApp` to identify which app triggered the intervention
   - Did NOT reset state when `BEGIN_INTERVENTION` was dispatched for a different app

2. **OS Trigger Brain** (`src/os/osTriggerBrain.ts`):
   - Tracks which apps have interventions in progress
   - Prevents duplicate intervention triggers for the same app
   - Did NOT clear the old app's in-progress flag when a new app triggered

**The Problem:** When switching from Instagram to TikTok:
- OS Trigger Brain would mark TikTok as "in progress"
- But Instagram was still marked as "in progress" (never cleared)
- Intervention state machine kept the old state (root causes from Instagram)
- Result: TikTok intervention showed Instagram's state

## Solution

The fix required changes at three layers of the intervention system:

### 1. Intervention State Machine Fix

**File:** `src/core/intervention/transitions.js`

**Change:** Updated `BEGIN_INTERVENTION` action to always reset intervention state, regardless of whether an intervention is already active.

```javascript
case 'BEGIN_INTERVENTION':
  // If intervention is already active for a DIFFERENT app, reset and start fresh
  // This ensures each app gets its own independent intervention flow
  const isDifferentApp = context.targetApp && context.targetApp !== action.app;
  
  return {
    ...context,
    state: 'breathing',
    targetApp: action.app,
    breathingCount: action.breathingDuration,
    selectedCauses: [],
    selectedAlternative: null,
    actionTimer: 0,
  };
```

**Key Points:**
- Always resets `selectedCauses`, `selectedAlternative`, and `actionTimer`
- Updates `targetApp` to the new app
- Restarts breathing countdown
- Previous intervention state is completely discarded

### 2. Navigation Handler Fix

**File:** `app/App.tsx`

**Change:** Updated navigation effect to watch both `state` AND `targetApp` to detect app switches.

```typescript
useEffect(() => {
  if (!navigationRef.current?.isReady()) {
    return;
  }

  const stateChanged = state !== previousStateRef.current;
  const appChanged = targetApp !== previousTargetAppRef.current;

  // If neither state nor app changed, do nothing
  if (!stateChanged && !appChanged) {
    return;
  }

  // Update refs
  previousStateRef.current = state;
  previousTargetAppRef.current = targetApp;

  // If app changed and we're in breathing state, force navigate to Breathing
  // This handles the case where user switches apps during intervention
  if (appChanged && state === 'breathing') {
    console.log('[Navigation] App switch detected, forcing navigation to Breathing screen');
    navigationRef.current.navigate('Breathing');
    return;
  }

  // ... normal state-based navigation
}, [state, targetApp]);
```

**Key Points:**
- Watches both `state` and `targetApp` changes
- Detects when app switches during intervention
- Forces navigation to Breathing screen when app changes
- Ensures user always starts from breathing screen for new app

### 3. OS Trigger Brain Fix

**File:** `src/os/osTriggerBrain.ts`

**Change:** Updated `triggerIntervention()` to clear ALL in-progress interventions before starting a new one.

```typescript
function triggerIntervention(packageName: string, timestamp: number): void {
  // Check if intervention already in progress for THIS SPECIFIC app
  if (interventionsInProgress.has(packageName)) {
    // Silent - no log spam for repeated checks
    return;
  }

  // If there's an intervention in progress for a DIFFERENT app, clear it
  // This ensures each app gets its own independent intervention
  if (interventionsInProgress.size > 0) {
    const oldApps = Array.from(interventionsInProgress);
    interventionsInProgress.clear();
    console.log('[OS Trigger Brain] Clearing previous intervention(s) for app switch', {
      oldApps,
      newApp: packageName,
    });
  }

  // Mark intervention as in-progress for this app
  interventionsInProgress.add(packageName);
  
  // ... rest of function
}
```

**Key Points:**
- Checks if ANY intervention is in progress (not just for this app)
- Clears ALL in-progress flags before starting new intervention
- Logs the app switch for debugging
- Ensures only ONE app can have an active intervention at a time

## Testing

### Manual Testing Steps

1. **Setup:**
   - Ensure Instagram and TikTok are configured as monitored apps
   - Build and install the app on a device

2. **Test Scenario:**
   ```
   1. Open Instagram
   2. Intervention starts → Breathing screen appears
   3. Wait for breathing to complete → Root Cause screen appears
   4. Select "Boredom" as root cause
   5. WITHOUT proceeding to alternatives, switch to TikTok
   6. Expected: New intervention starts for TikTok
      - Breathing screen appears again
      - App name shows "TikTok" (not Instagram)
      - Root cause selection is empty (not showing "Boredom")
   ```

3. **Verification Points:**
   - ✅ TikTok intervention shows correct app name
   - ✅ Root cause screen is empty (no carried-over selections)
   - ✅ Breathing countdown restarts from beginning
   - ✅ Instagram intervention is completely abandoned

### Log Verification

When switching apps during intervention, you should see these logs:

```
[OS Trigger Brain] Clearing previous intervention(s) for app switch {
  oldApps: ['com.instagram.android'],
  newApp: 'com.zhiliaoapp.musically'  // TikTok
}
[OS Trigger Brain] BEGIN_INTERVENTION dispatched {
  packageName: 'com.zhiliaoapp.musically',
  timestamp: 1735478400000,
  time: '2024-12-29T12:00:00.000Z'
}
```

### Edge Cases Tested

1. **Rapid App Switching:**
   - Instagram → TikTok → Instagram (within seconds)
   - Each switch should start a fresh intervention

2. **Mid-Flow Switching:**
   - Switch during breathing countdown
   - Switch during root cause selection
   - Switch during alternatives browsing
   - All should reset properly

3. **Timer State:**
   - Switch during action timer (alternative activity timer)
   - Timer should reset for new app

## Implementation Details

### State Reset Behavior

When `BEGIN_INTERVENTION` is dispatched for a new app:

| State Variable | Old Value | New Value |
|---------------|-----------|-----------|
| `state` | Any intervention state | `'breathing'` |
| `targetApp` | Old app package name | New app package name |
| `breathingCount` | Any value | New breathing duration |
| `selectedCauses` | Array of causes | `[]` (empty) |
| `selectedAlternative` | Alternative object or null | `null` |
| `actionTimer` | Any value | `0` |

### In-Progress Tracking

The `interventionsInProgress` Set in OS Trigger Brain:

**Before Fix:**
```
Instagram intervention active → Set contains: ['com.instagram.android']
TikTok triggers → Set contains: ['com.instagram.android', 'com.zhiliaoapp.musically']
```

**After Fix:**
```
Instagram intervention active → Set contains: ['com.instagram.android']
TikTok triggers → Set cleared → Set contains: ['com.zhiliaoapp.musically']
```

### Intention Timer Behavior

**Important:** Intention timers are per-app and independent:

- Instagram's intention timer is NOT affected by TikTok's intervention
- When Instagram intervention is abandoned, its intention timer is deleted
- TikTok gets its own fresh intention timer after completing its intervention
- This ensures each app's usage is tracked independently

## Future Considerations

### Potential Enhancements

1. **Intervention History:**
   - Could track abandoned interventions for analytics
   - Might help identify patterns of app-switching behavior

2. **Smart Resume:**
   - Could optionally save intervention state per app
   - Allow resuming if user returns within a short window
   - **Note:** This would require careful UX design to avoid confusion

3. **Multi-App Interventions:**
   - Could detect patterns of switching between specific apps
   - Offer combined interventions for app pairs (e.g., Instagram + TikTok)

### Known Limitations

1. **No Intervention Stacking:**
   - Only one intervention can be active at a time
   - Previous intervention is always abandoned, never paused

2. **No State Persistence:**
   - Abandoned intervention state is lost forever
   - User must start fresh if they return to the original app

3. **No Cross-App Context:**
   - Each app's intervention is completely independent
   - No awareness of previous app's intervention choices

## Related Files

- `src/core/intervention/transitions.js` - State machine reducer (state reset logic)
- `src/core/intervention/state.js` - State definitions
- `src/os/osTriggerBrain.ts` - OS-level intervention triggering (in-progress tracking)
- `app/App.tsx` - Navigation handler (watches state AND targetApp for app switches)
- `src/contexts/InterventionProvider.tsx` - React Context provider

## Changelog

**Date:** December 29, 2024

**Changes:**
1. Updated `interventionReducer` to reset state on `BEGIN_INTERVENTION`
2. Updated navigation handler to watch both `state` and `targetApp` for app switches
3. Updated `triggerIntervention()` to clear previous in-progress flags
4. Added documentation comments explaining app-switch behavior
5. Created comprehensive documentation files

**Impact:**
- ✅ Each app gets independent intervention flow
- ✅ No state mixing between apps
- ✅ Correct app name displayed in intervention UI
- ✅ Navigation always resets to breathing screen on app switch
- ✅ Clean user experience when switching apps

