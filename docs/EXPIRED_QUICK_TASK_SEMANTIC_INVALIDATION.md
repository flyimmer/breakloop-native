# Expired Quick Task Semantic Invalidation Fix

**Date:** January 9, 2026  
**Issue:** POST_QUICK_TASK_CHOICE screen reappears after user leaves app and reopens  
**Status:** ✅ FIXED

## Problem Description

### Observed Behavior (WRONG)

1. Quick Task expires in foreground → `PostQuickTaskChoiceScreen` appears ✅
2. User presses Home button (without making a choice)
3. Session ends correctly ✅ (from previous fix)
4. User reopens Instagram
5. **BUG:** `PostQuickTaskChoiceScreen` appears AGAIN ❌

### Root Cause

This was **NOT a UI lifecycle problem**. It was a **semantic invalidation problem**.

The `expiredQuickTasks[app]` flag was set when Quick Task expired and **persisted in storage**. When the user left the app:
- ✅ UI session ended correctly (from previous teardown fix)
- ❌ Semantic flag remained in storage
- ❌ On app reopen, System Brain read stale flag from storage
- ❌ Decision Engine saw stale flag → Launched POST_QUICK_TASK_CHOICE again

### Evidence from Logs

**After session ended** (flag still in storage):
```
State saved to storage: {
  "expiredQuickTasks": {
    "com.instagram.android": {
      "expiredAt": 1767960072423,
      "expiredWhileForeground": true
    }
  }
}
```

**User reopens Instagram** (11 seconds later):
```
LOG [Decision Engine] 🚨 PRIORITY #1: Expired Quick Task (foreground) - showing choice screen
LOG [Decision Engine] Flag age: {"ageSeconds": 11}
```

The flag was **stale** but still triggered the choice screen.

## The Semantic Rule

**An expiredQuickTask is only valid while the user remains in the app.**

Once the user leaves the app, that expired flag must be **semantically invalidated** by System Brain.

This is NOT a UI lifecycle cleanup. This is a **semantic state invalidation triggered by a semantic event** (user leaving app).

## The Fix

### File: `src/systemBrain/eventHandler.ts`

Added semantic invalidation logic in `handleForegroundChange()` function, after `lastMeaningfulApp` is updated:

