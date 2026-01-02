# Native Cross-App Intervention Fix

## Root Cause Identified

The **real issue** was in the **native Kotlin layer**, not the JavaScript layer.

The `ForegroundDetectionService.kt` has a `checkIntentionTimerExpirations()` function that runs every second and checks for expired intention timers. **The bug**: it was launching InterventionActivity for ANY expired timer, regardless of which app was currently in the foreground.

### The Bug

```kotlin
// OLD CODE (BUGGY)
private fun checkIntentionTimerExpirations() {
    for ((key, value) in allPrefs) {
        if (now > expiresAt) {
            // BUG: Launches intervention for ANY expired timer
            // NO CHECK for current foreground app!
            launchInterventionActivity(packageName, skipTimerCheck = true)
        }
    }
}
```

### Why This Caused Cross-App Interference

1. **t=0**: Instagram (1min timer), TikTok (5min timer) - You're in TikTok
2. **t=1min**: Instagram's timer expires
3. **Native layer** sees expired timer and launches InterventionActivity for Instagram
4. InterventionActivity appears **on top of TikTok** (wrong!)
5. Intervention state is set to `targetApp: 'com.instagram.android'` but shows while in TikTok
6. You switch to Instagram → Intervention state is already in progress (emotion screen)
7. **Result**: Cross-app interference, mixed states

## The Fix

Modified `checkIntentionTimerExpirations()` to check if the expired timer is for the **current foreground app**:

```kotlin
// NEW CODE (FIXED)
private fun checkIntentionTimerExpirations() {
    // Get the currently foreground app
    val currentForegroundApp = lastPackageName
    
    for ((key, value) in allPrefs) {
        if (now > expiresAt) {
            // CRITICAL CHECK: Only trigger if CURRENT foreground app
            val isForeground = packageName == currentForegroundApp
            
            if (isForeground) {
                // Only trigger intervention for foreground app
                prefs.edit().remove(key).apply()
                launchInterventionActivity(packageName, skipTimerCheck = true)
            } else {
                // Background app: just delete timer, don't trigger
                // Intervention will trigger when user returns to this app
                prefs.edit().remove(key).apply()
            }
        }
    }
}
```

### Key Changes

1. **Get current foreground app**: `val currentForegroundApp = lastPackageName`
2. **Check before triggering**: `if (packageName == currentForegroundApp)`
3. **Foreground app**: Delete timer, launch InterventionActivity
4. **Background app**: Delete timer only, DO NOT launch intervention
5. **On app return**: `onAccessibilityEvent()` will detect monitored app and launch intervention then

## Files Modified

1. **android/app/src/main/java/.../ForegroundDetectionService.kt**
   - Modified `checkIntentionTimerExpirations()` function
   - Added foreground app check before triggering intervention

2. **plugins/src/android/java/.../ForegroundDetectionService.kt**
   - Same changes (source file that gets copied during build)

3. **src/os/osTriggerBrain.ts** (previous fixes)
   - JavaScript layer also fixed for redundancy
   - Both native and JS now check foreground app

## How It Works Now

### Scenario: Instagram (1min) + TikTok (5min)

**t=0**: Both timers set, you're in TikTok
- Instagram: `intention_timer_com.instagram.android` = t+1min
- TikTok: `intention_timer_com.zhiliaoapp.musically` = t+5min
- `lastPackageName` = `com.zhiliaoapp.musically` (TikTok)

**t=1min**: Native periodic check runs
- Checks Instagram timer: **EXPIRED**
- Checks: `packageName == lastPackageName`
- `com.instagram.android` == `com.zhiliaoapp.musically` → **false**
- **Does NOT launch InterventionActivity**
- **Deletes Instagram's timer**
- Log: "Intention timer EXPIRED for BACKGROUND app com.instagram.android"
- Log: "Deleting timer - intervention will trigger when user returns"

**t=2min**: You switch to Instagram
- `onAccessibilityEvent()` detects `com.instagram.android` in foreground
- Checks: Is this a monitored app? **Yes**
- Checks: Has valid intention timer? **No** (was deleted)
- **Launches InterventionActivity**
- Intervention starts fresh from breathing screen

**t=5min**: TikTok timer expires
- If you're still in Instagram: Timer deleted, no intervention
- If you're in TikTok: Intervention launches for TikTok

## Testing

### IMPORTANT: You Must Rebuild the App!

```bash
# Rebuild the Android app to include the native fix
npx expo run:android
```

### Test Case 1: Background Timer Expiration

1. Open Instagram → Set 1-minute timer → Exit
2. Open TikTok → Set 5-minute timer → Stay in TikTok
3. Wait 1 minute
4. **Expected**: NO intervention on TikTok
5. Switch to Instagram
6. **Expected**: Breathing screen appears (fresh intervention)

### Test Case 2: Foreground Timer Expiration

1. Open TikTok → Set 1-minute timer → Stay in TikTok
2. Wait 1 minute
3. **Expected**: Breathing screen appears on TikTok

### Test Case 3: Multiple Apps

1. Instagram → 1-minute timer
2. TikTok → 2-minute timer
3. X → 3-minute timer
4. Stay in X for 3 minutes
5. **Expected**: Only X's intervention triggers at 3 minutes
6. Switch to Instagram
7. **Expected**: Breathing screen for Instagram (fresh intervention)
8. Switch to TikTok
9. **Expected**: Breathing screen for TikTok (fresh intervention)

## Logging Output

### Background App Timer Expires (Native)

```
⏰ Intention timer EXPIRED for BACKGROUND app com.instagram.android (5s ago)
  └─ Current foreground: com.zhiliaoapp.musically
  └─ Deleting timer - intervention will trigger when user returns to com.instagram.android
```

### Foreground App Timer Expires (Native)

```
⏰ Intention timer EXPIRED for FOREGROUND app com.zhiliaoapp.musically (1s ago) — launching intervention
  └─ InterventionActivity launched successfully
```

### User Returns to App with Expired Timer

```
📱 Foreground app changed: com.instagram.android
🎯 MONITORED APP DETECTED: com.instagram.android
[Accessibility] Launching InterventionActivity with WAKE_REASON=MONITORED_APP_FOREGROUND for com.instagram.android
  └─ InterventionActivity launched successfully
```

## Architecture Notes

### Why Native Fix Was Needed

The native layer runs **independently** of the React Native JavaScript:
- Native service runs in a separate process
- Native timers continue even when JS is backgrounded/killed
- Native can launch activities at any time

If only JS was fixed, the native layer would still trigger interventions incorrectly.

### Defense in Depth

Now **both layers** check for foreground app:
1. **Native (Kotlin)**: `checkIntentionTimerExpirations()` checks `lastPackageName`
2. **JavaScript**: `checkForegroundIntentionExpiration()` checks `lastMeaningfulApp`

This provides redundancy - even if one layer has a bug, the other catches it.

## Status

✅ **FIXED** - Native layer now checks foreground app
✅ **FIXED** - Both android/app/ and plugins/src/ updated
✅ **FIXED** - JavaScript layer also has same check (redundancy)
⏳ **REBUILD REQUIRED** - Must run `npx expo run:android` to apply native fix

## Related Fixes

- **CROSS_APP_INTERVENTION_FIX.md** - JavaScript layer fix
- **MULTI_APP_INTENTION_TIMER_FIX.md** - Initial (incomplete) fix
- **APP_SWITCH_INTERVENTION_FIX.md** - App switch during intervention
