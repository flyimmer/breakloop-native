# Settings Specification

This document lists all settings currently implemented in the BreakLoop Android app, including default values and exact behavior impact.

---

## Settings Overview

Settings are stored in AsyncStorage and synced to native code where applicable. All settings take effect immediately without requiring app restart.

---

## 1. Monitored Apps

### Setting: Monitored Apps List

**Type**: Multi-select list  
**Default Value**: Empty (no apps monitored)  
**Storage Key**: `monitored_apps_v1`  
**Format**: JSON array of package names

**Example**:
```json
["com.instagram.android", "com.zhiliaoapp.musically", "com.twitter.android"]
```

**Behavior Impact**:
- Apps in this list trigger intervention/Quick Task flows when opened
- Apps not in this list are ignored by ForegroundDetectionService
- Changes sync immediately to native via `AppMonitorModule.setMonitoredApps()`
- Empty list = no monitoring (app is passive)

**Implementation**:
- **JS**: `src/os/osConfig.ts` → `setMonitoredApps()`
- **Native**: `ForegroundDetectionService.kt` → `updateMonitoredApps()`
- **UI**: `app/screens/mainAPP/Settings/SettingsScreen.tsx` → "Monitored Apps" section
- **Editor**: `app/screens/mainAPP/Settings/EditMonitoredAppsScreen.tsx`

**Validation**:
- Must be valid Android package names
- Duplicates are automatically removed
- System apps (e.g., `com.android.systemui`) are filtered out

---

## 2. Quick Task Settings

### Setting: Quick Task Duration (t_quickTask)

**Type**: Duration selector  
**Default Value**: `180000` ms (3 minutes)  
**Storage Key**: `quick_task_settings_v1` → `durationMs`  
**Range**: 10 seconds to 5 minutes (10000 - 300000 ms)

**Available Options**:
- 10 seconds (10000 ms)
- 30 seconds (30000 ms)
- 1 minute (60000 ms)
- 2 minutes (120000 ms)
- **3 minutes (180000 ms)** ← Default
- 5 minutes (300000 ms)

**Behavior Impact**:
- Determines how long the Quick Task timer runs after user confirms
- Timer starts when user taps "Quick Task" on QuickTaskDialogScreen
- Timer runs silently in background (no UI)
- When timer expires:
  - If user still in app → Show PostQuickTaskChoiceScreen
  - If user left app → Silent reset to IDLE (no UI)
- Duration is per-app configurable (each monitored app can have different duration)

**Implementation**:
- **JS**: `src/os/osConfig.ts` → `setQuickTaskConfig()`
- **Native**: `ForegroundDetectionService.kt` → `setQuickTaskDurationForApp()`
- **UI**: `app/screens/mainAPP/Settings/SettingsScreen.tsx` → "Quick Task Settings" section
- **Applied**: `ForegroundDetectionService.kt` → `onQuickTaskConfirmed()` → `entry.expiresAt = now + durationMs`

**Validation**:
- Clamped to range 1000-300000 ms
- Synced to native immediately on change
- Persisted to AsyncStorage

---

### Setting: Quick Task Uses Per Window (n_quickTask)

**Type**: Number selector  
**Default Value**: `1`  
**Storage Key**: `quick_task_settings_v1` → `usesPerWindow`  
**Range**: 1 to 10 (or -1 for unlimited in dev mode)

**Available Options**:
- **1** ← Default
- 2
- 3
- 5
- 10
- Unlimited (-1, dev only)

**Behavior Impact**:
- Determines how many Quick Tasks user can use before quota exhausted
- Quota resets when window expires (see Window Duration below)
- When quota = 0:
  - DecisionGate returns `START_INTERVENTION` instead of `START_QUICK_TASK`
  - User is forced into full intervention flow
- Quota is decremented when user confirms Quick Task (OFFERING → ACTIVE transition)
- Quota is NOT decremented if user declines or switches to intervention

**Implementation**:
- **JS**: `src/os/osConfig.ts` → `setQuickTaskConfig()`
- **Native**: `QuickTaskQuotaStore.kt` → `setMaxQuota()`
- **Native**: `ForegroundDetectionService.kt` → `setQuickTaskMaxQuota()`
- **UI**: `app/screens/mainAPP/Settings/SettingsScreen.tsx` → "Quick Task Settings" section
- **Applied**: `DecisionGate.kt` → `evaluate()` checks `qtRemaining`

**Validation**:
- Must be positive integer or -1
- Changes apply immediately (no need to wait for window reset)
- Persisted to DataStore (survives app restart)

---

### Setting: Quick Task Window Duration

**Type**: Duration selector  
**Default Value**: `900000` ms (15 minutes)  
**Storage Key**: `quick_task_settings_v1` → `windowDurationMs`  
**Range**: 15 minutes to 24 hours

**Available Options**:
- **15 minutes (900000 ms)** ← Default
- 1 hour (3600000 ms)
- 2 hours (7200000 ms)
- 4 hours (14400000 ms)
- 8 hours (28800000 ms)
- 24 hours (86400000 ms)

