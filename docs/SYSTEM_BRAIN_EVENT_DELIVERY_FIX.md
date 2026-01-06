# System Brain Event Delivery Fix

**Date:** January 5, 2026  
**Issue:** Quick Task expiration does not trigger intervention flow  
**Root Cause:** System Brain headless task not receiving TIMER_EXPIRED events from native

## Problem Summary

After Quick Task expires (10 seconds in test mode), no intervention flow appears. The user stays on the monitored app (Instagram) but no intervention is triggered.

### Evidence from Logs

```
LOG  [QuickTaskDialog] Quick Task timer stored in native: {
  "app": "com.instagram.android",
  "durationMs": 10000,
  "expiresAt": 1767649410698,
  "note": "System Brain will receive TIMER_SET event via HeadlessTask"
}
```

**Missing logs:**
- ❌ No `[System Brain] Event received` logs
- ❌ No `[System Brain] Timer expired` logs
- ❌ No intervention launch after 10 seconds

### Root Cause Analysis

The System Brain headless task was registered in `src/systemBrain/index.ts`, but the native event emission mechanism was incomplete:

1. **ForegroundDetectionService** had an incomplete `emitSystemEvent()` implementation that attempted to manually invoke headless tasks
2. **AppMonitorModule** had similar incomplete implementation
3. **No HeadlessTaskService** existed to properly handle System Brain events
4. **No AndroidManifest declaration** for the service

The proper React Native pattern for headless tasks is:
1. Create a `HeadlessJsTaskService` subclass
2. Declare it in AndroidManifest.xml
3. Start it via Intent from other components
4. The service invokes the registered headless task

## Solution Implemented

### 1. Created SystemBrainService (NEW)

**File:** `plugins/src/android/java/com/anonymous/breakloopnative/SystemBrainService.kt`

- Extends `HeadlessJsTaskService` (standard React Native pattern)
- Pure mechanical event delivery layer (no semantic logic)
- Receives Intent with event data
- Creates `HeadlessJsTaskConfig` for "SystemEvent" task
- Forwards event to System Brain JS headless task

**Key characteristics:**
- ✅ Mechanical only (no business logic)
- ✅ No state management
- ✅ No semantic interpretation
- ✅ Runs briefly per event (not continuous)
- ✅ Handles both TIMER_SET and TIMER_EXPIRED events

### 2. Updated Expo Config Plugin

**File:** `plugins/withForegroundService.js`

Added SystemBrainService to:
- Source paths mapping
- Destination paths mapping
- File copying logic
- AndroidManifest service registration

**AndroidManifest entry:**
```xml
<service
    android:name=".SystemBrainService"
    android:exported="false" />
```

### 3. Fixed Event Emission in ForegroundDetectionService

**File:** `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`

**Before:** Incomplete manual headless task invocation
```kotlin
private fun emitSystemEvent(...) {
    // Attempted to manually invoke headless task
    // Did not work properly
}
```

**After:** Proper Intent-based service invocation
```kotlin
private fun emitSystemEvent(
    eventType: String, 
    packageName: String, 
    timestamp: Long,
    expiresAt: Long? = null
) {
    val intent = Intent(this, SystemBrainService::class.java).apply {
        putExtra(SystemBrainService.EXTRA_EVENT_TYPE, eventType)
        putExtra(SystemBrainService.EXTRA_PACKAGE_NAME, packageName)
        putExtra(SystemBrainService.EXTRA_TIMESTAMP, timestamp)
        if (expiresAt != null) {
            putExtra(SystemBrainService.EXTRA_EXPIRES_AT, expiresAt)
        }
    }
    startService(intent)
}
```

### 4. Fixed Event Emission in AppMonitorModule

**File:** `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`

Updated `emitSystemEventToSystemBrain()` to use Intent-based invocation (same pattern as ForegroundDetectionService).

### 5. Enhanced Debug Logging

**Files:**
- `src/systemBrain/index.ts` - Added detailed event reception logging
- `src/systemBrain/eventHandler.ts` - Added comprehensive logging for TIMER_SET and TIMER_EXPIRED handling

**New log output will show:**
```
[System Brain] ========================================
[System Brain] 📨 Event received (HeadlessTask)
[System Brain] Event type: TIMER_EXPIRED
[System Brain] Package name: com.instagram.android
[System Brain] 🔔 TIMER_EXPIRED event received
[System Brain] Timer expired for: com.instagram.android
[System Brain] Checking stored timers: {...}
[System Brain] ✓ Classified as Quick Task expiration
[System Brain] 🚨 User still on expired app - launching intervention
[System Brain] ========================================
```

