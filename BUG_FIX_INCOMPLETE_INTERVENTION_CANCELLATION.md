# Bug Fix: Incomplete Intervention Not Cancelled on App Switch

**Date:** January 5, 2026  
**Status:** ✅ FIXED  
**Severity:** HIGH - Core functionality broken

---

## Problem Description

When a user is in the middle of an intervention (e.g., Root Cause screen) and switches away from the app (to home screen or another app), then returns to the monitored app, the intervention state is preserved instead of being cancelled and restarted.

**Expected Behavior (per spec):**
1. User opens Instagram → Breathing screen
2. Breathing completes → Root Cause screen
3. User switches to another app or home screen
4. **Intervention should be CANCELLED** (reset to idle)
5. User returns to Instagram
6. **Should:** Start NEW intervention from breathing screen (normal evaluation)

**Actual Behavior (BEFORE FIX):**
1. User opens Instagram → Breathing screen
2. Breathing completes → Root Cause screen
3. User switches away
4. User returns to Instagram
5. **Bug:** Root Cause screen still showing (intervention state preserved)

---

## Root Cause

The system was not detecting when a user "switched away" from an app with an incomplete intervention. The intervention state was preserved in React state, and when the user returned, the same screen was shown.

**Missing Logic:**
- No detection of "user switched away from app with incomplete intervention"
- No cancellation of incomplete interventions
- No reset to `idle` state when user abandons intervention

---

## The Fix

### Architecture

Added a **bidirectional connection** between OS Trigger Brain and React intervention state:

1. **State Getter:** OS Trigger Brain can now query current intervention state
2. **Incomplete Detection:** When user switches apps, check if previous app had incomplete intervention
3. **Cancellation:** If incomplete, dispatch `RESET_INTERVENTION` to reset state to `idle`
4. **Normal Flow:** When user returns, state is `idle` → normal evaluation applies

### Flow Diagram

```
User in Instagram (Root Cause screen)
         ↓
User switches to TikTok
         ↓
handleForegroundAppChange(TikTok)
         ↓
Check: Did Instagram have incomplete intervention? → YES
         ↓
Cancel intervention (dispatch RESET_INTERVENTION)
         ↓
Clear interventionsInProgress flag for Instagram
         ↓
Instagram state → idle
         ↓
(Later) User returns to Instagram
         ↓
State is idle → Normal evaluation
         ↓
Check t_intention → 0 (not set)
         ↓
Check n_quickTask → Show Quick Task dialog OR start intervention
```

---

## Implementation Details

### 1. Added State Getter Connection

**File:** `src/os/osTriggerBrain.ts`

```typescript
// New state getter variable
let interventionStateGetter: (() => { state: string; targetApp: string | null }) | null = null;

// New function to set the getter
export function setInterventionStateGetter(getter: () => { state: string; targetApp: string | null }): void {
  interventionStateGetter = getter;
  console.log('[OS Trigger Brain] Intervention state getter connected');
}
```

### 2. Added Incomplete Intervention Detection

**File:** `src/os/osTriggerBrain.ts`

```typescript
function hasIncompleteIntervention(packageName: string): boolean {
  if (!interventionStateGetter) {
    return false;
  }
  
  const { state, targetApp } = interventionStateGetter();
  
  // Check if this app has an intervention
  if (targetApp !== packageName) {
    return false;
  }
  
  // States that are "incomplete" (should be cancelled when user switches away)
  const incompleteStates = ['breathing', 'root-cause', 'alternatives', 'action', 'reflection'];
  
  return incompleteStates.includes(state);
}
```

**Incomplete States (cancelled when user switches away):**
- `breathing` - User hasn't finished breathing countdown
- `root-cause` - User hasn't selected causes
- `alternatives` - User hasn't chosen alternative
- `action` - User hasn't started activity
- `reflection` - User hasn't finished reflection

**Complete/Preserved States (NOT cancelled):**
- `action_timer` - User is doing alternative activity → preserve
- `timer` - User set t_intention → transitions to idle, app launches normally
- `idle` - No intervention active

### 3. Added Cancellation Function

**File:** `src/os/osTriggerBrain.ts`

```typescript
function cancelIncompleteIntervention(packageName: string): void {
  console.log('[OS Trigger Brain] Cancelling incomplete intervention for:', packageName);
  
  // Clear the in-progress flag
  interventionsInProgress.delete(packageName);
  
  // Dispatch RESET_INTERVENTION to reset state to idle
  interventionDispatcher({
    type: 'RESET_INTERVENTION',
  });
  
  console.log('[OS Trigger Brain] Incomplete intervention cancelled, state reset to idle');
}
```

### 4. Updated handleForegroundAppChange

**File:** `src/os/osTriggerBrain.ts` (Step 3, after launcher filtering)

