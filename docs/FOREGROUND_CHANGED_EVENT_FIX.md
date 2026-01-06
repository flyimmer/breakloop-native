# FOREGROUND_CHANGED Event Fix

**Date:** January 6, 2026  
**Issue:** No intervention after Quick Task expires  
**Root Cause:** System Brain never receives FOREGROUND_CHANGED events, so `lastMeaningfulApp` stays null

## Problem Summary

After Quick Task expires, intervention does not appear even though user is still on Instagram.

### Symptoms from Logs

```
[System Brain] Timer expired for: com.instagram.android
[System Brain] Checking foreground app: {
  "expiredApp": "com.instagram.android",
  "currentForegroundApp": null,  // <-- PROBLEM: Should be "com.instagram.android"
  "shouldTriggerIntervention": false
}
[System Brain] User switched apps - silent cleanup only (no intervention)
```

System Brain logic:
```typescript
if (currentForegroundApp === packageName) {
  // Launch intervention
} else {
  // Silent cleanup (user switched apps)
}
```

Since `currentForegroundApp` is null, it never matches, so no intervention is launched.

## Root Cause

**ForegroundDetectionService was NOT emitting FOREGROUND_CHANGED events to System Brain.**

### Architecture

System Brain needs to know the current foreground app to make intervention decisions:

```typescript
// src/systemBrain/eventHandler.ts
async function handleForegroundChange(
  packageName: string,
  timestamp: number,
  state: TimerState
): Promise<void> {
  // Update last meaningful app
  state.lastMeaningfulApp = packageName;  // <-- This needs to happen!
  
  // Evaluate OS Trigger Brain logic
  evaluateTriggerLogic(packageName, timestamp);
}
```

But this function was never called because native never emitted the event!

### What Was Missing

In `ForegroundDetectionService.kt`, the `onAccessibilityEvent()` function was:

**Before (BROKEN):**
```kotlin
override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    // ... detect package name ...
    
    // Emit to MainApp context (for UI state tracking)
    emitForegroundAppChangedEvent(packageName)
    
    // ❌ MISSING: No emission to System Brain!
    
    // Launch SystemSurface if monitored app
    if (dynamicMonitoredApps.contains(packageName)) {
        launchInterventionActivity(packageName)
    }
}
```

**After (FIXED):**
```kotlin
override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    // ... detect package name ...
    
    // Emit to MainApp context (for UI state tracking)
    emitForegroundAppChangedEvent(packageName)
    
    // ✅ ADDED: Emit to System Brain (for lastMeaningfulApp tracking)
    emitSystemEvent("FOREGROUND_CHANGED", packageName, System.currentTimeMillis())
    
    // Launch SystemSurface if monitored app
    if (dynamicMonitoredApps.contains(packageName)) {
        launchInterventionActivity(packageName)
    }
}
```

### Key Points

1. **Emitted for ALL apps** - Not just monitored apps
   - System Brain needs to track exits from monitored apps too
   - Home screen switches are important for cleanup logic

2. **Emitted BEFORE launching SystemSurface** - Order matters
   - System Brain must know current foreground app before intervention starts
   - Ensures state is consistent when Quick Task dialog appears

3. **Uses existing `emitSystemEvent()` function** - No new infrastructure needed
   - Same mechanism used for TIMER_EXPIRED and TIMER_SET
   - Goes through SystemBrainService (HeadlessTaskService)

## Solution Implemented

### File Modified

`plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`

### Change Made

Added 3 lines after line 347:

```kotlin
// Emit FOREGROUND_CHANGED to System Brain (for lastMeaningfulApp tracking)
// This MUST happen for ALL apps BEFORE launching SystemSurface
// so that System Brain knows the current foreground app when making decisions
emitSystemEvent("FOREGROUND_CHANGED", packageName, System.currentTimeMillis())
```

### Sync and Build

1. Modified source file in `plugins/src/android/java/...`
2. Ran `npm run sync:kotlin` to copy to `android/app/src/main/java/...`
3. Rebuilt app with `npm run android`

## Expected Behavior After Fix

### Test A: Quick Task Expiration (Regression Fix)

**Setup:**
- Set `n_quickTask = 1` in Settings
- Accessibility Service enabled

**Steps:**
1. Open Instagram
2. Quick Task dialog appears
3. Click "Quick Task" (10 seconds)
4. Stay on Instagram
5. Wait 10 seconds

**Expected Result:** ✅ Intervention flow appears

### Event Flow

```
1. User opens Instagram
   ↓
   ForegroundDetectionService detects "com.instagram.android"
   ↓
   Emits FOREGROUND_CHANGED to System Brain
   ↓
   System Brain: lastMeaningfulApp = "com.instagram.android" ✅
   ↓
   Launches SystemSurface (Quick Task dialog)

2. User clicks Quick Task
   ↓
   Timer stored (expiresAt = now + 10 seconds)
   ↓
   Emits TIMER_SET to System Brain
   ↓
   System Brain records Quick Task usage

3. Wait 10 seconds...

4. Timer expires
   ↓
   ForegroundDetectionService checks timers
   ↓
   Emits TIMER_EXPIRED("com.instagram.android") to System Brain
   ↓
   System Brain checks:
     - expiredApp: "com.instagram.android"
     - currentForegroundApp: "com.instagram.android" ✅ (from FOREGROUND_CHANGED)
     - Match? YES ✅
   ↓
   System Brain launches SystemSurface
   ↓
   Intervention flow appears ✅
```

## Expected Logs After Fix

### When User Opens Instagram

```
[ForegroundDetection] 📱 Foreground app changed: com.instagram.android
[ForegroundDetection] 🔵 About to emit FOREGROUND_CHANGED to SystemBrainService
[ForegroundDetection] ✅ startService() called successfully
[System Brain] ========================================
[System Brain] 📨 Event received (HeadlessTask)
[System Brain] Event type: FOREGROUND_CHANGED
[System Brain] Foreground changed to: com.instagram.android
[System Brain] Foreground app updated: {"previous": null, "current": "com.instagram.android"}
[System Brain] ========================================
```

### When Quick Task Expires

```
[System Brain] ========================================
[System Brain] Event type: TIMER_EXPIRED
[System Brain] Timer expired for: com.instagram.android
[System Brain] ✓ Classified as Quick Task expiration
[System Brain] Checking foreground app: {
  "expiredApp": "com.instagram.android",
  "currentForegroundApp": "com.instagram.android",  ✅ NOW CORRECT!
  "timerType": "QUICK_TASK",
  "shouldTriggerIntervention": true
}
[System Brain] 🚨 User still on expired app - launching intervention
[System Brain] This is SILENT expiration (no reminder screen)
[SystemSurfaceActivity] Launching...
[SystemSurface] Bootstrap starting...
```

## Files Modified

1. `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt` - Added FOREGROUND_CHANGED emission
2. `android/app/src/main/java/.../ForegroundDetectionService.kt` - Auto-synced from plugins

## Prevention

When implementing event-driven systems:
- [ ] Define all event types upfront (TIMER_SET, TIMER_EXPIRED, FOREGROUND_CHANGED)
- [ ] Ensure native emits ALL defined event types
- [ ] Test that JS handlers receive all event types
- [ ] Verify state updates correctly for each event type
- [ ] Check logs to confirm event delivery

## Related Issues Fixed

This fix completes the System Brain event delivery:
- ✅ TIMER_SET events (already working)
- ✅ TIMER_EXPIRED events (already working)
- ✅ FOREGROUND_CHANGED events (fixed now!)

All three event types now flowing correctly from native to System Brain.
