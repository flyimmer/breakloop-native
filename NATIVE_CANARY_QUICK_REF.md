# Native Build Canary - Quick Reference

## 📝 Workflow for Every Kotlin Edit

### Step 1: Make your Kotlin changes
Edit any `.kt` file as needed

### Step 2: Update the canary
```kotlin
// File: android/app/src/main/java/com/anonymous/breakloopnative/NativeBuildCanary.kt

object NativeBuildCanary {
    const val BUILD_ID = "QT_DEV_2026_01_19_002"  // ← INCREMENT THIS
}
```

### Step 3: Rebuild and install
```powershell
npm run android
```

### Step 4: Verify in logcat
```powershell
adb logcat | Select-String "NATIVE_CANARY"
```

**Expected output:**
```
NATIVE_CANARY    🔥 Native build active: QT_DEV_2026_01_19_002
```

## ⚠️ STOP Signs

### 🛑 If you see an OLD BUILD_ID:
- Your native code changes are NOT running
- Old bytecode is still active
- Do a full clean rebuild:
  ```powershell
  Remove-Item -Recurse -Force android/app/build, android/.gradle
  npm run android
  ```

### 🛑 Before debugging Kotlin logic:
1. Check the canary first
2. Verify BUILD_ID matches your latest edit
3. Only proceed if canary confirms latest code

## 🎯 BUILD_ID Naming Convention

Use any format that's human-readable:

```kotlin
// Dated incremental
"QT_DEV_2026_01_19_001"
"QT_DEV_2026_01_19_002"

// Descriptive
"TIMER_FIX_JAN_19"
"SURFACE_CLOSE_FIX"
"LIFECYCLE_PATCH_001"
```

## 📍 Files Modified

1. `android/app/src/main/java/com/anonymous/breakloopnative/NativeBuildCanary.kt`
   - Contains the BUILD_ID constant

2. `android/app/src/main/java/com/anonymous/breakloopnative/MainApplication.kt`
   - Logs the canary on app startup (onCreate)

---

**Golden Rule:** Never debug Kotlin logic unless the canary proves the code is running.
