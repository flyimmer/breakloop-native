# Quick Testing Guide - Phase F1

## Quick Start

### 1. Build & Install
```bash
cd android
./gradlew clean
cd ..
npm run android
```

### 2. Enable Service
1. Open **Settings → Accessibility**
2. Find **BreakLoop**
3. Toggle **ON**
4. Accept permission warning

### 3. Test Detection
```bash
# Terminal 1: Watch logs
adb logcat -s ForegroundDetection:* *:E

# Terminal 2: Test apps
adb shell am start -n com.instagram.android/.mainactivity.MainActivity
```

### 4. Expected Output
```
ForegroundDetection: ✅ ForegroundDetectionService connected and ready
ForegroundDetection: 📱 Foreground app changed: com.instagram.android
ForegroundDetection:   └─ Class: com.instagram.mainactivity.MainActivity
ForegroundDetection:   └─ Time: 1735123456789
```

## Quick Checks

✅ **Service enabled in Settings?**
```bash
adb shell dumpsys accessibility | grep "BreakLoop"
```

✅ **Logs appearing?**
```bash
adb logcat -s ForegroundDetection:I
```

✅ **Service survives app kill?**
```bash
# Force stop app
adb shell am force-stop com.anonymous.breakloopnative

# Open any app - logs should still appear
adb shell am start -n com.instagram.android/.mainactivity.MainActivity
```

## Common Issues

❌ **No logs** → Check service enabled in Settings  
❌ **Service not found** → Rebuild app with `npm run android`  
❌ **Permission denied** → Accept accessibility permission warning

## What to Test

1. ✅ Open Instagram → Detect package
2. ✅ Open YouTube → Detect package
3. ✅ Return to home → Detect launcher
4. ✅ Force close BreakLoop → Detection continues
5. ✅ Disable service → Detection stops
6. ✅ Re-enable service → Detection resumes

## Phase F1 Limitations

🚧 **Currently NOT implemented:**
- React Native communication
- Intervention triggers
- Overlay UI
- Monitored app checking

📝 **Phase F1 is detection-only** - logs package names for debugging.

---

For full documentation, see: `android/docs/PHASE_F1_ACCESSIBILITY_SERVICE.md`

