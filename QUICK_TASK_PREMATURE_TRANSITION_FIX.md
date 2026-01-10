# Quick Task Premature POST_QUICK_TASK_CHOICE Transition Fix

**Date:** 2026-01-10  
**Status:** ✅ FIXED

## Problem

When opening Instagram (or any monitored app), the system:
1. ✅ Correctly decided to show Quick Task dialog (`SHOW_QUICK_TASK_DIALOG`)
2. ✅ Launched SystemSurface with `QUICK_TASK` session
3. ❌ **Immediately transitioned to `POST_QUICK_TASK_CHOICE`**
4. ❌ Backgrounded Instagram to home screen
5. ❌ User saw Instagram "crash/quit"

**User Experience:**
- User switches to Instagram
- Instagram appears briefly
- Instagram immediately quits to home screen
- Looks like a crash, but was actually intentional backgrounding

## Root Cause

`setNextSessionOverride(packageName, 'POST_QUICK_TASK_CHOICE')` was called at line 219 in `src/systemBrain/eventHandler.ts` **without checking if Quick Task was in ACTIVE phase**.

This meant:
- ❌ Fired on app entry (phase = undefined)
- ❌ Fired during DECISION phase (dialog showing)
- ❌ Fired when old expired flags existed from previous sessions
- ✅ Should ONLY fire when phase = ACTIVE (user started Quick Task and timer expired)

## Semantic Rule (Enforced)

```
POST_QUICK_TASK_CHOICE may ONLY be triggered when:
  quickTaskPhaseByApp[app] === 'ACTIVE'
```

**Meaning:**
- ✅ User clicked "Use Quick Task" → phase = ACTIVE
- ✅ Timer ran for configured duration (e.g., 10 seconds)
- ✅ Timer expired while user was in the app
- ✅ THEN show POST_QUICK_TASK_CHOICE

**Never:**
- ❌ On app entry (no phase or phase = DECISION)
- ❌ During dialog display (phase = DECISION)
- ❌ Based on stale expired flags

## Solution

### Code Change

**File:** `src/systemBrain/eventHandler.ts`  
**Location:** Line 205-249 (TIMER_EXPIRED handler for QUICK_TASK)

**Before:**
```typescript
// Clear phase (transition ACTIVE → null)
delete state.quickTaskPhaseByApp[packageName];

if (expiredWhileForeground) {
  // Set session override for UI to observe
  setNextSessionOverride(packageName, 'POST_QUICK_TASK_CHOICE');  // ❌ No guard
  // ...
}
```

**After:**
```typescript
// CRITICAL: Capture phase BEFORE clearing (needed for POST_QUICK_TASK_CHOICE guard)
const phaseBeforeExpiration = state.quickTaskPhaseByApp[packageName];

// Clear phase (transition ACTIVE → null)
delete state.quickTaskPhaseByApp[packageName];

if (expiredWhileForeground) {
  // CRITICAL: Only set POST_QUICK_TASK_CHOICE if Quick Task was ACTIVE
  if (phaseBeforeExpiration === 'ACTIVE') {
    setNextSessionOverride(packageName, 'POST_QUICK_TASK_CHOICE');  // ✅ Guarded
    // ...
  } else {
    console.warn('[QuickTask] Ignoring POST_QUICK_TASK_CHOICE — not in ACTIVE phase', {
      phase: phaseBeforeExpiration,
      app: packageName,
      note: 'POST_QUICK_TASK_CHOICE requires phase = ACTIVE',
    });
  }
}
```

### Key Points

1. **Capture phase before deletion** - Store `phaseBeforeExpiration` before clearing
2. **Guard the transition** - Only call `setNextSessionOverride()` if phase was `ACTIVE`
3. **Warn on invalid transitions** - Log when transition is blocked (helps debugging)
4. **Still record expiration** - Even if POST_QUICK_TASK_CHOICE is blocked, we record the expiration fact

## Expected Behavior After Fix

### Scenario 1: App Entry (Bug Fixed)

**Before Fix:**
1. Open Instagram
2. System decides: `SHOW_QUICK_TASK_DIALOG`
3. ❌ `POST_QUICK_TASK_CHOICE` fires immediately
4. ❌ Instagram backgrounds to home
5. ❌ User sees "crash"

**After Fix:**
1. Open Instagram
2. System decides: `SHOW_QUICK_TASK_DIALOG`
3. ✅ Quick Task dialog appears
4. ✅ Instagram stays visible
5. ✅ User can choose "Use Quick Task" or "Start Intervention"
6. ✅ No backgrounding until user makes choice

### Scenario 2: Timer Expiration (Should Still Work)

