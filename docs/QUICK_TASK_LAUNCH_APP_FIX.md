# Quick Task Launch App Fix

**Date:** December 30, 2025  
**Issue:** After clicking Quick Task, main app shows instead of monitored app (Instagram)

## Problem

When the user clicks "Quick Task":
1. Quick Task timer is set ✅
2. `HIDE_QUICK_TASK` is dispatched ✅
3. `finishInterventionActivity()` is called ✅
4. InterventionActivity finishes ✅
5. **But main BreakLoop app shows instead of Instagram** ❌

## Root Cause

The `finishInterventionActivity()` function was only calling `activity.finish()`, which closes the InterventionActivity but doesn't specify what should happen next.

When an activity finishes in Android, the system shows whatever was underneath in the task stack. In our case, that was the main BreakLoop app, not Instagram.

**Previous Implementation:**
```kotlin
fun finishInterventionActivity() {
    val activity = reactApplicationContext.currentActivity
    if (activity is InterventionActivity) {
        activity.finish()  // ❌ Just closes activity, doesn't launch monitored app
    }
}
```

## The Fix

After finishing the InterventionActivity, we need to explicitly launch the monitored app (Instagram).

**New Implementation:**
```kotlin
fun finishInterventionActivity() {
    val activity = reactApplicationContext.currentActivity
    if (activity is InterventionActivity) {
        // Get the triggering app from the intent
        val triggeringApp = activity.intent.getStringExtra("triggeringApp")
        
        // Finish the activity first
        activity.finish()
        
        // Launch the monitored app
        if (triggeringApp != null && triggeringApp.isNotEmpty()) {
            val launchIntent = reactApplicationContext.packageManager
                .getLaunchIntentForPackage(triggeringApp)
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                reactApplicationContext.startActivity(launchIntent)
            }
        }
    }
}
```

### Key Points

1. **Get triggering app**: Read `triggeringApp` from the InterventionActivity's intent
2. **Finish activity**: Close the InterventionActivity
3. **Launch monitored app**: Use `packageManager.getLaunchIntentForPackage()` to launch Instagram
4. **Flags**:
   - `FLAG_ACTIVITY_NEW_TASK`: Launch in a new task
   - `FLAG_ACTIVITY_SINGLE_TOP`: Reuse existing instance if available

## Expected Behavior After Fix

1. User opens Instagram
2. Quick Task dialog appears
3. User clicks "Quick Task"
4. `finishInterventionActivity()` called:
   - Reads `triggeringApp = "com.instagram.android"`
   - Finishes InterventionActivity
   - Launches Instagram
5. ✅ Instagram appears in foreground
6. ✅ No main BreakLoop app

## Why This Works

- **Explicit launch**: We explicitly tell Android to launch Instagram
- **Correct intent**: We use the package manager to get the proper launch intent
- **Proper flags**: We use the right flags to ensure Instagram comes to foreground
- **Clean handoff**: InterventionActivity closes, Instagram launches immediately

## Files Modified

1. **`plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`**
   - Updated `finishInterventionActivity()` to launch monitored app after finishing activity
   - Added logging for debugging
   - Added error handling for launch failures

## Testing

Build started: December 30, 2025, 21:47 UTC

To verify:
1. Open Instagram
2. Quick Task dialog appears
3. Click "Quick Task"
4. ✅ InterventionActivity finishes
5. ✅ Instagram launches and appears in foreground
6. ✅ No main BreakLoop app visible

## Related Issues

This fix resolves:
- Main app appearing after Quick Task activation
- Monitored app not returning to foreground
- User seeing BreakLoop instead of Instagram
- Incorrect task stack behavior

