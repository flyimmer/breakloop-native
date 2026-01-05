# Cross-App Blocking Bug Fix

**Date:** January 5, 2026  
**Status:** COMPLETED

## Problem Summary

When a user opened Instagram (intervention started) then switched to X (Twitter), X would hang because:

1. Instagram intervention was marked "in progress" via `interventionsInProgress` Set
2. X tried to start intervention, but OS Trigger Brain blocked it with early return
3. SystemSurface woke for X but **no session was created** (blocked)
4. Bootstrap completed with `session === null` but `bootstrapState === 'READY'`
5. SystemSurface remained alive as invisible overlay, X could not be used

**Root Cause:** Legacy `interventionsInProgress` Set created a secondary truth source that conflicted with the Session-based architecture, causing deadlock.

## Solution

**Removed `interventionsInProgress` Set entirely** and all related tracking logic. The Session-based architecture already provides complete lifecycle management through `SystemSession`.

## Changes Made

### 1. Removed `interventionsInProgress` Set

**File:** `src/os/osTriggerBrain.ts`

- **Line 140:** Deleted Set declaration
- **Lines 287-312:** Removed blocking logic in `startInterventionFlow()`
- **Line 331:** Removed comment about not setting flag in `showQuickTaskDialog()`
- **Line 1044:** Removed `interventionsInProgress.clear()` from `resetTrackingState()`

### 2. Removed Helper Functions

**File:** `src/os/osTriggerBrain.ts`

- **Lines 480-496:** Deleted `hasIncompleteIntervention()`
- **Lines 504-525:** Deleted `cancelIncompleteIntervention()`
- **Lines 496-515:** Deleted `onInterventionStarted()`
- **Lines 517-522:** Deleted `onInterventionCompleted()`
- **Lines 536-557:** Deleted DEV testing functions:
  - `completeInterventionDEV()`
  - `getInterventionsInProgressDEV()`

### 3. Removed Call Sites in handleForegroundAppChange()

**File:** `src/os/osTriggerBrain.ts`

- **Lines 567-589:** Removed incomplete intervention check and cancellation logic
- User app switches are now handled entirely by `SystemSurfaceRoot`

### 4. Removed Function Calls in Screens

**File:** `app/screens/conscious_process/QuickTaskDialogScreen.tsx`

- **Line 6:** Removed `onInterventionStarted` from import
- **Lines 94-97:** Removed call to `onInterventionStarted()`
- **Line 145:** Updated comment to remove reference to `onInterventionCompleted()`

**File:** `app/screens/conscious_process/IntentionTimerScreen.tsx`

- **Line 5:** Removed `onInterventionCompleted` from import
- **Line 83:** Removed call to `onInterventionCompleted()`
- **Line 85:** Updated log message

## How It Works Now

### Session Lifecycle (Authoritative)

**File:** `app/roots/SystemSurfaceRoot.tsx` (lines 192-209)

```typescript
useEffect(() => {
  // Only check for INTERVENTION sessions
  if (session?.kind !== 'INTERVENTION') return;
  
  // Don't end session if foregroundApp is null or BreakLoop infrastructure
  if (isBreakLoopInfrastructure(foregroundApp)) return;
  
  // End session if user switched to a different app
  if (foregroundApp !== session.app) {
    dispatchSystemEvent({ type: 'END_SESSION' });
  }
}, [session, foregroundApp, dispatchSystemEvent]);
```

**This is the ONLY mechanism needed.** When user switches apps:
1. `foregroundApp` changes (via native event)
2. SystemSurfaceRoot detects: `session.app !== foregroundApp`
3. Dispatches `END_SESSION` immediately
4. Session becomes null
5. SystemSurface finishes (via Rule 4)
6. New app gets fresh evaluation

### Intervention Flow (No Blocking)

**File:** `src/os/osTriggerBrain.ts` (lines 260-295)

```typescript
function startInterventionFlow(packageName: string, timestamp: number): void {
  // Use SystemSession dispatcher if available (Rule 2)
  const dispatcher = systemSessionDispatcher || interventionDispatcher;
  
  if (!dispatcher) {
    console.warn('[OS Trigger Brain] No dispatcher set - cannot trigger');
    return;
  }

  // Delete t_intention (per spec: "intervention flow starts → t_intention deleted")
  intentionTimers.delete(packageName);
  console.log('[OS Trigger Brain] t_intention deleted (intervention starting)');

  // RULE 2: Dispatch SystemSession event
  if (systemSessionDispatcher) {
    systemSessionDispatcher({
      type: 'START_INTERVENTION',
      app: packageName,
    });
  } else {
    // Fallback to old dispatcher during migration
    dispatcher({
      type: 'BEGIN_INTERVENTION',
      app: packageName,
      breathingDuration: getInterventionDurationSec(),
    });
  }
}
```

**No blocking checks.** Every app gets fresh evaluation. Session creation is never blocked.

## Expected Behavior

### Before Fix:
```
Instagram opens → Intervention starts → interventionsInProgress = ['instagram']
User switches to X
X tries intervention → BLOCKED (early return) → No session created
SystemSurface alive with no session → X hangs
```

### After Fix:
```
Instagram opens → Intervention starts → Session created (kind: INTERVENTION, app: instagram)
User switches to X
  → foregroundApp changes to X
  → SystemSurfaceRoot detects: session.app !== foregroundApp
  → dispatchSystemEvent({ type: 'END_SESSION' })
  → Session becomes null
  → SystemSurface finishes
X tries intervention → NOT BLOCKED → New session created
SystemSurface renders X intervention → No hang
```

## Why This Cannot Deadlock

1. **No blocking logic** - Every app gets fresh evaluation
2. **Session is authority** - SystemSurface finishes when session === null
3. **Cleanup is automatic** - App switch triggers session end via useEffect
4. **No early returns** - OS Trigger Brain always completes evaluation
5. **Single source of truth** - Only `SystemSession` determines lifecycle

The Session-based architecture provides all necessary lifecycle management. The `interventionsInProgress` Set was a legacy mechanism that conflicted with the new architecture.

## Verification

After fix, verify:
- ✅ Instagram intervention starts normally
- ✅ Switching to X ends Instagram intervention immediately
- ✅ X starts its own intervention (if no intention timer)
- ✅ No app hangs
- ✅ No invisible SystemSurface overlay
- ✅ Logs show clean transition: "Intervention Session ended" → "New intervention started"

## Files Modified

1. `src/os/osTriggerBrain.ts` - Removed `interventionsInProgress` Set and all related functions
2. `app/screens/conscious_process/QuickTaskDialogScreen.tsx` - Removed `onInterventionStarted` calls
3. `app/screens/conscious_process/IntentionTimerScreen.tsx` - Removed `onInterventionCompleted` calls

## Architecture Compliance

This fix ensures compliance with:

- **Native-JavaScript Boundary** - Native decides WHEN, JavaScript decides WHAT
- **Session-based Architecture** - SystemSession is sole authority for lifecycle
- **Rule 4** - Session is ONLY authority for SystemSurface existence
- **Single Source of Truth** - No secondary tracking structures
