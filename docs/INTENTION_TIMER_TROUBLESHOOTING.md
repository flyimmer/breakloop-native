# Intention Timer - Troubleshooting Guide

## Issue 1: No Intervention When Opening Instagram

### Symptoms
- Open Instagram
- No intervention flow appears
- Logs show BreakLoop app entering foreground, but not Instagram
- No `[OS Trigger Brain] Monitored app entered foreground` log

### Root Cause
The AccessibilityService (ForegroundDetectionService) is not detecting Instagram opening. This could be due to:

1. **Service not enabled** in Android Settings
2. **Service not running** after app update
3. **App needs rebuild** to update native code

### Solution Steps

#### Step 1: Check if AccessibilityService is Enabled

1. Open **Android Settings**
2. Go to **Accessibility**
3. Find **BreakLoop** in the list
4. Check if it's **enabled** (toggle should be ON)
5. If disabled, enable it and grant permissions

#### Step 2: Rebuild the App

Since we modified native Kotlin files, you MUST rebuild:

```bash
# Stop Metro (Ctrl+C in terminal)
npm run android
```

Wait for "BUILD SUCCESSFUL" message.

#### Step 3: Restart AccessibilityService

After rebuilding:

1. Go to **Settings → Accessibility → BreakLoop**
2. **Disable** the service (toggle OFF)
3. Wait 2 seconds
4. **Enable** the service again (toggle ON)
5. Grant permissions if asked

#### Step 4: Test Again

1. Open Instagram
2. Check logs for:
   ```
   [Accessibility] Launching InterventionActivity for com.instagram.android
   [F3.5] Triggering app received: com.instagram.android
   ```

### Expected Logs When Working

```
LOG [OS Trigger Brain] App entered foreground: { packageName: 'com.instagram.android', ... }
LOG [Accessibility] Launching InterventionActivity for com.instagram.android
LOG [F3.5] Triggering app received: com.instagram.android
LOG [F3.5] Dispatching BEGIN_INTERVENTION
LOG [Navigation] App switch detected, forcing navigation to Breathing screen
```

### Debug Commands

#### Check if AccessibilityService is Running

```bash
adb shell settings get secure enabled_accessibility_services
```

Should show: `com.anonymous.breakloopnative/com.anonymous.breakloopnative.ForegroundDetectionService`

#### Check Logcat for Accessibility Events

```bash
adb logcat | grep -E "(ForegroundDetection|Accessibility)"
```

Should show app detection events when you open Instagram.

#### Force Stop and Restart App

```bash
adb shell am force-stop com.anonymous.breakloopnative
adb shell am start -n com.anonymous.breakloopnative/.MainActivity
```

## Issue 2: Correct Intervention Flow

### Short Flow (What You're Testing)

```
1. Open Instagram
2. Breathing screen (5 seconds countdown)
3. Root Cause screen
4. Click "I really need to use it"  ← Shortcut to intention timer
5. Intention Timer screen
6. Select "Just 1 min"
7. → Should return to Instagram ✅
```

### Full Flow (Alternative Path)

```
1. Open Instagram
2. Breathing screen (5 seconds countdown)
3. Root Cause screen
4. Select emotions (boredom, anxiety, etc.)
5. Click "See alternatives"
6. Alternatives screen (My List / Discover / AI For You)
7. Select an alternative activity
8. Activity Timer screen
9. Complete activity
10. Reflection screen
11. → Returns to main app
```

### Entry Points to Intention Timer

There are **two ways** to reach the Intention Timer screen:

1. **From Root Cause screen:**
   - Click "I really need to use it" button
   - Goes directly to Intention Timer
   - **This is the shortcut you're testing** ✅

2. **From Alternatives screen:**
   - Click "Ignore & Continue" button
   - Goes to Intention Timer
   - Alternative path if user doesn't want alternatives

## Complete Test Procedure

### Prerequisites

1. ✅ App rebuilt with latest native code
2. ✅ AccessibilityService enabled in Settings
3. ✅ Metro bundler running (`npx expo start`)

### Test Steps

1. **Open Instagram app**
   
   **Expected:**
   - Breathing screen appears
   - Console shows: `[F3.5] Triggering app received: com.instagram.android`
   
   **If not working:**
   - Check AccessibilityService is enabled
   - Rebuild app
   - Check logcat for errors

2. **Wait for breathing to complete** (5 seconds)
   
   **Expected:**
   - Root Cause screen appears
   - Shows emotion options and "I really need to use it" button

3. **Click "I really need to use it"**
   
   **Expected:**
   - Intention Timer screen appears
   - Shows duration options (5m, 15m, 30m, 45m, 60m, Just 1 min)

4. **Click "Just 1 min"**
   
   **Expected Console Logs:**
   ```
   [IntentionTimer] User selected duration: { durationMinutes: 1, targetApp: 'com.instagram.android' }
   [OS Trigger Brain] Intention timer set { durationSec: '60s', ... }
   [IntentionTimer] Dispatching SET_INTENTION_TIMER
   [F3.5 Debug] useEffect triggered: { state: 'idle', previousState: 'timer', ... }
   [F3.5] Intervention complete (state → idle)
   [F3.5] App to launch: com.instagram.android
   [F3.5] Launching monitored app: com.instagram.android
   [F3.5] Finishing InterventionActivity
   ```
   
   **Expected Behavior:**
   - Instagram launches and comes to foreground ✅
   - You see Instagram app (NOT BreakLoop main app) ✅
   - You can use Instagram normally ✅

5. **Use Instagram for 30 seconds, then exit and reopen**
   
   **Expected Console Logs:**
   ```
   [OS Trigger Brain] Timer status check: { hasTimer: true, expired: false, remainingMs: 30000 }
   [OS Trigger Brain] Valid intention timer exists — allowing app usage
   [F3.5] Triggering app has valid intention timer (30s remaining), skipping intervention
   ```
   
   **Expected Behavior:**
   - No intervention appears ✅
   - Instagram opens normally ✅

6. **Wait 60 seconds total, then open Instagram again**
   
   **Expected:**
   - Intervention appears again (breathing screen)
   - Timer has expired, so new intervention is required

## Common Issues

### Issue: "Service not running" in logs

**Solution:**
1. Go to Settings → Accessibility
2. Disable BreakLoop service
3. Enable it again
4. Test

### Issue: "Permission denied" errors

**Solution:**
1. Go to Settings → Apps → BreakLoop
2. Check all permissions are granted
3. Especially "Usage Access" permission

### Issue: App crashes when opening Instagram

**Solution:**
1. Check logcat: `adb logcat | grep -E "(FATAL|AndroidRuntime)"`
2. Look for stack trace
3. Might need to rebuild with clean: `cd android && ./gradlew clean && cd .. && npm run android`

### Issue: Still goes to BreakLoop main app

**Possible causes:**
1. `launchApp()` method not in native module → Rebuild required
2. `previousTargetAppRef` is null → Check debug logs
3. useEffect not triggering → Check debug logs

## Files That Must Be Updated

If you modified these files, you MUST rebuild:

- ✅ `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`
- ✅ `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`
- ✅ `plugins/src/android/java/com/anonymous/breakloopnative/InterventionActivity.kt`

These get copied to `android/app/src/main/java/` during build.

## Date

December 29, 2025

