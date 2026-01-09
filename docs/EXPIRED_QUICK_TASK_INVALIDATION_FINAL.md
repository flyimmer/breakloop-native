# Expired Quick Task Invalidation - Final Fix

**Date:** January 9, 2026  
**Issue:** POST_QUICK_TASK_CHOICE screen persists after user leaves app  
**Status:** ✅ FIXED (Final)

## The Journey to the Correct Fix

### Attempt 1: UI Teardown (Partial Success)

**Fix:** Added POST_QUICK_TASK_CHOICE to teardown effects in `SystemSurfaceRoot.tsx`

**Result:** ✅ Session ends when user leaves app  
**But:** ❌ Choice screen still reappears on app reopen

### Attempt 2: Semantic Invalidation (Wrong Logic)

**Fix:** Added invalidation logic checking `previousApp`

```typescript
// WRONG - Only checks previousApp
if (
  previousApp &&
  state.expiredQuickTasks[previousApp]?.expiredWhileForeground &&
  packageName !== previousApp
) {
  delete state.expiredQuickTasks[previousApp];
}
```

**Result:** ❌ Never runs because expired flag is for Instagram, not launcher

### Attempt 3: Correct Semantic Invalidation (This Fix)

**Fix:** Check ALL apps with expired flags, not just previousApp

```typescript
// CORRECT - Checks all apps
for (const app in state.expiredQuickTasks) {
  if (
    state.expiredQuickTasks[app].expiredWhileForeground &&
    app !== packageName  // User is NOT in this app anymore
  ) {
    console.log(
      '[SystemBrain] Invalidating expiredQuickTask due to app leave',
      { expiredApp: app, currentApp: packageName }
    );
    delete state.expiredQuickTasks[app];
  }
}
```

**Result:** ✅ Correctly invalidates expired flags for any app user is not currently in

## Root Cause Analysis

### Why Previous Fix Failed

**Scenario:**
1. User in Instagram → Quick Task expires → `expiredQuickTasks['com.instagram.android']` = true
2. User goes to Home → `previousApp` = "com.hihonor.android.launcher"
3. Code checks: "Does launcher have expired flag?" → NO
4. Code does nothing → Instagram flag remains in storage
5. User reopens Instagram → Stale flag triggers choice screen again

**The bug:** Checking `previousApp` is wrong because:
- `previousApp` is the launcher (where user came from)
- Expired flag is for Instagram (where user was before)
- These are different apps!

### The Correct Semantic Rule

**An expiredQuickTask is only valid while the user remains in that same app.**

When foreground changes to ANY app, invalidate expired flags for ALL OTHER apps.

This is not about "leaving the previous app" - it's about "being in the current app vs. not being in other apps".

## The Complete Solution (Two Fixes)

### Fix 1: UI Lifecycle

**File:** `app/roots/SystemSurfaceRoot.tsx`  
**Purpose:** End session when user leaves app

```typescript
// QUICK_TASK teardown
if (session?.kind !== 'QUICK_TASK' && session?.kind !== 'POST_QUICK_TASK_CHOICE') return;

// INTERVENTION teardown
if (session?.kind !== 'INTERVENTION' && session?.kind !== 'POST_QUICK_TASK_CHOICE') return;
```

### Fix 2: Semantic Invalidation (Corrected)

**File:** `src/systemBrain/eventHandler.ts`  
**Purpose:** Clear semantic trigger for apps user is not in

```typescript
// Check ALL apps with expired flags
for (const app in state.expiredQuickTasks) {
  if (
    state.expiredQuickTasks[app].expiredWhileForeground &&
    app !== packageName  // User is NOT in this app
  ) {
    delete state.expiredQuickTasks[app];
  }
}
```

## Why This Was Difficult to Fix

### The Subtle Bug

The wrong variable (`previousApp`) **looked almost right**:
- It worked in some cases
- It had semantic meaning
- It was close to the correct logic

But it failed when:
- User went from Instagram → Launcher → Instagram
- `previousApp` = launcher (not Instagram)
- Expired flag = Instagram (not launcher)
- Check failed because it looked for launcher's flag, not Instagram's

### The Correct Mental Model

**Don't think:** "Did we leave the previous app?"  
**Think:** "Are we still in the app that has the expired flag?"

The semantic truth is:
- Expired flag for Instagram is valid ONLY while in Instagram
- When in ANY other app (launcher, systemui, etc.), Instagram's flag is invalid

## Expected Flow After Fix

1. Instagram Quick Task expires → `expiredQuickTasks['com.instagram.android']` set
2. POST_QUICK_TASK_CHOICE screen appears
3. User goes to Home (launcher) → `FOREGROUND_CHANGED` event fires
4. System Brain loops through expired flags
5. Finds: `expiredQuickTasks['com.instagram.android']`
6. Checks: Is user in Instagram? NO (user in launcher)
7. **Invalidates**: `delete state.expiredQuickTasks['com.instagram.android']`
8. **Logs**: `[SystemBrain] Invalidating expiredQuickTask due to app leave`
9. State saved to storage (flag gone)
10. User reopens Instagram
11. No expired flag found
12. OS Trigger Brain evaluates normally
13. Shows Quick Task dialog OR Intervention ✅

## Testing

### Expected Logs

**When user leaves app:**
```
[SystemBrain] Invalidating expiredQuickTask due to app leave
  expiredApp: com.instagram.android
  currentApp: com.hihonor.android.launcher
```

**When user reopens app:**
```
[Decision Engine] Evaluating OS Trigger Brain
[Decision Engine] ✓ OS Trigger Brain: QUICK_TASK (or INTERVENTION)
```

No "PRIORITY #1: Expired Quick Task (foreground)" message.

### Test Scenario

1. Open Instagram → Quick Task dialog
2. Choose Quick Task (10 seconds) → Wait for expiration
3. POST_QUICK_TASK_CHOICE screen appears
4. **Press Home** (don't choose)
5. **Verify logs:** Flag invalidation message appears
6. Reopen Instagram
7. **Expected:** Quick Task dialog OR Intervention (NOT choice screen)

## Architectural Principles

1. **Semantic state is invalidated by semantic events** (not UI teardown)
2. **Check semantic truth, not convenience variables** (all apps, not just previousApp)
3. **System Brain owns semantic state** (no UI mutations)
4. **Persistence updates naturally** (no explicit AsyncStorage writes)

## Final Anchor Rule

**Semantic state must be invalidated based on semantic truth, not on convenience variables like previousApp.**

The correct question is: "Is the expired flag still valid?" not "Did we leave the previous app?"

## Impact

This fix closes the last loop in the Quick Task expired-in-foreground flow. After this:
- ✅ Session ends cleanly when user leaves
- ✅ Semantic flag invalidates correctly
- ✅ No zombie screens
- ✅ No sticky triggers
- ✅ Clean app re-entry behavior

## Related Documentation

- `docs/POST_QUICK_TASK_CHOICE_LIFECYCLE_FIX.md` - Fix 1 (UI teardown)
- `docs/EXPIRED_QUICK_TASK_SEMANTIC_INVALIDATION.md` - Fix 2 (semantic invalidation)
- `docs/EXPIRED_QUICK_TASK_INVALIDATION_FINAL.md` - This document (corrected logic)
