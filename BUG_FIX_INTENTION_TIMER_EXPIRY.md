# Bug Fix: Intention Timer Expiry Not Triggering Intervention

**Date:** January 5, 2026  
**Status:** ✅ FIXED  
**Severity:** HIGH - Core functionality broken

---

## Problem Description

When a user sets an intention timer (e.g., "I want to use Instagram for 1 minute") and stays in the app, after the timer expires, the system shows the "Set Intention Timer" screen again instead of restarting the intervention from the breathing screen.

**Expected Behavior:**
- User sets intention timer for 1 minute
- User stays in Instagram
- After 1 minute, timer expires
- **Should:** Start new intervention from breathing screen

**Actual Behavior:**
- User sets intention timer for 1 minute  
- User stays in Instagram
- After 1 minute, timer expires
- **Bug:** Shows "Set Intention Timer" screen again (wrong screen)

---

## Root Cause

The bug was in `handleForegroundAppChange()` in `src/os/osTriggerBrain.ts`.

**The Issue:**
1. When Instagram enters foreground (heartbeat event from accessibility service)
2. System detects intention timer expired (lines 620-631)
3. System deletes the expired timer
4. System hits heartbeat check (lines 636-640)
5. **BUG:** Returns early, skipping `evaluateTriggerLogic()`
6. No intervention is triggered!

**Code Flow (BEFORE FIX):**
```
handleForegroundAppChange(Instagram)
  ↓
Check intention timer → EXPIRED → Delete timer
  ↓
Check if heartbeat (same app) → YES → RETURN EARLY ❌
  ↓
(Never reaches evaluateTriggerLogic)
```

---

## The Fix

Modified the heartbeat detection logic to allow processing when intention timer just expired.

**File:** `src/os/osTriggerBrain.ts` (lines 617-650)

**Key Changes:**

1. **Track if timer just expired:**
   ```typescript
   const intentionJustExpired = intentionTimer && timestamp > intentionTimer.expiresAt;
   ```

2. **Modified heartbeat check:**
   ```typescript
   if (lastMeaningfulApp === packageName && !intentionJustExpired) {
     // Skip heartbeat UNLESS timer just expired
     return;
   }
   ```

3. **Added logging:**
   ```typescript
   if (lastMeaningfulApp === packageName && intentionJustExpired) {
     console.log('[OS Trigger Brain] Heartbeat event BUT intention timer just expired - will re-evaluate logic');
   }
   ```

**Code Flow (AFTER FIX):**
```
handleForegroundAppChange(Instagram)
  ↓
Check intention timer → EXPIRED → Delete timer, set flag
  ↓
Check if heartbeat (same app) → YES, but timer just expired → CONTINUE ✅
  ↓
evaluateTriggerLogic() → START INTERVENTION
```

---

## Testing

**Test Scenario:**
1. Open Instagram (monitored app)
2. Complete breathing countdown
3. Select root causes
4. Choose "I really need to use it"
5. Set intention timer for 1 minute
6. Stay in Instagram for 1 minute
7. **Expected:** After 1 minute, breathing screen appears (new intervention starts)

**Verification:**
- ✅ Intention timer expires correctly
- ✅ `evaluateTriggerLogic()` is called
- ✅ New intervention starts from breathing screen
- ✅ No "Set Intention Timer" screen shown

---

## Related Code

**Files Modified:**
- `src/os/osTriggerBrain.ts` - Fixed heartbeat detection logic

**Related Functions:**
- `handleForegroundAppChange()` - Entry point for app changes
- `evaluateTriggerLogic()` - Decides intervention vs Quick Task
- `checkForegroundIntentionExpiration()` - Periodic check (also calls evaluateTriggerLogic)

**Note:** The periodic check in `checkForegroundIntentionExpiration()` was working correctly and calling `evaluateTriggerLogic()`. The bug was specifically in the heartbeat detection logic that prevented the intervention from triggering when the app was already in foreground.

---

## Impact

**Before Fix:**
- Users could not use intention timers properly
- Timer would expire but no intervention would start
- User would see wrong screen (IntentionTimer screen again)

**After Fix:**
- Intention timers work as designed
- When timer expires, new intervention starts from breathing screen
- Correct user experience per spec

---

## Related Documentation

- `docs/Trigger_logic_priority.md` - Trigger logic specification
- `docs/OS_TRIGGER_LOGIC_TEST_SCENARIOS.md` - Test scenarios (Scenario 3)
- `spec/NATIVE_JAVASCRIPT_BOUNDARY.md` - Updated spec screenshots
