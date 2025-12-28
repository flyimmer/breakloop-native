# Quick Testing Guide - Phase F1/F2

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
# Terminal 1: Watch logs (includes launcher filtering)
adb logcat -s ForegroundDetection:*

# To see ONLY app changes (hide launcher debug logs):
adb logcat -s ForegroundDetection:I

# Terminal 2: Test apps
adb shell am start -n com.instagram.android/.mainactivity.MainActivity
```

### 4. Expected Output
```
ForegroundDetection: ✅ ForegroundDetectionService connected and ready
ForegroundDetection: 📱 Foreground app changed: com.instagram.android
ForegroundDetection: 🏠 Launcher detected, ignoring: com.hihonor.android.launcher
ForegroundDetection:   └─ Class: com.instagram.mainactivity.MainActivity
ForegroundDetection:   └─ Time: 1735123456789
```

**Phase F2 Update:** Launcher events now show 🏠 and are **ignored** - they don't update the current foreground app.

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

✅ **Launchers being filtered?** (Phase F2)
```bash
# Watch for 🏠 emoji when pressing home button
adb logcat -s ForegroundDetection:D
```

## Common Issues

❌ **No logs** → Check service enabled in Settings  
❌ **Service not found** → Rebuild app with `npm run android`  
❌ **Permission denied** → Accept accessibility permission warning

## What to Test

### Phase F1 Tests
1. ✅ Open Instagram → Detect package
2. ✅ Open YouTube → Detect package
3. ✅ Return to home → Detect launcher (Phase F1) or ignore (Phase F2)
4. ✅ Force close BreakLoop → Detection continues
5. ✅ Disable service → Detection stops
6. ✅ Re-enable service → Detection resumes

### Phase F2 Tests (Launcher Filtering)
7. ✅ Open Instagram → See 📱 for Instagram
8. ✅ Press home → See 🏠 for launcher (ignored, no 📱)
9. ✅ Open YouTube → See 📱 for YouTube only
10. ✅ Open Instagram from home → See 📱 for Instagram, 🏠 for launcher bounce (if OEM device)

## Phase F1/F2 Limitations

🚧 **Currently NOT implemented:**
- React Native communication
- Intervention triggers
- Overlay UI
- Monitored app checking

📝 **Phase F1/F2 status:**
- ✅ Detection with event-driven app switching
- ✅ Launcher filtering to prevent false positives
- ✅ Logs package names for debugging

---

For full documentation:
- Phase F1: `android/docs/PHASE_F1_ACCESSIBILITY_SERVICE.md`
- Phase F2: `android/docs/PHASE_F2_LAUNCHER_FILTERING.md`