## Architecture Compliance

This fix strictly adheres to the architectural boundaries:

### Native Layer (Mechanical Only)
- ✅ Detects timer expiration (mechanical event)
- ✅ Emits TIMER_EXPIRED event (mechanical notification)
- ✅ No semantic interpretation
- ✅ No decision making

### SystemBrainService (Delivery Only)
- ✅ Pure event forwarding
- ✅ No semantic logic
- ✅ No state management
- ✅ No timers or business logic

### System Brain JS (Semantic Authority)
- ✅ Receives mechanical events
- ✅ Classifies semantic meaning (Quick Task vs Intention)
- ✅ Makes intervention decisions
- ✅ Launches SystemSurface when needed

## Event Flow

### TIMER_SET Flow (Quick Task Start)
```
1. User clicks "Quick Task" in QuickTaskDialog
2. QuickTaskDialog calls AppMonitorModule.storeQuickTaskTimer()
3. AppMonitorModule:
   - Stores timer in SharedPreferences
   - Notifies ForegroundDetectionService
   - Emits TIMER_SET via Intent → SystemBrainService
4. SystemBrainService:
   - Receives Intent
   - Creates HeadlessJsTaskConfig
   - Invokes System Brain JS headless task
5. System Brain JS:
   - Receives TIMER_SET event
   - Stores timer in semantic state
   - Records usage (consumes quota)
   - Saves state to AsyncStorage
```

### TIMER_EXPIRED Flow (Quick Task Expires)
```
1. ForegroundDetectionService periodic check (every 1 second)
2. Detects timer expiration (now >= expiresAt)
3. Emits TIMER_EXPIRED via Intent → SystemBrainService
4. SystemBrainService:
   - Receives Intent
   - Creates HeadlessJsTaskConfig
   - Invokes System Brain JS headless task
5. System Brain JS:
   - Receives TIMER_EXPIRED event
   - Classifies as Quick Task expiration
   - Checks if user still on app
   - If yes: Launches SystemSurface for intervention
   - If no: Silent cleanup only
```

## Testing Instructions

### Prerequisites
1. Set `n_quickTask = 1` in Settings
2. Enable 10-second Quick Task duration (test mode)
3. Ensure Instagram is in monitored apps list

### Test Procedure
1. Open Instagram
2. Quick Task dialog appears
3. Click "Quick Task"
4. SystemSurface closes, user returns to Instagram
5. **Wait 10 seconds** (stay on Instagram)
6. **Expected:** Intervention flow appears

### Expected Logs
```
[Native] ⏰ Timer expired for app: com.instagram.android
[Native] 📤 Emitted mechanical event to System Brain: TIMER_EXPIRED
[SystemBrainService] 🚀 System Brain headless task started
[System Brain] 📨 Event received (HeadlessTask)
[System Brain] Event type: TIMER_EXPIRED
[System Brain] 🔔 TIMER_EXPIRED event received
[System Brain] ✓ Classified as Quick Task expiration
[System Brain] 🚨 User still on expired app - launching intervention
[SystemBrainService] ✅ System Brain headless task finished
```

## Files Modified

### New Files
- `plugins/src/android/java/com/anonymous/breakloopnative/SystemBrainService.kt` (117 lines)

### Modified Files
- `plugins/withForegroundService.js` - Added SystemBrainService registration
- `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt` - Fixed emitSystemEvent()
- `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt` - Fixed emitSystemEventToSystemBrain()
- `src/systemBrain/index.ts` - Enhanced logging
- `src/systemBrain/eventHandler.ts` - Enhanced logging for TIMER_SET and TIMER_EXPIRED

## Build Instructions

```bash
# Sync Kotlin files
npm run sync:kotlin

# Validate plugin configuration
npm run validate:kotlin

# Rebuild Android app
npm run android
```

## Verification Checklist

- [x] SystemBrainService created with proper HeadlessJsTaskService pattern
- [x] Service declared in AndroidManifest via Expo config plugin
- [x] Event emission uses Intent-based invocation
- [x] Both TIMER_SET and TIMER_EXPIRED events supported
- [x] No semantic logic in native or service layers
- [x] Comprehensive debug logging added
- [x] All files synced and validated
- [x] No linter errors

## Next Steps

1. Rebuild app: `npm run android`
2. Test Quick Task expiration flow
3. Verify logs show System Brain receiving events
4. Confirm intervention appears after 10 seconds
5. Test with different scenarios (user switches apps, etc.)
