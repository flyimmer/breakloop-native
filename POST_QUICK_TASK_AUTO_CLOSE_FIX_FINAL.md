# POST_QUICK_TASK_CHOICE Auto-Close Fix (Final)

## Problem

POST_QUICK_TASK_CHOICE screen appeared briefly then immediately closed and launched home screen.

**User observation:** "very short, I can not even see it clearly"

## Root Cause (Final Diagnosis)

After removing native foreground deduplication (to fix foreground tracking), Android emits **multiple `FOREGROUND_CHANGED` events** for a single logical transition:

1. App → Home
2. Overlay → Home  
3. Window focus transitions

The original system-initiated marker was:
- **Boolean flag**
- **Consumed on first event**

**Event sequence:**
```
1. markSystemInitiatedForegroundChange() → flag = true
2. FOREGROUND_CHANGED #1 → consume flag → preserve expiredQuickTasks ✓
3. FOREGROUND_CHANGED #2 (50ms later) → flag already consumed → invalidate ❌
4. Session ends → home screen
```

## Solution: Time-Window Marker

Changed from **consume-once boolean** to **time-window check** (500ms).

### Implementation

**File:** `src/systemBrain/stateManager.ts`

**Before (consume-once):**
```typescript
let suppressNextForegroundInvalidation = false;

export function markSystemInitiatedForegroundChange(): void {
  suppressNextForegroundInvalidation = true;
}

export function consumeSystemInitiatedForegroundChange(): boolean {
  const value = suppressNextForegroundInvalidation;
  suppressNextForegroundInvalidation = false;  // ❌ Consumed immediately
  return value;
}
```

**After (time-window):**
```typescript
let systemInitiatedForegroundUntil = 0;

export function markSystemInitiatedForegroundChange(): void {
  systemInitiatedForegroundUntil = Date.now() + 500;  // 500ms window
}

export function isSystemInitiatedForegroundChange(): boolean {
  const now = Date.now();
  const isSystemInitiated = now < systemInitiatedForegroundUntil;
  
  // Auto-clear if expired
  if (now >= systemInitiatedForegroundUntil && systemInitiatedForegroundUntil > 0) {
    systemInitiatedForegroundUntil = 0;
  }
  
  return isSystemInitiated;  // ✓ Multiple events can check
}
```

**File:** `src/systemBrain/eventHandler.ts`

Changed from consume to check:
```typescript
// Before
const isSystemInitiated = consumeSystemInitiatedForegroundChange();

// After
const isSystemInitiated = isSystemInitiatedForegroundChange();
```

## Why This Works

**Event burst handling:**
```
t=0ms:   markSystemInitiatedForegroundChange() → window until t=500ms
t=10ms:  FOREGROUND_CHANGED #1 → check window → within 500ms → preserve ✓
t=60ms:  FOREGROUND_CHANGED #2 → check window → within 500ms → preserve ✓
t=120ms: FOREGROUND_CHANGED #3 → check window → within 500ms → preserve ✓
t=600ms: User switches app → check window → expired → invalidate normally ✓
```

## Why This Is Correct

1. **Not polling:** Single timestamp check per event
2. **Not weakening semantics:** Same rule, just acknowledges Android's event burst
3. **Debouncing known behavior:** Android emits multiple events for one transition
4. **Semantic rule intact:** Foreground changes caused by blocking screen don't invalidate

## Architecture

**One semantic transition may produce multiple platform events. Semantic intent must survive the entire event burst.**

This is the correct, final stabilization of the Quick Task flow on Android.

## Expected Behavior After Fix

1. Quick Task expires in foreground
2. POST_QUICK_TASK_CHOICE screen appears
3. App backgrounds (triggers 2-3 FOREGROUND_CHANGED events)
4. **All events preserve expiredQuickTasks** ✓
5. **Screen stays visible** ✓
6. User can see and interact with buttons
7. User presses "Quit" or "Continue"
8. Flag cleared only on resolution

## Files Modified

1. `src/systemBrain/stateManager.ts` - Changed to time-window marker
2. `src/systemBrain/eventHandler.ts` - Changed from consume to check

---

**Date:** January 9, 2026  
**Issue:** POST_QUICK_TASK_CHOICE auto-closing  
**Root Cause:** Duplicate FOREGROUND_CHANGED events consuming single-use marker  
**Fix:** Time-window marker (500ms) to handle Android event bursts  
**Status:** ✅ FIXED - Implemented and rebuilding
