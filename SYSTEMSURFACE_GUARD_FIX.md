# SystemSurface Lifecycle Guard Fix

## Problem Summary

The `isSystemSurfaceActive` flag in `decisionEngine.ts` was stuck as `true`, blocking ALL SystemSurface launches (both Quick Task dialogs and Interventions).

### Evidence from Logs

1. **Every event blocked**: From the very first logged event (23:32:47), all decisions showed "Duplicate launch suppressed"
2. **No LAUNCH logs**: Searched entire terminal - ZERO occurrences of `[SystemSurfaceInvariant] LAUNCH`
3. **Flag stuck from previous session**: The flag was already `true` before any logged events, indicating it persisted from a previous session that didn't finish cleanly

### Root Cause

The `isSystemSurfaceActive` flag is:
- Set to `true` when SystemSurface launches
- Cleared when SystemSurface session finishes cleanly
- **BUT**: If the app crashes, is force-stopped, or the session doesn't finish properly, the flag remains stuck as `true`
- **AND**: React Native module caching can keep the flag in memory across app restarts

## Solution Implemented

### 1. Added Debug Logging

**File**: `src/systemBrain/decisionEngine.ts`

Added logging at the start of `decideSystemSurfaceAction()` to show flag state:

```typescript
// DEBUG: Log lifecycle guard state at entry
console.log('[Decision Engine] Entry state:', {
  app,
  eventType: event.type,
  isSystemSurfaceActive,
  timestamp: event.timestamp,
});
```

This will help diagnose:
- When the flag is stuck
- What events are being processed
- Whether the flag is being cleared properly

### 2. Added Flag Clear on Startup

**File**: `src/systemBrain/index.ts`

Modified `initializeSystemBrain()` to explicitly clear the flag on app startup:

```typescript
async function initializeSystemBrain() {
  try {
    console.log('[System Brain] Initializing...');
    
    // CRITICAL: Clear any stuck lifecycle flags from previous sessions
    clearSystemSurfaceActive();
    console.log('[System Brain] Lifecycle flags cleared');
    
    // Load current state
    const state = await loadTimerState();
    
    // Sync quota to Native
    await syncQuotaToNative(state);
    
    console.log('[System Brain] ✅ Initialization complete');
  } catch (error) {
    console.error('[System Brain] ❌ Initialization failed:', error);
  }
}
```

This ensures:
- Flag resets to `false` on every app startup
- Works even with React Native module caching
- Prevents stuck flags from previous sessions

## Expected Behavior After Fix

### On App Startup

Logs should show:
```
[System Brain] Initializing...
[System Brain] Lifecycle flags cleared
[System Brain] ✅ Initialization complete
```

### On First Monitored App Entry (e.g., XHS)

Logs should show:
```
[Decision Engine] Entry state: { app: "com.xingin.xhs", eventType: "FOREGROUND_CHANGED", isSystemSurfaceActive: false, ... }
[Decision Engine] Making decision for event: ...
```

Then either:
- `[SystemSurfaceInvariant] LAUNCH { app: "com.xingin.xhs", wakeReason: "SHOW_QUICK_TASK_DIALOG" }` (if quota available)
- `[SystemSurfaceInvariant] LAUNCH { app: "com.xingin.xhs", wakeReason: "START_INTERVENTION_FLOW" }` (if no quota)

### On Subsequent Events (Near-Simultaneous)

Logs should show:
```
[Decision Engine] Entry state: { ..., isSystemSurfaceActive: true, ... }
[SystemSurfaceInvariant] Duplicate launch suppressed (expected behavior)
```

This is CORRECT behavior - blocking duplicate launches while SystemSurface is active.

## Testing Checklist

After the build completes:

1. **Check startup logs**:
   - [ ] See "[System Brain] Lifecycle flags cleared"
   - [ ] Initialization completes successfully

2. **Open XHS or Instagram**:
   - [ ] See "[Decision Engine] Entry state" with `isSystemSurfaceActive: false`
   - [ ] See either Quick Task dialog OR Intervention screen (not blank)
   - [ ] See "[SystemSurfaceInvariant] LAUNCH" log

3. **Test flag lifecycle**:
   - [ ] Finish SystemSurface normally → Flag should clear
   - [ ] Open XHS again → Should launch again (not blocked)

4. **Test stuck flag recovery**:
   - [ ] Force-stop app while SystemSurface is showing
   - [ ] Restart app
   - [ ] Check logs show "Lifecycle flags cleared"
   - [ ] Open XHS → Should work (not blocked)

## Files Modified

1. `src/systemBrain/decisionEngine.ts` - Added debug logging
2. `src/systemBrain/index.ts` - Added flag clear on startup

## Related Issues

This fix addresses the root cause of the "UI vacuum" bug where neither Quick Task dialog nor Intervention appeared when opening monitored apps. The issue was NOT related to Phase 4.1 quota sync or Native decision emission - those are working correctly. The issue was the lifecycle guard blocking all launches due to a stuck flag.
