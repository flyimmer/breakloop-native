# BreakLoop Expo Config Plugins

This directory contains Expo Config Plugins that automatically configure native Android/iOS code during `expo prebuild`.

## withForegroundService.js

**Purpose:** Automatically configures the `ForegroundDetectionService` (AccessibilityService) for Android foreground app detection.

### What It Does

1. **Copies Kotlin file:** `ForegroundDetectionService.kt` → `android/app/src/main/java/com/anonymous/breakloopnative/`
2. **Adds permission:** `BIND_ACCESSIBILITY_SERVICE` to `AndroidManifest.xml`
3. **Registers service:** Adds `<service>` tag for `ForegroundDetectionService` in `AndroidManifest.xml`
4. **Copies XML config:** `accessibility_service.xml` → `android/app/src/main/res/xml/`
5. **Merges strings:** Adds `accessibility_service_description` to `res/values/strings.xml`

### Source Files

All source files are in `plugins/src/android/`:
- `java/com/anonymous/breakloopnative/ForegroundDetectionService.kt` - The AccessibilityService implementation
- `res/xml/accessibility_service.xml` - Service configuration
- `res/values/strings.xml` - User-facing description string

### Usage

The plugin is automatically registered in `app.json`:

```json
{
  "expo": {
    "plugins": [
      "./plugins/withForegroundService.js"
    ]
  }
}
```

### When It Runs

The plugin runs automatically during:
- `expo prebuild` - Generates native folders
- `expo run:android` - Runs prebuild before building
- `npx expo prebuild --clean` - Clean rebuild

### Benefits

✅ **Version-controlled:** Source files in `plugins/src/` are tracked in Git  
✅ **Reproducible:** Same changes applied every time  
✅ **Clean:** Android folder stays git-ignored (as Expo intended)  
✅ **Maintainable:** Edit source files, not generated files  

### Adding New Native Files

To add new Android native files:

1. **Add source file** to `plugins/src/android/`
2. **Update plugin** (`withForegroundService.js`) to copy/modify it
3. **Test** with `npx expo prebuild --clean`
4. **Commit** the plugin and source files

### Future Plugins

You can add more plugins here for other native modifications:
- `withCustomModule.js` - For other native modules
- `withNativePermissions.js` - For additional permissions
- etc.

