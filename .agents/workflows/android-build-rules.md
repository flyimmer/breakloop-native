---
description: By using Android Studio
---

# 🚨 STRICT NATIVE BUILD & WORKFLOW RULES FOR AI 🚨

## 1. The Core Architecture (90% Native, 10% JS)
We have officially migrated away from the standard Expo Managed workflow. We are treating this as a **Bare Native Android Application** that happens to have a JS bundle attached. 

## 2. Kotlin Editing Rules (CRITICAL)
* **STOP** editing Kotlin files inside the `plugins/src/...` directory. 
* **STOP** running `KOTLIN_FILE_SYNC.md` or any sync scripts. This process is deprecated.
* **START** editing Kotlin files directly inside their permanent home: `android/app/src/main/java/com/anonymous/breakloopnative/`. This is the single source of truth.

## 3. The Build Process
* **DO NOT** run `npm run android`, `npx expo start`, or `npx expo prebuild` to test Kotlin changes. These commands boot up the JS bundler unnecessarily and cause massive delays.
* **ALWAYS USE:** `dev_both.bat` in the PowerShell terminal to compile native code and push it to the emulator. 
* This script bypasses Expo and uses Gradle directly (`gradlew.bat installDebug`), reducing build times from minutes to seconds.

## 4. Error Handling & Debugging
* Do not rely on the Expo Metro terminal for native crashes.
* If a build fails or the app crashes, immediately read the `crash_report.txt` file located in the root directory. The `.\dev_both.bat` script automatically pipes all ADB native errors (`*:E`) into this file.