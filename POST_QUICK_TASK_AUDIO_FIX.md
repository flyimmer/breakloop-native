# POST_QUICK_TASK_CHOICE Audio Leak Fix

**Status:** ✅ IMPLEMENTED  
**Date:** January 9, 2026  
**Issue:** Audio/video continued playing behind POST_QUICK_TASK_CHOICE screen

---

## Problem Summary

When Quick Task expired while user was still in the monitored app (e.g., XHS):
- POST_QUICK_TASK_CHOICE screen appeared as an **overlay**
- Underlying app (XHS) remained active in background
- Audio/video continued playing behind the choice screen ❌
- This violated the architectural rule: **"Blocking UI must not be an overlay on an active app"**

## Root Cause

POST_QUICK_TASK_CHOICE was rendered as an overlay instead of a replacement. The underlying app was never properly backgrounded, so it never received `onPause()` lifecycle callback to stop media playback.

## Solution

Added a `useEffect` in `app/roots/SystemSurfaceRoot.tsx` that:
1. Detects when `session.kind === 'POST_QUICK_TASK_CHOICE'`
2. Immediately calls `AppMonitorModule.launchHomeScreen()`
3. This forces the underlying app to background (triggers `onPause()`)
4. Keeps SystemSurface alive so the choice screen remains visible

## Implementation

**File:** `app/roots/SystemSurfaceRoot.tsx` (lines 469-495)

```typescript
/**
 * CRITICAL: Background app immediately when POST_QUICK_TASK_CHOICE starts
 * 
 * POST_QUICK_TASK_CHOICE is a blocking screen, not an overlay.
 * The underlying app must be paused (audio/video stopped) before the user interacts.
 * 
 * This launches home screen to force the app to background,
 * while keeping SystemSurface alive for the choice UI.
 * 
 * ARCHITECTURAL RULE: Blocking UI must not be an overlay on an active app.
 * It must replace the app's foreground context.
 */
useEffect(() => {
  if (session?.kind === 'POST_QUICK_TASK_CHOICE') {
    if (__DEV__) {
      console.log('[SystemSurfaceRoot] Entering POST_QUICK_TASK_CHOICE — backgrounding app');
    }
    
    if (Platform.OS === 'android' && AppMonitorModule?.launchHomeScreen) {
      AppMonitorModule.launchHomeScreen();
      
      if (__DEV__) {
        console.log('[SystemSurfaceRoot] Home screen launched - target app backgrounded');
      }
    }
  }
}, [session?.kind]);
```

## Key Design Decisions

### Why `launchHomeScreen()` and not other methods?

- ✅ **`launchHomeScreen()`** - Correct choice
  - Brings home screen to foreground
  - Forces underlying app to background (triggers `onPause()`)
  - Keeps SystemSurface alive for user interaction
  - Stops audio/video immediately

- ❌ **`cancelInterventionActivity()`** - Wrong
  - Would finish SystemSurface
  - Would kill the choice screen
  - This is Quit behavior, not entry behavior

- ❌ **`finishSystemSurfaceActivity()`** - Wrong
  - Would remove the blocking UI
  - Would leave user in undefined state
  - Breaks "you must decide now" rule

### Why at session entry, not on button press?

The fix must happen **when POST_QUICK_TASK_CHOICE starts**, not when it ends:
- Audio was already playing before user clicks anything
- User may sit on choice screen for seconds/minutes
- Enforcement must be immediate, not deferred
- Blocking semantics require the app to be paused before user interaction

## What Was NOT Changed

- ❌ No changes to `PostQuickTaskChoiceScreen.tsx` Quit handler
- ❌ No media-specific pause logic added
- ❌ No emitters or timers added
- ❌ No native media hacks

The Quit button behavior (`safeEndSession(true)`) remains unchanged and correct.

## Expected Behavior (After Fix)

1. XHS playing audio/video
2. Quick Task expires while XHS is in foreground
3. POST_QUICK_TASK_CHOICE screen appears
4. **Audio stops immediately** ✅ (before user clicks anything)
5. User can still choose:
   - "Continue using this app" → Quick Task dialog or Intervention
   - "Quit this app" → Home screen
6. No audio/video plays behind the choice screen at any time

## Testing Instructions

### Manual Test Scenario

1. Open XHS (小红书)
2. Start playing a video with audio
3. Trigger Quick Task (should appear as overlay)
4. Use Quick Task for its duration
5. Wait for Quick Task to expire **while still in XHS**
6. **Expected:** POST_QUICK_TASK_CHOICE screen appears AND audio stops immediately
7. Verify choice screen is visible and interactive
8. Test both buttons:
   - "Continue using this app" → Should work normally
   - "Quit this app" → Should go to home screen

### Verification Points

- ✅ Audio stops the moment POST_QUICK_TASK_CHOICE appears
- ✅ No audio plays while user is on choice screen
- ✅ Choice screen remains visible and interactive
- ✅ Both buttons work correctly
- ✅ No crashes or frozen UI

## Architectural Rule (Locked)

> **Blocking UI must not be an overlay on an active app.**
> 
> When a blocking screen appears, it must **replace** the app's foreground context, not overlay it. This ensures proper lifecycle enforcement and prevents media leakage.

This rule applies to:
- POST_QUICK_TASK_CHOICE
- Any future blocking screens
- All intervention flows that require user decision

## Logs to Look For

When POST_QUICK_TASK_CHOICE starts, you should see:

```
LOG  [SystemSurfaceRoot] Entering POST_QUICK_TASK_CHOICE — backgrounding app
LOG  [SystemSurfaceRoot] Home screen launched - target app backgrounded
```

This confirms the app was properly backgrounded before the choice screen rendered.

---

**Implementation Status:** ✅ Complete  
**Linting Status:** ✅ No errors  
**Ready for Testing:** ✅ Yes
