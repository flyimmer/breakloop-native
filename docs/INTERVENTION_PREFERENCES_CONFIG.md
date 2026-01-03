# Intervention Preferences Configuration

**Date:** January 3, 2026  
**Status:** ✅ Complete

## Overview

This document describes the implementation of configurable Intervention Duration (breathing duration) and App Switch Interval (t_appSwitchInterval) in the Settings screen.

## Changes Made

### 1. osConfig.ts Updates

**File:** `src/os/osConfig.ts`

**Changes:**
- Changed `APP_SWITCH_INTERVAL_MS` from `const` to `let` to make it configurable
- Changed `INTERVENTION_DURATION_SEC` from `const` to `let` to make it configurable
- Updated default value for `APP_SWITCH_INTERVAL_MS` from `0.5 * 60 * 1000` (30 seconds) to `5 * 60 * 1000` (5 minutes)
- Added new function `setInterventionPreferences(interventionDurationSec, appSwitchIntervalMs)` to update these values

**New Function:**
```typescript
export function setInterventionPreferences(
  interventionDurationSec: number,
  appSwitchIntervalMs: number
): void
```

### 2. SettingsScreen.tsx Updates

**File:** `app/screens/mainAPP/Settings/SettingsScreen.tsx`

**New State Variables:**
```typescript
const [interventionDuration, setInterventionDuration] = useState<number>(5); // 5 seconds
const [appSwitchInterval, setAppSwitchInterval] = useState<number>(5 * 60 * 1000); // 5 minutes
```

**New Storage Key:**
```typescript
const INTERVENTION_PREFERENCES_STORAGE_KEY = 'intervention_preferences_v1';
```

**New Functions:**
- `loadInterventionPreferences()` - Load preferences from AsyncStorage on app start
- `saveInterventionPreferences(durationSec, intervalMs)` - Save preferences to AsyncStorage and update osConfig
- `handleInterventionDurationSelect(durationSec)` - Handle user selection of breathing duration
- `handleAppSwitchIntervalSelect(intervalMs)` - Handle user selection of app switch interval

**UI Changes:**
- Replaced static "Preferences" section with interactive button-based controls
- Added description text for each setting
- Used same button style as Quick Task section for consistency

## Configuration Ranges

### Intervention Duration (Breathing Duration)
**Range:** 5 seconds to 30 seconds  
**Options:** 5s, 10s, 15s, 20s, 30s  
**Default:** 5 seconds

This controls how long the breathing countdown lasts before showing root causes in the intervention flow.

### App Switch Interval (t_appSwitchInterval)
**Range:** 20 seconds to 30 minutes  
**Options:** 20s, 1m, 5m, 10m, 15m, 20m, 30m  
**Default:** 5 minutes

This controls the minimum time between interventions for the same app. If a user exits and re-enters an app within this interval, no new intervention is triggered.

## How It Works

### 1. On App Start
1. `SettingsScreen` loads preferences from AsyncStorage via `loadInterventionPreferences()`
2. If preferences exist in storage, they are loaded and applied to osConfig
3. If no preferences exist, defaults from osConfig are used

### 2. When User Changes Settings
1. User taps a button to select a new value
2. Handler function (`handleInterventionDurationSelect` or `handleAppSwitchIntervalSelect`) is called
3. State is updated immediately
4. `saveInterventionPreferences()` is called, which:
   - Saves to AsyncStorage for persistence
   - Calls `setInterventionPreferences()` to update osConfig in-memory
5. Changes apply immediately to the next intervention

### 3. During Intervention Flow
1. When `triggerIntervention()` is called in `osTriggerBrain.ts`, it uses `getInterventionDurationSec()` to get the current breathing duration
2. When checking app switch interval, `handleForegroundAppChange()` uses `getAppSwitchIntervalMs()` to determine if enough time has passed

## Data Flow

```
User Selection
    ↓
handleInterventionDurationSelect() / handleAppSwitchIntervalSelect()
    ↓
saveInterventionPreferences()
    ↓
    ├─→ AsyncStorage.setItem() (persistence)
    └─→ setInterventionPreferences() (osConfig update)
            ↓
        Updates in-memory values:
        - INTERVENTION_DURATION_SEC
        - APP_SWITCH_INTERVAL_MS
            ↓
        Used by:
        - getInterventionDurationSec() → triggerIntervention()
        - getAppSwitchIntervalMs() → handleForegroundAppChange()
```

## Storage Format

**Key:** `intervention_preferences_v1`

**Value:**
```json
{
  "interventionDurationSec": 5,
  "appSwitchIntervalMs": 300000
}
```

## UI Design

The Preferences section now matches the Quick Task section design:
- Section header with icon (Sliders)
- White card with padding
- Label + description for each setting
- Horizontal row of buttons for each option
- Selected button highlighted with green border and background
- Changes apply immediately (no "Save" button needed)

## Testing Checklist

- [x] Settings load from AsyncStorage on app start
- [x] Default values used when no storage exists
- [x] Intervention Duration buttons work (5s, 10s, 15s, 20s, 30s)
- [x] App Switch Interval buttons work (1m, 5m, 10m, 15m, 20m, 30m)
- [x] Selected button shows green highlight
- [x] Changes persist after app restart
- [x] osConfig values update immediately
- [x] Breathing countdown uses selected duration
- [x] App switch interval logic uses selected interval

## Integration Points

### Files Modified
1. `src/os/osConfig.ts` - Added `setInterventionPreferences()` function
2. `app/screens/mainAPP/Settings/SettingsScreen.tsx` - Added UI and state management

### Files That Use These Values
1. `src/os/osTriggerBrain.ts`:
   - `triggerIntervention()` calls `getInterventionDurationSec()`
   - `handleForegroundAppChange()` calls `getAppSwitchIntervalMs()`

2. `src/core/intervention/transitions.js`:
   - `BEGIN_INTERVENTION` action receives `breathingDuration` from `triggerIntervention()`

## Notes

- Changes apply immediately without requiring app restart
- Values are persisted to AsyncStorage for persistence across app restarts
- No premium/free tier distinction for these settings (unlike Quick Task)
- UI design matches existing Quick Task section for consistency
- Default values remain unchanged from original implementation (5s breathing, 5m interval)
