# Complete App Discovery System - Implementation Summary

## Overview

Implemented a comprehensive three-source app discovery system matching OneSec's UX:
- **Launcher**: Fast seed (synchronous, ~44 apps)
- **UsageStats**: Async backfill (may be slow, discovers recently used apps)
- **Accessibility**: Runtime discovery (as apps are opened)

**Final list = UNION(L, U, A)**

## Key Features

### 1. Multi-Source Discovery
- **Launcher Intent Query**: Fast synchronous discovery of apps with launcher activities
- **UsageStats Manager**: Async discovery of apps used in last 14 days (requires permission)
- **Accessibility Service**: Real-time discovery as apps are opened (event-driven)

### 2. Mandatory Metadata Resolution
- **Separate step**: Discovery and metadata resolution are independent
- **Every app gets icon + label**: Uses `getApplicationInfo()` which works even without QUERY_ALL_PACKAGES
- **Placeholder icons**: Shows first letter of app name while metadata loads
- **Retry logic**: Failed resolutions retry on next screen open or app launch

### 3. Progressive Loading UX
- **T+0s**: Launcher apps appear immediately (fast seed)
- **T+2s**: UsageStats apps merge in (async backfill)
- **T+runtime**: Apps discovered as user opens them (accessibility)
- **No blocking**: UI remains responsive during async operations
- **Intentional loading**: Matches OneSec's progressive population behavior

### 4. Persistence & Cleanup
- **Local storage**: All discovered apps persisted in AsyncStorage
- **Source tracking**: Each app tracks which sources discovered it
- **Uninstall detection**: Apps marked uninstalled when metadata resolution fails
- **Grace period**: 7-day grace period before removing uninstalled apps
- **Periodic reconciliation**: Daily cleanup and metadata retry

## Architecture

### Native Layer (Mechanical)
- `AppDiscoveryModule.kt`: Three discovery methods + metadata resolution
- `ForegroundDetectionService.kt`: Emits discovery events on window state changes
- **NO semantic decisions**: Only provides data

### JavaScript Layer (Orchestration)
- `appDiscovery.ts`: Coordinates all three sources, manages subscriptions
- `appDiscovery.ts` (storage): Persistence layer with merge logic
- **Progressive updates**: Notifies UI as apps are discovered

### UI Layer (Display)
- `EditMonitoredAppsScreen.tsx`: Progressive loading, placeholder icons
- **Subscribes to updates**: List automatically updates as new apps discovered

## Files Created

1. **`src/storage/appDiscovery.ts`** - Persistence layer
2. **`src/services/appDiscovery.ts`** - Discovery coordinator
3. **`src/native-modules/AppDiscoveryModule.ts`** - TypeScript interface
4. **`plugins/src/android/java/.../AppDiscoveryModule.kt`** - Native discovery module
5. **`plugins/src/android/java/.../AppDiscoveryPackage.kt`** - Package registration

## Files Modified

1. **`plugins/withForegroundService.js`** - Added UsageStats permission, package registration
2. **`plugins/src/android/java/.../ForegroundDetectionService.kt`** - Emit discovery events
3. **`app/screens/mainAPP/Settings/EditMonitoredAppsScreen.tsx`** - Progressive loading UI
4. **`app/App.tsx`** - Initialize discovery service on app start
5. **`scripts/sync-kotlin-files.js`** - Added new Kotlin files to sync
6. **`scripts/validate-native-modules.js`** - Added AppDiscoveryPackage validation

## Permissions Added

- **PACKAGE_USAGE_STATS**: For UsageStats discovery (user must grant in Settings)

## No Restricted Permissions

- ✅ No QUERY_ALL_PACKAGES
- ✅ No MATCH_ALL
- ✅ No full getInstalledPackages() enumeration
- ✅ Uses intent-based queries (Play-safe)

## Expected Results

**Before:**
- 44 apps (launcher only)
- Instagram/TikTok/XHS: Missing

**After (Progressive):**
- T+0s: 44 apps (launcher seed)
- T+2s: +50 apps (UsageStats backfill) - **Instagram/TikTok/XHS likely here**
- T+runtime: +N apps (as user opens them)
- **Total: 100+ apps with complete metadata**

## Verification

After build completes, check:
1. **Logs**: Should show "Found X launcher apps", "Found Y apps from UsageStats"
2. **UI**: Apps appear progressively (not all at once)
3. **Instagram/TikTok/XHS**: Should appear via UsageStats or Accessibility
4. **Icons**: Every app has icon or placeholder
5. **Permission**: UsageStats permission request in settings

## Next Steps

1. **Test on device**: Verify Instagram/TikTok/XHS appear
2. **Grant UsageStats permission**: Settings → Apps → Special app access → Usage access
3. **Verify progressive loading**: Watch apps appear over time
4. **Test accessibility discovery**: Open an app not in launcher/UsageStats
