# Native Build Canary Implementation

## ✅ Implementation Complete

**Date:** 2026-01-19  
**Initial BUILD_ID:** `NATIVE_2026_01_19_001`

## 📋 What Was Implemented

### 1. **NativeBuildCanary.kt**
- **Location:** `android/app/src/main/java/com/anonymous/breakloopnative/NativeBuildCanary.kt`
- **Purpose:** Single source of truth for native build verification
- **Contains:** A manually-updated `BUILD_ID` constant

### 2. **MainApplication.kt Log**
- **Location:** `android/app/src/main/java/com/anonymous/breakloopnative/MainApplication.kt`
- **Added:** Log statement in `onCreate()` method
- **Tag:** `NATIVE_CANARY`
- **Message Format:** `🔥 Native build active: NATIVE_2026_01_19_001`

## 🎯 How to Use

### Every Time You Edit ANY Kotlin File:
1. Open `NativeBuildCanary.kt`
2. Change the `BUILD_ID` constant to a new value (e.g., increment the number)
3. Save the file
4. Rebuild and reinstall the app
5. Check logcat for the new BUILD_ID

### Example BUILD_ID Evolution:
```kotlin
// First edit
const val BUILD_ID = "NATIVE_2026_01_19_001"

// Second edit (changed timer logic)
const val BUILD_ID = "NATIVE_2026_01_19_002"

// Third edit (fixed SystemSurface bug)
const val BUILD_ID = "NATIVE_2026_01_19_003"

// Or use descriptive names
const val BUILD_ID = "TIMER_FIX_2026_01_19"
```

## 🔍 Verifying Native Code Deployment

### Expected Logcat Output:
```
NATIVE_CANARY    🔥 Native build active: NATIVE_2026_01_19_001
```

### To Monitor the Canary:
```powershell
adb logcat | Select-String "NATIVE_CANARY"
```

### If You See an Old BUILD_ID:
❌ **STOP DEBUGGING IMMEDIATELY**
- The native code is stale
- Your Kotlin changes are NOT running
- Full rebuild/reinstall is required

## ⚠️ Critical Rules

### Rule 1: Manual Updates Only
- **DO NOT** automate BUILD_ID updates
- **DO NOT** use timestamps or Gradle metadata
- **DO NOT** rely on build tool output

### Rule 2: Every Kotlin Change
- If you edit ANY `.kt` file → Change BUILD_ID
- No exceptions
- This includes: services, activities, modules, utilities, etc.

### Rule 3: Never Debug Without Verification
- Before debugging Kotlin logic → Check the canary
- If BUILD_ID doesn't match your latest change → Stop
- Only trust logcat, not build output

## 🧪 Testing the Canary

### Initial Verification:
1. Rebuild the app: `npm run android`
2. Watch logcat: `adb logcat | Select-String "NATIVE_CANARY"`
3. You should see: `🔥 Native build active: NATIVE_2026_01_19_001`

### Incremental Build Test:
1. Change `BUILD_ID` to `NATIVE_2026_01_19_002`
2. Save the file
3. Rebuild and reinstall
4. If you see `002` in logcat → Canary is working ✅
5. If you see `001` in logcat → Incremental build failed ❌

## 🐛 Why This Exists

### The Problem:
- Android incremental builds are unreliable
- Kotlin changes may not be compiled/installed
- Old native bytecode continues running
- Leads to debugging phantom bugs

### The Solution:
- Simple, deterministic verification mechanism
- Human-readable BUILD_ID
- Guaranteed to run on every app launch
- No dependency on build tools or metadata

## 📍 File Locations

```
android/app/src/main/java/com/anonymous/breakloopnative/
├── NativeBuildCanary.kt          ← Change this on every Kotlin edit
└── MainApplication.kt             ← Logs the canary on startup
```

## 🎓 One-Sentence Summary

**A manually-updated Kotlin file that logs a BUILD_ID on app startup so we can deterministically verify native code updates on device.**

---

## 🔗 Related Context

- This solves incremental build reliability issues
- Complements existing debug workflows
- For development use only (consider removing for production)
- Used in conjunction with `adb logcat` filtering

---

**Remember:** The Native Build Canary is your first line of defense against wasting hours debugging code that isn't actually running. Always check it first.
