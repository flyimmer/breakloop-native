---
name: Development Workflow Guide

---

**Standard Workflow.**

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

### 1.1 Stale Build Recovery (Force Reinstall)

**Problem:** Sometimes `npm run android` successfully builds but the device keeps running the OLD binary (stale logic). This happens because Android's `adb install` might skip installation if it sees the same version ID.

**Solution: The "Version Bump" Force.** 
If `NATIVE_BUILD_CANARY` in logcat does not match your code:
1.  Open `android/app/build.gradle`.
2.  Increment `versionCode` by 1 (e.g., `5 -> 6`).
3.  Increment `versionName` (e.g., `1.0.4 -> 1.0.5`).
4.  Run `npm run android` again.

This forces the Android OS to recognize the APK as a fresh update and strictly overwrite the old logic.

### 2. Verifying and Forcing Native Changes

#### A. The Logic Proof (Canary)
Increase the version in `plugins\src\android\java\com\anonymous\breakloopnative\NativeBuildCanary.kt`.
To verify it in the code if the current version is used on the cellphone:
```bash
adb logcat | Select-String "QT_DEV"
adb logcat | Select-String "NATIVE_BUILD_CANARY"
```

#### B. The Installation Signal (Forcing Update)
> [!IMPORTANT]
> **If logs show an old version number** despite running `npm run android`, it means Android/ADB skipped the installation because the `versionCode` didn't change.

**To FORCE a fresh installation:**
1.  Open `android/app/build.gradle`.
2.  Increment `versionCode` (e.g., from `5` to `6`).
3.  Increment `versionName` (e.g., from `1.0.4` to `1.0.5`).
4.  Run `npm run android` again.

**Rule of Thumb:**
-   **Edit logic only?** Increment `NativeBuildCanary`.
-   **Logs still stale?** Bump `versionCode` in `build.gradle`.


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

# 3. Full rebuild
npx expo prebuild --platform android --clean
npm run android
```



