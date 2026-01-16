# Launcher Intent Discovery Implementation

## Summary

Implemented Play-Store-safe app discovery using launcher intent queries (`ACTION_MAIN` + `CATEGORY_LAUNCHER`) to populate the "Monitored Apps" list with ALL user-launchable apps, including Instagram, TikTok, and XHS.

## Problem Solved

**Before:** `getInstalledPackages()` returned 218 packages, but Instagram/TikTok/XHS were NOT included due to Android 11+ package visibility restrictions on Honor devices.

**After:** `queryIntentActivities()` discovers ALL launcher apps, including privacy-protected apps like Instagram/TikTok/XHS.

## Changes Made

### 1. Expo Config Plugin (`plugins/withForegroundService.js`)

Added `<queries>` block to AndroidManifest.xml via `withAndroidManifest`:

```xml
<queries>
  <intent>
    <action android:name="android.intent.action.MAIN" />
    <category android:name="android.intent.category.LAUNCHER" />
  </intent>
</queries>
```

**Why this works:**
- Tells Android: "I need visibility to apps the user can launch from the launcher"
- No `QUERY_ALL_PACKAGES` permission needed
- No per-app `<package>` declarations needed
- Android 11+ compliant
- Matches OneSec's approach

### 2. Kotlin Discovery Logic (`AppMonitorModule.kt`)

**Replaced:**
```kotlin
val installedPackages = packageManager.getInstalledPackages(flags)
// Returns 218 packages, missing Instagram/TikTok/XHS
```

**With:**
```kotlin
val launcherIntent = Intent(Intent.ACTION_MAIN).apply {
    addCategory(Intent.CATEGORY_LAUNCHER)
}
val launcherApps = packageManager.queryIntentActivities(launcherIntent, 0)
// Returns ALL launcher apps, including Instagram/TikTok/XHS
```

**Key improvements:**
- Uses `ResolveInfo.loadLabel()` and `ResolveInfo.loadIcon()` (official API)
- Deduplicates packages (multiple activities per app)
- Minimal negative heuristics (exclude only non-user-facing packages)
- No reliance on `getLaunchIntentForPackage()` or `getPackageInfo(GET_ACTIVITIES)`

### 3. Filtering Strategy

**Minimal negative heuristics only:**
- Exclude system packages: `android.*`, `com.android.*`, `com.google.android.*` (except whitelisted)
- Exclude non-user-facing: `vendor.*`, `com.qualcomm.*`, `*.overlay.*`, `*service`, `*server`
- **Whitelist important system apps:** Chrome, Play Store, YouTube, Maps, Gmail

**No longer exclude based on:**
- `getLaunchIntentForPackage()` returning null
- `getPackageInfo()` throwing SecurityException
- Any "privacy-protected" checks

## Android 11+ Compliance

### Why This Approach is Play-Safe

1. **No QUERY_ALL_PACKAGES permission** - Would require special justification
2. **No MATCH_ALL flag** - Restricted by Google Play policies
3. **No hardcoded package lists** - Doesn't scale, requires maintenance
4. **Uses intent-based discovery** - Official Android recommendation for Android 11+

### Mental Model

We are NOT trying to enumerate "all installed packages".  
We are discovering "all apps the user can launch from the launcher".  
**Launcher apps are the correct domain for a monitored-app picker.**

## Expected Results

**Before:**
- 218 packages from `getInstalledPackages()`
- Filtered to 118 apps
- Instagram/TikTok/XHS: **NOT FOUND** ❌

**After:**
- ~150-200 launcher apps from `queryIntentActivities()`
- Filtered to ~120-150 apps
- Instagram/TikTok/XHS: **FOUND** ✅

## Verification

Check logs for:
```
========== LAUNCHER DISCOVERY COMPLETE ==========
Total launcher apps: XXX
Processed: XXX apps
Instagram found: true
TikTok found: true
XHS found: true
```

## Architecture Compliance

**Native Layer (Mechanical):**
- Discovers launcher apps
- Provides app metadata (name, icon, package)
- No semantic decisions

**System Brain JS (Semantic):**
- Decides which apps are monitored
- Intervention logic
- OS Trigger Brain evaluation

**Separation maintained:** Native provides data, JS makes decisions.

## Files Modified

1. `plugins/withForegroundService.js` - Added `<queries>` via Expo config plugin
2. `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt` - Refactored discovery logic

## No New Permissions

- ✅ No `QUERY_ALL_PACKAGES`
- ✅ No `MATCH_ALL`
- ✅ No hardcoded `<package>` declarations
- ✅ Only intent-based `<queries>` (Play-safe)

## References

- Android Package Visibility: https://developer.android.com/training/package-visibility
- Queries Element: https://developer.android.com/guide/topics/manifest/queries-element
- Expo Config Plugins: https://docs.expo.dev/config-plugins/introduction/
