# Intention Timer - Launch App Fix (Final Solution)

## Problem

After the user selected an intention timer, the app would still show the **BreakLoop main app** instead of returning to the **monitored app** (Instagram/TikTok).

### Root Cause

The InterventionActivity uses `launchMode="singleInstance"` and `taskAffinity=""`, which means it runs in its **own isolated task**. When the activity finishes, Android doesn't automatically return to Instagram because:

1. InterventionActivity is in its own task (completely isolated)
2. When it finishes, Android looks for what to show next
3. If MainActivity was in the background, Android shows MainActivity
4. Instagram is in a different task, so Android doesn't automatically switch to it

Simply calling `activity.finish()` doesn't tell Android **which app** to return to.

## Solution

**Explicitly launch the monitored app** before finishing InterventionActivity. This ensures the user returns to Instagram/TikTok, not the BreakLoop main app.

### Implementation

#### 1. Added `launchApp()` Method (Native - Kotlin)

**File:** `android/app/src/main/java/com/anonymous/breakloopnative/AppMonitorModule.kt`

```kotlin
/**
 * Launch a specific app by package name
 * Used to return user to monitored app after intervention completes
 * 
 * @param packageName Package name of the app to launch (e.g., "com.instagram.android")
 */
@ReactMethod
fun launchApp(packageName: String) {
    try {
        val packageManager = reactApplicationContext.packageManager
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        
        if (launchIntent != null) {
            android.util.Log.i("AppMonitorModule", "Launching app: $packageName")
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(launchIntent)
        } else {
            android.util.Log.w("AppMonitorModule", "Cannot launch app: $packageName (no launch intent found)")
        }
    } catch (e: Exception) {
        android.util.Log.e("AppMonitorModule", "Failed to launch app: $packageName", e)
    }
}
```

This method:
- Gets the launch intent for the specified package (Instagram/TikTok)
- Adds `FLAG_ACTIVITY_NEW_TASK` to launch in a new task
- Starts the activity, bringing the monitored app to foreground

#### 2. Updated Intervention Completion Handler (React Native)

**File:** `app/App.tsx`

```typescript
useEffect(() => {
  if (Platform.OS !== 'android' || !AppMonitorModule) {
    return;
  }

  if (state === 'idle' && previousStateRef.current !== 'idle' && previousStateRef.current !== state) {
    if (__DEV__) {
      console.log('[F3.5] Intervention complete (state → idle)');
    }
    
    // If there's a target app, launch it before finishing the intervention
    if (targetApp) {
      if (__DEV__) {
        console.log('[F3.5] Launching monitored app:', targetApp);
      }
      AppMonitorModule.launchApp(targetApp);
      
      // Small delay to let the app launch before finishing intervention activity
      setTimeout(() => {
        if (__DEV__) {
          console.log('[F3.5] Finishing InterventionActivity');
        }
        AppMonitorModule.finishInterventionActivity();
      }, 100);
    } else {
      // No target app, just finish
      if (__DEV__) {
        console.log('[F3.5] No target app, finishing InterventionActivity');
      }
      AppMonitorModule.finishInterventionActivity();
    }
  }
}, [state, targetApp]);
```

This handler:
1. Detects when intervention completes (state → idle)
2. Launches the monitored app (Instagram/TikTok) using `launchApp()`
3. Waits 100ms for the app to launch
4. Finishes InterventionActivity
5. User sees Instagram/TikTok, not BreakLoop main app

## Flow After Fix

### Complete User Journey

```
1. User opens Instagram
2. AccessibilityService detects Instagram
3. Launches InterventionActivity (in its own task)
4. Breathing screen (5 seconds)
5. Root Cause screen → "I really need to use it"
6. Intention Timer screen → User selects "Just 1 min"
7. Timer set (60 seconds)
8. Intervention state → idle
9. [F3.5] Launching monitored app: com.instagram.android ✅
10. Instagram launches and comes to foreground ✅
11. [F3.5] Finishing InterventionActivity
12. InterventionActivity finishes
13. User sees Instagram ✅ (NOT BreakLoop main app)
14. User can use Instagram for 60 seconds
15. Timer expires
16. Next Instagram entry → Intervention triggers
```

### Console Logs (Expected)

```
[IntentionTimer] User selected duration: { durationMinutes: 1, ... }
[OS Trigger Brain] Intention timer set { durationSec: '60s', ... }
[OS Trigger Brain] Intervention completed
[IntentionTimer] Dispatching SET_INTENTION_TIMER to reset state to idle
[Navigation] State is idle - InterventionActivity will finish via separate useEffect
[F3.5] Intervention complete (state → idle)
[F3.5] Launching monitored app: com.instagram.android
[AppMonitorModule] Launching app: com.instagram.android
[F3.5] Finishing InterventionActivity
[AppMonitorModule] Finishing InterventionActivity
[OS Trigger Brain] App entered foreground: { packageName: 'com.instagram.android', ... }
[F3.5] Triggering app com.instagram.android has valid intention timer (60s remaining), skipping intervention
```

## Why This Works

### Task Management

Android manages apps in **tasks**:

1. **Instagram Task**: Contains Instagram app
2. **InterventionActivity Task**: Isolated task (due to `singleInstance` + `taskAffinity=""`)
3. **MainActivity Task**: Contains BreakLoop main app

When InterventionActivity finishes without launching Instagram:
- InterventionActivity task closes
- Android looks for next task to show
- Might show MainActivity task (BreakLoop main app) ❌

When we explicitly launch Instagram before finishing:
- Instagram task comes to foreground
- InterventionActivity task closes
- User sees Instagram ✅

### Timing

The 100ms delay ensures:
- Instagram has time to start launching
- InterventionActivity finishes after Instagram is visible
- No jarring transition or blank screen

## Related Issues Fixed

This is the **final fix** for the intention timer feature:

1. **Fix #1**: User not released to monitored app → Fixed by adding `SET_INTENTION_TIMER` action handler
2. **Fix #2**: Intervention triggers immediately (foreground change) → Fixed by checking valid timer in `handleForegroundAppChange`
3. **Fix #3**: Intervention triggers immediately (app restart) → Fixed by checking valid timer in initial trigger check
4. **Fix #4**: User goes to BreakLoop main app (navigation) → Fixed by removing MainTabs navigation
5. **Fix #5**: User goes to BreakLoop main app (task management) → **Fixed by explicitly launching monitored app** ✅

## Testing Checklist

- [x] Open monitored app (Instagram/TikTok)
- [x] Complete intervention flow
- [x] Click "I really need to use it"
- [x] Select "Just 1 min"
- [x] Verify: User returns to **Instagram/TikTok** (NOT BreakLoop main app) ✅
- [x] Verify: Console shows "Launching monitored app: com.instagram.android"
- [x] Verify: User can use monitored app for 60 seconds
- [x] Verify: No intervention triggers during timer period
- [x] Wait 60 seconds
- [x] Re-open monitored app
- [x] Verify: Intervention triggers after timer expires

## Files Modified

- `android/app/src/main/java/com/anonymous/breakloopnative/AppMonitorModule.kt` - Added `launchApp()` method
- `app/App.tsx` - Updated intervention completion handler to launch app before finishing

## Date

December 29, 2025

