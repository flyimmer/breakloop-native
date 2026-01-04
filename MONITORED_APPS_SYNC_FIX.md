# Monitored Apps Sync Fix

**Date**: January 4, 2026  
**Issue**: XHS (com.xingin.xhs) and other user-selected monitored apps were not triggering interventions

## Problem Summary

The native `ForegroundDetectionService` was checking a hardcoded list of monitored apps instead of the dynamic list synced from JavaScript. When users added apps like XHS in Settings, the JavaScript state was updated but the native layer never received the update, so it never launched the intervention.

## Root Cause

**Line 278** in `ForegroundDetectionService.kt` was checking the wrong variable:

```kotlin
// ❌ WRONG - Hardcoded list
if (MONITORED_APPS.contains(packageName)) {
```

Should have been:

```kotlin
// ✅ CORRECT - Dynamic list synced from JavaScript
if (dynamicMonitoredApps.contains(packageName)) {
```

## Solution Implemented

### 1. Fixed Native Service Check

**File**: `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`

**Change**: Line 278 - Updated to check `dynamicMonitoredApps` instead of `MONITORED_APPS`

```kotlin
// Check if this is a monitored app (for launching intervention)
// Use dynamicMonitoredApps (synced from JavaScript) instead of hardcoded MONITORED_APPS
if (dynamicMonitoredApps.contains(packageName)) {
    Log.i(TAG, "🎯 MONITORED APP DETECTED: $packageName")
    launchInterventionActivity(packageName)
} else {
    Log.d(TAG, "  └─ Not a monitored app, no intervention needed")
}
```

### 2. Verified Native Module Method

**File**: `android/app/src/main/java/com/anonymous/breakloopnative/AppMonitorModule.kt`

**Status**: ✅ Already exists (lines 362-380)

The `setMonitoredApps()` method was already implemented and working correctly:

```kotlin
@ReactMethod
fun setMonitoredApps(packageNames: ReadableArray, promise: Promise) {
    try {
        val apps = mutableSetOf<String>()
        for (i in 0 until packageNames.size()) {
            packageNames.getString(i)?.let { apps.add(it) }
        }
        
        Log.i("AppMonitorModule", "Updating monitored apps list: $apps")
        ForegroundDetectionService.updateMonitoredApps(apps)
        
        val result: WritableMap = Arguments.createMap()
        result.putBoolean("success", true)
        result.putInt("count", apps.size)
        promise.resolve(result)
    } catch (e: Exception) {
        Log.e("AppMonitorModule", "Failed to update monitored apps", e)
        promise.reject("UPDATE_FAILED", "Failed to update monitored apps: ${e.message}", e)
    }
}
```

### 3. Verified JavaScript Sync

**File**: `src/os/osConfig.ts`

**Status**: ✅ Already exists (lines 107-126)

The `setMonitoredApps()` function was already calling the native module:

```typescript
export function setMonitoredApps(packageNames: string[]): void {
  MONITORED_APPS = new Set(packageNames);
  if (__DEV__) {
    console.log('[osConfig] Updated monitored apps:', Array.from(MONITORED_APPS));
  }

  // Update native service on Android
  if (typeof window !== 'undefined') {
    try {
      const { NativeModules, Platform } = require('react-native');
      if (Platform.OS === 'android' && NativeModules.AppMonitorModule) {
        NativeModules.AppMonitorModule.setMonitoredApps(packageNames)
          .then((result: any) => {
            if (__DEV__) {
              console.log('[osConfig] ✅ Native service updated with', result.count, 'monitored apps');
            }
          })
          .catch((error: any) => {
            console.error('[osConfig] ❌ Failed to update native service:', error);
          });
      }
    } catch (error) {
      console.error('[osConfig] Failed to update native monitored apps:', error);
    }
  }
}
```

### 4. Verified Startup Sync

**File**: `app/App.tsx`

**Status**: ✅ Already exists (line 552)

The app loads monitored apps from AsyncStorage on startup and calls `setMonitoredApps()`, which automatically syncs to native:

```typescript
const loadMonitoredApps = async () => {
  try {
    const stored = await AsyncStorage.getItem('monitored_apps_v1');
    if (stored) {
      const apps = JSON.parse(stored);
      setMonitoredApps(apps); // ✅ This syncs to native
      setMonitoredAppsLoaded(true);
    }
  } catch (error) {
    console.error('[App] ❌ Failed to load monitored apps:', error);
  }
};
```

## Architecture

### Event-Driven Sync

The sync is **event-driven**, not continuous:

1. **On app startup** - Load saved monitored apps from AsyncStorage and sync once to native
2. **When user changes settings** - Immediately sync new list to native when user adds/removes monitored apps

### Native Checking

The native service checks `dynamicMonitoredApps` on every foreground change (efficient O(1) Set lookup), but the list itself is only updated when the user changes settings.

### Flow Diagram

```
User changes monitored apps in Settings
    ↓
JavaScript: setMonitoredApps(apps)
    ↓
JavaScript: Update MONITORED_APPS Set
    ↓
JavaScript: Call NativeModules.AppMonitorModule.setMonitoredApps(apps)
    ↓
Native: AppMonitorModule.setMonitoredApps()
    ↓
Native: ForegroundDetectionService.updateMonitoredApps(apps)
    ↓
Native: dynamicMonitoredApps = apps
    ↓
Native: On foreground change, check if (dynamicMonitoredApps.contains(packageName))
    ↓
Native: If yes, launch SystemSurfaceActivity
```

## Testing Instructions

1. **Clear existing state**: Uninstall and reinstall app (optional)
2. **Add XHS to monitored apps** in Settings
3. **Open XHS** from device
4. **Verify logs**:
   - `[osConfig] Updated monitored apps: [com.xingin.xhs, ...]` (JS)
   - `[osConfig] ✅ Native service updated with X monitored apps` (JS)
   - `📱 Monitored apps updated: [com.xingin.xhs, ...]` (Native)
   - `🎯 MONITORED APP DETECTED: com.xingin.xhs` (Native)
   - `BEGIN_INTERVENTION dispatched` (JS)
5. **Verify UI**: Intervention UI appears (Breathing screen)

## Expected Behavior After Fix

- ✅ Any app selected in Settings will immediately sync to native layer
- ✅ Native service will check the dynamic list instead of hardcoded list
- ✅ All monitored apps (including XHS) will trigger interventions
- ✅ System works for any package name user selects
- ✅ Efficient: No continuous polling, just event-driven updates

## Files Modified

1. `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt` - Line 278 fixed
2. Synced to `android/app/src/main/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`

## Files Verified (Already Correct)

1. `android/app/src/main/java/com/anonymous/breakloopnative/AppMonitorModule.kt` - setMonitoredApps() method
2. `src/os/osConfig.ts` - Native sync in setMonitoredApps()
3. `app/App.tsx` - Startup sync via setMonitoredApps()

## Performance Characteristics

- **Sync frequency**: Only on app startup + user settings changes (2-3 times per session typically)
- **Check frequency**: Native checks `dynamicMonitoredApps` on every foreground change (efficient Set lookup, O(1))
- **Memory**: Single Set<String> stored in native service (minimal overhead)
- **No polling**: Pure event-driven architecture
