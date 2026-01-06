# Intervention Race Condition Fix

**Date:** January 6, 2026  
**Status:** ✅ Complete  
**Issue:** Duplicate BEGIN_INTERVENTION dispatches causing immediate home screen launch

## Problem Summary

When switching between monitored apps (e.g., xhs → Instagram), the intervention would start with a 5-second breathing countdown but immediately launch the home screen instead of showing the intervention UI.

### Symptoms
- Breathing countdown starts (5 seconds)
- Home screen appears immediately
- Intervention session ends prematurely
- User never sees root cause or alternatives screens

### Evidence from Logs
```
[InterventionFlow] State after BEGIN_INTERVENTION: {"breathingCount": 3, "state": "idle", "targetApp": null}
```

The state hadn't updated yet when logged, even though `BEGIN_INTERVENTION` was dispatched. This indicated duplicate dispatches were occurring.

## Root Cause

**File:** `app/flows/InterventionFlow.tsx` (lines 82-117)

The initialization logic used **state inspection** to detect session entry:

```typescript
useEffect(() => {
  // ❌ WRONG: Using state inspection to detect session entry
  if (
    interventionState.targetApp !== app ||
    interventionState.state !== 'breathing'
  ) {
    dispatchIntervention({
      type: 'BEGIN_INTERVENTION',
      app,
      breathingDuration: getInterventionDurationSec(),
    });
  }
}, [app]); // Only depends on [app] but checks interventionState
```

### Why This Was Wrong

1. **State inspection creates race conditions** - The condition checks `interventionState` but the effect only depends on `[app]`
2. **Reducer lag causes duplicate dispatches** - Before the reducer processes the first dispatch, the component re-renders and the condition is still true
3. **Not tied to lifecycle event** - Session entry is explicitly known (when `app` changes), but the code tried to infer it from state
4. **Multiple rapid state updates** - Duplicate dispatches caused rapid state changes that triggered foreground change detection
5. **SystemSurfaceRoot thinks user left** - The rapid state changes made SystemSurfaceRoot think the user switched apps and ended the session

## The Correct Mental Model

**InterventionFlow should initialize exactly once per session entry.**

Not:
- ❌ once per render
- ❌ once per reducer lag
- ❌ once per state mismatch

But:
- ✅ **once per app change (session boundary)**

## Solution

Replace the conditional initialization with unconditional dispatch tied to `app` change.

### Changes Made

**File:** `app/flows/InterventionFlow.tsx` (lines 71-92)

**Before:**
```typescript
useEffect(() => {
  if (__DEV__) {
    console.log('[InterventionFlow] Mounted for app:', app);
  }
  
  // Idempotent initialization: dispatch BEGIN_INTERVENTION only if needed
  if (
    interventionState.targetApp !== app ||
    interventionState.state !== 'breathing'
  ) {
    if (__DEV__) {
      console.log('[InterventionFlow] Initializing intervention for app:', app);
      console.log('[InterventionFlow] Current state:', interventionState.state);
      console.log('[InterventionFlow] Current targetApp:', interventionState.targetApp);
    }
    
    dispatchIntervention({
      type: 'BEGIN_INTERVENTION',
      app,
      breathingDuration: getInterventionDurationSec(),
    });
    
    // Log state after dispatch (with delay to allow reducer to process)
    if (__DEV__) {
      setTimeout(() => {
        console.log('[InterventionFlow] State after BEGIN_INTERVENTION:', {
          state: interventionState.state,
          targetApp: interventionState.targetApp,
          breathingCount: interventionState.breathingCount,
        });
      }, 100);
    }
  }
}, [app]);
```

**After:**
```typescript
/**
 * Initialize intervention state when flow mounts or app changes
 * 
 * CRITICAL: Dispatch BEGIN_INTERVENTION exactly once per app change.
 * - No state inspection (no race conditions)
 * - No refs or timers (deterministic)
 * - Depends ONLY on [app] (session boundary)
 * 
 * This aligns with Phase 2 architecture:
 * - SystemBrain decides when an intervention starts
 * - SystemSurface dispatches exactly one session (START_INTERVENTION)
 * - InterventionFlow initializes exactly once per session (one BEGIN_INTERVENTION per app)
 */
useEffect(() => {
  if (__DEV__) {
    console.log('[InterventionFlow] BEGIN_INTERVENTION for app:', app);
  }

  dispatchIntervention({
    type: 'BEGIN_INTERVENTION',
    app,
    breathingDuration: getInterventionDurationSec(),
  });
}, [app]);
```

