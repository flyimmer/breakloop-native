# SystemSurface Bootstrap Phase 2 Fix

**Date:** January 6, 2025  
**Issue:** SystemSurface bootstrap calling removed function `evaluateTriggerLogic()`, causing ReferenceError and crash  
**Root Cause:** Phase 1 logic remained in SystemSurfaceRoot after Phase 2 refactor removed OS Trigger Brain from SystemSurface

## Problem

When opening Instagram, SystemSurface would:
1. ✅ System Brain correctly launches SystemSurface with `START_INTERVENTION_FLOW`
2. ❌ SystemSurfaceRoot calls `handleForegroundAppChange()` during bootstrap
3. ❌ `handleForegroundAppChange()` internally calls `evaluateTriggerLogic()`
4. ❌ `evaluateTriggerLogic()` was deleted in Phase 2 cleanup
5. ❌ ReferenceError: Property 'evaluateTriggerLogic' doesn't exist
6. ❌ Bootstrap fails, session ends, activity closes
7. ❌ User sees home screen instead of intervention

**Log Evidence:**
```
ERROR  [SystemSurfaceRoot] ❌ Bootstrap initialization failed: [ReferenceError: Property 'evaluateTriggerLogic' doesn't exist]
LOG  [SystemSession] dispatchSystemEvent: {"type": "END_SESSION"}
LOG  [SystemSession] Ending session {"shouldLaunchHome": true}
```

## Root Cause Analysis

### Phase 2 Architecture (Correct)
- **System Brain:** Evaluates OS Trigger Brain, pre-decides UI flow, launches SystemSurface with explicit wake reason
- **SystemSurface:** Consumes wake reason, dispatches session, renders UI
- **No re-evaluation:** SystemSurface does NOT run OS Trigger Brain logic

### What Went Wrong
During Phase 2 cleanup, we removed:
- ✅ `evaluateTriggerLogic()` from `osTriggerBrain.ts`
- ✅ `startInterventionFlow()` from `osTriggerBrain.ts`
- ❌ **MISSED:** Removing the call to `handleForegroundAppChange()` from `SystemSurfaceRoot.tsx`

This left SystemSurfaceRoot trying to call deleted functions.

## Solution

Removed all OS Trigger Brain logic from SystemSurfaceRoot bootstrap:

### Changes Made

**File:** `app/roots/SystemSurfaceRoot.tsx`

1. **Removed import (line 22):**
   ```typescript
   // DELETED:
   import { handleForegroundAppChange } from '@/src/os/osTriggerBrain';
   ```

2. **Removed OS Trigger Brain call (lines 140-153):**
   ```typescript
   // DELETED:
   if (__DEV__) {
     console.log('[SystemSurfaceRoot] 🧠 Running OS Trigger Brain in SystemSurface context...');
   }
   
   handleForegroundAppChange(
     {
       packageName: triggeringApp,
       timestamp: Date.now(),
     },
     { force: true }
   );
   ```

3. **Updated bootstrap comments (lines 93-103):**
   ```typescript
   /**
    * BOOTSTRAP INITIALIZATION (Cold Start)
    * 
    * Phase 2 Bootstrap (System Brain pre-decided):
    * 1. Read wakeReason + triggeringApp from Intent extras
    * 2. Map wake reason → START_QUICK_TASK or START_INTERVENTION
    * 3. Dispatch exactly one session
    * 4. Set bootstrapState = READY
    * 
    * NO OS Trigger Brain evaluation in SystemSurface.
    * System Brain already made the decision.
    */
   ```

4. **Simplified session dispatch logic:**
   - Removed verbose comments
   - Kept clean wake reason → session type mapping
   - Maintained guardrails for old wake reasons (transitional compatibility)

## Phase 2 Bootstrap Flow (After Fix)

```
1. System Brain receives FOREGROUND_CHANGED event
2. System Brain evaluates OS Trigger Brain
3. System Brain decides: SHOW_QUICK_TASK_DIALOG or START_INTERVENTION_FLOW
4. System Brain launches SystemSurface with wake reason
5. SystemSurface reads wake reason from Intent extras
6. SystemSurface maps wake reason → session type
7. SystemSurface dispatches session (START_QUICK_TASK or START_INTERVENTION)
8. SystemSurface sets bootstrap to READY
9. SystemSurface renders appropriate flow
```

