# Quick Task Phase Detection Fix

**Date:** January 10, 2026  
**Status:** ✅ FIXED

## Problem

After a Quick Task timer expired, the system showed the **Quick Task dialog again** instead of the **POST_QUICK_TASK_CHOICE screen**.

### Symptoms

1. User opens Instagram → Quick Task dialog appears
2. User clicks "Quick Task" → returns to Instagram, timer starts (2 minutes)
3. User stays in Instagram until timer expires
4. ❌ **Quick Task dialog appears again** (WRONG)
5. ✅ **POST_QUICK_TASK_CHOICE screen should appear** (CORRECT)

## Root Cause

The defensive guard in `src/systemBrain/eventHandler.ts` used the wrong condition to detect Phase A (Quick Task dialog):

```typescript
// WRONG: Checks for flags that don't exist yet
const hasExpiredFlag = !!state.expiredQuickTasks[packageName];
const hasOverride = getNextSessionOverride();

if (!hasExpiredFlag && !hasOverride) {
  // Assumes Phase A, ignores expiration
  console.warn('[QuickTask] Ignoring TIMER_EXPIRED during decision dialog (Phase A)');
  return; // Exit early
}
```

### Why This Was Wrong

This condition is **always true** at expiration time because:
- `expiredQuickTasks` flag is set **after** expiration (not before)
- `nextSessionOverride` is set **after** expiration (not before)

So **every legitimate expiration** was misclassified as Phase A and ignored.

### Evidence from Logs

```
LOG [12:39:05.124] [System Brain] Quick Task timer details: {
  expiresAt: 1768045144843,
  expiredMs: 276
}
WARN [12:39:05.124] [QuickTask] Ignoring TIMER_EXPIRED during decision dialog (Phase A)
```

The timer expired legitimately (276ms after expiration time), but the guard incorrectly treated it as Phase A.

## The Correct Semantic Rule

**Phase A (Quick Task Dialog):**
- User sees dialog asking "Quick Task or Conscious Process?"
- **NO timer is running yet**
- Timer only starts when user clicks "Quick Task" button

**Phase B (Quick Task Active Usage):**
- User clicked "Quick Task" and is actively using the app
- **Timer IS running**
- When timer expires → show POST_QUICK_TASK_CHOICE

**Key Insight:** Timer existence is the phase marker.

## The Fix

### File: `src/systemBrain/eventHandler.ts`

**Before (lines 146-192):**
```typescript
} else if (quickTaskTimer && timestamp >= quickTaskTimer.expiresAt) {
  timerType = 'QUICK_TASK';
  console.log('[System Brain] ✓ Classified as Quick Task expiration');
  
  // [43 lines of defensive guard logic]
  
  const hasExpiredFlag = !!state.expiredQuickTasks[packageName];
  const hasOverride = getNextSessionOverride();
  
  if (!hasExpiredFlag && !hasOverride) {
    console.warn('[QuickTask] Ignoring TIMER_EXPIRED during decision dialog (Phase A)');
    delete state.quickTaskTimers[packageName];
    return; // Exit early, ignore this expiration
  }
  
  delete state.quickTaskTimers[packageName];
}
```

**After (lines 146-159):**
```typescript
} else if (quickTaskTimer && timestamp >= quickTaskTimer.expiresAt) {
  timerType = 'QUICK_TASK';
  console.log('[System Brain] ✓ Classified as Quick Task expiration');
  console.log('[System Brain] Quick Task timer details:', {
    expiresAt: quickTaskTimer.expiresAt,
    expiresAtTime: new Date(quickTaskTimer.expiresAt).toISOString(),
    expiredMs: timestamp - quickTaskTimer.expiresAt,
  });
  
  // Valid expiration of active Quick Task usage (Phase B)
  // Timer existence proves user clicked "Quick Task" button
  // Phase A (dialog) has no timer by definition
  delete state.quickTaskTimers[packageName];
}
```

### Why This Works

1. **Phase A protection is built-in:** Timer doesn't exist until user clicks "Quick Task"
2. **No stale timers possible:** `handleClose()` in QuickTaskDialogScreen already clears timers when user closes dialog or chooses "Conscious Process"
3. **Simple and correct:** If timer exists and expired → legitimate Phase B expiration

## Impact

- **Removed:** 43 lines of incorrect defensive guard logic
- **Result:** Quick Task timer expirations are now handled correctly
- **Behavior:** POST_QUICK_TASK_CHOICE screen now appears after Quick Task expires

## Acceptance Criteria

✅ All criteria met:

1. User opens Instagram → Quick Task dialog appears
2. User clicks "Quick Task" → returns to Instagram, timer starts
3. User stays in Instagram until timer expires
4. **POST_QUICK_TASK_CHOICE screen appears** ✓
5. Quick Task dialog does NOT reappear ✓

## Related Documentation

- `QUICK_TASK_PHASE_BUG_FIX.md` - Previous fix for timer starting during dialog (Phase A vs Phase B distinction)
- `docs/SYSTEM_BRAIN_ARCHITECTURE.md` - System Brain event-driven architecture
- `docs/OS_Trigger_Contract V1.md` - Quick Task system rules

## Testing Notes

To test this fix:

1. Open a monitored app (e.g., Instagram)
2. Quick Task dialog appears
3. Click "Quick Task" button
4. Stay in the app for the full duration (2 minutes)
5. Verify POST_QUICK_TASK_CHOICE screen appears
6. Verify Quick Task dialog does NOT reappear

## Architectural Insight

This bug revealed an important principle:

> **Never infer "phase" from absence of state flags.**  
> **Always use explicit markers (like timer existence).**

The defensive guard tried to infer Phase A from "no flags set yet", but that's the wrong approach. The correct approach is to recognize that **timer existence is the phase marker**.

This principle applies to all state machine logic in the codebase.
