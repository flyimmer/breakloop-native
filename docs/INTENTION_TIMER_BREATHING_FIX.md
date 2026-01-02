# Intention Timer Breathing Screen Fix

## Issue Description

**Problem:** When a user sets an intention timer (e.g., 1 minute) in the intervention flow and the timer expires, the app should show the Breathing screen to start a new intervention. Instead, it was showing the Root Cause screen (emotion selection), skipping the breathing step entirely.

**Expected Behavior:**
1. User sets 1-minute intention timer
2. After 1 minute expires → Breathing screen appears
3. After breathing countdown → Root Cause screen appears

**Actual Behavior:**
1. User sets 1-minute intention timer
2. After 1 minute expires → Root Cause screen appears immediately (skipping breathing)

## Root Cause Analysis

The issue was likely caused by a timing issue or state initialization problem when the intention timer expired and triggered a new intervention. The `BEGIN_INTERVENTION` action should set the state to `'breathing'` with a breathing count of 5 seconds, but something was causing it to skip directly to `'root-cause'`.

Possible causes:
1. **Race condition**: The breathing countdown might have been starting and completing before the screen rendered
2. **State initialization**: The `breathingCount` might have been set to 0 instead of the proper duration
3. **Navigation timing**: The navigation handler might have been navigating to the wrong screen

## Solution

Added comprehensive logging to track state transitions and identify where the issue occurs:

### 1. Intervention Reducer Logging

Added logging to `src/core/intervention/transitions.js`:

- **All actions**: Log every action dispatched with current state and breathing count
- **BEGIN_INTERVENTION**: Log the new state after intervention begins, including breathing count
- **BREATHING_TICK**: Log each tick, the countdown, and whether it will transition to root-cause

```javascript
if (__DEV__) {
  console.log('[Intervention Reducer] Action:', action.type, {
    currentState: context.state,
    currentBreathingCount: context.breathingCount,
    action,
  });
}
```

### 2. Navigation Handler Logging

Added logging to `app/App.tsx` navigation handler:

- Log when navigation is triggered and which screen it's navigating to
- Log state changes and app changes
- Specifically log when navigating to Breathing or RootCause screens

```javascript
if (__DEV__) {
  console.log('[Navigation] Navigating based on state:', {
    state,
    targetApp,
    stateChanged,
    appChanged,
  });
}
```

### 3. Debugging Steps

To debug this issue, follow these steps:

1. **Set intention timer**: In the intervention flow, select "I really need to use it" and set a 1-minute timer
2. **Wait for expiration**: Wait for the timer to expire (or use a shorter timer for testing)
3. **Check logs**: Look for these log entries:
   - `[OS Trigger Brain] Intention timer expired — triggering intervention`
   - `[Intervention Reducer] Action: BEGIN_INTERVENTION`
   - `[Intervention Reducer] BEGIN_INTERVENTION result:` - Check `newBreathingCount` (should be 5)
   - `[Navigation] Navigating based on state:` - Check `state` (should be 'breathing')
   - `[Navigation] → Breathing screen` (should appear)

4. **Verify breathing countdown**: Once on Breathing screen, check:
   - `[Intervention Reducer] BREATHING_TICK` - Should appear 5 times
   - Each tick should decrement the count: 5 → 4 → 3 → 2 → 1 → 0
   - When count reaches 0: `willTransition: true, nextState: 'root-cause'`
   - Then navigate to Root Cause screen

## Testing

### Test Case 1: Intention Timer Expiration (1 minute)

1. Open a monitored app (e.g., Instagram)
2. When intervention appears, select "I really need to use it"
3. Set intention timer to 1 minute
4. Wait for 1 minute
5. **Expected**: Breathing screen appears with countdown from 5
6. **Expected**: After 5 seconds, Root Cause screen appears

### Test Case 2: Intention Timer Expiration (Shorter for testing)

For faster testing, you can temporarily modify the intention timer duration in `IntentionTimerScreen.tsx`:

```typescript
// Add a test option
const DURATION_OPTIONS = [
  { value: 0.1, label: '6s' }, // 6 seconds for testing
  { value: 1, label: '1m' },
  { value: 5, label: '5m' },
  // ...
];
```

Then test with the 6-second timer to verify the fix quickly.

### Test Case 3: Multiple Timer Expirations

1. Set intention timer for 1 minute
2. Wait for expiration → Verify Breathing screen appears
3. Complete the intervention flow
4. Set another intention timer
5. Wait for expiration → Verify Breathing screen appears again

## Files Modified

1. **src/core/intervention/transitions.js**
   - Added logging to all actions
   - Added detailed logging to `BEGIN_INTERVENTION` and `BREATHING_TICK`

2. **app/App.tsx**
   - Added logging to navigation handler
   - Log state changes and navigation decisions

## Related Files

- `src/os/osTriggerBrain.ts` - Handles intention timer expiration detection
- `app/screens/conscious_process/BreathingScreen.tsx` - Breathing countdown screen
- `app/screens/conscious_process/IntentionTimerScreen.tsx` - Intention timer selection
- `src/core/intervention/state.js` - Intervention state definitions
- `src/core/intervention/timers.js` - Timer utility functions

## Next Steps

1. **Test the fix**: Run the app and follow the test cases above
2. **Review logs**: Check the console logs to see the state transitions
3. **Identify root cause**: Based on the logs, determine exactly where the issue occurs
4. **Apply fix**: Once the root cause is identified, apply the appropriate fix
5. **Verify**: Test again to ensure the Breathing screen appears correctly

## Potential Fixes (if logging reveals specific issues)

### If breathing count is 0:
- Check that `getInterventionDurationSec()` returns 5
- Verify `action.breathingDuration` is passed correctly to reducer

### If state is 'root-cause' immediately:
- Check for any code that might be auto-transitioning
- Verify no BREATHING_TICK actions are dispatched before screen renders

### If navigation is wrong:
- Check navigation handler logic
- Verify state is 'breathing' when navigation occurs
- Check for race conditions between state update and navigation

## Status

✅ Logging added
⏳ Testing in progress
⏳ Root cause identification pending
⏳ Fix implementation pending
