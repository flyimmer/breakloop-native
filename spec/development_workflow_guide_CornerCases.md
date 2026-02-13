---
name: Development Workflow Guide
overview: Establish clear, efficient procedures for making Kotlin and JavaScript changes to avoid build issues and wasted time in the future.
todos: []
---

# Development Workflow Guide for BreakLoop-Native

## Problem Analysis - What Went Wrong Today

### Root Cause

**The native module `AppMonitorPackage` was NEVER registered in `MainApplication.kt`.**

This meant:

- Even though we edited `AppMonitorModule.kt` correctly
- Even though we ran `npm run android` multiple times
- Even though the Kotlin code was synced and compiled
- **JavaScript couldn't call the native module because React Native didn't know it existed**

### Why `npm run android` Didn't Fix It

`npm run android` does NOT automatically run `expo prebuild`. It only:

1. Syncs Kotlin files from `plugins/` to `android/`
2. Runs Gradle build
3. Installs APK

**It does NOT regenerate `MainApplication.kt` or run the config plugin.**

### The Solution

We had to manually run:

```bash
npx expo prebuild --platform android --clean
```

This regenerated `MainApplication.kt` and ran the config plugin (`withForegroundService.js`), which added the critical line:

```kotlin
add(AppMonitorPackage())
```

### Secondary Issues (After Registration)

1. **Gradle caching** - Changes weren't being compiled despite file modifications
2. **React Native caching** - JavaScript was using old native bridge even after APK install
3. **File locks on Windows** - Gradle processes holding files during builds

## Quick Decision Tree

**"Should I run `expo prebuild`?"**

```
START
  ↓
Is this the first time building? → YES → Run expo prebuild
  ↓ NO
Did I add NEW Kotlin files? → YES → Run expo prebuild
  ↓ NO
Did I modify withForegroundService.js? → YES → Run expo prebuild
  ↓ NO
Are native logs NOT appearing? → YES → Check MainApplication.kt
  ↓                                      ↓
  NO                              Is AppMonitorPackage registered?
  ↓                                      ↓ NO
Just run: npm run android          Run expo prebuild
                                         ↓ YES
                                   Problem is elsewhere (see diagnostic)
```

**Key Rule:** If you're editing existing Kotlin files and native logs appear correctly, you DON'T need `expo prebuild`.


## Future Workflows

### 0. First Time Setup / After Cloning Project

**ALWAYS run this after cloning or if native modules aren't working:**

```bash
# 1. Install dependencies
npm install

# 2. Generate Android project and register native modules
npx expo prebuild --platform android --clean

# 3. Build and install
npm run android
```

**This is what we had to do today to fix the issue.**

### 1. Making Kotlin Changes (Native Code)

**Source of Truth:** `plugins/src/android/java/com/anonymous/breakloopnative/*.kt`

#### Standard Workflow (Editing Existing Files)

```bash
# 1. Edit Kotlin file in plugins/
# Edit: plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt

# 2. Run the app (auto-syncs and builds)
npm run android
```

**What `npm run android` does:**

