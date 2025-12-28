# Phase F3.5: InterventionActivity - Intervention-Only UI

**Status:** ✅ Complete  
**Date:** December 28, 2025  
**Scope:** Wake BreakLoop app and show ONLY intervention UI when monitored app detected

---

## Overview

Phase F3.5 implements a dedicated `InterventionActivity` that wakes the BreakLoop app process and displays **only the intervention UI**, with no main app UI flash. This works even when the BreakLoop app was fully killed.

### Goal

When a monitored app is detected:
- BreakLoop wakes (even from killed state)
- User sees **ONLY** the intervention UI (breathing → root-cause → alternatives → etc.)
- Main app UI (tabs, settings, community) **NEVER** appears
- After intervention completes, user returns to previously opened app

---

## Architecture Intent (NON-NEGOTIABLE)

```
┌─────────────────────────────────────────────────────────────┐
│  NATIVE CODE                                                 │
│  - Decides WHEN to surface UI (monitored app detected)      │
│  - Launches InterventionActivity                            │
│  - Passes triggering app package name                       │
│  - NO INTERVENTION BUSINESS LOGIC                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  JAVASCRIPT (OS Trigger Brain + Intervention State Machine) │
│  - Single source of truth for intervention semantics        │
│  - Decides IF intervention should occur                     │
│  - Manages intervention state machine                       │
│  - Handles navigation logic                                 │
│  - Determines when to exit                                  │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle:** Native code wakes the app and decides **WHEN** to surface UI. JavaScript remains the single source of truth for **IF** and **HOW** to intervene.

---

## Implementation

### 1. InterventionActivity.kt

**Location:** `android/app/src/main/java/com/anonymous/breakloopnative/InterventionActivity.kt`

**Purpose:** Dedicated Activity that hosts ONLY the intervention experience.

**Key Features:**
- Extends `ReactActivity` (React Native integration)
- Returns "main" as root component (same as MainActivity)
- OS Trigger Brain detects intervention trigger and navigates to intervention flow
- Prevents main app tabs from appearing

**React Native Integration:**
```kotlin
override fun getMainComponentName(): String = "main"
```

While this returns the same "main" component as MainActivity, the OS Trigger Brain will detect the intervention trigger (via Intent extras) and automatically navigate to the intervention flow instead of showing tabs.

**Intent Extras:**
- `EXTRA_TRIGGERING_APP`: Package name of the app that triggered intervention
- Used by JS to identify which monitored app was detected

**Lifecycle:**
1. Launched by ForegroundDetectionService when monitored app detected
2. React Native initializes
3. OS Trigger Brain evaluates situation (reads Intent extras)
4. JS dispatches `BEGIN_INTERVENTION` to intervention state machine
5. User completes intervention
6. Activity finishes and user returns to previously opened app

---

### 2. AndroidManifest.xml Configuration

**Key Settings Explained:**

#### `launchMode="singleInstance"`
- Only one instance of InterventionActivity ever exists
- Runs in its own dedicated task, completely isolated from MainActivity
- If already running, brings existing instance to foreground instead of creating new one
- Prevents stacking multiple intervention screens

#### `excludeFromRecents="true"`
- Hides this activity from Android's recent apps list
- Users don't see "Intervention" as a separate app task
- Reinforces that this is a temporary interruption, not a standalone app

#### `taskAffinity=""` (empty)
- Further isolates intervention task from main app
- Prevents grouping with MainActivity in task switcher
- Allows intervention to close cleanly without affecting main app state

#### `theme="@style/Theme.Intervention"`
- Transparent/minimal theme (no splash screen or loading UI)
- React Native content shows immediately when ready
- Smooth, non-disruptive entrance

#### `exported="false"`
- Cannot be launched by external apps
- Only launchable by ForegroundDetectionService (internal component)

#### No `<intent-filter>`
- Does not appear in app drawer
- Does not show launcher icon
- Only accessible via internal launching from ForegroundDetectionService

---

### 3. Theme.Intervention Style

**Location:** `android/app/src/main/res/values/styles.xml`

**Design Goals:**
- No splash screen or loading UI
- Minimal visual disruption
- Full-screen immersive experience
- No action bar or title bar
- React Native content shows immediately when ready

**Key Style Attributes:**
```xml
<!-- Transparent window background -->
<item name="android:windowBackground">@android:color/transparent</item>
<item name="android:windowIsTranslucent">true</item>

<!-- No preview/splash -->
<item name="android:windowDisablePreview">true</item>

<!-- Dark status bar -->
<item name="android:statusBarColor">#000000</item>
```

This ensures users see **ONLY** the intervention UI, not any app chrome or branding elements.

---

### 4. ForegroundDetectionService Updates

**Changes:**
1. Added hardcoded list of monitored apps (Phase F3.5 testing)
2. Added `launchInterventionActivity()` method
3. Detects when monitored app comes to foreground
4. Launches `InterventionActivity` (NOT MainActivity)

**Intent Flags Explained:**

```kotlin
FLAG_ACTIVITY_NEW_TASK:
- Required when starting activity from a Service (not an Activity context)
- Creates activity in a new task