**No re-evaluation, no duplicate logic, no crash.**

## Expected Behavior After Fix

### Opening Instagram:
```
[System Brain] Foreground changed to: com.instagram.android
[System Brain] Checking if app is monitored: { isMonitoredAppFunction: "function", packageName: "com.instagram.android" }
[System Brain] Monitored app check result: { isMonitored: true, packageName: "com.instagram.android" }
[System Brain] Evaluating OS Trigger Brain for: com.instagram.android
[System Brain] ✗ n_quickTask = 0 - launching with START_INTERVENTION_FLOW
[System Brain] 🚀 Launching SystemSurface: { triggeringApp: "com.instagram.android", wakeReason: "START_INTERVENTION_FLOW" }

[SystemSurfaceRoot] 🚀 Bootstrap initialization starting...
[SystemSurfaceRoot] 📋 Intent extras: { triggeringApp: "com.instagram.android", wakeReason: "START_INTERVENTION_FLOW" }
[SystemSession] Event: START_INTERVENTION { type: "START_INTERVENTION", app: "com.instagram.android" }
[SystemSurfaceRoot] ✅ Bootstrap initialization complete
[SystemSurfaceRoot] Rendering InterventionFlow for app: com.instagram.android
```

**Result:** Intervention shows correctly, no crash, no home screen.

## Architectural Compliance

This fix completes the Phase 2 architecture:

### System Brain (Headless Task)
- ✅ Receives mechanical events from native
- ✅ Classifies semantic meaning
- ✅ Evaluates OS Trigger Brain (priority chain)
- ✅ Pre-decides UI flow
- ✅ Launches SystemSurface with explicit wake reason
- ✅ Single source of semantic truth

### SystemSurface (UI Context)
- ✅ Receives wake reason from System Brain
- ✅ Maps wake reason to session type
- ✅ Dispatches session
- ✅ Renders UI
- ✅ NO semantic logic
- ✅ NO OS Trigger Brain evaluation
- ✅ NO re-computation

### Native (Kotlin)
- ✅ Emits mechanical events to System Brain
- ✅ Launches SystemSurface when requested by System Brain
- ✅ Passes wake reason via Intent extras
- ✅ NO semantic decisions

## Related Fixes

This fix builds on previous fixes in the same session:

1. **Storage Key Fix:** Fixed `n_quickTask` storage key mismatch
2. **Monitored App Guard:** Added guard to skip non-monitored apps in System Brain
3. **Import Path Fix:** Changed `@/src/os/osConfig` to `../os/osConfig` for Headless Task context
4. **Bootstrap Fix (this):** Removed OS Trigger Brain from SystemSurface bootstrap

All fixes together ensure:
- ✅ System Brain is the only place that evaluates OS Trigger Brain
- ✅ SystemSurface only renders decisions made by System Brain
- ✅ No duplicate logic, no crashes, no architectural violations

## Testing

**Test Case:** Open Instagram with `n_quickTask = 0`

**Expected:**
1. ✅ System Brain evaluates OS Trigger Brain
2. ✅ System Brain launches SystemSurface with `START_INTERVENTION_FLOW`
3. ✅ SystemSurface dispatches `START_INTERVENTION` session
4. ✅ Intervention flow renders (breathing screen)
5. ✅ No ReferenceError
6. ✅ No crash
7. ✅ No home screen

**Actual:** (After fix) All expected behaviors confirmed.

## Related Documentation

- `docs/SYSTEM_BRAIN_ARCHITECTURE.md` - System Brain architecture
- `docs/SYSTEM_SURFACE_ARCHITECTURE.md` - SystemSurface architecture
- `docs/NATIVE_JAVASCRIPT_BOUNDARY.md` - Architectural boundary rules
- `docs/system_surface_bootstrap.md` - Bootstrap lifecycle
- `docs/BREAKLOOP_APP_INTERVENTION_FIX.md` - Monitored app guard fix
