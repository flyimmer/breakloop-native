# Installed Apps Filter Fix - Implementation Complete

**Date:** January 12, 2026  
**Issue:** Only 37 apps showing in monitored apps list instead of full list

## Problem Summary

The `getInstalledApps()` function in `AppMonitorModule.kt` was using overly restrictive `FLAG_SYSTEM` filtering that incorrectly excluded many user-installed apps (especially Instagram, TikTok, XHS, and other apps from certain regions or installation methods).

## Root Cause

**Two filtering layers existed:**
1. **Native layer (Kotlin)**: `FLAG_SYSTEM` filtering - **THE PROBLEM** (only returned 37 apps to JS)
2. **JS layer (TypeScript)**: Search query filtering - **ALREADY FIXED** (Jan 4, 2026 - commit `f64c5c4`)

The JS fix from Jan 4 was working correctly, but it couldn't show apps that the native code never returned in the first place.

## Solution Implemented

### 1. Replaced FLAG_SYSTEM Filter with Launcher Intent Check

**File:** `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`

**Old approach (lines 816-826):**
```kotlin
// Filter out pure system apps
val isSystemApp = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0
val isUpdatedSystemApp = (appInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0

// Skip pure system apps (but keep updated system apps like Chrome, Gmail)
if (isSystemApp && !isUpdatedSystemApp) {
    skippedSystemApps++
    continue
}
```

**New approach:**
```kotlin
// Only include apps that have a launcher intent (user-facing apps)
// This is more reliable than FLAG_SYSTEM checking
val launchIntent = packageManager.getLaunchIntentForPackage(pkgName)
if (launchIntent == null) {
    skippedNoLauncher++
    continue
}
```

**Why this is better:**
- ✅ Includes all apps the user can actually launch from their home screen
- ✅ Doesn't depend on inconsistent system flags
- ✅ Works across Android versions and OEM customizations
- ✅ Automatically excludes background services and system components
- ✅ More reliable than flag-based filtering

### 2. Added XHS to Manual Fallback List

Added XHS (Xiaohongshu) package name `com.xingin.xhs` to the manual fallback alongside Instagram/TikTok. This ensures XHS appears even if the filtering logic somehow misses it.

### 3. Updated Logging

- Changed counter variable from `skippedSystemApps` to `skippedNoLauncher`
- Added XHS detection logging
- Updated log messages to reflect new filtering approach

## Files Modified

- `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`

## Changes Made

1. **Lines 800-826**: Replaced FLAG_SYSTEM filtering with launcher intent check
2. **Lines 828-836**: Added XHS detection
3. **Lines 868-872**: Updated logging to include XHS and reflect new filtering
4. **Lines 934-954**: Added XHS manual fallback (after TikTok fallback)

## Testing Instructions

### Step 1: Rebuild the App

The Kotlin files have been synced, but the app needs to be rebuilt to include the changes:

```bash
# Stop the current running app
# Then rebuild and run:
npm run android
```

Or if you prefer to build manually:
```bash
cd android
./gradlew clean
./gradlew assembleDebug
cd ..
npm run android
```

### Step 2: Verify the Fix

1. Open the app
2. Go to **Settings → Monitored Apps**
3. Check the app list

**Expected results:**
- ✅ Significantly more than 37 apps (likely 100-200+ depending on device)
- ✅ Instagram should appear in the list
- ✅ TikTok should appear in the list
- ✅ XHS (Xiaohongshu) should appear in the list
- ✅ All other user-installed apps with launcher icons should appear

### Step 3: Check Native Logs

When the EditMonitoredApps screen loads, check the native logs for:

```
[AppMonitorModule] ========== GET INSTALLED APPS START ==========
[AppMonitorModule] Total packages found: <large number>
[AppMonitorModule] Processed: <large number> user apps
[AppMonitorModule] Skipped: <number> apps without launcher, <number> null appInfo
[AppMonitorModule] Instagram found: true
[AppMonitorModule] TikTok found: true
[AppMonitorModule] XHS found: true
[AppMonitorModule] Returning <large number> apps to React Native
```

If Instagram/TikTok/XHS are not found in the main loop, you should see:
```
[AppMonitorModule] ✅ Instagram MANUALLY ADDED: Instagram
[AppMonitorModule] ✅ TikTok MANUALLY ADDED: TikTok
[AppMonitorModule] ✅ XHS MANUALLY ADDED: 小红书
```

## Historical Context

- **Dec 30, 2025 (commit `ca32ab8`)**: Original implementation added `FLAG_SYSTEM` filtering with manual fallback for Instagram/TikTok
- **Jan 4, 2026 (commit `f64c5c4`)**: Fixed JS-layer search filtering bug (when search is empty, show all apps)
- **Jan 12, 2026 (this fix)**: Replaced native `FLAG_SYSTEM` filtering with launcher intent check, added XHS support

## Rollback Instructions

If this fix causes issues, you can revert by:

```bash
git diff HEAD plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt
git checkout HEAD -- plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt
npm run sync:kotlin
npm run android
```

## Success Criteria

- [ ] App list shows 100+ apps (not just 37)
- [ ] Instagram appears in the list
- [ ] TikTok appears in the list
- [ ] XHS (Xiaohongshu) appears in the list
- [ ] Search functionality still works correctly
- [ ] No crashes or performance issues