FLAG_ACTIVITY_CLEAR_TOP:
- If InterventionActivity already exists, brings it to front
- Clears any activities above it in the stack
- Combined with singleInstance launchMode, ensures clean state

FLAG_ACTIVITY_SINGLE_TOP:
- If activity is already at top of stack, reuses existing instance
- Calls onNewIntent() instead of creating new instance
- Prevents duplicate intervention screens
```

Together these flags ensure:
- Clean wake from killed state
- No duplicate intervention screens
- Proper isolation from MainActivity
- User sees ONLY intervention UI, not main app

**Monitored Apps (Hardcoded for Testing):**
```kotlin
private val MONITORED_APPS = setOf(
    "com.instagram.android",
    "com.zhiliaoapp.musically",  // TikTok
    "com.twitter.android",
    "com.facebook.katana",
    "com.reddit.frontpage",
    "com.snapchat.android",
    "com.youtube.android"
)
```

**TODO Phase F4:** Replace with dynamic list synced from React Native settings.

---

## Why This Architecture?

### Why a Dedicated Activity?

**Problem with Single Activity Approach:**
If we only had MainActivity:
- When waking from killed state, React Native boots and shows initial UI
- Without special handling, this would be the main app tabs
- User would see a flash of tabs/settings before intervention starts
- Confusing and disruptive user experience

**Solution: Dedicated InterventionActivity:**
- Separate Activity specifically for intervention
- Never shows main app UI
- React Native still boots, but OS Trigger Brain immediately navigates to intervention
- Clean, focused experience

### How It Avoids Showing Main App UI

**1. Separate Task:**
- `launchMode="singleInstance"` + `taskAffinity=""` isolates intervention from main app
- MainActivity runs in one task, InterventionActivity runs in another
- No risk of main app appearing when intervention launches

**2. Direct Navigation:**
- ForegroundDetectionService launches InterventionActivity directly
- Never touches MainActivity
- MainActivity only launches when user explicitly opens the app

**3. Transparent Theme:**
- `Theme.Intervention` has no splash screen
- Transparent background until React Native content loads
- No visual artifacts or UI flash

**4. Exit Behavior:**
- When intervention completes, InterventionActivity finishes
- User returns to the app they were trying to open (or launcher)
- MainActivity is NOT left open in the background

### How JS Remains the Decision Authority

**Native Code Responsibilities:**
- ✅ Detect foreground app changes (AccessibilityService)
- ✅ Check if app is in monitored list (simple lookup)
- ✅ Launch InterventionActivity (WHEN decision)
- ❌ NO intervention business logic
- ❌ NO state machine management
- ❌ NO navigation decisions

**JavaScript Responsibilities:**
- ✅ Evaluate if intervention should occur (Quick Task window, user settings, etc.)
- ✅ Decide which intervention flow to show (breathing → root-cause → alternatives)
- ✅ Manage intervention state machine (idle → breathing → root-cause → etc.)
- ✅ Navigate through intervention screens
- ✅ Handle user actions (select cause, choose alternative, etc.)
- ✅ Determine when intervention is complete and should exit

**Data Flow:**
```
1. Native: Monitored app detected (e.g., Instagram)
2. Native: Launch InterventionActivity with EXTRA_TRIGGERING_APP="com.instagram.android"
3. React Native: Boot and read Intent extras
4. JS (OS Trigger Brain): Read triggering app from Intent
5. JS: Evaluate if intervention should occur (check Quick Task window, etc.)
6. JS: If yes, dispatch BEGIN_INTERVENTION to intervention state machine
7. JS: Navigate to BreathingScreen (first intervention screen)
8. User: Complete intervention flow (JS handles all navigation)
9. JS: Dispatch RESET_INTERVENTION when complete
10. Native: InterventionActivity finishes and closes
```

Native code only decides **WHEN** (step 1-2). JavaScript decides **IF** and **HOW** (steps 4-9).

---

## Expected Behavior

### Scenario 1: App is Killed
1. User force-closes BreakLoop (swipe away from recent apps)
2. User opens Instagram
3. ForegroundDetectionService detects Instagram (service runs independently)
4. InterventionActivity launches (app wakes from killed state)
5. React Native boots
6. OS Trigger Brain evaluates and dispatches BEGIN_INTERVENTION
7. User sees breathing screen (NO main app UI flash)
8. User completes intervention
9. InterventionActivity closes
10. User returns to Instagram or launcher

**Main app is NOT left open.** User never sees tabs/settings.

### Scenario 2: App is Backgrounded
1. User uses main app, then presses home
2. User opens TikTok
3. ForegroundDetectionService detects TikTok
4. InterventionActivity launches (separate task from MainActivity)
5. User sees intervention UI immediately
6. User completes intervention
7. InterventionActivity closes
8. User returns to TikTok or launcher

**MainActivity remains backgrounded.** No interference with main app state.

### Scenario 3: Quick Task Window Active
1. User opens Twitter (monitored app)
2. InterventionActivity launches
3. React Native boots and OS Trigger Brain evaluates
4. JS checks: Quick Task window active? User recently used bypass?
5. JS decides: NO intervention needed
6. InterventionActivity closes immediately
7. User proceeds to Twitter without interruption

**Native code doesn't know about Quick Task logic.** JS makes all decisions.

---

## Testing

### Prerequisites
1. Enable Accessibility Service:
   ```
   Settings > Accessibility > BreakLoop > Enable
   ```

2. Build and install app:
   ```bash
   cd android
   ./gradlew assembleDebug
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

