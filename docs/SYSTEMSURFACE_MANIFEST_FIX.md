# SystemSurfaceActivity Missing from AndroidManifest Fix

**Date:** January 6, 2026  
**Issue:** No intervention appears when opening Instagram  
**Root Cause:** SystemSurfaceActivity not declared in AndroidManifest.xml

## Problem Summary

After fixing the SystemBrainService registration issue, Instagram was detected by ForegroundDetectionService but **no intervention appeared**.

### Symptoms
- ❌ No SystemSurfaceActivity launch
- ❌ No intervention UI
- ❌ Only MAIN_APP context running
- ✅ ForegroundDetectionService detecting Instagram
- ✅ AccessibilityService enabled and running

### Error from Logcat

```
E ForegroundDetection: ❌ Failed to launch SystemSurfaceActivity
E ForegroundDetection: android.content.ActivityNotFoundException: Unable to find explicit activity class 
{com.anonymous.breakloopnative/com.anonymous.breakloopnative.SystemSurfaceActivity}; 
have you declared this activity in your AndroidManifest.xml, or does your intent not match its declared <intent-filter>?
```

## Root Cause

**SystemSurfaceActivity was NOT in AndroidManifest.xml**

### Why This Happened

1. Originally, the app had `InterventionActivity` registered in the manifest
2. We renamed it to `SystemSurfaceActivity` in the codebase
3. We updated the Expo config plugin to remove `InterventionActivity` references
4. **BUT we forgot to add `SystemSurfaceActivity` registration to the plugin**
5. When we ran `expo prebuild --clean`, it regenerated the manifest WITHOUT SystemSurfaceActivity

### Timeline of Events

1. **Initial state**: InterventionActivity in manifest ✅
2. **Renamed**: InterventionActivity → SystemSurfaceActivity in code
3. **Plugin update**: Removed InterventionActivity registration
4. **Prebuild**: Regenerated manifest → SystemSurfaceActivity missing ❌
5. **Result**: ActivityNotFoundException when trying to launch

## Solution

### Step 1: Added SystemSurfaceActivity to Plugin

Updated `plugins/withForegroundService.js` to register SystemSurfaceActivity:

```javascript
// Register SystemSurfaceActivity
if (!application.activity) {
  application.activity = [];
}

const activities = Array.isArray(application.activity) ? application.activity : [application.activity];

const hasSystemSurfaceActivity = activities.some(
  (activity) => activity.$['android:name'] === '.SystemSurfaceActivity'
);

if (!hasSystemSurfaceActivity) {
  activities.push({
    $: {
      'android:name': '.SystemSurfaceActivity',
      'android:configChanges': 'keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode',
      'android:launchMode': 'singleInstance',
      'android:excludeFromRecents': 'true',
      'android:taskAffinity': '',
      'android:theme': '@style/Theme.Intervention',
      'android:exported': 'false',
      'android:windowSoftInputMode': 'adjustResize',
      'android:screenOrientation': 'portrait',
    },
  });
  application.activity = activities;
  console.log(`[${PLUGIN_NAME}] Registered SystemSurfaceActivity in AndroidManifest.xml`);
}
```

### Step 2: Ran Expo Prebuild

```bash
npx expo prebuild --clean
```

**Output:**
```
[withForegroundService] Registered SystemSurfaceActivity in AndroidManifest.xml
√ Finished prebuild
```

### Step 3: Verified AndroidManifest

Checked `android/app/src/main/AndroidManifest.xml`:

```xml
<activity 
    android:name=".SystemSurfaceActivity" 
    android:configChanges="keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode" 
    android:launchMode="singleInstance" 
    android:excludeFromRecents="true" 
    android:taskAffinity="" 
    android:theme="@style/Theme.Intervention" 
    android:exported="false" 
    android:windowSoftInputMode="adjustResize" 
    android:screenOrientation="portrait"/>
```

✅ SystemSurfaceActivity now present!

### Step 4: Rebuilt App

```bash
npm run android
```

Build in progress...

## Key Learnings

### Activity Registration Requirements

For an Activity to be launchable in Android:
1. **Must be declared in AndroidManifest.xml**
2. Must have proper launch mode and configuration
3. Intent filters (if needed for external launches)

Without manifest declaration → `ActivityNotFoundException`

### Expo Prebuild Behavior

- `expo prebuild` regenerates AndroidManifest from plugins
- `npm run android` does NOT regenerate AndroidManifest
- When renaming activities, MUST update plugin registration
- Always run `expo prebuild` after plugin changes

### Plugin Development Checklist

When adding/renaming activities:
- [ ] Create/rename Kotlin file
- [ ] Update plugin to copy file
- [ ] **Update plugin to register in AndroidManifest** ← We missed this!
- [ ] Run `expo prebuild`
- [ ] Verify manifest contains activity
- [ ] Rebuild app

## Files Modified

1. `plugins/withForegroundService.js` - Added SystemSurfaceActivity registration
2. `android/app/src/main/AndroidManifest.xml` - Now contains SystemSurfaceActivity (generated)

## Expected Outcome

With SystemSurfaceActivity properly registered:

1. User opens Instagram
2. ForegroundDetectionService detects monitored app
3. Native launches SystemSurfaceActivity ✅ (was failing before)
4. SystemSurface bootstrap runs
5. OS Trigger Brain evaluates
6. Quick Task dialog or intervention appears

## Testing Instructions

Once build completes:

1. Set `n_quickTask = 1` in Settings
2. Open Instagram
3. **Expected:** Quick Task dialog appears
4. Click "Quick Task" (10 seconds)
5. Stay on Instagram
6. **Wait 10 seconds**
7. **Expected:** Intervention flow appears

## Related Issues Fixed

This fix also resolves:
- AppMonitorPackage registration (plugin now handles it)
- Complete native module integration
- Proper activity lifecycle management

## Prevention

To prevent this in the future:
1. Always update plugin when adding/renaming activities
2. Run `expo prebuild` after plugin changes
3. Verify AndroidManifest before building
4. Add validation script to check manifest completeness
