# Phase F3.5 Implementation Summary

## What Was Implemented

A dedicated `InterventionActivity` that wakes the BreakLoop app and shows **ONLY** the intervention UI when a monitored app is detected. Works even when the app is fully killed.

---

## Why a Dedicated Activity?

### The Problem with Single Activity Approach

If we only had `MainActivity`:
```
User opens Instagram (monitored app)
  → AccessibilityService detects it
  → Launches MainActivity
  → React Native boots
  → User sees main app tabs/settings (flash!)
  → THEN intervention starts
  → ❌ Disruptive, confusing experience
```

### Solution: Dedicated InterventionActivity

```
User opens Instagram (monitored app)
  → AccessibilityService detects it
  → Launches InterventionActivity (separate from MainActivity)
  → React Native boots
  → OS Trigger Brain navigates directly to intervention
  → User sees ONLY breathing screen (no tabs, no settings)
  → ✅ Clean, focused experience
```

---

## How It Avoids Showing Main App UI

### 1. Separate Task Isolation

**AndroidManifest.xml configuration:**
```xml
<activity
  android:name=".InterventionActivity"
  android:launchMode="singleInstance"
  android:taskAffinity=""
  android:excludeFromRecents="true">
```

- `singleInstance`: Runs in its own dedicated task (completely isolated from MainActivity)
- `taskAffinity=""`: Prevents grouping with MainActivity in task switcher
- `excludeFromRecents="true"`: Hidden from recent apps list

**Result:** MainActivity and InterventionActivity are completely separate tasks. Opening InterventionActivity never touches MainActivity.

### 2. Direct Launch Path

**ForegroundDetectionService.kt:**
```kotlin
// When monitored app detected:
if (MONITORED_APPS.contains(packageName)) {
    val intent = Intent(this, InterventionActivity::class.java)
    intent.putExtra(EXTRA_TRIGGERING_APP, packageName)
    startActivity(intent)  // Launch InterventionActivity, NOT MainActivity
}
```

The AccessibilityService launches `InterventionActivity` directly, never going through `MainActivity`.

### 3. Transparent Theme

**styles.xml:**
```xml
<style name="Theme.Intervention">
  <item name="android:windowBackground">@android:color/transparent</item>
  <item name="android:windowDisablePreview">true</item>
  <!-- No splash screen -->
</style>
```

No splash screen, no loading UI. React Native content shows immediately once ready.

### 4. Clean Exit Behavior

When intervention completes:
```
User finishes intervention
  → InterventionActivity.finish() called
  → User returns to Instagram (or launcher)
  → MainActivity is NOT left open in background
```

---

## How JavaScript Remains the Decision Authority

### Native Code Responsibilities (WHEN Decision)

**ForegroundDetectionService.kt:**
```kotlin
// Native ONLY decides WHEN to wake app
if (MONITORED_APPS.contains(packageName)) {
    launchInterventionActivity(packageName)
}
```

That's it. Native code:
- ✅ Detects foreground app changes
- ✅ Checks if app is in monitored list (simple lookup)
- ✅ Launches InterventionActivity
- ❌ NO intervention business logic
- ❌ NO state management
- ❌ NO navigation decisions

### JavaScript Responsibilities (IF and HOW Decisions)

**OS Trigger Brain (React Native):**
```javascript
// JS receives Intent extras with triggering app
const triggeringApp = getIntentExtra('triggeringApp');

// JS decides IF intervention should occur
if (isQuickTaskWindowActive()) {
  // No intervention needed, close activity
  return;
}

// JS decides HOW to intervene
dispatch({ type: 'BEGIN_INTERVENTION', targetApp: triggeringApp });

// JS manages state machine
// idle → breathing → root-cause → alternatives → action → reflection → idle

// JS handles navigation
navigation.navigate('BreathingScreen');
```

