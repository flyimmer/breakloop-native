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

### 2. Verifying Changes
increase the version in plugins\src\android\java\com\anonymous\breakloopnative\NativeBuildCanary.kt
To verify it in the code if the current version is used on the cellphone:
adb logcat | Select-String "QT_DEV"
adb logcat | Select-String "NATIVE_BUILD_CANARY"


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



