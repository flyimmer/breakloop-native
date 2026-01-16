# Icon Storage Fix - Implementation Complete

## Problem Fixed

The error `Row too big to fit into CursorWindow` was caused by storing all discovered apps (100+ apps) with base64-encoded icons in a single AsyncStorage key, exceeding the ~2MB row size limit.

## Solution Implemented

Separated icon storage from app metadata using **file-based storage**:

- Icons stored as PNG files in `FileSystem.documentDirectory/app-icons/`
- Metadata contains only `iconPath` (file path to PNG)
- Icons loaded lazily when rendering UI
- Main metadata array stays small (~100-200KB)

## Implementation Summary

### Phase 1: Storage Layer + Type Changes ✅

**File**: `src/storage/appDiscovery.ts`

- **Changed interface**: `icon: string | null` → `iconPath: string | null`
- **Added functions**:
  - `saveAppIcon(packageName, iconBase64)` - Converts base64 to PNG, saves to file system
  - `loadAppIcon(packageName)` - Loads icon from file system on-demand
  - `removeAppIcon(packageName)` - Deletes icon file
  - `getIconPath(packageName)` - Returns expected file path
- **Updated functions**:
  - `markUninstalled()` - Also removes icon file
  - `cleanupUninstalled()` - Also cleans up orphaned icon files
  - `mergeApps()` - Uses `iconPath` instead of `icon`

**Safety features**:
- Creates directory if missing
- Handles overwrite safely
- Catches and logs file write errors (doesn't crash)

### Phase 2: Discovery Service Updates ✅

**File**: `src/services/appDiscovery.ts`

- **Updated `resolveMetadata()`**:
  - Saves icon to file system via `saveAppIcon()`
  - Stores only `iconPath` in metadata (never embeds icon data)
  - Enforces architecture invariant

### Phase 3: UI Lazy Loading ✅

**File**: `app/screens/mainAPP/Settings/EditMonitoredAppsScreen.tsx`

- **Added icon cache**: `Map<string, string>` for loaded icons
- **Lazy loading**: Icons loaded on-demand when rendering
- **Fallback**: Shows placeholder (first letter) if icon not loaded
- **Non-blocking**: UI renders immediately, icons load progressively

### Phase 4: Migration ✅

**File**: `src/storage/appDiscovery.ts`

- **One-time migration**: `migrateIconStorage()`
  - Detects old format (icons embedded in metadata)
  - Extracts icons, saves to file system
  - Updates metadata to use `iconPath`
  - Marks migration complete
- **Runs on app start**: Called in `appDiscoveryService.initialize()`
- **Idempotent**: Only runs once, safe to call multiple times

## Architecture Invariant (Enforced)

**Icons are NEVER embedded in metadata objects. Ever.**

- Metadata contains only `iconPath: string | null`
- Icon data lives in file system as PNG files
- UI loads icons lazily from file system
- No serialization of binary data in JSON
- Type system enforces this (no `icon` field in interface)

## Expected Results

- **Before**: Single 2MB+ blob → "Row too big" error
- **After**: 
  - Main array: ~100-200KB (metadata with iconPath only)
  - Icons: 100+ PNG files in file system, ~20-50KB each
  - Total storage: Reduced (PNG more efficient than base64)
  - No size limit errors
  - Faster icon loading
  - Cleaner cleanup

## Files Modified

1. `src/storage/appDiscovery.ts` - Icon storage functions, interface change
2. `src/services/appDiscovery.ts` - Metadata resolution with file storage
3. `app/screens/mainAPP/Settings/EditMonitoredAppsScreen.tsx` - Lazy icon loading

## Testing Checklist

- [ ] Clear AsyncStorage and file system
- [ ] Discover 100+ apps
- [ ] Verify no "Row too big" errors
- [ ] Verify icons load correctly in UI
- [ ] Test migration from old format
- [ ] Verify icon files created in correct directory
- [ ] Test uninstall cleanup (icon files deleted)
- [ ] Verify Instagram/TikTok/XHS appear

## Next Steps

1. Run `npm run android` to build and test
2. Clear app data to test fresh install
3. Verify icons load progressively
4. Check logs for migration success
5. Confirm no "Row too big" errors
