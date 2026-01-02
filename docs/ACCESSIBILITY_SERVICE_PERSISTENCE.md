# Accessibility Service Persistence Guide

**Date:** January 2, 2026  
**Issue:** Accessibility service needs to be re-enabled after each new build

## Overview

Android accessibility services can persist across app updates, but there are important limitations and requirements. This document explains how persistence works and what was implemented to improve the user experience.

## How Android Handles Accessibility Service Persistence

### When Service Persists ✅

The accessibility service **WILL** remain enabled across builds if:

1. **Same signing key**: The app uses the same signing certificate
   - Debug builds use the same debug keystore by default
   - Production builds must use the same release keystore
   
2. **Same package name**: The app package name doesn't change

3. **Same component name**: The accessibility service component name doesn't change

4. **Update (not reinstall)**: The app is **updated** (not uninstalled and reinstalled)

### When Service Gets Disabled ❌

The accessibility service **WILL BE DISABLED** if:

1. **App is uninstalled**: Android disables accessibility services when the app is removed
2. **Different signing key**: If you use a different keystore, Android treats it as a different app
3. **Package name changes**: The component name is tied to package name

### Development Build Behavior

During development:

- **First install**: Service must be manually enabled
- **Updates** (without uninstall): Service should persist ✅
- **Reinstalls** (uninstall + install): Service will be disabled ❌

**Note:** If you're experiencing the service being disabled after each build, you might be doing a full uninstall/reinstall. Try using `npm run android` which should update the existing installation.

## Implementation

### Native Module Methods Added

**`AppMonitorModule.isAccessibilityServiceEnabled()`**
- Checks if ForegroundDetectionService is enabled in Android Settings
- Returns `Promise<boolean>`
- Used to display status in Settings screen

**`AppMonitorModule.openAccessibilitySettings()`**
- Opens Android's Accessibility Settings screen
- Returns `Promise<boolean>`
- Better UX than using raw Intent strings

### Settings Screen Updates

The Settings screen now:

1. **Displays status**: Shows a visual indicator (green/red dot) and text status
2. **Auto-refreshes**: Checks status when screen comes into focus (user returns from Settings)
3. **Better UX**: Button text changes based on current status
4. **Informative hint**: Explains that service should persist across updates

### Files Modified

1. `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`
   - Added `isAccessibilityServiceEnabled()` method
   - Added `openAccessibilitySettings()` method

2. `src/native-modules/AppMonitorModule.ts`
   - Added TypeScript type definitions for new methods

3. `app/screens/mainAPP/Settings/SettingsScreen.tsx`
   - Added accessibility status state
   - Added `checkAccessibilityStatus()` function
   - Updated UI with status indicator
   - Added `useFocusEffect` to refresh status when screen focuses

## Best Practices

### For Development

1. **Use update, not reinstall**: Run `npm run android` which updates the existing app
2. **Don't manually uninstall**: Avoid uninstalling the app between builds
3. **Check status**: Use the Settings screen to verify service is enabled

### For Production

1. **Consistent signing**: Always use the same release keystore
2. **Never change package name**: Keep the same package name across versions
3. **Document for users**: Explain that service must be enabled once and will persist

## Testing

1. **Enable service**: Go to Settings > Accessibility and enable BreakLoop
2. **Build new version**: Run `npm run android`
3. **Check persistence**: Service should still be enabled after build
4. **Verify status**: Settings screen should show "Accessibility service is enabled"

## Troubleshooting

### Service Disabled After Build

**Possible causes:**
- App was uninstalled before rebuild
- Different signing key used
- Package name changed

**Solutions:**
- Check if you're doing full uninstall/reinstall
- Verify same signing key is used
- Check package name in `app.json` and `AndroidManifest.xml`

### Status Not Updating

**Symptoms:**
- Settings screen shows wrong status
- Status doesn't update after enabling service

**Solutions:**
- Return to Settings screen (triggers `useFocusEffect`)
- Manually refresh by navigating away and back
- Check logcat for errors in `AppMonitorModule`

## Future Improvements

Potential enhancements:

1. **Auto-check on app start**: Check status when app launches
2. **Push notification reminder**: If service disabled, remind user periodically
3. **Better error handling**: Show specific error messages if status check fails
4. **Deep link to specific service**: Try to deep link directly to BreakLoop's accessibility service settings (may not be possible on all Android versions)

## Related Files

- `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`
- `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`
- `app/screens/mainAPP/Settings/SettingsScreen.tsx`
- `src/native-modules/AppMonitorModule.ts`
- `plugins/src/android/res/xml/accessibility_service.xml`
