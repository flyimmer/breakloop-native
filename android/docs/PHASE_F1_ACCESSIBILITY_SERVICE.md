# Phase F1: Android Accessibility Service Implementation

## Overview

Phase F1 implements a production-grade Android AccessibilityService for **detection-only** foreground app monitoring. This is the foundation for future intervention triggers.

## Implementation Status

✅ **COMPLETED - Detection Only**
- AccessibilityService implementation
- Configuration and registration
- Logging and debugging support
- Privacy-conscious design
- Coexistence with existing AppMonitorService

🚧 **NOT IMPLEMENTED (Future Phases)**
- React Native communication (Phase F2)
- Overlay/intervention triggers (Phase F3+)
- AppMonitorService deprecation (Phase F3+)

---

## Architecture

### 1. ForegroundDetectionService.kt

**Location:** `android/app/src/main/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`

**Purpose:** Detect foreground app changes using Android's AccessibilityService API.

**Key Features:**
- Extends `AccessibilityService` for event-driven detection
- Listens to `TYPE_WINDOW_STATE_CHANGED` events
- Extracts package names from accessibility events
- Runs independently of React Native lifecycle
- Survives app kills and restarts

**Why AccessibilityService?**
1. **Real-time detection** - Event-driven, not polling-based
2. **Battery efficient** - No continuous polling required
3. **Survives app death** - Service runs independently
4. **Reliable** - Direct OS-level events
5. **Immediate** - No delay or lag

**Privacy & Security:**
- ✅ Only reads package names (e.g., "com.instagram.android")
- ❌ Does NOT read any content, text, or UI elements
- ❌ Does NOT capture keystrokes or interactions
- ❌ Does NOT take screenshots or record screen
- ✅ Requires explicit user permission in Settings
- ✅ User can disable anytime

**Current Behavior (Phase F1):**
```kotlin
// When app switches occur:
Log.i(TAG, "📱 Foreground app changed: com.instagram.android")
Log.d(TAG, "  └─ Class: com.instagram.mainactivity.MainActivity")
Log.d(TAG, "  └─ Time: 1735123456789")
```

**Lifecycle:**
1. User enables service in **Settings → Accessibility → BreakLoop**
2. `onServiceConnected()` called → Service starts listening
3. `onAccessibilityEvent()` called on every app switch
4. Service continues running even if BreakLoop app is killed
5. User can disable in Settings → `onDestroy()` called

**State Management:**
```kotlin
companion object {
    @Volatile
    var isServiceConnected = false  // Check if service is running
}
```

---

### 2. accessibility_service.xml

**Location:** `android/app/src/main/res/xml/accessibility_service.xml`

**Purpose:** Configure the AccessibilityService capabilities and behavior.

**Key Configuration:**
```xml
android:accessibilityEventTypes="typeWindowStateChanged"
    → Only receive app switch events

android:canRetrieveWindowContent="false"
    → Explicitly disable content access (privacy)

android:accessibilityFlags="flagRetrieveInteractiveWindows"
    → Detect window changes, but NOT their content

android:notificationTimeout="0"
    → Real-time detection, no delay

android:description="@string/accessibility_service_description"
    → User-facing explanation shown in Settings
```

**What User Sees in Settings:**
- Service name: "BreakLoop"
- Description: "BreakLoop needs to detect when you open monitored apps to provide mindfulness interventions. This service only reads app names, not your content or activity within apps. You can disable this anytime in Settings."
- Permission warning: Android's standard accessibility permission warning

---

### 3. AndroidManifest.xml Updates

**Location:** `android/app/src/main/AndroidManifest.xml`

**Changes Made:**

#### a) Added Permission
```xml
<uses-permission 
    android:name="android.permission.BIND_ACCESSIBILITY_SERVICE" 
    tools:ignore="ProtectedPermissions"/>
```

**Why `tools:ignore="ProtectedPermissions"`?**
- AccessibilityService requires this permission
- It's a system-level permission that doesn't need manifest request
- Android grants it when user enables the service in Settings
- The lint warning is a false positive, so we suppress it

#### b) Registered Service
```xml
<service
    android:name=".ForegroundDetectionService"
    android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
    android:exported="true"
    android:enabled="true">
    <intent-filter>
        <action android:name="android.accessibilityservice.AccessibilityService"/>
    </intent-filter>
    <meta-data
        android:name="android.accessibilityservice"
        android:resource="@xml/accessibility_service"/>
</service>
```

**Key Attributes:**
- `android:exported="true"` → Required for system to bind service
- `android:permission="..."` → Restricts binding to system only
- `intent-filter` → Declares this is an AccessibilityService
- `meta-data` → Points to configuration XML

---

### 4. strings.xml Addition

**Location:** `android/app/src/main/res/values/strings.xml`

**Added:**
```xml
<string name="accessibility_service_description">
    BreakLoop needs to detect when you open monitored apps to provide 
    mindfulness interventions. This service only reads app names, not 
    your content or activity within apps. You can disable this anytime 
    in Settings.
</string>
```

**Purpose:** User-facing description shown in Android Accessibility Settings.

---

## Coexistence with AppMonitorService

### Current State (Phase F1)

