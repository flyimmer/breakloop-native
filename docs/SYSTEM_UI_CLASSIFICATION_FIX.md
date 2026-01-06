# System UI Classification Fix

**Date:** January 7, 2026  
**Issue:** Quick Task timer expires but intervention doesn't trigger  
**Root Cause:** System UI (notification shade) incorrectly updates `lastMeaningfulApp`  
**Status:** ✅ Fixed (classification bug corrected)

## Problem

User reported: "Quick task on Instagram started, but after even a min, I can still use Instagram. t_quickTask I set as 10s."

### Log Analysis

The logs revealed the timer expiration mechanism was working correctly, but intervention wasn't triggering:

```
[System Brain] ⚠️ TIMER_EXPIRED event received
[System Brain] Timer expired for: com.instagram.android
[System Brain] ✓ Classified as Quick Task expiration
[System Brain] Checking foreground app: {
  "currentForegroundApp": "com.android.systemui",
  "expiredApp": "com.instagram.android",
  "shouldTriggerIntervention": false
}
[System Brain] ✓ User switched apps - silent cleanup only (no intervention)
```

**The Problem:**
1. ✅ Timer expires correctly after 10 seconds
2. ✅ System Brain receives `TIMER_EXPIRED` event
3. ✅ Classifies it as Quick Task expiration
4. ❌ System Brain thinks user is on `com.android.systemui` (System UI), NOT Instagram
5. ❌ Does "silent cleanup" instead of launching intervention

### Root Cause

**System UI (`com.android.systemui`) was incorrectly updating `lastMeaningfulApp`.**

When user:
- Pulls down notification shade
- Opens quick settings
- Adjusts volume slider
- Interacts with any system UI overlay

ForegroundDetectionService emits `FOREGROUND_CHANGED` for `com.android.systemui`, and System Brain updated `lastMeaningfulApp` to system UI.

When the timer expired, System Brain compared:
- `lastMeaningfulApp` = `"com.android.systemui"` (wrong!)
- `expiredApp` = `"com.instagram.android"`
- Mismatch → silent cleanup instead of intervention

## Solution: Classification Fix

This is a **classification bug**, not a timing bug.

### Core Rule

**System infrastructure apps must NOT update `lastMeaningfulApp`.**

System infrastructure includes:
- `com.android.systemui` - Notification shade, quick settings, volume slider, etc.
- `android` - Generic Android system package

These are transient overlays that don't represent meaningful user navigation away from the current app.

### Implementation

**File:** `src/systemBrain/eventHandler.ts`

**Added helper function:**

```typescript
/**
 * Check if an app is system infrastructure (should not update lastMeaningfulApp).
 * 
 * System infrastructure apps are transient overlays that don't represent
 * meaningful user navigation away from the current app.
 * 
 * Examples:
 * - com.android.systemui: Notification shade, quick settings, volume slider
 * - android: Generic Android system package
 * 
 * @param packageName - Package name to check
 * @returns true if app is system infrastructure
 */
function isSystemInfrastructureApp(packageName: string | null): boolean {
  if (!packageName) return true;
  return packageName === 'com.android.systemui' || packageName === 'android';
}
```

**Updated `handleForegroundChange()`:**

```typescript
// Before (problematic)
const previousApp = state.lastMeaningfulApp;
state.lastMeaningfulApp = packageName;

// After (correct)
const previousApp = state.lastMeaningfulApp;

if (!isSystemInfrastructureApp(packageName)) {
  state.lastMeaningfulApp = packageName;
  console.log('[System Brain] Foreground app updated:', {
    previous: previousApp,
    current: packageName,
  });
} else {
  console.log('[System Brain] System infrastructure detected, lastMeaningfulApp unchanged:', {
    systemApp: packageName,
    lastMeaningfulApp: state.lastMeaningfulApp,
  });
}
```

## Expected Behavior After Fix

### Scenario: User pulls down notification shade during Quick Task

**Before fix:**
1. User opens Instagram, starts Quick Task (10s)
2. User pulls down notification shade
3. System Brain updates: `lastMeaningfulApp = "com.android.systemui"`
4. Timer expires after 10s
5. System Brain compares: `"com.android.systemui"` ≠ `"com.instagram.android"`
6. ❌ Silent cleanup, NO intervention

**After fix:**
1. User opens Instagram, starts Quick Task (10s)
2. User pulls down notification shade
3. System Brain detects system UI, keeps: `lastMeaningfulApp = "com.instagram.android"`
4. Timer expires after 10s
5. System Brain compares: `"com.instagram.android"` === `"com.instagram.android"`
6. ✅ Launches intervention flow

### Expected Logs

```
[System Brain] Foreground changed to: com.android.systemui
[System Brain] System infrastructure detected, lastMeaningfulApp unchanged: {
  "systemApp": "com.android.systemui",
  "lastMeaningfulApp": "com.instagram.android"
}
[System Brain] ⚠️ TIMER_EXPIRED event received
[System Brain] Timer expired for: com.instagram.android
[System Brain] ✓ Classified as Quick Task expiration
[System Brain] Checking foreground app: {
  "currentForegroundApp": "com.instagram.android",
  "expiredApp": "com.instagram.android",
  "shouldTriggerIntervention": true
}
[System Brain] 🚨 User still on expired app - launching intervention
```

## What This Fix Does

✅ **Ignores system UI in lastMeaningfulApp tracking**  
✅ **Intervention triggers even if notification shade is open**  
✅ **Intervention triggers even if quick settings visible**  
✅ **Intervention triggers even if volume slider shown**  
✅ **Mirrors SystemSurfaceRoot logic** (already filters system UI)

## What This Fix Does NOT Do

❌ **Does NOT add grace periods**  
❌ **Does NOT add retry logic**  
❌ **Does NOT special-case timer expiration**  
❌ **Does NOT add JavaScript timers**  
❌ **Does NOT add "wait for systemui to close" heuristics**

This is a pure classification fix. System UI is correctly classified as "not a meaningful app change."

## Files Modified

1. `src/systemBrain/eventHandler.ts`
   - Added `isSystemInfrastructureApp()` helper function
   - Updated `handleForegroundChange()` to skip system infrastructure

## Testing Instructions

1. **Rebuild the app:**
   ```bash
   npx expo run:android
   ```

2. **Test Quick Task with notification shade:**
   - Set Quick Task to 10 seconds
   - Open Instagram
   - Choose Quick Task
   - Pull down notification shade (or open quick settings)
   - Wait 10 seconds
   - **Expected:** Intervention flow starts even though notification shade is open

3. **Verify logs:**
   ```
   [System Brain] System infrastructure detected, lastMeaningfulApp unchanged
   [System Brain] 🚨 User still on expired app - launching intervention
   ```

## Success Criteria

- ✅ Classification fix implemented
- ⏳ System UI doesn't update lastMeaningfulApp (verify with rebuild)
- ⏳ Timer expiration triggers intervention even with notification shade open
- ⏳ User sees intervention flow after 10 seconds

## Related Issues

This fix also resolves potential issues with:
- Volume slider interactions during timers
- Quick settings panel during timers
- Any other system UI overlays during timers

## Related Documentation

- `docs/QUICK_TASK_TIMER_FIX.md` - Timer expiration mechanism hardening
- `docs/SYSTEM_BRAIN_ARCHITECTURE.md` - System Brain event-driven runtime
- `docs/NATIVE_JAVASCRIPT_BOUNDARY.md` - Architectural boundary rules
