# System Brain Event Delivery Fix V2

**Date:** January 6, 2026  
**Issue:** TIMER_SET and TIMER_EXPIRED events not reaching System Brain JS  
**Root Cause:** SystemBrainService not registered in AndroidManifest.xml

## Problem Summary

After implementing SystemBrainService, Quick Task timer was stored in native but **no events reached System Brain JS**:

- ❌ No TIMER_SET event when Quick Task starts
- ❌ No TIMER_EXPIRED event after 10 seconds
- ❌ No intervention flow after Quick Task expires

### Evidence

**Logs showed:**
```
LOG  [QuickTaskDialog] Quick Task timer stored in native: {"expiresAt": 1767652088541}
```

**But missing:**
- No `[AppMonitorModule] 📤 Emitted mechanical event to System Brain: TIMER_SET`
- No `[SystemBrainService] 🚀 System Brain headless task started`
- No `[System Brain] 📨 Event received (HeadlessTask)`

## Root Cause

**SystemBrainService was NOT in AndroidManifest.xml**

When we created SystemBrainService.kt and updated the Expo config plugin, we ran `npm run android` which:
- ✅ Copied Kotlin files from `plugins/` to `android/`
- ✅ Compiled the code successfully
- ❌ Did NOT regenerate AndroidManifest.xml

**Why?** Only `expo prebuild` regenerates AndroidManifest from plugins. Regular builds (`npm run android`) do not.

### Verification

Checked `android/app/src/main/AndroidManifest.xml`:
- ✅ ForegroundDetectionService present
- ✅ MainActivity present
- ✅ SystemSurfaceActivity present
- ❌ **SystemBrainService MISSING**

This caused `startService(intent)` calls to fail silently because Android couldn't find the service.

## Solution Implemented

### Step 1: Added Debug Logging

Updated both `AppMonitorModule.kt` and `ForegroundDetectionService.kt` to log before and after `startService()`:

```kotlin
private fun emitSystemEventToSystemBrain(...) {
    try {
        android.util.Log.i("AppMonitorModule", "🔵 About to emit $eventType to SystemBrainService")
        
        val intent = Intent(reactApplicationContext, SystemBrainService::class.java).apply {
            // ... intent extras ...
        }
        
        android.util.Log.i("AppMonitorModule", "🔵 Intent created, calling startService()...")
        reactApplicationContext.startService(intent)
        android.util.Log.i("AppMonitorModule", "✅ startService() called successfully")
        android.util.Log.i("AppMonitorModule", "📤 Emitted mechanical event to System Brain: $eventType")
        
    } catch (e: Exception) {
        android.util.Log.e("AppMonitorModule", "❌ Failed to emit SystemEvent to System Brain", e)
    }
}
```

### Step 2: Fixed Expo Config Plugin

The plugin was referencing `InterventionActivity.kt` which no longer exists (renamed to `SystemSurfaceActivity.kt`). Removed references:

**Files modified:**
- `plugins/withForegroundService.js`
  - Removed `interventionActivity` from source/destination paths
  - Removed InterventionActivity copying code
  - Removed InterventionActivity AndroidManifest registration

### Step 3: Ran Expo Prebuild

```bash
npx expo prebuild --clean
```

**Output:**
```
[withForegroundService] Copied SystemBrainService.kt
[withForegroundService] Registered SystemBrainService in AndroidManifest.xml
√ Finished prebuild
```

### Step 4: Verified AndroidManifest

Checked `android/app/src/main/AndroidManifest.xml`:

```xml
<service android:name=".SystemBrainService" android:exported="false"/>
```

✅ SystemBrainService now present!

### Step 5: Rebuilt App

```bash
npm run android
```

Build in progress...

## Expected Outcome

With SystemBrainService properly registered, the event flow should now work:

### TIMER_SET Flow (Quick Task Start)
```
1. User clicks "Quick Task"
2. AppMonitorModule.storeQuickTaskTimer()
3. [AppMonitorModule] 🔵 About to emit TIMER_SET to SystemBrainService
4. [AppMonitorModule] 🔵 Intent created, calling startService()...
5. [AppMonitorModule] ✅ startService() called successfully
6. [SystemBrainService] 🚀 System Brain headless task started
7. [System Brain] 📨 Event received (HeadlessTask)
8. [System Brain] Event type: TIMER_SET
9. [System Brain] ✓ Timer stored in semantic state
10. [System Brain] ✅ Quick Task timer recorded
```

### TIMER_EXPIRED Flow (After 10 Seconds)
```
1. ForegroundDetectionService periodic check (every 1 second)
2. Detects timer expiration
3. [ForegroundDetection] 🔵 About to emit TIMER_EXPIRED to SystemBrainService
4. [ForegroundDetection] 🔵 Intent created, calling startService()...
5. [ForegroundDetection] ✅ startService() called successfully
6. [SystemBrainService] 🚀 System Brain headless task started
7. [System Brain] 📨 Event received (HeadlessTask)
8. [System Brain] Event type: TIMER_EXPIRED
9. [System Brain] 🔔 TIMER_EXPIRED event received
10. [System Brain] ✓ Classified as Quick Task expiration
11. [System Brain] 🚨 User still on expired app - launching intervention
12. Intervention flow appears!
```

## Architecture Compliance

This fix maintains proper React Native patterns:
- ✅ Uses standard HeadlessJsTaskService
- ✅ Service started via Intent + startService()
- ✅ No manual HeadlessJsTaskContext invocation
- ✅ SystemBrainService remains pure mechanical delivery
- ✅ Proper AndroidManifest registration

## Files Modified

### New Debug Logging
1. `plugins/src/android/java/.../AppMonitorModule.kt` - Added 4 log statements
2. `plugins/src/android/java/.../ForegroundDetectionService.kt` - Added 4 log statements

### Plugin Fixes
3. `plugins/withForegroundService.js` - Removed InterventionActivity references

### Generated Files
4. `android/app/src/main/AndroidManifest.xml` - Now contains SystemBrainService
5. `android/app/src/main/java/.../SystemBrainService.kt` - Copied from plugins

## Key Learnings

### Expo Build System
- **`npm run android`**: Copies Kotlin files, compiles code, builds APK
  - Does NOT regenerate AndroidManifest.xml
  - Uses existing AndroidManifest
  
- **`expo prebuild`**: Runs config plugins, regenerates native projects
  - Regenerates AndroidManifest.xml from plugins
  - Applies all plugin modifications
  - Required when adding new services/activities

### When to Use Each
- **Add/modify Kotlin code**: `npm run android` is sufficient
- **Add new service/activity**: Must run `expo prebuild` first
- **Change plugin configuration**: Must run `expo prebuild`

## Testing Instructions

Once build completes:

1. Set `n_quickTask = 1` in Settings
2. Open Instagram (monitored app)
3. Quick Task dialog appears
4. Click "Quick Task" (10 seconds)
5. **Check logs for TIMER_SET event**
6. Stay on Instagram
7. **Wait 10 seconds**
8. **Check logs for TIMER_EXPIRED event**
9. **Verify intervention flow appears**

## Next Steps

After successful test:
1. Document the Expo prebuild requirement
2. Update development workflow documentation
3. Add prebuild check to CI/CD pipeline
4. Consider adding validation script to detect missing services
