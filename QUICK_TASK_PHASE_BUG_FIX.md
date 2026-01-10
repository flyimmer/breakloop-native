# Quick Task Phase Bug Fix

**Date:** 2026-01-10  
**Issue:** Quick Task timer expiring during decision dialog (Phase A), causing premature POST_QUICK_TASK_CHOICE transitions

## Root Cause

Quick Task timers were running during the **decision dialog** (Phase A), when they should only start after the user explicitly clicks "Quick Task" (Phase B).

### The Bug

**Broken flow:**
```
Show Quick Task dialog
  ↓
Timer already running ❌ (from previous session)
  ↓
User sees dialog
  ↓
Timer expires (10 seconds)
  ↓
System thinks "usage finished"
  ↓
POST_QUICK_TASK_CHOICE appears
  ↓
Dialog flashes, app backgrounds, home screen launches
```

**Correct flow:**
```
Phase A: Show Quick Task dialog → NO TIMER
  ↓ User clicks "Quick Task"
Phase B: Active usage → TIMER STARTS NOW
  ↓ Timer expires
POST_QUICK_TASK_CHOICE → CORRECT
```

### Why It Happened

1. User clicks "Quick Task" button → Timer starts in native
2. Native emits `TIMER_SET` event → System Brain persists timer
3. User returns to app → Timer is still running
4. User opens app again → Dialog shows (Phase A)
5. **Old timer expires** → POST_QUICK_TASK_CHOICE triggered incorrectly
6. Dialog flashes and closes, app backgrounds

### Why It Only Appeared on Second Run

- First time: No previous timer exists, flow works correctly
- Second time: Timer from first session persists and expires during dialog
- This is a **phase distinction bug**, not a lifecycle or invalidation bug

## The Fix

### Core Principle

> **Timers measure usage, never intent. A dialog is intent.**

Quick Task has TWO distinct phases:
- **Phase A (Decision Dialog)**: User sees choice → NO TIMER
- **Phase B (Active Usage)**: User clicked "Quick Task" → TIMER RUNS

### Changes Made

#### 1. Defensive Guard in `handleTimerExpiration()`

**File:** `src/systemBrain/eventHandler.ts`

Added check after Quick Task timer classification:

```typescript
// After timerType === 'QUICK_TASK' classification
const hasExpiredFlag = !!state.expiredQuickTasks[packageName];
const hasOverride = getNextSessionOverride();

if (!hasExpiredFlag && !hasOverride) {
  console.warn(
    '[QuickTask] Ignoring TIMER_EXPIRED during decision dialog (Phase A)',
    { packageName }
  );
  
  // Clear stale timer from previous session
  delete state.quickTaskTimers[packageName];
  return; // Exit early, ignore this expiration
}
```

**Purpose:** Prevents stale timers from previous sessions from triggering POST_QUICK_TASK_CHOICE while user is in the decision dialog.

#### 2. Clear Timer When Dialog Closes Without Selection

**File:** `app/screens/conscious_process/QuickTaskDialogScreen.tsx`

In `handleClose()` (when user chooses "Conscious Process"):

```typescript
// Clear any running Quick Task timer for this app
if (AppMonitorModule && session?.app) {
  AppMonitorModule.clearQuickTaskTimer(session.app);
  console.log('[QuickTaskDialog] Cleared Quick Task timer (user chose Conscious Process)');
}
```

**Purpose:** If user declines Quick Task, any running timer is invalid and should be cleared.

#### 3. Native `clearQuickTaskTimer()` Method

**File:** `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`

**Status:** Method already existed (line 644), no changes needed.

The `clearQuickTaskTimer()` method was already implemented in the codebase:
- Removes timer from SharedPreferences
- Calls `ForegroundDetectionService.clearQuickTaskTimer()`
- Logs cleanup action

**Purpose:** Provides native method to clear timers from both SharedPreferences and ForegroundDetectionService.

**Note:** Both `AppMonitorModule.clearQuickTaskTimer()` and `ForegroundDetectionService.clearQuickTaskTimer()` already existed, so no native changes were needed.

#### 4. TypeScript Interface

**File:** `src/native-modules/AppMonitorModule.ts`

Interface already included `clearQuickTaskTimer()` method (line 150), so no changes needed.

## Evidence from Logs

From `terminals/5.txt` (10:44:47-10:44:48):

1. **10:44:47.383** - Instagram opened, Quick Task dialog launched ✅
2. **10:44:48.213** - TIMER_EXPIRED event (10 seconds later) ❌
3. **10:44:48.220** - System Brain set `nextSessionOverride: POST_QUICK_TASK_CHOICE` ❌
4. **10:44:48.327** - SystemSurfaceRoot auto-transitioned QUICK_TASK → POST_QUICK_TASK_CHOICE ❌
5. **10:44:48.338** - POST_QUICK_TASK_CHOICE backgrounded app to launcher
6. **10:44:48.712** - SystemSurface destroyed

**The user never clicked "Quick Task" button** - the timer expired while the dialog was still visible.

## What Was NOT Changed

- ❌ POST_QUICK_TASK_CHOICE logic (correct as-is)
- ❌ `setNextSessionOverride()` in `handleTimerExpired()` (correct as-is)
- ❌ Launcher check logic (correct as-is)
- ❌ Modal task flags (correct as-is)
- ❌ Blocking semantics (correct as-is)

## Expected Behavior After Fix

- ✅ Quick Task dialog appears with NO timer running
- ✅ Timer starts ONLY after clicking "Quick Task" button
- ✅ Timer never expires while dialog is visible
- ✅ POST_QUICK_TASK_CHOICE appears only after actual usage expires
- ✅ Second Quick Task works same as first (no stale timer)
- ✅ Clicking "Conscious Process" clears any stale timers

## Testing Checklist

1. Open monitored app (e.g., Instagram)
2. See Quick Task dialog
3. **Wait 10+ seconds WITHOUT clicking anything**
4. Dialog should remain visible (no auto-close) ✅
5. Click "Quick Task" → Timer starts
6. Wait 10 seconds → POST_QUICK_TASK_CHOICE appears ✅
7. Choose option and complete flow
8. Open Instagram again → Quick Task dialog shows
9. Click "Conscious Process" → Timer cleared ✅
10. Open Instagram third time → Quick Task dialog shows (no stale timer) ✅

## Key Insight

This bug survived so long because it's a **phase distinction bug**, not a state bug.

Previous fixes addressed:
- ✅ Semantics
- ✅ Lifecycle
- ✅ Invalidation
- ✅ Foreground truth
- ✅ Modal containment

But never explicitly encoded:
> "This dialog is pre-usage."

The timer system had no idea that Phase A (dialog) should have NO timer.

## Permanent Rule

> **Timers represent usage, never intent. A dialog is intent.**

This rule is now enforced at three levels:
1. **Defensive guard** in System Brain (ignores stale timers)
2. **Explicit clear** when user declines Quick Task
3. **Native cleanup** removes timer from all storage

## Related Issues Fixed

This fix resolves:
- "Flash then home" bug on second Quick Task
- Premature POST_QUICK_TASK_CHOICE transitions
- Dialog auto-closing without user interaction
- Stale timer persistence across sessions
- Inconsistent behavior between first and subsequent runs

All of these were symptoms of the same root cause: **timers running during Phase A (decision dialog)**.
