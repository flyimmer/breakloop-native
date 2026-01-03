# Intention Timer Error Fix - launchMonitoredApp Not Found

**Date:** January 3, 2026  
**Error:** `TypeError: AppMonitorModule.launchMonitoredApp is not a function (it is undefined)`

## Problem

After implementing the intention timer fix, when user selected a 5-minute timer, the code tried to call:
```typescript
AppMonitorModule.launchMonitoredApp(appToLaunch);
```

But this method doesn't exist in the native module, causing a TypeError.

## Root Cause

The native `AppMonitorModule` only has these methods:
- ✅ `finishInterventionActivity()` - Finishes activity and launches monitored app
- ✅ `launchHomeScreen()` - Launches home screen
- ❌ `launchMonitoredApp()` - **Does not exist**

## Solution

Instead of calling a non-existent `launchMonitoredApp()` method, we should call `finishInterventionActivity()`, which already handles launching the monitored app.

### How `finishInterventionActivity()` Works

From `AppMonitorModule.kt` (lines 260-289):

```kotlin
fun finishInterventionActivity() {
    val activity = reactApplicationContext.currentActivity
    if (activity is SystemSurfaceActivity) {
        // Get the triggering app from the intent extras
        val triggeringApp = activity.intent.getStringExtra(
            SystemSurfaceActivity.EXTRA_TRIGGERING_APP
        )
        
        // Launch the monitored app FIRST, before finishing the activity
        if (triggeringApp != null && triggeringApp.isNotEmpty()) {
            val launchIntent = reactApplicationContext.packageManager
                .getLaunchIntentForPackage(triggeringApp)
            if (launchIntent != null) {
                reactApplicationContext.startActivity(launchIntent)
            }
        }
        
        // Then finish the activity
        activity.finish()
    }
}
```

**Key insight:** The triggering app is stored in the Intent extras when `SystemSurfaceActivity` is launched. The `finishInterventionActivity()` method reads this and launches it automatically.

### Updated Code

**File:** `app/App.tsx`

**Before (broken):**
```typescript
if (intentionTimerSet && appToLaunch) {
  AppMonitorModule.launchMonitoredApp(appToLaunch); // ❌ Does not exist
}
```

**After (fixed):**
```typescript
if (intentionTimerSet && appToLaunch) {
  // finishInterventionActivity() reads triggeringApp from Intent extras
  // and launches it before finishing the activity
  AppMonitorModule.finishInterventionActivity(); // ✅ Works correctly
}
```

## Why This Works

1. When user opens Instagram, native code launches `SystemSurfaceActivity` with Intent extras:
   ```kotlin
   intent.putExtra(EXTRA_TRIGGERING_APP, "com.instagram.android")
   ```

2. User completes intervention and selects 5-minute intention timer

3. JavaScript calls `finishInterventionActivity()`

4. Native code:
   - Reads `triggeringApp` from Intent extras → `"com.instagram.android"`
   - Launches Instagram using `packageManager.getLaunchIntentForPackage()`
   - Finishes `SystemSurfaceActivity`

5. Result: Instagram comes to foreground, user can use it for 5 minutes

## Testing

### Test Case: Intention Timer with finishInterventionActivity

**Steps:**
1. Open Instagram
2. Complete breathing countdown
3. Select "I really need to use it"
4. Choose "5m" duration

**Expected Logs:**
```
[IntentionTimer] User selected duration: 5
[F3.5] Intention timer set - finishing activity to launch target app: com.instagram.android
[F3.5] Calling finishInterventionActivity (will launch monitored app)
[F3.5] finishInterventionActivity called successfully
[AppMonitorModule] 🎯 finishInterventionActivity called!
[AppMonitorModule] 📱 Triggering app from Intent: com.instagram.android
[AppMonitorModule] 🚀 Attempting to launch: com.instagram.android
[AppMonitorModule] ✅ Successfully launched: com.instagram.android
```

**Expected Result:**
- ✅ Instagram launches immediately
- ✅ No error thrown
- ✅ User can use Instagram for 5 minutes

## Files Modified

1. `app/App.tsx` - Changed `launchMonitoredApp()` to `finishInterventionActivity()`
2. `docs/INTENTION_TIMER_APP_LAUNCH_FIX.md` - Updated documentation

## Related Issues

- Original issue: Home screen launched instead of target app
- First fix: Added `intentionTimerSet` flag
- Second fix: Use correct native method (`finishInterventionActivity`)

## Conclusion

The fix is simple: use the existing `finishInterventionActivity()` method instead of trying to call a non-existent `launchMonitoredApp()` method. The native code already handles launching the monitored app correctly.
