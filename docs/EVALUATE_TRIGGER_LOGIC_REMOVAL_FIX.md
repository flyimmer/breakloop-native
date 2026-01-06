# evaluateTriggerLogic() Removal Fix

**Date:** January 6, 2025  
**Issue:** ReferenceError in intervention screen: "Property 'evaluateTriggerLogic' doesn't exist"  
**Root Cause:** Dead code in `osTriggerBrain.ts` still calling removed function

## Problem

After removing the import from `SystemSurfaceRoot.tsx`, the intervention screen showed an error:

```
Property 'evaluateTriggerLogic' doesn't exist
```

The intervention UI loaded, but with an error overlay at the bottom.

## Root Cause Analysis

### What We Missed in Phase 2 Cleanup

When we removed `evaluateTriggerLogic()` function from `osTriggerBrain.ts`, we removed:
- ✅ The function definition
- ✅ The import from `SystemSurfaceRoot.tsx`
- ❌ **MISSED:** Two calls to the function inside `osTriggerBrain.ts` itself

### The Two Remaining Calls

**Call 1: Line 487 in `handleForegroundAppChange()`**
```typescript
// Decision tree per OS Trigger Contract V1:
// 1. Check t_intention (per-app)
// 2. If t_intention = 0: Check n_quickTask (global)
//    - If n_quickTask != 0: Check t_quickTask (per-app)
//      - If t_quickTask != 0: suppress
//      - If t_quickTask = 0: show Quick Task dialog
//    - If n_quickTask = 0: start intervention

evaluateTriggerLogic(packageName, timestamp);  // ❌ Function doesn't exist!
```

**Call 2: Line 805 in timer expiration handler**
```typescript
// Clear the expired timer
intentionTimers.delete(packageName);

// Re-evaluate using nested logic (not direct intervention)
// This respects the priority chain: t_intention expired → check n_quickTask, etc.
evaluateTriggerLogic(packageName, currentTimestamp);  // ❌ Function doesn't exist!
```

### Why This Wasn't Caught Earlier

The error only appeared when:
1. SystemSurface actually rendered (Instagram opened)
2. The intervention flow started
3. React Native tried to execute the code path

During our testing, we were hitting crashes before reaching this point, so the error was hidden.

## Solution

Removed both calls to `evaluateTriggerLogic()` and replaced with Phase 2 comments.

### Changes Made

**File:** `src/os/osTriggerBrain.ts`

**Change 1: Line 477-491 (handleForegroundAppChange)**

Before:
```typescript
// ============================================================================
// Evaluate trigger logic using nested decision tree
// ============================================================================
// Decision tree per OS Trigger Contract V1:
// 1. Check t_intention (per-app)
// 2. If t_intention = 0: Check n_quickTask (global)
//    - If n_quickTask != 0: Check t_quickTask (per-app)
//      - If t_quickTask != 0: suppress
//      - If t_quickTask = 0: show Quick Task dialog
//    - If n_quickTask = 0: start intervention

evaluateTriggerLogic(packageName, timestamp);

// Update tracking
lastForegroundApp = packageName;
lastMeaningfulApp = packageName;
```

After:
```typescript
// ============================================================================
// Phase 2: evaluateTriggerLogic() removed
// ============================================================================
// System Brain handles all trigger logic evaluation.
// This file (osTriggerBrain.ts) is no longer used in SystemSurface context.
// SystemSurface only consumes wake reasons from System Brain.

// Update tracking
lastForegroundApp = packageName;
lastMeaningfulApp = packageName;
```

**Change 2: Line 800-805 (timer expiration handler)**

Before:
```typescript
// Clear the expired timer
intentionTimers.delete(packageName);

// Re-evaluate using nested logic (not direct intervention)
// This respects the priority chain: t_intention expired → check n_quickTask, etc.
evaluateTriggerLogic(packageName, currentTimestamp);
```

After:
```typescript
// Clear the expired timer
intentionTimers.delete(packageName);

// Phase 2: evaluateTriggerLogic() removed
// System Brain handles all trigger logic evaluation.
```

## Why This File Still Exists

You might ask: "If `osTriggerBrain.ts` is no longer used in SystemSurface, why keep it?"

**Answer:** The file still contains useful functions that ARE used:
- `setQuickTaskTimer()` - Called when user chooses Quick Task
- `setIntentionTimer()` - Called when user sets intention
- Timer management functions
- State tracking (intentionTimers, quickTaskTimers, etc.)

Only the **decision-making logic** (`evaluateTriggerLogic()`) was moved to System Brain. The **state management and timer functions** remain here.

## Expected Behavior After Fix

### Opening Instagram:

1. ✅ System Brain evaluates OS Trigger Brain
2. ✅ System Brain launches SystemSurface with `START_INTERVENTION_FLOW`
3. ✅ SystemSurfaceRoot reads wake reason
4. ✅ SystemSurfaceRoot dispatches `START_INTERVENTION` session
5. ✅ Intervention flow renders (breathing screen)
6. ✅ **NO error overlay**
7. ✅ Clean UI, no ReferenceError

### Logs should show:
```
[SystemSurfaceRoot] 🚀 Bootstrap initialization starting...
[SystemSurfaceRoot] 📋 Intent extras: { triggeringApp: "com.instagram.android", wakeReason: "START_INTERVENTION_FLOW" }
[SystemSession] Event: START_INTERVENTION { type: "START_INTERVENTION", app: "com.instagram.android" }
[SystemSurfaceRoot] ✅ Bootstrap initialization complete
[SystemSurfaceRoot] Rendering InterventionFlow for app: com.instagram.android
```

No error, clean intervention UI.

## Verification

After rebuild:
```bash
npm run android
```

Open Instagram → Intervention shows with no error overlay.

## Related Fixes

This is the **third fix** in the Phase 2 cleanup sequence:

1. **Storage Key Fix:** Fixed `n_quickTask` storage key mismatch
2. **Monitored App Guard:** Added guard to skip non-monitored apps in System Brain
3. **Import Path Fix:** Changed `@/src/os/osConfig` to `../os/osConfig`
4. **Bootstrap Fix:** Removed `handleForegroundAppChange()` call from SystemSurfaceRoot
5. **evaluateTriggerLogic Fix (this):** Removed remaining calls to deleted function

All fixes together ensure Phase 2 architecture is complete and working.

## Related Documentation

- `docs/SYSTEM_BRAIN_ARCHITECTURE.md` - System Brain architecture
- `docs/SYSTEM_SURFACE_ARCHITECTURE.md` - SystemSurface architecture
- `docs/SYSTEMSURFACE_BOOTSTRAP_PHASE2_FIX.md` - Bootstrap fix
- `docs/BREAKLOOP_APP_INTERVENTION_FIX.md` - Monitored app guard fix
