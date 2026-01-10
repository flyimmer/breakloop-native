# POST_QUICK_TASK_CHOICE Auto-Close Fix

## Problem

POST_QUICK_TASK_CHOICE screen appeared briefly then immediately closed and launched home screen.

**User observation:** "very short, I can not even see it clearly"

## Root Cause

The POST_QUICK_TASK_CHOICE screen **intentionally backgrounds the app** to show itself (to stop audio playback). This triggers `FOREGROUND_CHANGED` event. The invalidation logic treated this as a **user exit** and deleted `expiredQuickTasks`, causing the session to end immediately.

**The system was eating its own blocking state.**

## Solution

Track **why** the foreground changed using a semantic marker:
- **User-initiated:** User switched apps → invalidate flag
- **System-initiated:** System backgrounded app to show choice screen → preserve flag

## Implementation

### 1. Added System-Initiated Marker

**File:** `src/systemBrain/stateManager.ts`

Added in-memory flag (NOT persisted):
```typescript
let suppressNextForegroundInvalidation = false;

export function markSystemInitiatedForegroundChange(): void {
  suppressNextForegroundInvalidation = true;
}

export function consumeSystemInitiatedForegroundChange(): boolean {
  const value = suppressNextForegroundInvalidation;
  suppressNextForegroundInvalidation = false;
  return value;
}
```

### 2. Mark Before Backgrounding App

**File:** `app/roots/SystemSurfaceRoot.tsx`

Before calling `launchHomeScreen()`:
```typescript
// Mark that we're about to background the app (system-initiated)
markSystemInitiatedForegroundChange();

AppMonitorModule.launchHomeScreen();
```

### 3. Check Marker in Invalidation Logic

**File:** `src/systemBrain/eventHandler.ts`

In `handleForegroundChange()`:
```typescript
const isSystemInitiated = consumeSystemInitiatedForegroundChange();

for (const app in state.expiredQuickTasks) {
  if (
    state.expiredQuickTasks[app].expiredWhileForeground &&
    app !== packageName &&
    !isSystemInitiated  // Don't invalidate if system backgrounded the app
  ) {
    delete state.expiredQuickTasks[app];
  }
}
```

## Architecture

**One-way semantic flow:**
```
SystemSurface (UI)
    ↓ (marks cause)
markSystemInitiatedForegroundChange()
    ↓ (in-memory flag)
suppressNextForegroundInvalidation = true
    ↓ (native detects)
FOREGROUND_CHANGED event
    ↓ (System Brain processes)
consumeSystemInitiatedForegroundChange()
    ↓ (semantic decision)
Skip invalidation if system-initiated
```

**Key:** This is a semantic marker, NOT UI → Brain coupling.

## Why This Is Correct

1. **Semantic cause tracking:** Marks WHY foreground changed, not WHAT state UI is in
2. **One-way flow:** UI → marker → Brain (no Brain → UI dependency)
3. **Ephemeral coordination:** Flag is consumed immediately, not persisted
4. **Architecturally sound:** No UI lifecycle coupling, no circular dependencies
5. **Minimal:** Single flag, single marker call, single check

## Expected Behavior After Fix

1. Quick Task expires in foreground
2. POST_QUICK_TASK_CHOICE screen appears
3. App is backgrounded (audio stops)
4. **Choice screen stays visible** ✅
5. User can see and interact with buttons
6. User presses "Quit" or "Continue"
7. Flag cleared only on resolution

## Final Anchor Rule

**Foreground changes caused by enforcing a blocking screen must never invalidate the blocking obligation.**

---

**Date:** January 9, 2026  
**Issue:** POST_QUICK_TASK_CHOICE auto-closing  
**Root Cause:** System eating its own blocking state on system-initiated foreground change  
**Fix:** Semantic marker to distinguish user vs system-initiated foreground changes  
**Status:** ✅ FIXED - Implemented and rebuilding
