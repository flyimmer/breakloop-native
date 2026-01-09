# Expired Quick Task Fix - Complete Summary

**Date:** January 9, 2026  
**Status:** ✅ COMPLETE

## The Bug

When Quick Task expired in foreground and user went to home screen, the POST_QUICK_TASK_CHOICE screen would reappear every time the user reopened the app.

## Root Causes (Two Separate Issues)

### Issue 1: Missing UI Teardown Rule

**Problem:** POST_QUICK_TASK_CHOICE session didn't end when user left app

**Fix:** Added POST_QUICK_TASK_CHOICE to teardown effects in `SystemSurfaceRoot.tsx`

**File:** `app/roots/SystemSurfaceRoot.tsx`

### Issue 2: Stale Semantic State

**Problem:** `expiredQuickTasks` flag persisted in storage after user left app

**Fix:** Semantic invalidation in System Brain when user leaves app

**File:** `src/systemBrain/eventHandler.ts`

## The Complete Solution

### Fix 1: UI Lifecycle (Lines 481-506, 522-555 in SystemSurfaceRoot.tsx)

```typescript
// QUICK_TASK teardown effect
if (session?.kind !== 'QUICK_TASK' && session?.kind !== 'POST_QUICK_TASK_CHOICE') return;

// INTERVENTION teardown effect  
if (session?.kind !== 'INTERVENTION' && session?.kind !== 'POST_QUICK_TASK_CHOICE') return;
```

**Purpose:** Ends session when user leaves app (UI lifecycle correctness)

### Fix 2: Semantic Invalidation (Lines 427-454 in eventHandler.ts)

```typescript
// SEMANTIC INVALIDATION: Clear expired Quick Task flag when user leaves app
if (
  previousApp &&
  state.expiredQuickTasks[previousApp]?.expiredWhileForeground &&
  packageName !== previousApp
) {
  console.log(
    '[SystemBrain] Invalidating expiredQuickTask due to app leave',
    { app: previousApp, newApp: packageName }
  );
  delete state.expiredQuickTasks[previousApp];
}
```

**Purpose:** Clears semantic trigger when user leaves app (semantic state correctness)

## Why Both Fixes Are Needed

| Fix | Layer | Trigger | Purpose |
|-----|-------|---------|---------|
| UI Teardown | SystemSurface | Underlying app changed | End session, prevent zombie UI |
| Semantic Invalidation | System Brain | FOREGROUND_CHANGED event | Clear trigger, prevent relaunch |

**Without Fix 1:** Session stays alive, UI doesn't close  
**Without Fix 2:** Session ends but relaunches with stale flag  
**With Both:** Session ends cleanly, no relaunch

## Architectural Principles Followed

1. **UI fixes UI lifecycle** - SystemSurfaceRoot ends session
2. **System Brain fixes semantic state** - eventHandler invalidates flag
3. **Semantic state is invalidated by semantic events, not UI teardown**
4. **No cross-layer authority confusion** - Each layer owns its concerns

## Expected Behavior After Fixes

1. Quick Task expires in foreground → POST_QUICK_TASK_CHOICE screen appears
2. User presses Home (without choosing)
3. **Session ends** (Fix 1)
4. **Flag invalidated** (Fix 2)
5. User reopens Instagram
6. **Quick Task dialog OR Intervention appears** (NOT choice screen)
7. Normal OS Trigger Brain evaluation

## Testing

### Test Scenario

1. Open Instagram → Quick Task dialog
2. Choose Quick Task → Wait for expiration
3. POST_QUICK_TASK_CHOICE screen appears
4. **Press Home** (don't choose)
5. **Verify logs:**
   - `[SystemSurfaceRoot] 🚨 Session ended - underlying app changed`
   - `[SystemBrain] Invalidating expiredQuickTask due to app leave`
6. Reopen Instagram
7. **Expected:** Quick Task dialog OR Intervention (NOT choice screen)

### Success Criteria

- ✅ Session ends when user leaves app
- ✅ Expired flag cleared when user leaves app
- ✅ No stale flag on app reopen
- ✅ Normal OS Trigger Brain evaluation
- ✅ No zombie screens
- ✅ No sticky triggers

## Files Modified

1. **`app/roots/SystemSurfaceRoot.tsx`** - UI teardown logic
   - Lines 481-506: QUICK_TASK teardown
   - Lines 522-555: INTERVENTION teardown
   - Added POST_QUICK_TASK_CHOICE to both

2. **`src/systemBrain/eventHandler.ts`** - Semantic invalidation
   - Lines 427-454: handleForegroundChange
   - Added expiredQuickTasks invalidation on app leave

## Documentation

- `docs/POST_QUICK_TASK_CHOICE_LIFECYCLE_FIX.md` - Fix 1 details
- `docs/EXPIRED_QUICK_TASK_SEMANTIC_INVALIDATION.md` - Fix 2 details
- `docs/EXPIRED_QUICK_TASK_FIX_COMPLETE.md` - This summary

## Lessons Learned

### Architectural Boundary Respect

**WRONG (Rejected Plan):**
- Clear semantic state in UI reducers
- Trigger semantic cleanup on END_SESSION
- Mix UI lifecycle with semantic state

**CORRECT (Implemented):**
- UI ends sessions (UI lifecycle)
- System Brain invalidates semantic state (semantic events)
- Clear separation of concerns

### Semantic vs Lifecycle

**Semantic events:** App foreground changes, timer expirations  
**Lifecycle events:** Session start, session end, UI mount/unmount

**Rule:** Semantic state responds to semantic events, not lifecycle events.

## Final Anchor Rule

**Semantic state is invalidated by semantic events, not by UI teardown.**

This principle prevents entire classes of bugs where semantic state outlives its valid lifetime and causes incorrect system behavior.