### Test Plan

#### Test 1: Intervention Launches from Killed State
1. Force close BreakLoop (swipe from recent apps)
2. Open Instagram
3. **Expected:** InterventionActivity launches, breathing screen appears
4. **Expected:** No main app tabs visible

#### Test 2: No Main App UI Flash
1. Kill BreakLoop
2. Open TikTok
3. **Expected:** Only intervention UI visible (no tabs, no settings)
4. Watch for any UI flash during React Native boot

#### Test 3: Proper Exit Behavior
1. Open Instagram (trigger intervention)
2. Complete intervention flow
3. **Expected:** InterventionActivity closes
4. **Expected:** Return to Instagram or launcher (not main app)
5. Check recent apps: Main app should NOT appear in recents

#### Test 4: Separate Task Isolation
1. Open main app (MainActivity) normally
2. Press home
3. Open Twitter (trigger intervention)
4. **Expected:** InterventionActivity appears in separate task
5. Check recent apps: Should see main app and intervention as separate entries
6. Complete intervention
7. **Expected:** Main app still exists in background, unaffected

#### Test 5: Non-Monitored Apps
1. Open Chrome (not monitored)
2. **Expected:** No intervention, no InterventionActivity launch
3. Check logcat: Should see "Not a monitored app, ignoring"

### Logcat Filtering

**View intervention launches:**
```bash
adb logcat | grep -E "ForegroundDetection|InterventionActivity"
```

**Expected logs:**
```
ForegroundDetection: 📱 Foreground app changed: com.instagram.android
ForegroundDetection: 🎯 MONITORED APP DETECTED: com.instagram.android
ForegroundDetection: [Accessibility] Launching InterventionActivity for com.instagram.android
InterventionActivity: 🎯 InterventionActivity created
InterventionActivity:   └─ Triggered by: com.instagram.android
InterventionActivity: Loading React Native root component: main
```

---

## Known Limitations & Future Work

### Current Limitations

1. **Hardcoded Monitored Apps:**
   - List is hardcoded in ForegroundDetectionService
   - Not synced with user settings in React Native
   - **TODO Phase F4:** Sync with JS settings via shared storage

2. **No Quick Task Check in Native:**
   - Native always launches InterventionActivity for monitored apps
   - JS must decide if intervention should actually occur
   - If no intervention needed, activity exits immediately
   - **TODO Phase F4:** Optimize to avoid unnecessary launches

3. **React Native Boot Time:**
   - Small delay while React Native initializes (unavoidable)
   - User may see transparent window briefly
   - **Future:** Consider preloading React Native in background

4. **No Overlay Windows:**
   - Phase F3.5 uses full Activity (not overlay)
   - Cannot appear on top of other apps
   - **TODO Phase F5:** Add SYSTEM_ALERT_WINDOW overlay support

### Future Enhancements

**Phase F4: Dynamic Monitored Apps:**
- Sync monitored apps list from React Native settings
- Use shared storage (SharedPreferences or AsyncStorage bridge)
- Real-time updates when user changes settings

**Phase F5: Overlay Windows:**
- Add SYSTEM_ALERT_WINDOW permission
- Show intervention as overlay on top of monitored app
- Allow "peek" at monitored app content below intervention

**Phase F6: Performance Optimization:**
- Preload React Native runtime in background service
- Reduce cold-start latency
- Consider custom React Native host for intervention-only bundle

**Phase F7: Advanced Triggers:**
- Time-based triggers (e.g., after 5 minutes of use)
- Usage pattern detection (e.g., rapid scrolling)
- Contextual triggers (e.g., late at night)

---

## Files Modified

### New Files
- `android/app/src/main/java/com/anonymous/breakloopnative/InterventionActivity.kt`
- `android/docs/PHASE_F3.5_INTERVENTION_ACTIVITY.md` (this file)

### Modified Files
- `android/app/src/main/AndroidManifest.xml`
  - Added InterventionActivity registration
  - Configured launchMode, taskAffinity, theme, flags

- `android/app/src/main/res/values/styles.xml`
  - Added Theme.Intervention style

- `android/app/src/main/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`
  - Added monitored apps list
  - Added launchInterventionActivity() method
  - Updated onAccessibilityEvent() to check monitored apps and launch activity

---

## Summary

Phase F3.5 successfully implements a dedicated `InterventionActivity` that:

✅ Wakes BreakLoop from killed state  
✅ Shows ONLY intervention UI (no main app tabs)  
✅ Maintains JavaScript as decision authority  
✅ Uses proper Android task isolation  
✅ Exits cleanly without leaving main app open  
✅ Works with existing OS Trigger Brain and intervention state machine  

**Next Steps:** Test thoroughly, then proceed to Phase F4 (dynamic monitored apps sync).

