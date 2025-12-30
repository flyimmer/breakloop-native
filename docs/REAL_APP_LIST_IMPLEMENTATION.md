# Real App List Implementation Summary

## Overview

Replaced the pseudo app list in Settings → Monitored Apps with a real list of all installed apps on the Android device.

## Problem

The original implementation showed a hardcoded list of fake apps. Users couldn't select real apps like Instagram, TikTok, etc.

## Solution

### 1. Native Module Implementation

**File:** `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`

Added `getInstalledApps()` method:
```kotlin
@ReactMethod
fun getInstalledApps(promise: Promise) {
    val packageManager = reactApplicationContext.packageManager
    val flags = PackageManager.GET_META_DATA or 
               PackageManager.MATCH_DISABLED_COMPONENTS or
               PackageManager.MATCH_DISABLED_UNTIL_USED_COMPONENTS or
               PackageManager.MATCH_UNINSTALLED_PACKAGES
    val installedPackages = packageManager.getInstalledPackages(flags)
    
    // Filter: Keep user-installed + updated system apps, exclude pure system apps
    // Returns: Array of { packageName, appName }
}
```

**Filtering Logic:**
- ✅ **Include**: User-installed apps (Instagram, TikTok, games, etc.)
- ✅ **Include**: Updated system apps (Chrome, Gmail if updated by user)
- ❌ **Exclude**: Pure system apps (Android System, Bluetooth, Settings, etc.)

### 2. Android Manifest Changes

**File:** `android/app/src/main/AndroidManifest.xml`

**Critical Fix:** Added package visibility query (required for Android 11+):
```xml
<queries>
  <!-- Query all launchable apps for the monitored apps list -->
  <intent>
    <action android:name="android.intent.action.MAIN"/>
    <category android:name="android.intent.category.LAUNCHER"/>
  </intent>
</queries>
```

**Why This Was Needed:**
- Android 11+ restricts package visibility for privacy
- Without `<queries>`, apps can only see ~200 packages
- With `<queries>`, apps can see ALL launchable apps
- This was the root cause of Instagram/TikTok not appearing

### 3. TypeScript Interface

**File:** `src/native-modules/AppMonitorModule.ts`

Added interface:
```typescript
export interface InstalledApp {
  packageName: string;  // e.g., "com.instagram.android"
  appName: string;      // e.g., "Instagram"
}

interface IAppMonitorModule {
  getInstalledApps(): Promise<InstalledApp[]>;
}
```

### 4. React Native Integration

**File:** `app/screens/mainAPP/Settings/EditMonitoredAppsScreen.tsx`

**Changes:**
- Removed hardcoded `AVAILABLE_APPS` array
- Added `useEffect` to fetch real apps on mount
- Added loading state (`isLoadingApps`)
- Implemented search functionality
- Displays both app name and package name
- Stores package names (not display names) in state

**Key Code:**
```typescript
const loadInstalledApps = async () => {
  const apps = await AppMonitorModuleType.getInstalledApps();
  apps.sort((a, b) => a.appName.localeCompare(b.appName));
  setInstalledApps(apps);
};
```

### 5. Settings Screen Updates

**File:** `app/screens/mainAPP/Settings/SettingsScreen.tsx`

**Changes:**
- Stores package names in `monitoredApps` state
- Loads app list to cache for display name lookup
- Shows app names by looking up package names in cache
- Handles empty state ("No apps selected")

## Technical Challenges & Solutions

### Challenge 1: Android Package Visibility Restrictions

**Problem:** `getInstalledPackages()` only returned 217 apps instead of 300+. Instagram and TikTok were invisible.

**Root Cause:** Android 11+ package visibility restrictions. Apps can't see other apps by default.

**Solution:** Added `<queries>` declaration in AndroidManifest.xml to request visibility of all launchable apps.

**Evidence:**
```
Before fix: 217 apps (Instagram NOT accessible)
After fix:  300+ apps (Instagram accessible)
```

### Challenge 2: Kotlin File Sync Issues

**Problem:** Changes to Kotlin files in `plugins/src/` didn't appear in builds. Had to manually copy files every time.

**Root Cause:** Expo plugins only run during `expo prebuild`, not during `npm run android`.

**Solution:** Created automatic sync system:
- Script: `scripts/sync-kotlin-files.js`
- Runs before every `npm run android`
- Only copies changed files (fast!)
- Clear feedback on what was synced

**New Workflow:**
```bash
# Old way (manual):
1. Edit Kotlin file
2. Copy file manually
3. npm run android

# New way (automatic):
1. Edit Kotlin file
2. npm run android  # Sync happens automatically!
```

### Challenge 3: Logging Not Visible

**Problem:** `android.util.Log.d()` logs weren't appearing in logcat.

**Solution:** 
- Used `android.util.Log.e()` (Error level) for important logs
- Filtered logcat by process ID
- Added extensive logging for debugging

## Files Changed

### Created:
- `scripts/sync-kotlin-files.js` - Automatic Kotlin file sync
- `docs/KOTLIN_FILE_SYNC.md` - Sync system documentation
- `docs/REAL_APP_LIST_IMPLEMENTATION.md` - This file

### Modified:
- `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`
  - Added `getInstalledApps()` method
  - Added filtering logic
  - Added extensive logging
- `android/app/src/main/AndroidManifest.xml`
  - Added `<queries>` for package visibility
- `src/native-modules/AppMonitorModule.ts`
  - Added `InstalledApp` interface
  - Added `getInstalledApps()` method signature
- `app/screens/mainAPP/Settings/EditMonitoredAppsScreen.tsx`
  - Replaced hardcoded apps with real app list
  - Added loading state
  - Implemented search
- `app/screens/mainAPP/Settings/SettingsScreen.tsx`
  - Updated to use package names
  - Added app name lookup
- `package.json`
  - Added `sync:kotlin` script
  - Updated `android` script to auto-sync
- `README.md`
  - Added Kotlin sync documentation

## Testing

**Verified:**
- ✅ App list loads on Settings → Monitored Apps
- ✅ Instagram and TikTok appear in list
- ✅ Search works correctly
- ✅ Apps can be selected/deselected
- ✅ Selected apps persist
- ✅ System apps are filtered out
- ✅ User-installed apps are included
- ✅ Kotlin sync works automatically

## Performance

- **App list load time:** < 1 second
- **Number of apps:** ~300-350 (depends on device)
- **Kotlin sync time:** < 1 second (only changed files)
- **Build time:** No significant impact

## Future Improvements

Potential enhancements:
1. **App icons:** Display app icons next to names
2. **Categories:** Group apps by category (Social, Games, etc.)
3. **Usage stats:** Show which apps are used most
4. **Batch selection:** Select multiple apps at once
5. **Favorites:** Pin frequently monitored apps to top

## References

- [Android Package Visibility](https://developer.android.com/training/package-visibility)
- [Expo Config Plugins](https://docs.expo.dev/config-plugins/introduction/)
- [PackageManager API](https://developer.android.com/reference/android/content/pm/PackageManager)