JavaScript controls:
- ✅ Whether intervention actually occurs (Quick Task window, user settings, etc.)
- ✅ Which intervention flow to show
- ✅ State machine transitions
- ✅ Screen navigation
- ✅ When intervention is complete

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User opens Instagram                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. ForegroundDetectionService detects foreground change     │
│    - Package: com.instagram.android                         │
│    - Check: Is this in MONITORED_APPS? → YES               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Native launches InterventionActivity                     │
│    Intent extras:                                            │
│    - triggeringApp: "com.instagram.android"                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. React Native boots in InterventionActivity               │
│    - Loads "main" component                                  │
│    - OS Trigger Brain reads Intent extras                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. JS evaluates: Should intervention occur?                 │
│    - Check Quick Task window                                 │
│    - Check user settings                                     │
│    - Check recent intervention history                       │
│    - Decision: YES → Dispatch BEGIN_INTERVENTION            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Intervention state machine transitions                   │
│    idle → breathing                                          │
│    JS navigates to BreathingScreen                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. User sees ONLY intervention UI (no tabs, no settings)   │
│    - BreathingScreen appears                                 │
│    - User completes breathing countdown                      │
│    - JS continues state machine: breathing → root-cause     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. User completes full intervention flow                    │
│    JS dispatches RESET_INTERVENTION                         │
│    InterventionActivity.finish() called                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. User returns to Instagram (or launcher)                  │
│    MainActivity is NOT open                                  │
└─────────────────────────────────────────────────────────────┘
```

**Key Points:**
- Steps 1-3: Native code (WHEN decision)
- Steps 4-9: JavaScript (IF and HOW decisions)
- Native has ZERO intervention business logic
- JS is the single source of truth for intervention semantics

---

## Expected Behavior

### Scenario: App is Killed

**Steps:**
1. User force-closes BreakLoop (swipe from recent apps)
2. User opens Instagram
3. AccessibilityService detects Instagram (runs independently of app)
4. InterventionActivity launches (app wakes from killed state)
5. React Native boots
6. OS Trigger Brain evaluates and dispatches BEGIN_INTERVENTION
7. User sees breathing screen **immediately** (NO tabs, NO settings)
8. User completes intervention
9. InterventionActivity closes
10. User returns to Instagram

**Key Observation:** Main app UI NEVER appears. User only sees intervention screens.

---

## Key Implementation Files

### 1. InterventionActivity.kt
- Dedicated Activity for intervention-only UI
- Extends ReactActivity
- Returns "main" component (same as MainActivity)
- OS Trigger Brain handles navigation to intervention screens

### 2. AndroidManifest.xml
- Registers InterventionActivity with proper configuration
- `launchMode="singleInstance"` - isolated task
- `excludeFromRecents="true"` - hidden from recents
- `taskAffinity=""` - separate from MainActivity
- `theme="@style/Theme.Intervention"` - transparent theme

### 3. styles.xml
- Defines Theme.Intervention style
- Transparent background, no splash screen
- Minimal visual disruption

### 4. ForegroundDetectionService.kt
- Added monitored apps list (hardcoded for Phase F3.5)
- Added launchInterventionActivity() method
- Launches InterventionActivity when monitored app detected
- Passes triggering app via Intent extras

---

## What This Achieves

✅ **No Main App UI Flash:** User never sees tabs/settings when intervention triggers  
✅ **Clean Wake from Killed State:** Works even when app is fully killed  
✅ **JavaScript Authority:** Native decides WHEN, JS decides IF and HOW  
✅ **Proper Task Isolation:** Intervention and main app are completely separate  
✅ **Clean Exit:** Intervention closes without leaving main app open  
✅ **Framework Integration:** Works with existing OS Trigger Brain and intervention state machine  

---

## Future Phases

**Phase F4: Dynamic Monitored Apps**
- Replace hardcoded list with dynamic sync from React Native settings
- Use shared storage (SharedPreferences or AsyncStorage bridge)

**Phase F5: Overlay Windows**
- Add SYSTEM_ALERT_WINDOW permission
- Show intervention as overlay on top of monitored app
- Allow "peek" at monitored app content below

**Phase F6: Performance Optimization**
- Preload React Native runtime in background service
- Reduce cold-start latency for faster intervention launch

---

## Testing

**Enable Accessibility Service:**
```
Settings > Accessibility > BreakLoop > Enable
```

**Test basic flow:**
1. Kill BreakLoop app
2. Open Instagram
3. Observe: Intervention launches, breathing screen appears
4. Confirm: No main app tabs visible

**Check logs:**
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

---

## Summary

Phase F3.5 implements a **dedicated Activity** that ensures users see **ONLY** the intervention UI, with **JavaScript remaining the decision authority** for all intervention logic. The implementation uses proper Android task isolation, transparent theming, and direct launch paths to avoid any main app UI flash.

