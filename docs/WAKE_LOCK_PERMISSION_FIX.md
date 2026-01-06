# WAKE_LOCK Permission Fix

**Date:** January 6, 2026  
**Issue:** App crashes when SystemBrainService starts  
**Root Cause:** Missing WAKE_LOCK permission for HeadlessTaskService

## Problem

After fixing SystemSurfaceActivity registration, the app crashed immediately when trying to start SystemBrainService:

```
java.lang.SecurityException: Neither user 10538 nor current process has android.permission.WAKE_LOCK
Unable to start service com.anonymous.breakloopnative.SystemBrainService
```

## Root Cause

**HeadlessTaskService requires WAKE_LOCK permission** to acquire wake locks when running in the background.

SystemBrainService extends `HeadlessJsTaskService`, which internally calls:
```kotlin
HeadlessJsTaskService.acquireWakeLockNow(reactContext)
```

This requires the `android.permission.WAKE_LOCK` permission in AndroidManifest.xml.

## Solution

### Added WAKE_LOCK Permission to Plugin

Updated `plugins/withForegroundService.js`:

```javascript
// Add WAKE_LOCK permission (required for HeadlessTaskService)
const hasWakeLockPermission = permissions.some(
  (perm) => perm.$['android:name'] === 'android.permission.WAKE_LOCK'
);

if (!hasWakeLockPermission) {
  permissions.push({
    $: {
      'android:name': 'android.permission.WAKE_LOCK',
    },
  });
  console.log(`[${PLUGIN_NAME}] Added WAKE_LOCK permission`);
}
```

### Ran Expo Prebuild

```bash
npx expo prebuild --clean
```

Output:
```
[withForegroundService] Added WAKE_LOCK permission
```

### Verified AndroidManifest

```xml
<uses-permission android:name="android.permission.WAKE_LOCK"/>
```

✅ Permission added!

## Why This Permission is Needed

### HeadlessTaskService Architecture

React Native's HeadlessTaskService:
1. Runs JavaScript code in the background
2. Needs to keep CPU awake while processing
3. Acquires wake lock to prevent device sleep
4. Requires WAKE_LOCK permission

Without this permission → SecurityException → Crash

### Our Use Case

SystemBrainService:
- Receives TIMER_SET and TIMER_EXPIRED events
- Processes events in background (even when app is killed)
- Needs wake lock to ensure event processing completes
- Must have WAKE_LOCK permission

## Files Modified

1. `plugins/withForegroundService.js` - Added WAKE_LOCK permission registration
2. `android/app/src/main/AndroidManifest.xml` - Now contains WAKE_LOCK permission (generated)

## Expected Outcome

With WAKE_LOCK permission:
- SystemBrainService can start successfully ✅
- Wake locks can be acquired ✅
- Background event processing works ✅
- No SecurityException ✅

## Testing

Once build completes:
1. Open Instagram
2. App should NOT crash
3. SystemBrainService should start successfully
4. Quick Task dialog should appear
5. Events should be processed in background

## Related Permissions

Our app now has these permissions:
- `BIND_ACCESSIBILITY_SERVICE` - For ForegroundDetectionService
- `WAKE_LOCK` - For SystemBrainService (HeadlessTaskService)
- `SYSTEM_ALERT_WINDOW` - For SystemSurfaceActivity overlay
- `INTERNET` - For network requests
- Others from Expo defaults

## Prevention

When adding HeadlessTaskService:
- [ ] Create service class extending HeadlessJsTaskService
- [ ] Register service in AndroidManifest
- [ ] **Add WAKE_LOCK permission** ← We missed this!
- [ ] Test background event processing
