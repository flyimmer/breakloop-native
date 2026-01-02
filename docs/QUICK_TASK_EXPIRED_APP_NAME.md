# Quick Task Expired Screen - App Name Display

## Summary

Added app name information to the Quick Task Expired screen to help users understand which app's Quick Task has ended, especially when they've already switched to other apps.

## Problem

When the Quick Task timer expires, users see a generic "Quick Task Ended" message. If they've already switched to other apps, they may be confused about which app's Quick Task has ended.

## Solution

Added the app name display to the Quick Task Expired screen:
- Shows "Quick Task Ended" as the main title
- Displays "for [App Name]" below the title in accent color
- Uses friendly app names (e.g., "Instagram", "TikTok", "Twitter")

## Implementation Details

### File Modified
- `app/screens/conscious_process/QuickTaskExpiredScreen.tsx`

### Changes Made

1. **Added `getAppDisplayName()` utility function**
   - Maps common package names to friendly display names
   - Includes mappings for: Instagram, TikTok, Twitter, Facebook, Snapchat, Reddit, YouTube, WhatsApp
   - Fallback: Extracts readable name from package name (e.g., "com.example.myapp" → "Myapp")

2. **Updated component to use Quick Task state**
   - Changed from `const { dispatchQuickTask } = useQuickTask()` to `const { quickTaskState, dispatchQuickTask } = useQuickTask()`
   - Added `const appName = getAppDisplayName(quickTaskState.expiredApp)`

3. **Updated UI layout**
   - Added new text element between title and description: `<Text style={styles.appNameText}>for {appName}</Text>`
   - Adjusted spacing: title `marginBottom` from 16 to 8

4. **Added new style**
   - `appNameText`: 18px font size, 600 weight, accent color (#6558B8), centered, 16px bottom margin

## Visual Design

**Before:**
```
Quick Task Ended

Your emergency window is over.
It's time to return to what matters.
```

**After:**
```
Quick Task Ended
for Instagram

Your emergency window is over.
It's time to return to what matters.
```

## Data Flow

1. Quick Task timer expires for an app (e.g., "com.instagram.android")
2. OS Trigger Brain dispatches `SHOW_EXPIRED` action with app package name
3. QuickTaskProvider stores package name in `quickTaskState.expiredApp`
4. QuickTaskExpiredScreen reads `quickTaskState.expiredApp`
5. `getAppDisplayName()` converts package name to friendly name
6. UI displays "Quick Task Ended for [App Name]"

## Testing

To test this feature:
1. Enable Quick Task in Settings (set duration to 10 seconds for testing)
2. Open a monitored app (e.g., Instagram)
3. Activate Quick Task
4. Wait for timer to expire (10 seconds)
5. Verify the expired screen shows "Quick Task Ended for Instagram"
6. Switch to another monitored app (e.g., TikTok) and repeat
7. Verify it shows "Quick Task Ended for TikTok"

## Edge Cases Handled

- **Unknown package name**: Shows "Unknown App" if `expiredApp` is null
- **Unmapped package name**: Extracts readable name from package (e.g., "com.example.myapp" → "Myapp")
- **Common apps**: All major social media apps have friendly name mappings

## Future Enhancements

If needed, the app name mapping can be extended by:
1. Adding more entries to the `appMappings` object
2. Using the native module's `getInstalledApps()` to fetch actual app names
3. Caching app names in AsyncStorage for better performance
