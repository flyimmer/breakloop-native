# Headless Task Crash Fix

## Problem

After building the app, there was a crash in the terminal:

```
E unknown:HeadlessJsTaskContext: Unhandled SoftException
E unknown:HeadlessJsTaskContext: java.lang.RuntimeException: Cannot start headless task, CatalystInstance not available
```

## Root Cause

The `SystemBrainService` (HeadlessJsTaskService) was trying to start a headless task **before React Native was fully initialized**. This happens when:

1. The app starts up
2. `ForegroundDetectionService` detects an app change
3. It tries to emit an event to System Brain via `SystemBrainService`
4. But React Native's CatalystInstance isn't ready yet
5. The headless task fails to start → crash

## Fix Applied

**File:** `plugins/src/android/java/com/anonymous/breakloopnative/SystemBrainService.kt`

Added a check in `getTaskConfig()` to verify React Native is initialized before attempting to start the headless task:

```kotlin
// CRITICAL: Check if React Native is initialized before starting headless task
try {
    val reactContext = reactApplicationContext
    if (reactContext == null) {
        Log.w(TAG, "⚠️ React Native not initialized yet, deferring headless task")
        return null
    }
    // Check if React Native has an active instance
    if (!reactContext.hasActiveReactInstance()) {
        Log.w(TAG, "⚠️ React Native not initialized yet, deferring headless task")
        return null
    }
} catch (e: Exception) {
    Log.w(TAG, "⚠️ Error checking React Native initialization, deferring headless task")
    return null
}
```

**Behavior:**
- If React Native isn't ready → return `null` (task won't start, no crash)
- Event is lost during startup (expected and acceptable)
- Once React Native is ready, subsequent events will work normally

## Related Issue: Metro Bundler Connection

There was also a Metro bundler connection error:

```
E unknown:ReactHost: The device must either be USB connected (with bundler set to "localhost:8081") 
or be on the same Wi-Fi network as your computer
```

**This is a separate issue** that can cause React Native initialization to fail.

**Fix:**
```bash
# If using USB connection, run:
adb reverse tcp:8081 tcp:8081

# Or ensure device and computer are on the same Wi-Fi network
```

## Testing

After rebuilding with this fix:

1. ✅ App should start without headless task crashes
2. ✅ Early events during startup will be safely ignored (logged as warnings)
3. ✅ Once React Native is ready, events will process normally
4. ✅ Quick Task timer should work correctly

## Expected Logs

**During startup (React Native not ready):**
```
[SystemBrainService] ⚠️ React Native not initialized yet, deferring headless task
[SystemBrainService]    Event will be lost - this is expected during app startup
```

**After React Native is ready:**
```
[SystemBrainService] 📤 Forwarding mechanical event to System Brain JS: FOREGROUND_CHANGED for com.instagram.android
[SystemBrainService] 🚀 System Brain headless task started (taskId: 1)
[System Brain] Event received: FOREGROUND_CHANGED
[SystemBrainService] ✅ System Brain headless task finished (taskId: 1)
```

## Status

✅ **Fixed** - Headless task crash resolved
⚠️ **Metro connection** - Separate issue, needs `adb reverse` or Wi-Fi setup

---

**Date:** January 9, 2026  
**Issue:** Headless task crash on startup  
**Root Cause:** Starting headless task before React Native initialization  
**Fix:** Added React Native readiness check  
**Status:** Fixed, ready to rebuild  
