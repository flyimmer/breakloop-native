# OS Trigger Logic - Contract V1 Update

**Date:** January 5, 2026  
**Change:** Removed `t_appSwitchInterval` concept per updated OS Trigger Contract V1  
**Status:** ✅ COMPLETED

---

## Summary

The OS Trigger Contract V1 has been updated to **remove the `t_appSwitchInterval` concept entirely**. The trigger logic is now simpler and based only on:

- **`t_intention`** (per-app) - Intention timer set by user
- **`t_quickTask`** (per-app) - Active Quick Task timer
- **`n_quickTask`** (global) - Quick Task usage count

---

## What Changed

### Removed Concept: `t_appSwitchInterval`

**Old Behavior (Contract V1.1):**
- Each app tracked its last exit timestamp
- If time since exit > interval (e.g., 5 minutes) → intervention starts directly
- `t_appSwitchInterval` had HIGHEST priority (even over `t_intention`)

**New Behavior (Contract V1):**
- No exit timestamp tracking
- No minimum interval between interventions
- Every monitored app entry evaluates the nested decision tree

---

## New Decision Tree

When a monitored app enters foreground:

```
1. Check t_intention for this app
   - If t_intention != 0 (valid): SUPPRESS everything
   - If t_intention = 0 (expired/not set): Go to step 2

2. Check n_quickTask (global count)
   - If n_quickTask != 0: Go to step 3
   - If n_quickTask = 0: START INTERVENTION

3. Check t_quickTask for this app
   - If t_quickTask != 0 (active): SUPPRESS everything
   - If t_quickTask = 0: SHOW QUICK TASK DIALOG
```

---

## Architecture Diagram

```
Monitored App Enters Foreground
         ↓
    [Heartbeat?] ─YES→ Skip (no action)
         ↓ NO
    evaluateTriggerLogic()
         ↓
    [t_intention valid?] ─YES→ SUPPRESS
         ↓ NO
    [n_quickTask > 0?]
         ↓ YES
    [t_quickTask active?] ─YES→ SUPPRESS
         ↓ NO
    showQuickTaskDialog()
         ↓ n_quickTask = 0
    startInterventionFlow()
    (delete t_intention, dispatch BEGIN_INTERVENTION)
```

---

## Per-App Isolation (Maintained)

**Per-App (Map<packageName, ...>):**
- `t_intention` - Each app has its own intention timer
- `t_quickTask` - Each app has its own Quick Task timer

**Global (shared):**
- `n_quickTask` - Usage count is global across all monitored apps

**Example:**
- Instagram has t_intention = 120s
- TikTok has NO t_intention
- User switches from Instagram to TikTok
- TikTok evaluates independently (Instagram's timer doesn't affect TikTok)

---

## Key Rules

1. **Every time intervention starts/restarts, `t_intention` for that app is deleted**
2. **When `t_intention` expires while user is in the app, intervention starts again**
3. **Quick Task does NOT create or extend `t_intention`**
4. **When Quick Task expires: `t_intention` reset to 0, show QuickTaskExpiredScreen**

---

## Files Modified

### Core Logic:
- `src/os/osTriggerBrain.ts`
  - Removed `lastMeaningfulExitTimestamps` Map
  - Removed `getAppSwitchIntervalMs()` import
  - Removed PRIORITY 1 block checking `t_appSwitchInterval`
  - Simplified `handleForegroundAppChange()` to call `evaluateTriggerLogic()` directly
  - Updated `evaluateTriggerLogic()` comments (now called for EVERY entry)
  - Added `clearIntentionTimer(packageName)` for targeted reset

### Configuration:
- `src/os/osConfig.ts`
  - Removed `APP_SWITCH_INTERVAL_MS` variable
  - Removed `getAppSwitchIntervalMs()` function
  - Updated `setInterventionPreferences()` to only take `interventionDurationSec`

### UI:
- `app/screens/conscious_process/QuickTaskExpiredScreen.tsx`
  - Changed from `resetTrackingState()` to `clearIntentionTimer(expiredApp)`
  - Only resets `t_intention` for the expired app (per spec)

- `app/screens/mainAPP/Settings/SettingsScreen.tsx`
  - Removed `appSwitchInterval` state
  - Removed "App Switch Interval" UI section
  - Updated `saveInterventionPreferences()` to only save duration

### Navigation:
- `app/App.tsx`
  - No changes needed - already follows correct priority chain

---

## Validation Checklist

- [x] `t_appSwitchInterval` removed from all code
- [x] Nested decision tree implemented correctly
- [x] `t_intention` deleted when intervention starts
- [x] Per-app isolation preserved (Maps keyed by packageName)
- [x] Global `n_quickTask` maintained
- [x] Quick Task expiry only resets `t_intention` (not all tracking state)
- [x] Settings UI updated (no App Switch Interval option)
- [x] Clear logging for each decision branch

---

## Related Documentation

- `NATIVE_JAVASCRIPT_BOUNDARY.md` - Native-JS boundary contract
- `spec/NATIVE_JAVASCRIPT_BOUNDARY.md` - Updated spec screenshots
