# ========================================
# CLEAR ACCESSIBILITY SERVICE LOGS
# ========================================
#
# This shows ONLY the app detection logs with emoji markers
# Much easier to read than the full logcat!

# BEST OPTION: Show only the main detection lines (with emoji 📱)
adb logcat -s ForegroundDetection:I

# This will show:
# ForegroundDetection: ✅ ForegroundDetectionService connected and ready
# ForegroundDetection: 📱 Foreground app changed: com.instagram.android
# ForegroundDetection: 📱 Foreground app changed: com.hihonor.android.launcher
# ForegroundDetection: 📱 Foreground app changed: com.youtube.android

# --------------------------------------------
# Alternative: If you want MORE detail
# --------------------------------------------
adb logcat -s ForegroundDetection:D

# This adds extra debug info:
# ForegroundDetection:   └─ Class: com.instagram.mainactivity.MainActivity
# ForegroundDetection:   └─ Time: 1735123456789

# --------------------------------------------
# Alternative: Clear screen first, then watch
# --------------------------------------------
adb logcat -c && adb logcat -s ForegroundDetection:I

# This clears old logs first, then starts fresh
# Very clean output!

# ========================================
# WHAT TO LOOK FOR
# ========================================
#
# 1. Service Connected:
#    ✅ ForegroundDetectionService connected and ready
#
# 2. App Switches (this is what matters!):
#    📱 Foreground app changed: [package name]
#
# Each 📱 means a new app is now in foreground

# ========================================
# TEST STEPS
# ========================================
#
# 1. Clear logs and start watching:
#    adb logcat -c && adb logcat -s ForegroundDetection:I
#
# 2. Switch apps on your phone:
#    - Open Instagram → See 📱 com.instagram.android
#    - Press home → See 📱 com.hihonor.android.launcher
#    - Open YouTube → See 📱 com.youtube.android
#
# 3. THE KEY TEST - Close BreakLoop completely:
#    - Swipe BreakLoop away from recent apps
#    - Open Instagram
#    - You should STILL see: 📱 Foreground app changed: com.instagram.android
#
# If you see the 📱 emoji even after closing BreakLoop,
# IT WORKS! The service is running independently.

