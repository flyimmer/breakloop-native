# BreakLoop App Intervention Fix

**Date:** January 6, 2025  
**Issue:** Intervention was incorrectly starting when clicking on the BreakLoop app itself  
**Root Cause:** System Brain was evaluating OS Trigger Brain logic for ALL apps, including non-monitored apps

## Problem

When the user clicked on the BreakLoop app itself, the intervention flow would start. This was incorrect behavior - interventions should only start for monitored apps (e.g., Instagram, TikTok), not for the BreakLoop app.

## Root Cause Analysis

The `handleForegroundChange()` function in System Brain (`src/systemBrain/eventHandler.ts`) was evaluating OS Trigger Brain logic for every foreground app change, without first checking if the app was in the monitored apps list.

**Flow before fix:**
```
1. User opens BreakLoop app
2. ForegroundDetectionService emits FOREGROUND_CHANGED event
3. System Brain receives event
4. System Brain evaluates OS Trigger Brain (checks t_intention, t_quickTask, n_quickTask)
5. System Brain decides to launch SystemSurface
6. Intervention starts (WRONG)
```

## Solution

Added an early guard at the top of `handleForegroundChange()` to check if the app is monitored before evaluating OS Trigger Brain logic.

**Flow after fix:**
```
1. User opens BreakLoop app
2. ForegroundDetectionService emits FOREGROUND_CHANGED event
3. System Brain receives event
4. System Brain updates lastMeaningfulApp
5. System Brain checks: isMonitoredApp(packageName)?
6. If false → return immediately (no evaluation, no launch)
7. If true → evaluate OS Trigger Brain and decide
```

## Implementation

### Changes Made

**File:** `src/systemBrain/eventHandler.ts`

1. **Added import:**
```typescript
import { isMonitoredApp } from '@/src/os/osConfig';
```

2. **Added guard in `handleForegroundChange()`:**
```typescript
async function handleForegroundChange(
  packageName: string,
  timestamp: number,
  state: TimerState
): Promise<void> {
  console.log('[System Brain] Foreground changed to:', packageName);
  
  // Always update last meaningful app
  const previousApp = state.lastMeaningfulApp;
  state.lastMeaningfulApp = packageName;
  
  console.log('[System Brain] Foreground app updated:', {
    previous: previousApp,
    current: packageName,
  });
  
  // 🔒 GUARD: only monitored apps are eligible for OS Trigger Brain evaluation
  if (!isMonitoredApp(packageName)) {
    console.log('[System Brain] App is not monitored, skipping:', packageName);
    return;
  }
  
  // Phase 2: Evaluate OS Trigger Brain and pre-decide UI flow
  console.log('[System Brain] Evaluating OS Trigger Brain for:', packageName);
  
  // ... rest of OS Trigger Brain evaluation ...
}
```

### Key Design Decisions

1. **Always update `lastMeaningfulApp`:**
   - Even for non-monitored apps, we update the last meaningful app
   - This maintains accurate state for context tracking

2. **Early return for non-monitored apps:**
   - If app is not monitored, return immediately
   - No OS Trigger Brain evaluation
   - No SystemSurface launch

3. **Single source of truth:**
   - Uses `isMonitoredApp()` from `src/os/osConfig.ts`
   - No duplication of monitored app storage
   - No separate reads in System Brain

## Testing

**Expected behavior after fix:**

1. **Opening BreakLoop app:**
   - ✅ No intervention starts
   - ✅ `lastMeaningfulApp` is updated
   - ✅ Log shows: "App is not monitored, skipping: com.anonymous.breakloopnative"

2. **Opening monitored app (e.g., Instagram):**
   - ✅ OS Trigger Brain evaluates
   - ✅ Intervention or Quick Task starts (based on state)
   - ✅ Log shows: "Evaluating OS Trigger Brain for: com.instagram.android"

3. **Opening non-monitored app (e.g., Chrome):**
   - ✅ No intervention starts
   - ✅ `lastMeaningfulApp` is updated
   - ✅ Log shows: "App is not monitored, skipping: com.android.chrome"

## Architectural Compliance

This fix maintains the Phase 2 architecture:

- ✅ System Brain is the only place that evaluates OS Trigger Brain
- ✅ System Brain pre-decides UI flow (SHOW_QUICK_TASK_DIALOG or START_INTERVENTION_FLOW)
- ✅ SystemSurface only renders decisions made by System Brain
- ✅ Single source of truth for monitored apps (`osConfig.ts`)
- ✅ No duplication of logic or state

## Related Documentation

- `docs/SYSTEM_BRAIN_ARCHITECTURE.md` - System Brain architecture
- `docs/NATIVE_JAVASCRIPT_BOUNDARY.md` - Architectural boundary rules
- `src/os/osConfig.ts` - Monitored apps configuration