Both services can run simultaneously:

| Feature | AppMonitorService | ForegroundDetectionService |
|---------|-------------------|---------------------------|
| **Method** | UsageStatsManager polling | AccessibilityService events |
| **Reliability** | Moderate (2s delay) | High (real-time) |
| **Battery** | Higher (polling) | Lower (event-driven) |
| **Survives app kill** | Yes (foreground service) | Yes (system service) |
| **Status** | Active | Active (detection only) |

### Future Migration Plan

**Phase F2-F3:**
- Connect ForegroundDetectionService to React Native
- Implement intervention triggers via AccessibilityService
- Gradually deprecate AppMonitorService

**Phase F4:**
- Remove AppMonitorService entirely
- Use only ForegroundDetectionService

**Why keep both now?**
- Backward compatibility
- Testing and validation period
- Risk mitigation during transition

---

## Testing the Implementation

### 1. Enable the Service

**Steps:**
1. Build and install the app: `npm run android`
2. Open Android Settings
3. Navigate to **Accessibility**
4. Find **BreakLoop** in the list
5. Toggle it ON
6. Accept the permission warning

### 2. Monitor Logs

**Command:**
```bash
adb logcat -s ForegroundDetection:* *:E
```

**Expected Output:**
```
ForegroundDetection: ✅ ForegroundDetectionService connected and ready
ForegroundDetection: Service configuration applied - listening for window state changes
ForegroundDetection: 📱 Foreground app changed: com.instagram.android
ForegroundDetection:   └─ Class: com.instagram.mainactivity.MainActivity
ForegroundDetection:   └─ Time: 1735123456789
ForegroundDetection: 📱 Foreground app changed: com.android.launcher3
```

### 3. Test Scenarios

✅ **Test 1: Basic Detection**
- Open Instagram → Log should show package name
- Open YouTube → Log should show package name
- Return to home → Log should show launcher

✅ **Test 2: Service Persistence**
- Enable service
- Force close BreakLoop app
- Open Instagram → Log should still show detection

✅ **Test 3: Service Lifecycle**
- Disable service in Settings
- Open Instagram → No logs should appear
- Re-enable service
- Open Instagram → Logs should resume

### 4. Debugging Tips

**Check if service is running:**
```bash
adb shell dumpsys accessibility | grep "BreakLoop"
```

**Check service status from code:**
```kotlin
if (ForegroundDetectionService.isServiceConnected) {
    // Service is running
}
```

**Common Issues:**

❌ **Service not connecting**
- Ensure user enabled it in Settings → Accessibility
- Check AndroidManifest.xml registration
- Verify XML configuration file exists

❌ **No logs appearing**
- Check logcat filter: `-s ForegroundDetection:*`
- Ensure service is enabled in Settings
- Try rebooting device

❌ **Events not firing**
- Verify `TYPE_WINDOW_STATE_CHANGED` in config
- Check accessibility service is bound to system
- Review accessibility_service.xml configuration

---

## Privacy Considerations

### What We Access
✅ Package name only (e.g., "com.instagram.android")

### What We DON'T Access
❌ App content or text
❌ User inputs or keystrokes
❌ Screenshots or screen recordings
❌ Passwords or sensitive data
❌ UI structure or layout
❌ Notifications or messages

### User Control
✅ Explicit permission required in Settings
✅ Clear description of service purpose
✅ Can be disabled anytime by user
✅ Android shows standard permission warning
✅ Service only runs when enabled

### Compliance
- ✅ Follows Android accessibility best practices
- ✅ Minimal permission scope
- ✅ Clear user communication
- ✅ Respects user privacy choices

---

## Future Phases

### Phase F2: React Native Bridge
- Create native module to communicate with JS
- Send detected package names to React Native
- Implement event emitter from AccessibilityService

### Phase F3: Intervention Triggers
- Check detected apps against monitored list
- Trigger overlay when monitored app opened
- Implement intervention UI (breathing screen, etc.)

### Phase F4: Full Migration
- Remove AppMonitorService
- Use AccessibilityService exclusively
- Clean up legacy polling code

---

## Files Created/Modified

### Created:
1. ✅ `android/app/src/main/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt` (173 lines)
2. ✅ `android/app/src/main/res/xml/accessibility_service.xml` (42 lines)
3. ✅ `android/docs/PHASE_F1_ACCESSIBILITY_SERVICE.md` (this file)

### Modified:
1. ✅ `android/app/src/main/AndroidManifest.xml` (Added permission + service registration)
2. ✅ `android/app/src/main/res/values/strings.xml` (Added service description)

---

## Summary

**Phase F1 Complete ✅**

We now have:
- ✅ Production-grade AccessibilityService
- ✅ Real-time, event-driven app detection
- ✅ Privacy-conscious design
- ✅ Clear user communication
- ✅ Comprehensive documentation
- ✅ Coexistence with existing service
- ✅ Foundation for future intervention system

**Next Steps:**
- Build and test the service
- Enable it in Android Accessibility Settings
- Monitor logs to verify detection
- Proceed to Phase F2 when ready

**No Breaking Changes:**
- AppMonitorService still works
- No changes to existing functionality
- Pure additive implementation