```typescript
// SEMANTIC INVALIDATION: Clear expired Quick Task flag when user leaves app
// An expiredQuickTask is only valid while the user remains in the app.
// Once the user leaves, the expired flag must be semantically invalidated.
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

### Why This Is Correct

- ✅ System Brain owns semantic state
- ✅ Invalidation triggered by semantic event (`FOREGROUND_CHANGED`)
- ✅ NOT triggered by UI lifecycle (`END_SESSION`)
- ✅ Persistence updates naturally via normal `saveTimerState()` flow
- ✅ No cross-layer authority confusion
- ✅ No UI reducers mutating semantic state

## Expected Flow After Fix

1. Quick Task expires → `expiredQuickTasks['com.instagram.android']` set
2. System Brain launches POST_QUICK_TASK_CHOICE screen
3. User presses Home → Instagram leaves foreground
4. System Brain receives `FOREGROUND_CHANGED` event
5. **Detects**: `expiredQuickTasks['com.instagram.android']` exists
6. **Detects**: User left Instagram (newApp ≠ Instagram)
7. **Invalidates flag**: `delete state.expiredQuickTasks['com.instagram.android']`
8. **Logs**: `[SystemBrain] Invalidating expiredQuickTask due to app leave`
9. Saves state to storage (flag now gone)
10. UI session ends separately (already working from previous fix)
11. User reopens Instagram
12. System Brain loads clean state (no expired flag)
13. Decision Engine evaluates OS Trigger Brain normally
14. Shows Quick Task dialog OR Intervention ✅
15. Choice screen does NOT reappear ✅

## Why Both Fixes Are Needed

### Fix 1: POST_QUICK_TASK_CHOICE in Teardown Effects (Previous)

**Location:** `app/roots/SystemSurfaceRoot.tsx`

**Purpose:** UI lifecycle correctness
- Ends session when user leaves app
- Prevents zombie UI
- Ensures clean UI teardown

### Fix 2: Semantic Invalidation on App Leave (This Fix)

**Location:** `src/systemBrain/eventHandler.ts`

**Purpose:** Semantic state correctness
- Clears semantic trigger when user leaves app
- Prevents session from restarting with stale data
- Ensures clean semantic state

Both fixes are necessary. Both respect the architectural boundary:
- **UI fixes UI lifecycle**
- **System Brain fixes semantic state**

## Architectural Principle

**Semantic state is invalidated by semantic events, not by UI teardown.**

- UI teardown ≠ user decision
- Leaving app = semantic event
- System Brain = semantic authority
- UI = expression of intent only

## What This Fix Does NOT Do

- ❌ Does NOT clear semantic state in UI reducers
- ❌ Does NOT add AsyncStorage writes from UI
- ❌ Does NOT modify SystemSessionProvider
- ❌ Does NOT modify PostQuickTaskChoiceScreen
- ❌ Does NOT use DeviceEventEmitter for semantic state
- ❌ Does NOT add native code changes

## Testing

### Test Scenario

1. Open Instagram → Quick Task dialog
2. Choose Quick Task (10 seconds for testing)
3. Wait for expiration → POST_QUICK_TASK_CHOICE screen appears
4. **Press Home** (don't choose)
5. **Verify logs**: Should see `[SystemBrain] Invalidating expiredQuickTask due to app leave`
6. Wait 2 seconds
7. Reopen Instagram
8. **Expected**: Quick Task dialog OR Intervention (NOT choice screen)
9. **Verify logs**: No "PRIORITY #1: Expired Quick Task (foreground)" message

### Log Verification

**When user leaves app:**
```
[SystemBrain] Invalidating expiredQuickTask due to app leave
  app: com.instagram.android
  newApp: com.hihonor.android.launcher
```

**When user reopens app:**
```
[Decision Engine] Evaluating OS Trigger Brain
[Decision Engine] ✓ OS Trigger Brain: QUICK_TASK (or INTERVENTION)
```

No stale expired flag should be found.

## Impact

This fix eliminates the "sticky trigger" bug where a semantic flag persists beyond its valid lifetime and causes UI to relaunch incorrectly.

**Before:** Expired flag persisted indefinitely, causing choice screen to reappear on every app reopen  
**After:** Expired flag is invalidated when user leaves app, allowing normal OS Trigger Brain evaluation

## Related Files

- `src/systemBrain/eventHandler.ts` - Semantic invalidation logic (THIS FIX)
- `app/roots/SystemSurfaceRoot.tsx` - UI teardown logic (PREVIOUS FIX)
- `src/systemBrain/decisionEngine.ts` - Decision logic that reads expired flags
- `src/systemBrain/stateManager.ts` - State persistence

## Commit Message

```
fix: invalidate expiredQuickTask flag when user leaves app

Problem: POST_QUICK_TASK_CHOICE screen reappeared after user left app and reopened
Root cause: expiredQuickTasks flag persisted in storage after user left app
Solution: Semantically invalidate flag in System Brain when FOREGROUND_CHANGED event
         shows user left the app (semantic event, not UI lifecycle)

Architectural principle: Semantic state is invalidated by semantic events, not by UI teardown.

This complements the previous UI teardown fix. Both are needed:
- UI fix: Ends session when user leaves (UI lifecycle correctness)
- This fix: Clears semantic trigger when user leaves (semantic state correctness)

Fixes sticky trigger bug where stale semantic flag caused UI to relaunch incorrectly.
```

## Final Anchor Rule

**Semantic state is invalidated by semantic events, not by UI teardown.**

UI teardown does not equal user decision. Leaving app is a semantic event that invalidates the expired flag's validity.