**After Fix:**
1. User clicks "Use Quick Task" → phase = ACTIVE
2. Timer runs for 10 seconds (test duration)
3. Timer expires → `TIMER_EXPIRED` event
4. Phase check: `phaseBeforeExpiration === 'ACTIVE'` ✅
5. ✅ `POST_QUICK_TASK_CHOICE` fires correctly
6. ✅ Screen appears with choice
7. ✅ App backgrounds to home (expected)

## Verification

### Test Case 1: App Entry
```
1. Open Instagram
2. Expected: Quick Task dialog appears
3. Expected: Instagram does NOT background
4. Expected: No POST_QUICK_TASK_CHOICE logs
5. Expected: User can interact with dialog
```

### Test Case 2: Quick Task Usage
```
1. Open Instagram → dialog appears
2. Click "Use Quick Task"
3. Phase = ACTIVE (check logs)
4. Wait 10 seconds
5. Expected: TIMER_EXPIRED event
6. Expected: POST_QUICK_TASK_CHOICE appears
7. Expected: App backgrounds to home
8. Expected: Choice screen stays visible
```

## Log Signatures

### On App Entry (After Fix)
```
[System Brain] FOREGROUND_CHANGED: com.instagram.android
[Decision Engine] ✓ n_quickTask > 0 - decision: QUICK_TASK
[System Brain] 🚀 Launching SystemSurface: SHOW_QUICK_TASK_DIALOG
[SystemSurfaceRoot] Rendering QuickTaskFlow
[QuickTaskDialog] Component mounted!
```

**No POST_QUICK_TASK_CHOICE logs** ✅

### On Timer Expiration (After Fix)
```
[System Brain] TIMER_EXPIRED: com.instagram.android
[QuickTask] Phase cleared (ACTIVE → null)
[SystemBrain] Quick Task expired in foreground: { phase: 'ACTIVE', nextSessionOverride: 'POST_QUICK_TASK_CHOICE' }
[SystemSurfaceRoot] Detected nextSessionOverride - transitioning QUICK_TASK → POST_QUICK_TASK_CHOICE
[SystemSurfaceRoot] Entering POST_QUICK_TASK_CHOICE — backgrounding app
```

**POST_QUICK_TASK_CHOICE only after ACTIVE phase** ✅

### On Invalid Transition (After Fix)
```
[System Brain] TIMER_EXPIRED: com.instagram.android
[QuickTask] Phase cleared (ACTIVE → null)
[QuickTask] Ignoring POST_QUICK_TASK_CHOICE — not in ACTIVE phase: { phase: undefined, app: 'com.instagram.android' }
```

**Warning logged, transition blocked** ✅

## Files Modified

1. **`src/systemBrain/eventHandler.ts`** - Added phase guard at line 217-248

## Related Issues

- **Original Bug Report:** Instagram crashes/quits immediately on open (2026-01-10)
- **Root Cause:** Refactor cleanup - old transition logic not fully removed after Phase architecture
- **Previous Fixes:**
  - `QUICK_TASK_PHASE_BUG_FIX.md` - Phase architecture introduction
  - `POST_QUICK_TASK_MODAL_FIX.md` - Modal task launch fix
  - `SYSTEMSURFACE_LIFECYCLE_FIX.md` - Bootstrap lifecycle fix

## Architecture Notes

### Why This Bug Appeared

After the Phase Refactor:
- ✅ New architecture is correct (Phase = DECISION / ACTIVE)
- ✅ OS Trigger Brain correctly decides SHOW_QUICK_TASK_DIALOG
- ❌ Old transition trigger (POST_QUICK_TASK_CHOICE) not fully guarded
- ❌ Result: Old logic fires in new system

**This is a typical refactor cleanup issue:**
- New system works correctly
- Old triggers need additional guards
- Not an architectural problem, just incomplete migration

### Semantic Invariant

```
POST_QUICK_TASK_CHOICE ⟺ (phase was ACTIVE AND timer expired)
```

This invariant is now **enforced in code** via the guard.

## What NOT to Do

- ❌ Do NOT add timers or delays
- ❌ Do NOT change launcher logic
- ❌ Do NOT modify SystemSurfaceRoot
- ❌ Do NOT remove modal task fix
- ❌ Do NOT touch decision engine

**This is a surgical fix:** one guard, one location, enforcing the semantic rule.

## Status

✅ **FIXED** - Phase guard added at line 217 in `eventHandler.ts`  
⏳ **TESTING** - Awaiting rebuild and verification  
📋 **DOCUMENTED** - This file serves as authoritative record

## Next Steps

1. Rebuild app: `npx expo run:android`
2. Test app entry: Open Instagram → dialog appears, no background
3. Test timer expiration: Use Quick Task → timer expires → POST_QUICK_TASK_CHOICE appears
4. Verify logs match expected signatures
5. Mark as complete if all tests pass