**Behavior Impact**:
- Determines how long until quota resets
- Window starts when first Quick Task is used
- When window expires:
  - Quota resets to max (e.g., 1 → 1)
  - New window starts on next Quick Task use
- Example: If set to 15 minutes and max quota is 1:
  - User uses Quick Task at 10:00 AM
  - Quota = 0 until 10:15 AM
  - At 10:15 AM, quota resets to 1

**Implementation**:
- **JS**: `src/os/osConfig.ts` → `setQuickTaskWindowDuration()`
- **Native**: `QuickTaskQuotaStore.kt` → `updateWindowDuration()`
- **Native**: `ForegroundDetectionService.kt` → `setQuickTaskWindowDuration()`
- **UI**: `app/screens/mainAPP/Settings/SettingsScreen.tsx` → "Quick Task Settings" section
- **Applied**: `QuickTaskQuotaStore.kt` → `refillIfNeeded()` checks window expiry

**Validation**:
- Must be valid duration in milliseconds
- Changes apply immediately
- Persisted to DataStore

---

### Setting: Premium Status

**Type**: Boolean flag  
**Default Value**: `true` (currently hardcoded for testing)  
**Storage Key**: `quick_task_settings_v1` → `isPremium`

**Behavior Impact**:
- If `false`: Quick Task duration and uses are locked to defaults
- If `true`: User can customize Quick Task settings
- Currently bypassed (all users treated as premium)

**Implementation**:
- **JS**: `src/os/osConfig.ts` → `getIsPremiumCustomer()`
- **UI**: `app/screens/mainAPP/Settings/SettingsScreen.tsx` → Shows "Premium Feature" alert if false

**Notes**:
- Future: Will be tied to actual premium subscription
- Current: Always `true` for development

---

## 3. Intervention Preferences

### Setting: Breathing Duration

**Type**: Duration selector  
**Default Value**: `5` seconds  
**Storage Key**: `intervention_preferences_v1` → `interventionDurationSec`  
**Range**: 5 to 30 seconds

**Available Options**:
- **5 seconds** ← Default
- 10 seconds
- 15 seconds
- 20 seconds
- 30 seconds

**Behavior Impact**:
- Determines how long the breathing countdown runs on BreathingScreen
- Countdown starts automatically when intervention begins
- User cannot skip or dismiss (must wait for countdown)
- When countdown reaches 0, auto-advances to RootCauseScreen

**Implementation**:
- **JS**: `src/os/osConfig.ts` → `setInterventionPreferences()`
- **JS**: `app/screens/conscious_process/BreathingScreen.tsx` → Uses `getInterventionDurationSec()`
- **UI**: `app/screens/mainAPP/Settings/SettingsScreen.tsx` → "Intervention Preferences" section
- **Applied**: `InterventionFlow.tsx` → `dispatchIntervention({ breathingDuration })`

**Validation**:
- Must be integer between 5 and 30
- Changes apply to next intervention (not current)
- Persisted to AsyncStorage

---

## 4. Social Privacy Settings

### Setting: Share Current Activity

**Type**: Boolean toggle  
**Default Value**: `true`  
**Storage Key**: Not yet implemented (UI only)

**Behavior Impact**:
- If `true`: Friends can see what alternative activity you're currently doing
- If `false`: Current activity is hidden from friends

**Implementation**:
- **UI**: `app/screens/mainAPP/Settings/SettingsScreen.tsx` → "Social Privacy" section
- **Status**: UI only, no backend integration yet

---

### Setting: Share Upcoming Activities

**Type**: Boolean toggle  
**Default Value**: `false`  
**Storage Key**: Not yet implemented (UI only)

**Behavior Impact**:
- If `true`: Friends can see your planned alternative activities
- If `false`: Upcoming activities are hidden from friends

**Implementation**:
- **UI**: `app/screens/mainAPP/Settings/SettingsScreen.tsx` → "Social Privacy" section
- **Status**: UI only, no backend integration yet

---

### Setting: Share Recent Mood

**Type**: Boolean toggle  
**Default Value**: `true`  
**Storage Key**: Not yet implemented (UI only)

**Behavior Impact**:
- If `true`: Friends can see your recent mood/reflection entries
- If `false`: Mood data is hidden from friends

**Implementation**:
- **UI**: `app/screens/mainAPP/Settings/SettingsScreen.tsx` → "Social Privacy" section
- **Status**: UI only, no backend integration yet

---

### Setting: Share Alternatives List

**Type**: Boolean toggle  
**Default Value**: `true`  
**Storage Key**: Not yet implemented (UI only)

**Behavior Impact**:
- If `true`: Friends can see your list of alternative activities
- If `false`: Alternatives list is hidden from friends

**Implementation**:
- **UI**: `app/screens/mainAPP/Settings/SettingsScreen.tsx` → "Social Privacy" section
- **Status**: UI only, no backend integration yet

---

## 5. Profile Settings

### Setting: Display Name

**Type**: Text input  
**Default Value**: Empty  
**Storage Key**: Not yet implemented (UI only)

**Behavior Impact**:
- Shown to friends in social features
- Used in intervention screens (e.g., "Return to [App]")

