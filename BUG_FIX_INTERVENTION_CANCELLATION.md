# Bug Fix: Intervention Cancellation Issue

**Date:** January 4, 2026  
**Status:** ✅ FIXED - Ready for Testing  
**Branch:** OS_Intervention

## Problem Summary

When user pressed back during an intervention (or switched away from a monitored app), the intervention screen (SystemSurfaceActivity) was not properly closed. When the user later opened BreakLoop from the launcher, the old intervention screen (e.g., root-cause screen) would reappear instead of showing the main app.

### Root Cause

The `launchHomeScreen()` method attempted to finish SystemSurfaceActivity using:

```kotlin
val activity = reactApplicationContext.currentActivity
if (activity is SystemSurfaceActivity) {
    activity.finish()
}
```

**Problem:** `reactApplicationContext.currentActivity` was **NULL** or **not SystemSurfaceActivity** at the time the method was called, so the `if` check failed and `activity.finish()` was never executed.

**Evidence from logs:** The log message `"🔄 Finishing SystemSurfaceActivity after launching home"` was **never printed**, confirming that the finish call never happened.

## Solution

Implemented a **static reference system** to reliably finish SystemSurfaceActivity:

### 1. Static Reference Storage (AppMonitorModule.kt)

Added a `companion object` with `WeakReference<SystemSurfaceActivity>`:

```kotlin
companion object {
    private var systemSurfaceActivityRef: WeakReference<SystemSurfaceActivity>? = null
    
    fun setSystemSurfaceActivity(activity: SystemSurfaceActivity) {
        systemSurfaceActivityRef = WeakReference(activity)
        android.util.Log.i("AppMonitorModule", "📌 SystemSurfaceActivity reference stored")
    }
    
    fun clearSystemSurfaceActivity() {
        systemSurfaceActivityRef = null
        android.util.Log.i("AppMonitorModule", "🧹 SystemSurfaceActivity reference cleared")
    }
}
```

**Why WeakReference?** Prevents memory leaks if activity is destroyed by Android.

### 2. Activity Registration (SystemSurfaceActivity.kt)

```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    // Register this activity with AppMonitorModule
    AppMonitorModule.setSystemSurfaceActivity(this)
    // ... rest of onCreate
}

override fun onDestroy() {
    // Clear the reference
    AppMonitorModule.clearSystemSurfaceActivity()
    super.onDestroy()
}
```

### 3. New Cancellation Method (AppMonitorModule.kt)

Created dedicated `cancelInterventionActivity()` method:

```kotlin
@ReactMethod
fun cancelInterventionActivity() {
    try {
        android.util.Log.i("AppMonitorModule", "🚫 Cancelling intervention activity")
        
        // Finish SystemSurfaceActivity using stored reference
        val activity = systemSurfaceActivityRef?.get()
        if (activity != null && !activity.isFinishing) {
            android.util.Log.i("AppMonitorModule", "🔄 Finishing SystemSurfaceActivity via static reference")
            activity.finish()
        } else {
            android.util.Log.w("AppMonitorModule", "⚠️ SystemSurfaceActivity reference is null or already finishing")
        }
        
        // Launch home screen
        val homeIntent = Intent(Intent.ACTION_MAIN)
        homeIntent.addCategory(Intent.CATEGORY_HOME)
        homeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactApplicationContext.startActivity(homeIntent)
        
        android.util.Log.i("AppMonitorModule", "✅ Intervention cancelled, home screen launched")
    } catch (e: Exception) {
        android.util.Log.e("AppMonitorModule", "❌ Failed to cancel intervention", e)
    }
}
```

### 4. TypeScript Interface (AppMonitorModule.ts)

```typescript
/**
 * Cancel intervention and close SystemSurfaceActivity
 * 
 * Called when user presses back during intervention or switches away from monitored app.
 * Uses static reference to reliably finish SystemSurfaceActivity even when currentActivity is null.
 * 
 * This is a MECHANICAL ACTION - JavaScript decides WHEN to cancel (semantics).
 */
cancelInterventionActivity(): void;
```

### 5. JavaScript Integration (App.tsx)

Updated intervention navigation handler:

```typescript
if (wasCancelled) {
  // Intervention was cancelled - immediately close InterventionActivity
  console.log('[F3.5] Intervention was CANCELLED - closing InterventionActivity');
  cancelledTimeout = setTimeout(() => {
    try {
      console.log('[F3.5] Calling cancelInterventionActivity (intervention cancelled)');
      AppMonitorModule.cancelInterventionActivity();
      console.log('[F3.5] InterventionActivity cancelled, home screen launched');
    } catch (error) {
      console.error('[F3.5] cancelInterventionActivity threw error:', error);
    }
  }, 100);
  return;
}
```

## Key Differences: Old vs New

| Aspect | Old (launchHomeScreen) | New (cancelInterventionActivity) |
|--------|----------------------|----------------------------------|
| Activity reference | `currentActivity` (can be null) | Static `WeakReference` (reliable) |
| Finish guarantee | ❌ Fails if currentActivity is wrong | ✅ Always finishes if reference exists |
| Logging | Generic home screen log | Specific cancellation log |
| Purpose | General home launch | Specific intervention cancellation |

## Architectural Compliance

✅ **Fully compliant with NATIVE_JAVASCRIPT_BOUNDARY.md:**

- **Native = mechanics:** `cancelInterventionActivity()` is a pure mechanical action (finishing activity, launching home)
- **JavaScript = semantics:** JavaScript decides WHEN to cancel via `wasCancelled` flag
- **No semantic logic in native layer:** Native doesn't know "why" it's cancelling
- **JavaScript owns all flow decisions:** Reducer sets `wasCancelled` flag based on user actions

## Files Modified

### Source Files (plugins/src/)
1. `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`
   - Added companion object with WeakReference
   - Added `cancelInterventionActivity()` method

2. `plugins/src/android/java/com/anonymous/breakloopnative/SystemSurfaceActivity.kt`
   - Added `setSystemSurfaceActivity()` call in `onCreate()`
   - Added `clearSystemSurfaceActivity()` call in `onDestroy()`

### JavaScript Files
3. `src/native-modules/AppMonitorModule.ts`
   - Added TypeScript interface for `cancelInterventionActivity()`

4. `app/App.tsx`
   - Updated to call `cancelInterventionActivity()` when `wasCancelled === true`

### Auto-Synced Files
The Kotlin file sync system automatically copied changes from `plugins/src/` to `android/app/src/main/` during build.

## Expected Behavior After Fix

### Test Scenario
1. Open xhs (monitored app)
2. Intervention starts → reach root-cause screen
3. Press back button
4. **Expected:** Home screen appears
5. Wait a few moments
6. Open BreakLoop from launcher
7. **Expected:** MainActivity (main app) appears, NOT the intervention screen

### Expected Logs
```
🚫 Cancelling intervention activity
📌 SystemSurfaceActivity reference stored
🔄 Finishing SystemSurfaceActivity via static reference
✅ Intervention cancelled, home screen launched
🧹 SystemSurfaceActivity reference cleared
```

## Testing Status

✅ **Build completed successfully**  
⏳ **Awaiting user testing**

Please test the scenario above and verify:
1. Intervention screen closes when back is pressed
2. Home screen appears
3. Opening BreakLoop later shows main app (not intervention screen)
4. Check logs for the expected messages

## Related Documentation

- `spec/NATIVE_JAVASCRIPT_BOUNDARY.md` - Architectural boundary rules
- `docs/KOTLIN_FILE_SYNC.md` - Kotlin file sync system
- `src/core/intervention/transitions.js` - Intervention state machine with `wasCancelled` flag
