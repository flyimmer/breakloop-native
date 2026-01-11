# Stuck Flag Auto-Recovery Fix

## Problem Summary

The `isSystemSurfaceActive` flag was stuck as `true`, blocking ALL SystemSurface launches (Quick Task dialogs and Interventions). This occurred even after implementing a startup clear fix.

### Evidence

From user's screenshot at 23:41:46:
```
[Decision Engine] Entry state: { "isSystemSurfaceActive": true, ... }
[SystemSurfaceInvariant] Duplicate launch suppressed (expected behavior)
[System Brain] Decision: NONE - no launch needed
```

### Root Cause Analysis

1. **Previous Fix Didn't Work**: The `clearSystemSurfaceActive()` call in `initializeSystemBrain()` was never executed because:
   - System Brain module (`src/systemBrain/index.ts`) loads lazily on first HeadlessTask event
   - By that time, the flag may already be `true` from a previous session
   - Module initialization happens too late

2. **Flag Persistence**: The `isSystemSurfaceActive` flag is a module-level variable that:
   - Persists across React Native fast refresh
   - Survives app crashes if module stays in memory
   - Never gets reset if `initializeSystemBrain()` doesn't run

3. **Missing Session Check**: The lifecycle guard checked the flag but never verified if an actual SystemSurface session exists.

## Solution Implemented

### Auto-Recovery Logic

Added automatic flag recovery at the START of every decision in `decideSystemSurfaceAction()`:

```typescript
// Auto-Recovery: Clear stuck lifecycle flag if no session exists
if (isSystemSurfaceActive) {
  // Check if there's actually an active SystemSurface session
  const cache = getInMemoryStateCache();
  const hasActiveSession = cache?.currentSession !== null;
  
  if (!hasActiveSession) {
    console.warn('[SystemSurfaceInvariant] ⚠️ Flag was stuck (no active session), auto-clearing', {
      app,
      eventType: event.type,
      flagWasStuck: true,
      timestamp: event.timestamp,
    });
    isSystemSurfaceActive = false;
    console.log('[SystemSurfaceInvariant] ✅ Stuck flag cleared, proceeding with decision');
  }
}
```

### How It Works

1. **On Every Decision**: Before checking the lifecycle guard, verify the flag state
2. **Reality Check**: If flag is `true`, check if there's actually an active session
3. **Auto-Clear**: If no session exists but flag is `true`, the flag is stuck → clear it automatically
4. **Continue Normally**: Proceed with normal decision logic (Quick Task or Intervention)

### Benefits

- **Self-Healing**: Automatically recovers from stuck flags without manual intervention
- **No Timing Dependencies**: Works regardless of when modules load or initialize
- **Defensive**: Checks reality (session state) vs. flag state on every decision
- **Logged**: Clear warnings when auto-recovery happens for debugging

## Expected Behavior After Fix

### Scenario 1: Normal Operation (Flag Not Stuck)

```
[Decision Engine] Entry state: { isSystemSurfaceActive: false, ... }
[Decision Engine] ✓ OS Trigger Brain: QUICK_TASK - showing dialog
[SystemSurfaceInvariant] LAUNCH { wakeReason: "SHOW_QUICK_TASK_DIALOG" }
```

### Scenario 2: Stuck Flag Auto-Recovery

```
[Decision Engine] Entry state: { isSystemSurfaceActive: true, ... }
[SystemSurfaceInvariant] ⚠️ Flag was stuck (no active session), auto-clearing
[SystemSurfaceInvariant] ✅ Stuck flag cleared, proceeding with decision
[Decision Engine] ✓ OS Trigger Brain: INTERVENTION - launching intervention flow
[SystemSurfaceInvariant] LAUNCH { wakeReason: "START_INTERVENTION_FLOW" }
```

### Scenario 3: Legitimate Duplicate (Flag Correctly True)

```
[Decision Engine] Entry state: { isSystemSurfaceActive: true, ... }
(No auto-clear warning - session exists)
[SystemSurfaceInvariant] Duplicate launch suppressed (expected behavior)
[System Brain] Decision: NONE - no launch needed
```

## Testing Checklist

After the build completes:

1. **Test with n_quickTask = 0**:
   - [ ] Set Quick Task quota to 0 in settings
   - [ ] Open monitored app (XHS, Instagram, Twitter)
   - [ ] Should see Intervention flow (NOT blank screen)
   - [ ] Check logs for auto-recovery if flag was stuck

2. **Test with n_quickTask > 0**:
   - [ ] Set Quick Task quota to 1 or more
   - [ ] Open monitored app
   - [ ] Should see Quick Task dialog (NOT blank screen)
   - [ ] Check logs for auto-recovery if flag was stuck

3. **Verify Auto-Recovery Logs**:
   - [ ] If flag was stuck, should see: "⚠️ Flag was stuck (no active session), auto-clearing"
   - [ ] Should see: "✅ Stuck flag cleared, proceeding with decision"
   - [ ] Should see normal LAUNCH log after recovery

4. **Test Legitimate Blocking**:
   - [ ] Open monitored app → SystemSurface launches
   - [ ] While SystemSurface is showing, switch to another monitored app
   - [ ] Should be blocked (correct behavior)
   - [ ] Should NOT see auto-recovery warning

## Files Modified

1. **`src/systemBrain/decisionEngine.ts`**:
   - Added `getInMemoryStateCache` import
   - Added auto-recovery logic before lifecycle guard check
   - Checks if session exists before blocking decisions

## Related Issues

This fix addresses:
- **UI Vacuum Bug**: Neither Quick Task nor Intervention appearing when opening monitored apps
- **Stuck Flag from Previous Session**: Flag remaining `true` after app crash or incomplete session
- **Module Load Timing**: Works regardless of when System Brain module loads

## Why This Fix Works

Unlike the previous fix that relied on module initialization timing, this fix:
1. **Runs on every decision** - No timing dependencies
2. **Checks reality** - Verifies actual session state vs. flag state
3. **Self-correcting** - Automatically recovers without external triggers
4. **Defensive** - Assumes the flag could be wrong and validates it

This is a more robust solution that handles all edge cases where the flag could get stuck.