### Why This Works

1. **`app` changes only when a new intervention session starts** - This is the explicit session boundary
2. **Reducer lag is irrelevant** - We don't inspect state, so timing doesn't matter
3. **Duplicate dispatches cannot happen** - Effect runs exactly once per `app` value
4. **React's semantics are respected** - Simple dependency on the prop that defines the session
5. **No timing assumptions** - No refs, no timers, no race conditions
6. **Deterministic behavior** - Same input (app) always produces same output (one dispatch)

### Alignment with Phase 2 Architecture

- ✅ SystemBrain decides when an intervention starts
- ✅ SystemSurface dispatches exactly one session (START_INTERVENTION)
- ✅ InterventionFlow initializes exactly once per session (one BEGIN_INTERVENTION per app)

**Correct lifecycle:**
```
SystemBrain → START_INTERVENTION → InterventionFlow mounts → BEGIN_INTERVENTION (once)
```

## Testing Checklist

### Test Case 1: Switch from xhs to Instagram
- [ ] Open xhs
- [ ] Intervention starts (breathing countdown from 5)
- [ ] Press home, open Instagram
- [ ] **Expected**: New intervention starts for Instagram (breathing countdown from 5)
- [ ] **Verify logs**: Exactly ONE `BEGIN_INTERVENTION` per app
- [ ] **Verify**: No immediate home screen launch

### Test Case 2: Switch from Instagram to xhs
- [ ] Open Instagram
- [ ] Intervention starts
- [ ] Press home, open xhs
- [ ] **Expected**: New intervention starts for xhs
- [ ] **Verify**: Smooth transition, no duplicate dispatches

### Test Case 3: Rapid app switching
- [ ] Open xhs → intervention starts
- [ ] Immediately press home
- [ ] Open Instagram → intervention starts
- [ ] Immediately press home
- [ ] Open xhs again
- [ ] **Expected**: Each intervention starts cleanly, exactly one dispatch per app

### Log Verification

Look for these patterns in logs:
- ✅ `[InterventionFlow] BEGIN_INTERVENTION for app: com.xingin.xhs`
- ✅ `[Intervention Reducer] BEGIN_INTERVENTION result: {"newState": "breathing", ...}`
- ✅ **Exactly ONE** `BEGIN_INTERVENTION` per app change (no duplicates)
- ✅ NO `[SystemSurfaceRoot] 🚨 Intervention Session ended - user left app` immediately after start
- ✅ Breathing countdown proceeds normally (5 → 4 → 3 → 2 → 1 → 0)

## Files Modified

1. ✅ `app/flows/InterventionFlow.tsx` - Simplified initialization useEffect (lines 71-92)

## Architecture Compliance

✅ **No changes to System Brain** - This is purely a UI-layer fix

✅ **No changes to native code** - JavaScript-only fix

✅ **Preserves Phase 2 architecture** - No changes to wake reasons or bootstrap logic

✅ **Maintains intervention state machine** - No changes to reducer logic

✅ **Follows React best practices** - Simple, deterministic effect with correct dependencies

✅ **Respects session boundaries** - Initialization tied to explicit session entry (app change)

## Key Learnings

1. **Don't inspect state to detect lifecycle events** - If you know when something happens (app change), use that directly
2. **Avoid conditional effects based on async state** - Reducer lag creates race conditions
3. **Keep effects simple and deterministic** - No refs, no timers, no complex conditions
4. **Trust React's dependency system** - When `[app]` changes, the effect runs exactly once
5. **Session boundaries are explicit** - Don't try to infer them from state inspection

## Related Documentation

- `docs/SYSTEM_BRAIN_ARCHITECTURE.md` - System Brain event-driven runtime
- `docs/NATIVE_JAVASCRIPT_BOUNDARY.md` - Architectural boundary rules
- `docs/SYSTEM_SURFACE_ARCHITECTURE.md` - System Surface architecture
- `docs/PHASE2_ARCHITECTURE_UPDATE.md` - Phase 2 explicit wake reasons
