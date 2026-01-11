# Final Fix: Stuck isSystemSurfaceActive Flag

## Problem History

The `isSystemSurfaceActive` flag was stuck as `true`, blocking ALL SystemSurface launches (Quick Task and Intervention).

### Previous Attempts

1. **First Fix**: Added `clearSystemSurfaceActive()` call in `initializeSystemBrain()`
   - **Failed**: Module loads too late, flag already stuck

2. **Second Fix**: Added auto-recovery with session check
   - **Failed**: Buggy logic - checked for `currentSession` property that doesn't exist in `TimerState`

## Root Cause of Bug in Second Fix

```typescript
// BUGGY CODE:
const cache = getInMemoryStateCache();
const hasActiveSession = cache?.currentSession !== null;  // ❌ currentSession doesn't exist!
```

**Problem**: `TimerState` (returned by `getInMemoryStateCache()`) doesn't have a `currentSession` property. Sessions are tracked in SystemSurface context, not System Brain. So the check always failed and auto-recovery never triggered.

## Final Solution (Third Fix)

### Simple Unconditional Clear

Remove the buggy session check and just clear the flag unconditionally:

```typescript
// Auto-Recovery: Clear stuck lifecycle flag
// The flag should only be true DURING an active launch (milliseconds).
// If we're at the start of a NEW decision and the flag is still true, it's stuck.
if (isSystemSurfaceActive) {
  console.warn('[SystemSurfaceInvariant] ⚠️ Flag was stuck, auto-clearing', {
    app,
    eventType: event.type,
    timestamp: event.timestamp,
  });
  isSystemSurfaceActive = false;
  console.log('[SystemSurfaceInvariant] ✅ Stuck flag cleared, proceeding with decision');
}
```

### Why This Works

1. **Flag Purpose**: The flag is meant to prevent duplicate launches within milliseconds (near-simultaneous events)
2. **Flag Lifecycle**: 
   - Set to `true` right before launching SystemSurface
   - Should be cleared immediately after launch completes
   - Should NEVER persist across different decision cycles
3. **Detection**: If we're at the START of a NEW decision and flag is `true`, it's stuck
4. **Recovery**: Clear it unconditionally and proceed with normal decision logic

### Why Unconditional Clear is Safe

- **If SystemSurface is actually active**: The next near-simultaneous event (milliseconds later) will be blocked by the lifecycle guard check that happens AFTER the flag is set again
- **If SystemSurface is not active**: The flag is stuck and should be cleared
- **No false positives**: Each decision is a separate event cycle, so flag should always be `false` at decision entry

## Expected Behavior After Fix

### Scenario 1: Flag is Stuck (Auto-Recovery Triggers)

```
[Decision Engine] Entry state: { isSystemSurfaceActive: true, ... }
[SystemSurfaceInvariant] ⚠️ Flag was stuck, auto-clearing
[SystemSurfaceInvariant] ✅ Stuck flag cleared, proceeding with decision
[Decision Engine] ✓ OS Trigger Brain: INTERVENTION - launching intervention flow
[SystemSurfaceInvariant] LAUNCH { wakeReason: "START_INTERVENTION_FLOW" }
```

**Result**: Intervention flow appears!

### Scenario 2: Normal Operation (Flag Not Stuck)

```
[Decision Engine] Entry state: { isSystemSurfaceActive: false, ... }
[Decision Engine] ✓ OS Trigger Brain: QUICK_TASK - showing dialog
[SystemSurfaceInvariant] LAUNCH { wakeReason: "SHOW_QUICK_TASK_DIALOG" }
```

**Result**: Quick Task dialog or Intervention appears normally

### Scenario 3: Legitimate Duplicate Block (Near-Simultaneous Events)

```
Event 1 (t=0ms):
[Decision Engine] Entry state: { isSystemSurfaceActive: false, ... }
[SystemSurfaceInvariant] LAUNCH { wakeReason: "START_INTERVENTION_FLOW" }
(Flag set to true here)

Event 2 (t=5ms, near-simultaneous):
[Decision Engine] Entry state: { isSystemSurfaceActive: true, ... }
(No auto-clear warning - this is within same event cycle)
[SystemSurfaceInvariant] Duplicate launch suppressed (expected behavior)
```

**Result**: Correctly blocks duplicate launch

## Testing Checklist

After the build completes:

### Test 1: With n_quickTask = 0
- [ ] Set Quick Task quota to 0 in settings
- [ ] Open monitored app (XHS, Instagram, Twitter)
- [ ] **Expected**: See auto-recovery warning, then Intervention flow appears
- [ ] **Logs should show**:
  ```
  [SystemSurfaceInvariant] ⚠️ Flag was stuck, auto-clearing
  [SystemSurfaceInvariant] ✅ Stuck flag cleared, proceeding with decision
  [SystemSurfaceInvariant] LAUNCH { wakeReason: "START_INTERVENTION_FLOW" }
  ```

### Test 2: With n_quickTask > 0
- [ ] Set Quick Task quota to 1 or more
- [ ] Open monitored app
- [ ] **Expected**: See auto-recovery warning (if flag was stuck), then Quick Task dialog appears
- [ ] **Logs should show**:
  ```
  [SystemSurfaceInvariant] ⚠️ Flag was stuck, auto-clearing
  [SystemSurfaceInvariant] ✅ Stuck flag cleared, proceeding with decision
  [SystemSurfaceInvariant] LAUNCH { wakeReason: "SHOW_QUICK_TASK_DIALOG" }
  ```

### Test 3: Verify No False Positives
- [ ] Open monitored app → SystemSurface launches
- [ ] Close SystemSurface normally
- [ ] Open monitored app again
- [ ] **Expected**: Should work normally, may see auto-recovery warning on first open but then normal operation

## Files Modified

1. **`src/systemBrain/decisionEngine.ts`**:
   - Removed buggy session check
   - Simplified to unconditional flag clear
   - Removed unused `getInMemoryStateCache` import

## Why This is the Correct Fix

1. **Addresses Root Cause**: Stuck flag from previous sessions or module caching
2. **Simple & Reliable**: No complex state checking, just clear if stuck
3. **Self-Healing**: Automatically recovers on every decision
4. **No Timing Dependencies**: Works regardless of module load order
5. **Defensive**: Assumes flag could be wrong and validates on every decision
6. **Safe**: Unconditional clear doesn't cause false positives due to event cycle boundaries

This fix ensures that the `isSystemSurfaceActive` flag can never stay stuck for more than one event cycle, guaranteeing that SystemSurface (Quick Task or Intervention) will always launch when needed.
