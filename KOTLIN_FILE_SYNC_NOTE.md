# Kotlin File Sync Process

**⚠️ CRITICAL: Always Edit Source Files in `plugins/` Directory**

## The Problem

The Kotlin files in `android/app/src/main/java/` are **COPIES** that get overwritten during the build process. Any edits made directly to these files will be lost!

## The Solution

**Always edit the source files in:**
```
plugins/src/android/java/com/anonymous/breakloopnative/
```

**NOT in:**
```
android/app/src/main/java/com/anonymous/breakloopnative/
```

## Sync Command

After editing files in `plugins/`, run:

```bash
npm run sync:kotlin
```

This copies the source files from `plugins/` to `android/app/`.

## Files Managed by This Process

- `ForegroundDetectionService.kt`
- `AppMonitorModule.kt`
- `AppMonitorPackage.kt`
- `AppMonitorService.kt`
- `SystemSurfaceActivity.kt`

## Warning in Files

Each file has a warning at the top:

```kotlin
/**
 * ⚠️ SOURCE FILE LOCATION ⚠️
 * 
 * This file is located in: plugins/src/android/java/com/anonymous/breakloopnative/
 * 
 * DO NOT EDIT the copy in android/app/src/main/java/ - it will be overwritten!
 * ALWAYS edit this file in the plugins/ directory.
 * 
 * The Expo build process copies this file to android/app/ automatically.
 */
```

## What Happened (January 5, 2026)

During the launcher incomplete intervention fix:
1. Initially edited `android/app/.../ForegroundDetectionService.kt` (WRONG)
2. Ran `npm run sync:kotlin`
3. Changes were overwritten from `plugins/` source
4. Re-applied changes to `plugins/src/.../ForegroundDetectionService.kt` (CORRECT)
5. Ran `npm run sync:kotlin` again
6. Changes now persist correctly

## Remember

**Source of Truth:** `plugins/src/android/java/`  
**Build Copy:** `android/app/src/main/java/`  
**Always edit:** Source files in `plugins/`!
