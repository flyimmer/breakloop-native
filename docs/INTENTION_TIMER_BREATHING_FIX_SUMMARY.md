# Intention Timer Breathing Fix - Summary

## Problem

When an intention timer expires (e.g., after 1 minute), the app should show the **Breathing screen** to start a new intervention. Instead, it was showing the **Root Cause screen** (emotion selection), skipping the breathing step entirely.

## Solution

Added comprehensive logging to track state transitions and identify where the issue occurs:

### Changes Made

1. **Intervention Reducer** (`src/core/intervention/transitions.js`)
   - Added logging for all actions
   - Added detailed logging for `BEGIN_INTERVENTION` (logs new state and breathing count)
   - Added detailed logging for `BREATHING_TICK` (logs countdown and transitions)

2. **Navigation Handler** (`app/App.tsx`)
   - Added logging for state-based navigation
   - Logs which screen is being navigated to
   - Logs state changes and app changes

## How to Debug

1. **Set a 1-minute intention timer** in the intervention flow
2. **Wait for expiration** (or use shorter timer for testing)
3. **Check console logs** for:
   ```
   [OS Trigger Brain] Intention timer expired — triggering intervention
   [Intervention Reducer] Action: BEGIN_INTERVENTION
   [Intervention Reducer] BEGIN_INTERVENTION result: { newBreathingCount: 5 }
   [Navigation] → Breathing screen
   [Intervention Reducer] BREATHING_TICK (5 times, counting down)
   [Navigation] → RootCause screen (after breathing completes)
   ```

4. **Identify the issue** based on the logs:
   - If `newBreathingCount` is 0 → breathing duration not set correctly
   - If state is `'root-cause'` immediately → auto-transition happening too early
   - If navigation goes to wrong screen → navigation handler issue

## Expected Behavior

1. Timer expires → `BEGIN_INTERVENTION` dispatched
2. State set to `'breathing'` with `breathingCount: 5`
3. Navigation handler navigates to Breathing screen
4. Breathing countdown ticks 5 times (5 → 4 → 3 → 2 → 1 → 0)
5. When count reaches 0 → auto-transition to `'root-cause'`
6. Navigation handler navigates to Root Cause screen

## Testing

Run the app and follow the test cases in `INTENTION_TIMER_BREATHING_FIX.md`. The logs will reveal exactly where the issue is occurring, allowing you to apply the appropriate fix.

## Files Modified

- `src/core/intervention/transitions.js` - Added logging
- `app/App.tsx` - Added navigation logging

## Next Steps

1. Test with the logging enabled
2. Review the console logs
3. Identify the root cause
4. Apply the specific fix based on findings
5. Verify the Breathing screen appears correctly
