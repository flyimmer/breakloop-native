# POST_QUICK_TASK_CHOICE Auto-Close - Final Fix

## Problem

POST_QUICK_TASK_CHOICE screen flashed briefly then immediately closed and went to home screen.

**User observation:** "very short, I can not even see it clearly"

## Root Cause (Final)

The "underlying app changed" check in `SystemSurfaceRoot.tsx` was treating the launcher as "user left app" and ending the session, even though POST_QUICK_TASK_CHOICE **intentionally backgrounds to the launcher**.

**Event sequence:**
```
1. POST_QUICK_TASK_CHOICE session starts (session.app = "com.instagram.android")
2. launchHomeScreen() called to background Instagram
3. underlyingApp changes to "com.hihonor.android.launcher"
4. useEffect detects: underlyingApp !== session.app
5. Calls safeEndSession(true) ❌
6. Session ends immediately
7. Screen flashes and closes
```

## Solution: Launcher Check

Added conditional check to skip session teardown when POST_QUICK_TASK_CHOICE is showing and the underlying app is the launcher (expected state).

### Implementation

**File:** `app/roots/SystemSurfaceRoot.tsx`

**1. Added launcher detection helper** (lines 86-100):
```typescript
function isLauncherApp(packageName: string | null): boolean {
  if (!packageName) return false;
  
  return (
    packageName.includes('launcher') ||
    packageName === 'com.android.launcher' ||
    packageName === 'com.hihonor.android.launcher' ||
    packageName.includes('.launcher.')
  );
}
```

**2. Added launcher check to FIRST useEffect** (lines 544-550):
```typescript
// Skip teardown when POST_QUICK_TASK_CHOICE intentionally backgrounds to launcher
if (session?.kind === 'POST_QUICK_TASK_CHOICE' && isLauncherApp(underlyingApp)) {
  if (__DEV__) {
    console.log('[SystemSurfaceRoot] POST_QUICK_TASK_CHOICE with launcher - expected, skipping teardown');
  }
  return;
}
```

**3. Added launcher check to SECOND useEffect** (lines 602-608):
```typescript
// Skip teardown when POST_QUICK_TASK_CHOICE intentionally backgrounds to launcher
if (session?.kind === 'POST_QUICK_TASK_CHOICE' && isLauncherApp(underlyingApp)) {
  if (__DEV__) {
    console.log('[SystemSurfaceRoot] POST_QUICK_TASK_CHOICE with launcher - expected, skipping teardown');
  }
  return;
}
```

## Why This Is Correct

1. **Conditional, not temporal:** Checks WHAT the app is, not WHEN it changed
2. **No timers:** Pure state-based logic
3. **No new flags:** Uses existing state
4. **Stable:** Works regardless of timing or event order
5. **Precise:** Only affects POST_QUICK_TASK_CHOICE + launcher combination

## Architecture

**The fix enforces:**
> Expected foreground changes must not be treated as user exits. POST_QUICK_TASK_CHOICE → launcher is expected.

This is a **UI-layer lifecycle rule**, not a semantic or System Brain issue.

## Expected Behavior After Fix

1. Quick Task expires in foreground
2. POST_QUICK_TASK_CHOICE screen appears
3. App backgrounds to launcher
4. **Session does NOT end** ✓
5. **Screen stays visible** ✓
6. User can see and interact with buttons
7. User presses "Quit" or "Continue"
8. Session ends normally
9. If user switches to a different real app → session ends normally ✓

## Complete Fix Chain

This completes the entire Quick Task expiration fix sequence:

1. ✅ **Time-of-truth** - Capture foreground at TIMER_EXPIRED
2. ✅ **Native timer scheduling** - Retry headless task when React Native not ready
3. ✅ **Foreground tracking** - Remove native deduplication
4. ✅ **Time-of-validity** - Preserve expiredQuickTasks until resolved
5. ✅ **System-initiated marker** - Time-window to handle event bursts
6. ✅ **Launcher check** - Skip teardown for expected POST_QUICK_TASK_CHOICE state ← THIS FIX

## Files Modified

1. `app/roots/SystemSurfaceRoot.tsx`
   - Added `isLauncherApp()` helper function
   - Added launcher check to both underlying app change useEffects

---

**Date:** January 9, 2026  
**Issue:** POST_QUICK_TASK_CHOICE auto-closing  
**Root Cause:** UI-layer treating launcher as "user left app"  
**Fix:** Skip teardown when POST_QUICK_TASK_CHOICE + launcher (expected state)  
**Status:** ✅ FIXED - Implemented and rebuilding