**Implementation**:
- **UI**: `app/screens/mainAPP/Settings/SettingsScreen.tsx` → "My Profile" section
- **Status**: UI only, no backend integration yet

---

### Setting: Profile Photo

**Type**: Image picker  
**Default Value**: None (placeholder icon)  
**Storage Key**: Not yet implemented (UI only)

**Behavior Impact**:
- Shown to friends in social features
- Displayed in profile section

**Implementation**:
- **UI**: `app/screens/mainAPP/Settings/SettingsScreen.tsx` → "My Profile" section
- **Status**: UI only, no backend integration yet

---

## 6. System Settings

### Setting: Accessibility Service Status

**Type**: Read-only status indicator  
**Default Value**: N/A (system-determined)

**Behavior Impact**:
- If enabled: App can monitor foreground apps and trigger interventions
- If disabled: App cannot detect monitored apps (core functionality broken)

**Implementation**:
- **Native**: `AppMonitorModule.kt` → `isAccessibilityServiceEnabled()`
- **UI**: `app/screens/mainAPP/Settings/SettingsScreen.tsx` → Shows status and "Enable" button
- **Status**: Fully functional

**User Action**:
- Tap "Enable Accessibility Service" button
- Opens Android Settings → Accessibility
- User must manually enable "BreakLoop" service

---

## Settings Sync Behavior

### JS → Native Sync

**When**: Immediately on settings change  
**How**: Native module calls via bridge

**Synced Settings**:
1. Monitored Apps → `AppMonitorModule.setMonitoredApps()`
2. Quick Task Duration → `AppMonitorModule.setQuickTaskDurationForApp()`
3. Quick Task Max Quota → `AppMonitorModule.setQuickTaskQuotaPer15m()`
4. Quick Task Window Duration → `AppMonitorModule.setQuickTaskWindowDuration()`

**Not Synced** (JS-only):
- Intervention breathing duration (read by JS at intervention start)
- Social privacy toggles (not yet implemented)
- Profile settings (not yet implemented)

---

### Persistence

**AsyncStorage** (JS):
- `monitored_apps_v1`: Monitored apps list
- `quick_task_settings_v1`: Quick Task config (duration, uses, window, premium)
- `intervention_preferences_v1`: Intervention config (breathing duration)

**DataStore** (Native):
- `QuickTaskQuotaStore`: Quota state (remaining, windowStart, maxPerWindow)
- `MonitoredAppsStore`: Monitored apps list (synced from JS)
- `IntentionStore`: Intention timers per app

**Sync Direction**:
- AsyncStorage → DataStore (on settings change)
- DataStore → AsyncStorage (never, DataStore is source of truth for runtime state)

---

## Default Configuration Summary

| Setting | Default Value | Unit | Configurable |
|---------|---------------|------|--------------|
| Monitored Apps | Empty | - | Yes |
| Quick Task Duration | 180000 | ms | Yes |
| Quick Task Uses Per Window | 1 | count | Yes |
| Quick Task Window Duration | 900000 | ms | Yes |
| Premium Status | true | boolean | No (hardcoded) |
| Breathing Duration | 5 | seconds | Yes |
| Share Current Activity | true | boolean | Yes (UI only) |
| Share Upcoming Activities | false | boolean | Yes (UI only) |
| Share Recent Mood | true | boolean | Yes (UI only) |
| Share Alternatives List | true | boolean | Yes (UI only) |

---

## Settings Impact Matrix

| Setting | Affects | Applied When | Persisted Where |
|---------|---------|--------------|-----------------|
| Monitored Apps | DecisionGate entry check | App entry detection | AsyncStorage + DataStore |
| Quick Task Duration | Timer expiry time | Quick Task confirmation | AsyncStorage + Native cache |
| Quick Task Uses | DecisionGate quota check | App entry detection | AsyncStorage + DataStore |
| Quick Task Window | Quota refill logic | Quota check | AsyncStorage + DataStore |
| Breathing Duration | Breathing countdown | Intervention start | AsyncStorage |
| Social Privacy | Friend visibility | Social feature access | Not persisted yet |
| Profile | Friend display | Social feature access | Not persisted yet |

---

## Implementation References

### File Locations

**Settings UI**:
- `app/screens/mainAPP/Settings/SettingsScreen.tsx` - Main settings screen
- `app/screens/mainAPP/Settings/EditMonitoredAppsScreen.tsx` - App selector

**JS Configuration**:
- `src/os/osConfig.ts` - Central config store and setters

**Native Modules**:
- `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt` - Bridge to native
- `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt` - Runtime state
- `plugins/src/android/java/com/anonymous/breakloopnative/QuickTaskQuotaStore.kt` - Quota persistence
- `plugins/src/android/java/com/anonymous/breakloopnative/MonitoredAppsStore.kt` - App list persistence
- `plugins/src/android/java/com/anonymous/breakloopnative/IntentionStore.kt` - Intention persistence

---

## Notes

- All settings changes take effect **immediately** (no restart required)
- Settings are **persisted** across app restarts and service crashes
- Native settings are **synced** from JS on every change
- Social and profile settings are **UI placeholders** (not yet functional)
- Premium status is **hardcoded to true** for development