- ✅ Syncs Kotlin files from `plugins/` to `android/`
- ✅ Runs Gradle build
- ✅ Installs APK
- ❌ Does NOT run `expo prebuild` (doesn't regenerate MainApplication.kt)

**This works ONLY if the native module is already registered.**

#### When to Use `expo prebuild` (Rare Cases)

**ONLY run `expo prebuild` when:**

- Adding NEW Kotlin files (not editing existing ones)
- Changing `AndroidManifest.xml` structure
- Modifying plugin configuration in `withForegroundService.js`
- Setting up project for the first time
- **Native module registration issues** (like today)
```bash
# Full rebuild with prebuild
npx expo prebuild --platform android --clean
npm run android
```


#### Emergency: Nuclear Clean (Last Resort)

**ONLY use when normal builds fail repeatedly:**

```bash
# 1. Stop all Gradle processes
cd android
./gradlew --stop

# 2. Delete build artifacts
cd ..
Remove-Item -Recurse -Force android/app/build
Remove-Item -Recurse -Force android/app/.cxx
Remove-Item -Recurse -Force android/.gradle

# 3. Delete GLOBAL Gradle build cache (critical!)
# This cache persists across ALL project-level cleans and is used by --build-cache flag
Remove-Item -Recurse -Force "$env:USERPROFILE\.gradle\caches\build-cache-1" -ErrorAction SilentlyContinue

# 4. Full rebuild
npx expo prebuild --platform android --clean
npm run android
```

> **WARNING:** If the build still reports errors for code that no longer exists in the file,
> the global Gradle build cache at `~/.gradle/caches/build-cache-1/` is almost certainly the cause.
> The `--build-cache` flag (used by Expo's default build command) stores compiled Kotlin outputs globally,
> and these persist even after `./gradlew clean`, deleting `kotlin-classes`, and `expo prebuild --clean`.

#### Native Code Verification Protocol (MANDATORY)

**CRITICAL:** Every time you modify Kotlin files, you MUST verify each step. Skipping verification causes silent failures that waste hours.

### Step-by-Step Verification

#### 1. After Editing Kotlin File
**Action:** Verify your changes are in the source file
```bash
# Check the file you just edited
Select-String -Path "plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt" -Pattern "YOUR_CHANGE"
```
**Expected:** Should see your changes
**If not:** File wasn't saved or wrong file edited

#### 2. After `npm run sync:kotlin`
**Action:** Verify sync actually copied the changes
```bash
# Compare source and synced files (should be identical)
$source = Get-Content "plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt" -Raw
$synced = Get-Content "android/app/src/main/java/com/anonymous/breakloopnative/AppMonitorModule.kt" -Raw
if ($source -eq $synced) { Write-Host "Files match" } else { Write-Host "Files differ - sync failed!" }
```
**Expected:** Files should be identical (no diff output)
**If different:** Sync failed. Delete synced file and re-sync:
```bash
Remove-Item android/app/src/main/java/com/anonymous/breakloopnative/AppMonitorModule.kt
npm run sync:kotlin
```

#### 3. Before Building
**Action:** Force clean build to prevent Gradle cache issues

**CRITICAL:** `./gradlew clean` alone is NOT sufficient! It doesn't delete compiled Kotlin classes, which causes Gradle to reuse old code indefinitely. You MUST delete `kotlin-classes` and `intermediates/classes` directories first.

```bash
# Delete compiled Kotlin classes (gradle clean doesn't do this!)
Remove-Item -Recurse -Force android\app\build\tmp\kotlin-classes -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force android\app\build\intermediates\classes -ErrorAction SilentlyContinue

# Then clean
cd android && ./gradlew clean && cd ..
```
**Expected:** "BUILD SUCCESSFUL"
**Why:** Gradle often uses cached .class files even when .kt files change. The `kotlin-classes` directory persists across `./gradlew clean` calls, causing stale compiled code to be reused.

#### 4. After `npm run android`
**Action:** Verify Gradle actually recompiled your file
```bash
# Check build logs for compilation (look for your file being compiled)
# In the build output, search for: :app:compileDebugKotlin
```
**Expected:** Should see `:app:compileDebugKotlin` (not "UP-TO-DATE")
**If UP-TO-DATE:** Clean build didn't work, need to delete build cache manually

#### 5. After APK Install
**Action:** Verify APK timestamp is recent
```bash
# Check APK was rebuilt
Get-Item android/app/build/outputs/apk/debug/app-debug.apk | Select-Object LastWriteTime
```
**Expected:** Timestamp within last few minutes
**If old:** APK wasn't rebuilt, need to investigate build process

#### 6. After Opening App Screen
**Action:** Verify native logs appear immediately
```bash
# Clear logs and watch for your changes
adb logcat -c
adb logcat -s AppMonitorModule:*
```
**Expected:** Logs appear within 5 seconds of opening relevant screen
**If no logs:** Code isn't in APK. Start verification from step 1.

### Red Flags (Stop and Verify)

- ❌ Sync says "Already up to date" but you just made changes
- ❌ Build completes in < 10 seconds (likely cached)
- ❌ Build logs show `:app:compileDebugKotlin UP-TO-DATE`
- ❌ No native logs appear when screen opens
- ❌ JavaScript logs show old behavior

### When Verification Fails

1. **Stop immediately** - don't proceed to next step
2. **Identify which step failed** using the checks above
3. **Fix that specific step** before continuing
4. **Re-verify** that step before moving forward

### Common Failures and Fixes

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Sync says "up to date" | File timestamps identical | `touch` the source file, re-sync |
| Build shows "UP-TO-DATE" | Gradle cache stale | `./gradlew clean`, rebuild |
| No logs appear | Code not in APK | Delete synced file, clean, re-sync, rebuild |
| Old behavior persists | Old APK still installed | Uninstall app, reinstall APK |

### 2. Making JavaScript/TypeScript Changes

**Location:** `app/`, `src/`, `components/`

#### Standard Workflow

```bash
# 1. Edit JS/TS files
# Edit: app/screens/mainAPP/Settings/EditMonitoredAppsScreen.tsx

# 2. Metro bundler auto-reloads (if running)
# OR manually reload: Shake device → Reload

# No build needed! JavaScript changes are hot-reloaded.
```

#### When Build IS Needed

**ONLY rebuild for JavaScript changes when:**

- Changing native module imports/exports
- Modifying `app.json` configuration
- Adding new native dependencies
```bash
npm run android  # Rebuilds and installs
```


### 3. Verifying Changes Work

#### For Kotlin Changes

**Check these logs when testing:**

```bash
# 1. Open app and navigate to the changed feature
# 2. Check terminal for native logs

# Expected logs for AppMonitorModule:
[AppMonitorModule] ========== GET INSTALLED APPS START ==========
[AppMonitorModule] Total packages found: 300+
[AppMonitorModule] Processed: 150 user apps
```

**If native logs DON'T appear (CRITICAL DIAGNOSTIC):**

This is the EXACT symptom we had today. Follow this checklist:

1. **Check if module is registered:**
   ```bash
   # Look for: add(AppMonitorPackage())
   cat android/app/src/main/java/com/anonymous/breakloopnative/MainApplication.kt | grep AppMonitorPackage
   ```


   - **If NOT found** → Native module not registered → Run `expo prebuild --clean`
   - **If found** → Continue to step 2

2. **Check if using old APK:**
   ```bash
   # Uninstall completely and reinstall
   adb uninstall com.anonymous.breakloopnative
   npm run android
   ```

3. **Check React Native cache:**

   - Clear app data on device (Settings → Apps → BreakLoop → Clear Data)
   - Or reinstall app (step 2 above)

#### For JavaScript Changes

**Check these logs:**

```bash
# Expected logs for React components:
[EditMonitoredApps] Loaded 150 apps
[SettingsScreen] Accessibility service enabled: true
```

**If changes don't appear:**

- Metro bundler not running → Run `npm start`
- Cache issue → Shake device → Reload
- Persistent cache → Clear Metro cache: `npx expo start --clear`

### 4. Kotlin Companion Object Pitfall

#### Issue: `withService` used for companion object functions

**Symptom:** Build error like `No parameter with name 'X' found` or `Unresolved reference` when calling a function via `svc.someFunction(...)` inside `withService { svc -> ... }`.

**Root Cause:** `withService` gives you a service **instance**. If the function is defined in the `companion object`, it is NOT an instance method and cannot be called via `svc.functionName()`.

**Rule of thumb:**
- **Companion functions** (e.g. `requestQuickTaskDecision`, `onSurfaceExit`) → call directly: `requestQuickTaskDecision(...)`
- **Instance methods** (e.g. `handleInterventionCompletionReevaluation`) → use `withService`: `withService { svc -> svc.handleMethod(...) }`

**How to tell:** Check the function definition:
- Inside `companion object { ... }` block → companion function
- Directly in the `class` body → instance method

```kotlin
// WRONG: calling companion function via instance
withService { svc -> svc.requestQuickTaskDecision(app = fg, source = "X") }

// RIGHT: call companion function directly
requestQuickTaskDecision(app = fg, source = "X")

// RIGHT: call instance method via withService
withService { svc -> svc.handleInterventionCompletionReevaluation(app, qt) }
```

#### Issue: Stale build errors for code that no longer exists

**Symptom:** Kotlin compiler reports errors (e.g. `No parameter with name 'context' found`) for code you already fixed. File content verified correct via `Get-Content`, `Select-String`, and MD5 hash comparison, but compiler still sees old code.

**Root Cause:** Gradle's **global build cache** at `~/.gradle/caches/build-cache-1/` stores compiled Kotlin outputs. The `--build-cache` flag (used by Expo's default build command) reuses these stale cached results even after:
- `./gradlew clean`
- Deleting `kotlin-classes` and `intermediates/classes`
- `expo prebuild --clean`
- Stopping Gradle daemon

**Fix:**
```bash
# Delete the global Gradle build cache
Remove-Item -Recurse -Force "$env:USERPROFILE\.gradle\caches\build-cache-1" -ErrorAction SilentlyContinue

# Then rebuild
npm run android
```

**Prevention:** When debugging build errors, always verify the reported error matches actual file content. If the error references code that doesn't exist, it's a cache problem.

### 5. Common Issues and Quick Fixes

#### Issue: "Native module not found"

```bash
# Fix: Register the module
npx expo prebuild --platform android --clean
npm run android
```

#### Issue: "Build failed with file lock"

```bash
# Fix: Stop Gradle and clean
cd android
./gradlew --stop
cd ..
Remove-Item -Recurse -Force android/app/build/intermediates/project_dex_archive
npm run android
```

#### Issue: "Changes not appearing after install"

```bash
# Fix: Full uninstall/reinstall
adb uninstall com.anonymous.breakloopnative
npm run android
```

#### Issue: "Device offline"

```bash
# Fix: Restart ADB
adb kill-server
adb start-server
adb devices  # Verify device appears
```

### 5. Recommended Daily Workflow

**Morning Setup:**

```bash
# 1. Start Metro bundler in one terminal
npm start

# 2. In another terminal, run on device
npm run android

# 3. Make changes and test
# - Kotlin changes: Save → Wait for rebuild → Test
# - JavaScript changes: Save → Auto-reload → Test
```

**Before Committing:**

```bash
# 1. Verify build is clean
npm run android

# 2. Test on device
# 3. Commit if everything works
```

### 6. Time Estimates

| Task | Expected Time |

|------|---------------|

| Edit existing Kotlin file | 2-3 min (auto-sync + build) |

| Edit JavaScript file | Instant (hot reload) |

| Add new Kotlin file | 5-10 min (prebuild + build) |

| Nuclear clean rebuild | 5-10 min |

| Debug build issues | 10-30 min (if following this guide) |

### 7. Prevention Checklist

**Before making changes:**

- [ ] Is this a Kotlin or JavaScript change?
- [ ] Do I need to add new files or just edit existing ones?
- [ ] Is Metro bundler running?
- [ ] Is device connected and authorized?

**After making changes:**

- [ ] Did the expected logs appear?
- [ ] Did the UI update as expected?
- [ ] Can I reproduce the change after app restart?

### 8. Documentation to Create

**Recommended new files:**

1. **`docs/DEVELOPMENT_WORKFLOW.md`** - This guide
2. **`docs/TROUBLESHOOTING.md`** - Common issues and fixes
3. **`.github/DEVELOPMENT.md`** - Quick reference for contributors

## Key Takeaways

1. **For Kotlin edits:** Just use `npm run android` (auto-syncs)
2. **For JavaScript edits:** Just save and reload (hot reload)
3. **Only use `expo prebuild` when adding NEW files or fixing registration issues**
4. **Nuclear clean is LAST RESORT** (not first step)
5. **Always check logs to verify changes are active**

This workflow should reduce build issues from hours to minutes.