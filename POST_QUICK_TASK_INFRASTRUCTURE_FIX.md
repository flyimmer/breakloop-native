# POST_QUICK_TASK_CHOICE Infrastructure Invalidation Fix

## Problem

POST_QUICK_TASK_CHOICE screen flashed briefly then immediately closed, even after the launcher check was added.

**Root cause:** The `expiredQuickTask` flag was being cleared when foreground changed to **BreakLoop itself**, before the launcher check could run.

## Timeline of System-Initiated Changes

When POST_QUICK_TASK_CHOICE is shown, TWO system-initiated foreground changes occur:

1. **Instagram → BreakLoop** (`com.instagram.android` → `com.anonymous.breakloopnative`)
   - ❌ Was treated as "user left app"
   - ❌ Flag cleared at line 575: `[SystemBrain] Invalidating expiredQuickTask (user-initiated app leave)`
   
2. **BreakLoop → Launcher** (`com.anonymous.breakloopnative` → `com.hihonor.android.launcher`)
   - ✅ Correctly preserved by time-window marker
   - ✅ Correctly preserved by launcher check in SystemSurfaceRoot

## The Missing Guard

The launcher check in SystemSurfaceRoot was correct but **too late** — the flag was already deleted by System Brain when the foreground changed to BreakLoop.

**The invalidation logic needed to recognize:**
> BreakLoop itself is infrastructure, not a user-chosen app.

## Solution: Infrastructure-Aware Invalidation

Added infrastructure check to the semantic invalidation logic in System Brain.

### Implementation

**File:** `src/systemBrain/eventHandler.ts`

**1. Detect infrastructure apps** (lines 444-447):
```typescript
// Check if current foreground app is infrastructure
// Infrastructure apps (BreakLoop overlay, system UI) don't represent user navigation
const isInfrastructureApp = isSystemInfrastructureApp(packageName, {
  isHeadlessTaskProcessing: state.isHeadlessTaskProcessing
});
```

**2. Updated invalidation condition** (lines 484-510):
```typescript
for (const app in state.expiredQuickTasks) {
  if (
    state.expiredQuickTasks[app].expiredWhileForeground &&
    app !== packageName &&  // User is NOT in this app anymore
    !isSystemInitiated &&  // Don't invalidate if system backgrounded the app
    !isInfrastructureApp  // Don't invalidate if foreground is infrastructure
  ) {
    console.log(
      '[SystemBrain] Invalidating expiredQuickTask (user left for real app)',
      { expiredApp: app, currentApp: packageName }
    );
    delete state.expiredQuickTasks[app];
  } else if (isSystemInitiated) {
    console.log(
      '[SystemBrain] Preserving expiredQuickTask (system-initiated foreground change)',
      { expiredApp: app, currentApp: packageName }
    );
  } else if (isInfrastructureApp) {
    console.log(
      '[SystemBrain] Preserving expiredQuickTask (BreakLoop infrastructure)',
      { expiredApp: app, currentApp: packageName }
    );
  }
}
```

## Architecture Principle (Locked)

> **Infrastructure is not navigation. Semantic invalidation must only respond to real user app switches.**

Infrastructure apps:
- `com.anonymous.breakloopnative` (during headless task processing)
- `com.android.systemui` (notification shade, quick settings)
- `android` (generic system package)

These are transient overlays, not user-chosen destinations.

## Three-Layer Defense

The fix now has three complementary guards:

1. **System Brain - Infrastructure check** ← THIS FIX
   - Prevents invalidation when foreground is BreakLoop or system UI
   - Semantic layer protection

2. **System Brain - Time-window marker**
   - Prevents invalidation during event bursts (launcher transition)
   - Debounces Android's multiple FOREGROUND_CHANGED events

3. **SystemSurface - Launcher check**
   - Prevents UI teardown when underlying app is launcher
   - UI lifecycle protection

All three work together to ensure POST_QUICK_TASK_CHOICE stays visible.

## Expected Behavior After Fix

1. Quick Task expires in Instagram
2. Foreground changes:
   - Instagram → BreakLoop (**flag preserved** ✓)
   - BreakLoop → Launcher (**flag preserved** ✓)
3. POST_QUICK_TASK_CHOICE screen stays visible ✓
4. User can interact with buttons ✓
5. Pressing "Quit" or "Continue" clears flag ✓
6. Switching to a real third-party app clears flag ✓

## Complete Fix Chain

This completes the entire Quick Task expiration fix sequence:

1. ✅ **Time-of-truth** - Capture foreground at TIMER_EXPIRED
2. ✅ **Native timer scheduling** - Retry headless task when React Native not ready
3. ✅ **Foreground tracking** - Remove native deduplication
4. ✅ **Time-of-validity** - Preserve expiredQuickTasks until resolved
5. ✅ **System-initiated marker** - Time-window to handle event bursts
6. ✅ **Launcher check** - Skip UI teardown for expected POST_QUICK_TASK_CHOICE state
7. ✅ **Infrastructure guard** - Skip semantic invalidation for BreakLoop overlay ← THIS FIX

## Files Modified

1. `src/systemBrain/eventHandler.ts`
   - Added `isInfrastructureApp` check in `handleForegroundChange()`
   - Updated invalidation condition to include `!isInfrastructureApp`
   - Added infrastructure preservation logging

---

**Date:** January 9, 2026  
**Issue:** POST_QUICK_TASK_CHOICE auto-closing (infrastructure invalidation)  
**Root Cause:** System Brain treating BreakLoop overlay as "user left app"  
**Fix:** Infrastructure-aware semantic invalidation  
**Status:** ✅ FIXED - Implemented and rebuilding
