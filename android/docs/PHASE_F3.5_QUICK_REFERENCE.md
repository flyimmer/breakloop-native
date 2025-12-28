# Phase F3.5 Quick Reference

## What Was Implemented

**InterventionActivity** - A dedicated Android Activity that shows ONLY the intervention UI, with no main app flash.

---

## Key Concepts in 60 Seconds

### 1. Why a Dedicated Activity?

**Problem:** If we only had MainActivity, users would see tabs/settings flash before intervention starts.

**Solution:** InterventionActivity runs in a separate task, completely isolated from MainActivity. Only shows intervention UI.

### 2. How It Works

```
User opens Instagram
  ↓
AccessibilityService detects it
  ↓
Launches InterventionActivity (NOT MainActivity)
  ↓
React Native boots
  ↓
OS Trigger Brain dispatches BEGIN_INTERVENTION
  ↓
User sees breathing screen (NO TABS)
```

### 3. Native vs JavaScript Responsibilities

**Native Code (WHEN):**
- Detect foreground app change
- Check if it's in monitored list
- Launch InterventionActivity
- ❌ NO intervention business logic

**JavaScript Code (IF and HOW):**
- Evaluate if intervention should occur
- Manage intervention state machine
- Handle all navigation
- Decide when to exit

---

## Files Created

1. **InterventionActivity.kt** - Dedicated activity for intervention-only UI
2. **AndroidManifest.xml** - Registered with proper task isolation
3. **styles.xml** - Added transparent Theme.Intervention style
4. **ForegroundDetectionService.kt** - Updated to launch InterventionActivity

---

## Key Configuration

### AndroidManifest.xml

```xml
<activity
  android:name=".InterventionActivity"
  android:launchMode="singleInstance"      <!-- Isolated task -->
  android:excludeFromRecents="true"        <!-- Hidden from recents -->
  android:taskAffinity=""                  <!-- Separate from MainActivity -->
  android:theme="@style/Theme.Intervention" <!-- Transparent -->
  android:exported="false">                <!-- Internal only -->
</activity>
```

### Theme.Intervention

```xml
<item name="android:windowBackground">@android:color/transparent</item>
<item name="android:windowDisablePreview">true</item>
<!-- No splash screen, no loading UI -->
```

---

## Testing

### Prerequisites

1. Enable Accessibility Service:
   ```
   Settings > Accessibility > BreakLoop > Enable
   ```

2. Build and install:
   ```bash
   cd android
   ./gradlew assembleDebug
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

### Quick Test

1. **Kill BreakLoop** (swipe from recents)
2. **Open Instagram**
3. **Expected:** Intervention launches, breathing screen appears
4. **Expected:** NO tabs, NO settings visible

### Monitor Logs

```bash
adb logcat | grep -E "ForegroundDetection|InterventionActivity"
```

**Expected output:**
```
ForegroundDetection: 🎯 MONITORED APP DETECTED: com.instagram.android
ForegroundDetection: [Accessibility] Launching InterventionActivity for com.instagram.android
InterventionActivity: 🎯 InterventionActivity created
InterventionActivity:   └─ Triggered by: com.instagram.android
```

### Automated Testing

```bash
cd android
chmod +x TEST_INTERVENTION_ACTIVITY.sh
./TEST_INTERVENTION_ACTIVITY.sh
```

---

## Monitored Apps (Hardcoded for Testing)

```kotlin
com.instagram.android       // Instagram
com.zhiliaoapp.musically    // TikTok
com.twitter.android         // Twitter
com.facebook.katana         // Facebook
com.reddit.frontpage        // Reddit
com.snapchat.android        // Snapchat
com.youtube.android         // YouTube
```

**TODO Phase F4:** Replace with dynamic list synced from React Native settings.

---

## Expected Behavior

### ✅ Correct Behavior

- Opening Instagram → Intervention launches
- Only breathing screen visible
- No tabs or settings
- Works even when app is killed
- Clean exit after intervention completes
- User returns to Instagram (not main app)

### ❌ Incorrect Behavior (Should NOT Happen)

- Main app tabs appear before intervention
- MainActivity opens instead of InterventionActivity
- Intervention appears in recent apps list
- Main app left open after intervention exits
- Chrome (non-monitored) triggers intervention

---

## Troubleshooting

### Intervention doesn't launch

**Check:**
1. Is Accessibility Service enabled?
   ```bash
   adb shell settings get secure enabled_accessibility_services
   ```
2. Is the app in monitored list?
3. Check logs for errors

### Main app UI flashes

**Check:**
1. Is MainActivity launching instead of InterventionActivity?
2. Check AndroidManifest.xml configuration
3. Verify ForegroundDetectionService launches correct activity

### React Native doesn't load

**Check:**
1. Metro bundler running?
2. Build errors?
3. Check full logcat for React Native errors

---

## Architecture Diagram

```
┌──────────────────────────────────────────┐
│  ForegroundDetectionService              │
│  (AccessibilityService)                  │
│                                          │
│  Detects: Instagram opened               │
│  Checks: Is monitored? → YES            │
│  Action: Launch InterventionActivity    │
└────────────────┬─────────────────────────┘
                 │
                 │ Intent with EXTRA_TRIGGERING_APP
                 │
                 ▼
┌──────────────────────────────────────────┐
│  InterventionActivity                    │
│  (Separate Task)                         │
│                                          │
│  - Loads React Native                    │
│  - Passes trigger info to JS            │
│  - Isolated from MainActivity            │
└────────────────┬─────────────────────────┘
                 │
                 │ React Native boots
                 │
                 ▼
┌──────────────────────────────────────────┐
│  OS Trigger Brain (JavaScript)           │
│                                          │
│  - Reads Intent extras                   │
│  - Evaluates if intervention needed      │
│  - Dispatches BEGIN_INTERVENTION        │
│  - Manages state machine                 │
│  - Handles navigation                    │
└──────────────────────────────────────────┘
```

---

## Next Steps (Future Phases)

**Phase F4: Dynamic Monitored Apps**
- Sync monitored apps list from React Native settings
- Real-time updates when user changes settings

**Phase F5: Overlay Windows**
- Add SYSTEM_ALERT_WINDOW permission
- Show intervention as overlay on top of monitored app

**Phase F6: Performance**
- Preload React Native runtime in background
- Reduce cold-start latency

---

## Documentation

- **Full Documentation:** `android/docs/PHASE_F3.5_INTERVENTION_ACTIVITY.md`
- **Summary:** `android/docs/PHASE_F3.5_SUMMARY.md`
- **This File:** `android/docs/PHASE_F3.5_QUICK_REFERENCE.md`

---

## Summary

✅ InterventionActivity created and configured  
✅ ForegroundDetectionService launches it when monitored app detected  
✅ Proper task isolation (no main app UI flash)  
✅ JavaScript remains decision authority  
✅ Works from killed state  
✅ Clean exit behavior  

**Status:** Phase F3.5 Complete

