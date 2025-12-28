# Commands to Test AccessibilityService

# Terminal 1: Keep Metro/Expo running (your current terminal)
# Don't stop this - it's for the React Native app

# Terminal 2: Open a NEW terminal and run this
# This will show ONLY the AccessibilityService logs
adb logcat -s ForegroundDetection:* *:E

# This filters for:
# - ForegroundDetection:* = All logs from our AccessibilityService
# - *:E = Only show errors from other sources (to reduce noise)

# Expected output when you switch apps:
# ForegroundDetection: ✅ ForegroundDetectionService connected and ready
# ForegroundDetection: Service configuration applied - listening for window state changes
# ForegroundDetection: 📱 Foreground app changed: com.instagram.android
# ForegroundDetection:   └─ Class: com.instagram.mainactivity.MainActivity
# ForegroundDetection:   └─ Time: 1735123456789

# To test if it works when app is closed:
# 1. Close the BreakLoop app (swipe it away from recent apps)
# 2. Open Instagram or any other app
# 3. You should STILL see logs in Terminal 2
# 4. Terminal 1 (Metro) will NOT show anything - that's correct!

