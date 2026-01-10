# Post Quick Task Choice Not Appearing - Root Cause Analysis

## What the Logs Show

### Timeline from Terminal Logs

**22:27:08 - Timer Expired (CORRECT)**
```
TIMER_EXPIRED captured foreground: "com.instagram.android"
foregroundAtExpiration: "com.instagram.android"
shouldTriggerIntervention: true
Set nextSessionOverride: POST_QUICK_TASK_CHOICE
Quick Task expired in foreground
expiredQuickTasks: {"com.instagram.android": {
  "expiredAt": 1767997628184,
  "expiredWhileForeground": true,
  "foregroundAppAtExpiration": "com.instagram.android"
}}
```

✅ **System correctly detected expiration while on Instagram**
✅ **Set POST_QUICK_TASK_CHOICE override**
✅ **Stored expired flag**

**22:28:33 - User Left Instagram (PROBLEM)**
```
Foreground changed to: com.android.systemui
[SystemBrain] Invalidating expiredQuickTask due to app leave
[SystemBrain] Merge: Deleted stale expiredQuickTask flag: com.instagram.android
expiredQuickTasks: {}  ← FLAG CLEARED
```

❌ **The expired flag was DELETED when user left Instagram**

## Root Cause

The system has logic that **invalidates the `expiredQuickTasks` flag** when the user leaves the app.

**The problem:** This breaks the POST_QUICK_TASK_CHOICE flow because:
1. Timer expires while user on Instagram → flag set ✓
2. User leaves Instagram (goes to notification shade, home, etc.)
3. Flag is cleared ❌
4. User returns to Instagram
5. No flag exists → no POST_QUICK_TASK_CHOICE ❌

## Why This Logic Exists

The invalidation logic probably exists to prevent showing POST_QUICK_TASK_CHOICE when:
- User left the app
- Timer expired
- User returns much later

But it's too aggressive - it clears the flag immediately when user leaves, even if they return seconds later.

## The Correct Behavior

**POST_QUICK_TASK_CHOICE should appear when:**
- Timer expired while user was on the app
- User returns to the app (even if they left briefly)
- Within a reasonable time window (e.g., 5 minutes)

**The flag should NOT be cleared when:**
- User briefly leaves to check notifications
- User goes to home screen momentarily
- User switches apps briefly

## Where to Find the Bug

Search for:
- `Invalidating expiredQuickTask`
- `Deleted stale expiredQuickTask flag`
- Logic that clears `expiredQuickTasks` on app leave

**Likely location:** `src/systemBrain/eventHandler.ts` in `handleForegroundChange()`

## The Fix

**Option 1: Time-based invalidation (recommended)**
- Don't clear flag on app leave
- Clear flag only after X minutes (e.g., 5 minutes)
- This allows user to briefly leave and return

**Option 2: User interaction invalidation**
- Don't clear flag on app leave
- Clear flag only when user makes a choice (Conscious Process or Quick Task again)

**Option 3: Remove invalidation entirely**
- Let the flag persist until user returns
- Show POST_QUICK_TASK_CHOICE whenever they return
- Clear flag only after user makes a choice

## Next Steps

1. Find the invalidation logic in `eventHandler.ts`
2. Either remove it or make it time-based
3. Test: Timer expires → user leaves → user returns → POST_QUICK_TASK_CHOICE appears

---

**Date:** January 9, 2026  
**Issue:** POST_QUICK_TASK_CHOICE not appearing  
**Root Cause:** expiredQuickTasks flag cleared when user leaves app  
**Fix:** Add guard to preserve flag when POST_QUICK_TASK_CHOICE is pending  
**Status:** ✅ FIXED - Implemented in eventHandler.ts

## Implementation

**File:** `src/systemBrain/eventHandler.ts`

**Changes:**
1. Added `getNextSessionOverride` to imports
2. Retrieve `nextSessionOverride` at start of `handleForegroundChange()`
3. Added `hasPendingChoice` guard to invalidation logic
4. Preserve `expiredQuickTasks` when `POST_QUICK_TASK_CHOICE` is pending

**Key Logic:**
```typescript
const hasPendingChoice =
  nextSessionOverride?.app === app &&
  nextSessionOverride?.kind === 'POST_QUICK_TASK_CHOICE';

if (
  state.expiredQuickTasks[app].expiredWhileForeground &&
  app !== packageName &&
  !hasPendingChoice  // ✅ Preserve flag if choice is pending
) {
  delete state.expiredQuickTasks[app];
}
```

**Result:** Flag now survives app switches until user explicitly resolves the choice.  
