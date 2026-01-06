# SystemSurface Launch Debugging

**Date:** January 6, 2025  
**Issue:** SystemSurfaceActivity not launching when System Brain calls `launchSystemSurface()`  
**Status:** Investigation in progress

## Problem

When user clicks Instagram:
1. ✅ System Brain detects Instagram (monitored app)
2. ✅ System Brain evaluates OS Trigger Brain
3. ✅ System Brain decides to show Quick Task dialog
4. ✅ System Brain calls `launchSystemSurface()`
5. ❌ SystemSurfaceActivity never starts
6. ❌ User sees BreakLoop main app instead

## Evidence from Logs

**What we see:**
```
[System Brain] ✓ n_quickTask > 0 - launching with SHOW_QUICK_TASK_DIALOG
[System Brain] 🚀 Launching SystemSurface: { triggeringApp: "com.instagram.android", wakeReason: "SHOW_QUICK_TASK_DIALOG" }
[SystemSession] Foreground app changed: com.anonymous.breakloopnative
```

**What's missing (should appear but doesn't):**
```
[AppMonitorModule] 📱 System Brain requested SystemSurface launch: ...
[SystemSurfaceRoot] 🚀 Bootstrap initialization starting...
```

## Root Cause Hypothesis

The `launchSystemSurface()` native method is not being called successfully from the Headless Task context.

### Possible Causes

1. **NativeModules not available in Headless Task**
   - React Native Headless Tasks run in a separate JS context
   - Native modules might not be accessible
   - `AppMonitorModule` could be `null` or `undefined`

2. **Silent failure**
   - Error caught but not logged
   - Console.error might not work in Headless Task

3. **Module registration issue**
   - Native module not registered for Headless Task context

## Investigation Steps

### Step 1: Add Defensive Logging ✅

Added comprehensive logging to `src/systemBrain/nativeBridge.ts`:

```typescript
export async function launchSystemSurface(
  triggeringApp: string,
  wakeReason: WakeReason
): Promise<void> {
  console.log('[System Brain] launchSystemSurface called:', {
    triggeringApp,
    wakeReason,
    AppMonitorModuleExists: !!AppMonitorModule,
    AppMonitorModuleType: typeof AppMonitorModule,
    hasLaunchMethod: AppMonitorModule ? typeof AppMonitorModule.launchSystemSurface : 'N/A',
  });
  
  if (!AppMonitorModule) {
    console.error('[System Brain] ❌ AppMonitorModule is NULL - cannot launch SystemSurface');
    console.error('[System Brain] This means NativeModules are not available in Headless Task context');
    return;
  }
  
  if (!AppMonitorModule.launchSystemSurface) {
    console.error('[System Brain] ❌ launchSystemSurface method does not exist on AppMonitorModule');
    console.error('[System Brain] Available methods:', Object.keys(AppMonitorModule));
    return;
  }
  
  console.log('[System Brain] 🚀 Launching SystemSurface:', {
    triggeringApp,
    wakeReason,
    note: 'System Brain pre-decided UI flow',
  });
  
  try {
    AppMonitorModule.launchSystemSurface(wakeReason, triggeringApp);
    console.log('[System Brain] ✅ launchSystemSurface call completed');
  } catch (error) {
    console.error('[System Brain] ❌ Failed to launch SystemSurface:', error);
    console.error('[System Brain] Error details:', JSON.stringify(error));
  }
}
```

### Step 2: Test and Analyze Logs

**Next action:** Rebuild and test to see which log appears:

**Scenario A: AppMonitorModule is NULL**
```
[System Brain] launchSystemSurface called: { AppMonitorModuleExists: false, ... }
[System Brain] ❌ AppMonitorModule is NULL - cannot launch SystemSurface
```
→ **Solution:** Use AsyncStorage bridge pattern (native polls for decisions)

**Scenario B: Method doesn't exist**
```
[System Brain] launchSystemSurface called: { AppMonitorModuleExists: true, hasLaunchMethod: "undefined" }
[System Brain] ❌ launchSystemSurface method does not exist on AppMonitorModule
```
→ **Solution:** Check Kotlin method registration, verify @ReactMethod annotation

**Scenario C: Call fails with error**
```
[System Brain] 🚀 Launching SystemSurface: ...
[System Brain] ❌ Failed to launch SystemSurface: [error details]
```
→ **Solution:** Fix the specific error

**Scenario D: Call succeeds but activity doesn't start**
```
[System Brain] 🚀 Launching SystemSurface: ...
[System Brain] ✅ launchSystemSurface call completed
```
→ **Solution:** Check native side (Intent flags, Activity manifest, etc.)

## Potential Solutions

### Solution A: AsyncStorage Bridge Pattern

If NativeModules are not available in Headless Task:

**System Brain saves decision:**
```typescript
await AsyncStorage.setItem('system_brain_launch_decision', JSON.stringify({
  triggeringApp,
  wakeReason,
  timestamp: Date.now(),
  consumed: false,
}));
```

**ForegroundDetectionService polls and launches:**
```kotlin
// After emitting FOREGROUND_CHANGED event
Handler(Looper.getMainLooper()).postDelayed({
    checkAndLaunchSystemSurface()
}, 100)

private fun checkAndLaunchSystemSurface() {
    val prefs = context.getSharedPreferences("RCTAsyncLocalStorage", Context.MODE_PRIVATE)
    val decisionJson = prefs.getString("system_brain_launch_decision", null)
    
    if (decisionJson != null) {
        val decision = parseDecision(decisionJson)
        if (!decision.consumed) {
            launchSystemSurface(decision.wakeReason, decision.triggeringApp)
            markDecisionConsumed()
        }
    }
}
```

### Solution B: Direct Native Launch

If the issue is timing/context:

**ForegroundDetectionService decides and launches directly:**
```kotlin
// After detecting monitored app foreground
if (shouldLaunchIntervention(packageName)) {
    val wakeReason = determineWakeReason(packageName)
    launchSystemSurface(wakeReason, packageName)
}
```

But this violates Phase 2 architecture (System Brain should decide).

### Solution C: Event-Based Bridge

Use React Native's event system:

**System Brain emits event:**
```typescript
import { NativeEventEmitter, NativeModules } from 'react-native';
const eventEmitter = new NativeEventEmitter(NativeModules.AppMonitorModule);
eventEmitter.emit('LAUNCH_SYSTEM_SURFACE', { triggeringApp, wakeReason });
```

**Native listens and launches:**
```kotlin
// In AppMonitorModule
@ReactMethod
fun addListener(eventName: String) {
    // Required for event emitters
}

@ReactMethod
fun removeListeners(count: Int) {
    // Required for event emitters
}
```

## Next Steps

1. ✅ Add defensive logging
2. 🔄 Rebuild app: `npm run android`
3. 🔄 Test with Instagram
4. 🔄 Analyze new logs to determine root cause
5. ⏳ Implement appropriate solution based on findings

## Related Documentation

- `docs/SYSTEM_BRAIN_ARCHITECTURE.md` - System Brain architecture
- `docs/NATIVE_JAVASCRIPT_BOUNDARY.md` - Architectural boundary rules
- React Native Headless JS: https://reactnative.dev/docs/headless-js-android
