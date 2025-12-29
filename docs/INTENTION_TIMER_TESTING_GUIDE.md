# Intention Timer - Complete Testing Guide

## Prerequisites

**IMPORTANT: You MUST rebuild the Android app** because native Kotlin code was modified.

### Step 1: Rebuild the Android App

```bash
# Stop the current Metro server (Ctrl+C)
# Then rebuild:
npm run android
```

This is required because we added a new native method `launchApp()` in `AppMonitorModule.kt`. JavaScript-only changes won't work without rebuilding.

### Step 2: Wait for Build to Complete

The build will:
1. Compile the new Kotlin code
2. Install the updated APK on your device
3. Start Metro bundler
4. Launch the app

Wait for the message: "BUILD SUCCESSFUL"

## Testing Steps

### Test 1: Basic Intention Timer Flow

1. **Open Instagram** (or TikTok)
2. **Breathing screen appears** (5 seconds countdown)
3. **Root Cause screen** → Click "I really need to use it"
4. **Intention Timer screen** → Click "Just 1 min"

**Expected Console Logs:**

```
[IntentionTimer] User selected duration: { durationMinutes: 1, targetApp: 'com.instagram.android', ... }
[OS Trigger Brain] Intention timer set { packageName: 'com.instagram.android', durationSec: '60s', ... }
[OS Trigger Brain] Intervention completed, cleared in-progress flag
[IntentionTimer] Timer set and intervention marked complete
[IntentionTimer] Dispatching SET_INTENTION_TIMER to reset state to idle
[Navigation] State is idle - InterventionActivity will finish via separate useEffect
[F3.5] Intervention complete (state → idle)
[F3.5] Launching monitored app: com.instagram.android
[F3.5] Finishing InterventionActivity
```

**Expected Behavior:**
- ✅ Instagram launches and comes to foreground
- ✅ You see Instagram app (NOT BreakLoop main app)
- ✅ You can use Instagram normally

### Test 2: Timer Respects Duration

After completing Test 1:

1. **Use Instagram** for ~30 seconds
2. **Press home button** (exit Instagram)
3. **Open Instagram again**

**Expected Console Logs:**

```
[OS Trigger Brain] Monitored app entered foreground: { packageName: 'com.instagram.android', ... }
[OS Trigger Brain] Timer status check: { hasTimer: true, expired: false, remainingMs: 30000, ... }
[OS Trigger Brain] Valid intention timer exists — allowing app usage { remainingSec: '30s remaining' }
```

**Expected Behavior:**
- ✅ NO intervention appears
- ✅ Instagram opens normally
- ✅ You can continue using Instagram

### Test 3: Timer Expires After Duration

After completing Test 1:

1. **Wait 60 seconds** (or set timer to "Just 1 min" and wait)
2. **Exit Instagram** (press home)
3. **Open Instagram again**

**Expected Console Logs:**

```
[OS Trigger Brain] Monitored app entered foreground: { packageName: 'com.instagram.android', ... }
[OS Trigger Brain] Timer status check: { hasTimer: true, expired: true, remainingMs: -5000, ... }
[OS Trigger Brain] Intention timer expired — intervention required
[OS Trigger Brain] BEGIN_INTERVENTION dispatched
```

**Expected Behavior:**
- ✅ Intervention appears again (breathing screen)
- ✅ Timer has expired, so new intervention is required

## Troubleshooting

### Issue: No Logs Appearing

**Solution:**
- Make sure Metro bundler is running
- Check that the device is connected: `adb devices`
- Try reloading the app: Press `r` in Metro terminal

### Issue: Still Goes to BreakLoop Main App

**Possible Causes:**

1. **Native code not rebuilt:**
   - Solution: Run `npm run android` to rebuild

2. **`launchApp()` method not found:**
   - Check console for error: "AppMonitorModule.launchApp is not a function"
   - Solution: Rebuild the app

3. **Target app is null:**
   - Check logs for: "[F3.5] No target app, finishing InterventionActivity"
   - This means `interventionState.targetApp` is null
   - Solution: Check intervention state machine

### Issue: App Crashes

**Check Logcat:**

```bash
adb logcat | grep -E "(AppMonitorModule|InterventionActivity|F3.5)"
```

Look for errors like:
- "Failed to launch app"
- "Cannot launch app: no launch intent found"

## Expected vs Actual Behavior

### ✅ CORRECT Behavior

```
User selects "Just 1 min"
    ↓
[F3.5] Launching monitored app: com.instagram.android
    ↓
Instagram launches
    ↓
User sees Instagram ✅
    ↓
Can use Instagram for 60 seconds
```

### ❌ WRONG Behavior (Before Fix)

```
User selects "Just 1 min"
    ↓
InterventionActivity finishes
    ↓
MainActivity appears
    ↓
User sees BreakLoop main app ❌
```

## Debug Commands

### Check if App is Installed

```bash
adb shell pm list packages | grep breakloop
```

### Check if Instagram is Installed

```bash
adb shell pm list packages | grep instagram
```

### View Full Logcat

```bash
adb logcat | grep -E "(OS Trigger Brain|IntentionTimer|F3.5|AppMonitorModule)"
```

### Clear Logcat Before Testing

```bash
adb logcat -c
```

## What to Report

If the issue persists after rebuilding, please provide:

1. **Console logs** from Metro bundler (copy the entire output)
2. **Logcat output** (run the debug command above)
3. **Exact behavior** you're seeing:
   - Does Instagram launch?
   - Do you see BreakLoop main app?
   - When does it happen?
4. **Build output** - Did the build succeed?

## Summary of Changes

### Files Modified

1. **Native (Kotlin):**
   - `android/app/src/main/java/com/anonymous/breakloopnative/AppMonitorModule.kt`
   - Added `launchApp(packageName: String)` method

2. **React Native (TypeScript):**
   - `app/App.tsx` - Updated intervention completion handler
   - `src/os/osTriggerBrain.ts` - Re-enabled debug logs
   - `app/screens/conscious_process/IntentionTimerScreen.tsx` - Already has logs

### Why Rebuild is Required

The `launchApp()` method is a **native module method** written in Kotlin. React Native needs to:
1. Compile the Kotlin code
2. Generate the JavaScript bridge
3. Link the native module
4. Install the updated APK

JavaScript-only changes (hot reload) won't work for native code changes.

## Date

December 29, 2025

