# OS Trigger Logic Refactor Summary

**Date:** January 3, 2026  
**Issue:** OS Trigger Brain implementation had wrong priority order and flat logic instead of nested structure  
**Status:** ✅ COMPLETED

---

## Problem Summary

The original implementation in `osTriggerBrain.ts` violated the OS Trigger Contract specification in multiple ways:

### Issues Fixed:

1. ❌ **Wrong Priority Order:** t_quickTask checked before t_appSwitchInterval
   - **Spec:** t_appSwitchInterval has HIGHER priority than t_intention
   - **Was:** Checked Quick Task timer first, then intention timer, then app switch interval
   - **Now:** Checks app switch interval FIRST, then applies nested logic

2. ❌ **Flat Priority Chain Instead of Nested Logic**
   - **Spec:** Nested decision tree (if t_intention=0 → if n_quickTask!=0 → if t_quickTask!=0)
   - **Was:** Flat priority chain (check 1, check 2, check 3, check 4, else 5)
   - **Now:** Proper nested structure matching spec

3. ❌ **t_intention Not Deleted on Intervention Start**
   - **Spec:** "Every time intervention flow starts, t_intention SHALL be deleted"
   - **Was:** Deleted in triggerIntervention() but not consistently
   - **Now:** Always deleted in startInterventionFlow()

4. ❌ **Expired t_intention Triggered Intervention Directly**
   - **Spec:** When t_intention expires, should re-evaluate nested logic
   - **Was:** Called triggerIntervention() directly
   - **Now:** Calls evaluateTriggerLogic() to respect priority chain

---

## Changes Made

### 1. New Helper Functions

#### `startInterventionFlow(packageName, timestamp)`
- Extracted intervention start logic from old `triggerIntervention()`
- Handles cross-app interference prevention
- Deletes t_intention (per spec)
- Dispatches BEGIN_INTERVENTION action

#### `showQuickTaskDialog(packageName, remaining)`
- Extracted Quick Task dialog logic
- Dispatches SHOW_QUICK_TASK action
- Clean separation of concerns

#### `evaluateTriggerLogic(packageName, timestamp)`
- **NEW:** Implements nested decision tree per spec
- Called when t_appSwitchInterval NOT elapsed
- Nested structure:
  1. Check t_intention → suppress if valid
  2. If t_intention = 0:
     - Check n_quickTask
       - If != 0: Check t_quickTask
         - If active: suppress
         - If = 0: show Quick Task dialog
       - If = 0: start intervention

### 2. Refactored `handleForegroundAppChange()`

**Old Flow:**
```
1. Check Quick Task timer → suppress if active
2. Check intention timer → suppress if valid, trigger if expired
3. Check app switch interval → trigger if elapsed
```

**New Flow:**
```
1. Clean up expired timers (Quick Task, intention)
2. Skip heartbeat events (same app)
3. Check t_appSwitchInterval (HIGHEST PRIORITY)
   - If ELAPSED → startInterventionFlow() directly
   - If NOT elapsed → evaluateTriggerLogic()
```

### 3. Updated `checkForegroundIntentionExpiration()`

**Old Behavior:**
- When t_intention expired for foreground app → called `triggerIntervention()`

**New Behavior:**
- When t_intention expired for foreground app → calls `evaluateTriggerLogic()`
- Respects nested priority chain (checks n_quickTask, t_quickTask)

---

## Architecture Diagram

```
Monitored App Enters Foreground
         ↓
    [Heartbeat?] ─YES→ Skip (no action)
         ↓ NO
    [t_appSwitchInterval elapsed?]
         ↓ YES
    startInterventionFlow()
    (delete t_intention, dispatch BEGIN_INTERVENTION)
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
```

---

## Per-App Isolation (Preserved)

The refactor maintains proper per-app isolation:

**Per-App (Map<packageName, ...>):**
- `t_intention` - Each app has its own intention timer
- `t_quickTask` - Each app has its own Quick Task timer
- `t_appSwitchInterval` - Each app tracks its own exit timestamp

**Global (shared):**
- `n_quickTask` - Usage count is global across all monitored apps

**Example:**
- Instagram has t_intention = 120s
- TikTok has NO t_intention
- User switches from Instagram to TikTok
- TikTok evaluates independently (Instagram's timer doesn't affect TikTok)

---

## Key Behavioral Changes

### Change 1: t_appSwitchInterval Takes Priority

**Before:**
- User opens Instagram after 6 minutes (interval elapsed)
- But has valid t_intention (30s remaining)
- Result: Suppressed (t_intention took priority)

**After:**
- User opens Instagram after 6 minutes (interval elapsed)
- Has valid t_intention (30s remaining)
- Result: Intervention starts (t_appSwitchInterval takes priority)
- t_intention deleted

### Change 2: Nested Logic When Interval NOT Elapsed

**Before:**
- User opens Instagram after 1 minute (interval NOT elapsed)
- No t_intention, no t_quickTask, but n_quickTask = 1
- Result: Intervention started (Quick Task dialog skipped)

**After:**
- User opens Instagram after 1 minute (interval NOT elapsed)
- No t_intention, no t_quickTask, but n_quickTask = 1
- Result: Quick Task dialog shown (nested logic respected)

### Change 3: Expired t_intention Re-evaluates Logic

**Before:**
- User in Instagram with t_intention
- t_intention expires while user still in app
- Result: Intervention starts immediately

**After:**
- User in Instagram with t_intention
- t_intention expires while user still in app
- Result: Re-evaluates nested logic (checks n_quickTask, t_quickTask)
- May show Quick Task dialog if available

---

## Testing Recommendations

See `OS_TRIGGER_LOGIC_TEST_SCENARIOS.md` for comprehensive test scenarios.

**Critical Scenarios to Test:**

1. **First Launch** - Intervention starts immediately
2. **Re-entry Within Interval** - Nested logic applied
3. **Re-entry After Interval** - Intervention starts (bypasses nested logic)
4. **Quick Task Available** - Dialog shown when appropriate
5. **Quick Task Active** - Suppresses intervention
6. **Per-App Isolation** - Instagram timer doesn't affect TikTok
7. **t_intention Expires In-App** - Re-evaluates logic
8. **Global n_quickTask** - Using on Instagram affects TikTok quota

---

## Files Modified

- `src/os/osTriggerBrain.ts` - Main logic refactor
  - Added: `startInterventionFlow()` (58 lines)
  - Added: `showQuickTaskDialog()` (23 lines)
  - Added: `evaluateTriggerLogic()` (68 lines)
  - Modified: `handleForegroundAppChange()` - Restructured monitored app logic (lines 566-680)
  - Modified: `checkForegroundIntentionExpiration()` - Uses evaluateTriggerLogic() (line 1010)
  - Removed: Old `triggerIntervention()` flat priority chain

---

## Validation Checklist

- [x] t_appSwitchInterval checked FIRST (highest priority)
- [x] Nested decision tree implemented correctly
- [x] t_intention deleted when intervention starts
- [x] Per-app isolation preserved (Maps keyed by packageName)
- [x] Global n_quickTask maintained
- [x] Expired t_intention re-evaluates logic (not direct intervention)
- [x] Clear logging for each decision branch
- [x] Cross-app interference prevention maintained

---

## Related Documentation

- `NATIVE_JAVASCRIPT_BOUNDARY.md` - Native-JS boundary contract
- `OS_TRIGGER_LOGIC_TEST_SCENARIOS.md` - Comprehensive test scenarios
- `spec/Intervention_OS_Contract.docx` - Original specification (screenshots)
