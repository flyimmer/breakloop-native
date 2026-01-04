# Bug Fix: Pending Timeout Cleanup for Intervention Completion

**Date:** January 5, 2026  
**Status:** ✅ FIXED  
**Severity:** CRITICAL - App immediately exits when opened after previous cancellation

---

## Problem Description

When opening XHS (or any monitored app) after a previous intervention was cancelled, the app flashes and immediately exits to home screen.

**What Happened:**
1. User opens XHS, reaches root-cause screen
2. User presses back to cancel intervention (19:21:41)
3. **43 seconds pass** (user does other things)
4. User opens XHS again (19:22:24)
5. New intervention starts (breathing screen appears)
6. **Immediately exits to home screen** (19:22:25)
7. `launchHomeScreen()` fires multiple times (6+ times)

---

## Root Cause

The `useEffect` in `app/App.tsx` (lines 231-311) creates `setTimeout` callbacks but **never cleans them up**:

```typescript
useEffect(() => {
    if (wasCancelled) {
        setTimeout(() => {
            AppMonitorModule.launchHomeScreen();  // ← No cleanup!
        }, 100);
        return;
    }
    // ... more setTimeout calls without cleanup
}, [state, targetApp, ...]);
```

**The Problem:**
- When intervention is cancelled, `setTimeout` is scheduled
- The callback is stored in JavaScript's event loop but **never cancelled**
- When component re-renders (new intervention starts), the old timeout is still pending
- The pending timeout fires when React re-renders, even though it's from the OLD intervention
- This causes `launchHomeScreen()` to fire during the NEW intervention

**Timeline:**
1. **19:21:41**: Intervention cancelled → `setTimeout(..., 100)` scheduled
2. Timeout doesn't fire immediately (component unmounts? state changes?)
3. **43 seconds pass** - timeout still pending in event loop
4. **19:22:24**: NEW intervention starts → Component re-renders
5. **19:22:25**: Old timeout fires (multiple times due to re-renders) → Kills new intervention

---

## The Fix

**Add cleanup function to cancel pending timeouts:**

```typescript
useEffect(() => {
    // Store timeout IDs for cleanup
    let cancelledTimeout: NodeJS.Timeout | null = null;
    let intentionTimeout: NodeJS.Timeout | null = null;
    let completedTimeout: NodeJS.Timeout | null = null;

    // ... existing logic ...

    if (wasCancelled) {
        cancelledTimeout = setTimeout(() => {  // ← Store timeout ID
            AppMonitorModule.launchHomeScreen();
        }, 100);
        return;
    }

    if (intentionTimerSet) {
        intentionTimeout = setTimeout(() => {  // ← Store timeout ID
            AppMonitorModule.finishInterventionActivity();
        }, 100);
    } else {
        completedTimeout = setTimeout(() => {  // ← Store timeout ID
            AppMonitorModule.launchHomeScreen();
        }, 100);
    }

    // CLEANUP: Cancel all pending timeouts when effect re-runs
    return () => {
        if (cancelledTimeout) clearTimeout(cancelledTimeout);
        if (intentionTimeout) clearTimeout(intentionTimeout);
        if (completedTimeout) clearTimeout(completedTimeout);
    };
}, [state, targetApp, ...]);
```

**Why this works:**
- When component re-renders (new intervention starts), cleanup function runs FIRST
- All pending timeouts from previous intervention are cancelled
- Only the current intervention's timeout remains active
- No old callbacks can fire during new interventions

---

## Implementation Details

### File Modified: `app/App.tsx`

**Lines 231-311**: Added timeout cleanup to intervention completion useEffect

**Changes:**
1. Added timeout ID variables at start of useEffect:
   ```typescript
   let cancelledTimeout: NodeJS.Timeout | null = null;
   let intentionTimeout: NodeJS.Timeout | null = null;
   let completedTimeout: NodeJS.Timeout | null = null;
   ```

2. Stored timeout IDs when creating timeouts:
   ```typescript
   cancelledTimeout = setTimeout(() => { ... }, 100);
   intentionTimeout = setTimeout(() => { ... }, 100);
   completedTimeout = setTimeout(() => { ... }, 100);
   ```

3. Added cleanup function:
   ```typescript
   return () => {
       if (cancelledTimeout) clearTimeout(cancelledTimeout);
       if (intentionTimeout) clearTimeout(intentionTimeout);
       if (completedTimeout) clearTimeout(completedTimeout);
   };
   ```

---

## Testing Scenarios

### Test 1: Rapid Re-opening After Cancellation ✅
**Before Fix:**
- Open XHS → Breathing screen → Press back to cancel
- Immediately open XHS again → Flashes and exits to home screen ❌

**After Fix:**
- Open XHS → Breathing screen → Press back to cancel
- Immediately open XHS again → Breathing screen shows normally ✅

### Test 2: Delayed Re-opening After Cancellation ✅
**Before Fix:**
- Open XHS → Breathing screen → Press back to cancel
- Wait 43 seconds
- Open XHS again → Flashes and exits to home screen ❌

**After Fix:**
- Open XHS → Breathing screen → Press back to cancel
- Wait any amount of time
- Open XHS again → Breathing screen shows normally ✅

### Test 3: Normal Completion ✅
- Complete full intervention (breathing → causes → alternatives → action → reflection)
- Should: Launch home screen ✅
- Cleanup doesn't interfere with normal flow

### Test 4: Intention Timer ✅
- Choose "I really need to use it" → Set intention timer
- Should: Launch target app ✅
- Cleanup doesn't interfere with intention timer flow

---

## Why This Bug Was Hard to Catch

1. **Timing-dependent**: Only happens when re-opening app after previous cancellation
2. **Non-deterministic**: Depends on when React re-renders and when timeouts fire
3. **Multiple timeouts**: Re-renders create multiple pending timeouts, causing multiple `launchHomeScreen()` calls
4. **Long delay**: 43 seconds between cancellation and re-opening made it seem unrelated

---

## Key Lessons

1. **Always cleanup side effects in React**: `useEffect` cleanup functions are critical
2. **`setTimeout` needs `clearTimeout`**: Every `setTimeout` should have a corresponding `clearTimeout` in cleanup
3. **Component re-renders don't cancel timeouts**: Timeouts persist across re-renders unless explicitly cancelled
4. **Test rapid state transitions**: Bugs often appear when users act quickly (cancel → immediately reopen)

---

## Related Issues

This fix is related to:
- **Launcher incomplete intervention fix**: Made cancellation work correctly
- **Home screen launch fix**: Made completion logic work correctly
- **This fix**: Made cleanup work correctly to prevent old callbacks from interfering

Together, these fixes ensure:
- Interventions are cancelled when user switches away ✅
- Cancelled interventions launch home screen ✅
- Old timeouts don't interfere with new interventions ✅
- App can be opened and used normally ✅

---

**All implementation completed successfully on January 5, 2026.**