Added detection logic:
```typescript
// Check if user switched away from an app with incomplete intervention
if (lastMeaningfulApp !== null && lastMeaningfulApp !== packageName) {
  // User switched from lastMeaningfulApp to packageName
  if (hasIncompleteIntervention(lastMeaningfulApp)) {
    console.log('[OS Trigger Brain] User switched away from app with incomplete intervention');
    cancelIncompleteIntervention(lastMeaningfulApp);
  }
}
```

### 5. Connected State Getter in App.tsx

**File:** `app/App.tsx`

Added new useEffect:
```typescript
useEffect(() => {
  setInterventionStateGetter(() => ({
    state: interventionState.state,
    targetApp: interventionState.targetApp,
  }));
}, [interventionState.state, interventionState.targetApp]);
```

Added import: `setInterventionStateGetter`

---

## Key Behavioral Changes

### Scenario 1: Incomplete Intervention (Root Cause)

**Before Fix:**
- User in Root Cause screen
- Switches to TikTok
- Returns to Instagram
- **Bug:** Root Cause screen still showing

**After Fix:**
- User in Root Cause screen
- Switches to TikTok → **Intervention cancelled, state → idle**
- Returns to Instagram
- **Fixed:** Normal evaluation → Quick Task dialog or new intervention from breathing

### Scenario 2: Alternative Activity (action_timer)

**Before and After (UNCHANGED - works correctly):**
- User doing alternative activity (action_timer state)
- Switches away
- Returns to Instagram
- **Correct:** Activity timer still showing (preserved, not cancelled)

### Scenario 3: Valid t_intention

**Before and After (UNCHANGED - works correctly):**
- User set t_intention for 5 minutes
- App launches, user uses Instagram
- Switches away (within 5 minutes)
- Returns to Instagram
- **Correct:** No intervention (t_intention still valid, suppressed)

---

## Testing Scenarios

### Test 1: Cancel incomplete intervention (Root Cause)
1. Open Instagram → Breathing → Root Cause screen
2. Switch to home or another app
3. Return to Instagram
4. **Expected:** Quick Task dialog or breathing screen (new intervention)
5. **Logs should show:** "User switched away from app with incomplete intervention" → "Incomplete intervention cancelled"

### Test 2: Cancel incomplete intervention (Alternatives)
1. Open Instagram → Complete breathing → Select causes → Alternatives screen
2. Switch away
3. Return to Instagram
4. **Expected:** Quick Task dialog or breathing screen

### Test 3: Preserve alternative activity
1. Open Instagram → Complete intervention → Start alternative activity (action_timer)
2. Switch away
3. Return to Instagram
4. **Expected:** Activity timer screen still showing (NOT cancelled)

### Test 4: Valid t_intention suppresses
1. Open Instagram → Set intention timer for 5 minutes
2. Instagram launches
3. Switch away (within 5 minutes)
4. Return to Instagram
5. **Expected:** No intervention (suppressed by valid t_intention)

### Test 5: Per-app independence
1. Instagram in Root Cause screen
2. Switch to TikTok
3. **Expected:** Instagram intervention cancelled, TikTok starts its own intervention

---

## Files Modified

1. **`src/os/osTriggerBrain.ts`**
   - Added `interventionStateGetter` variable
   - Added `setInterventionStateGetter()` export function
   - Added `hasIncompleteIntervention()` helper function
   - Added `cancelIncompleteIntervention()` helper function
   - Updated `handleForegroundAppChange()` Step 3 to detect and cancel incomplete interventions

2. **`app/App.tsx`**
   - Added `setInterventionStateGetter` import
   - Added useEffect to connect state getter (updates when state/targetApp changes)

---

## Compliance with Spec

✅ **Per OS Trigger Contract V1:**

**"When the intervention for a monitored app has already been started, need to monitor:**
- **If** when the intention timer (t_intention) is chosen and t_intention is not over, **or** the "alternative activity" is started
- **Then:** the intervention shall not be started
- **Else:** the intervention shall be started again"

**Our Implementation:**
- ✅ If t_intention is valid → suppress (don't start intervention)
- ✅ If alternative activity started (action_timer) → preserve (don't cancel)
- ✅ If incomplete intervention (breathing, root-cause, alternatives, action, reflection) → cancel when user switches away
- ✅ When user returns with idle state → normal evaluation (may start intervention)

---

## Native-JavaScript Boundary Compliance

✅ **Compliant with `docs/NATIVE_JAVASCRIPT_BOUNDARY.md`:**

- **Native (Kotlin):** Reports foreground app changes with timestamps
- **JavaScript:** Decides semantically what "switched away" means
- **JavaScript:** Decides to cancel incomplete interventions
- **JavaScript:** Manages all intervention state and timers

No changes needed to native code.

---

## Related Documentation

- `docs/NATIVE_JAVASCRIPT_BOUNDARY.md` - Native-JS boundary contract
- `docs/Trigger_logic_priority.md` - Trigger logic specification
- `spec/NATIVE_JAVASCRIPT_BOUNDARY.md` - Updated spec screenshots
- `BUG_FIX_INTENTION_TIMER_EXPIRY.md` - Previous bug fix (intention timer expiry)
