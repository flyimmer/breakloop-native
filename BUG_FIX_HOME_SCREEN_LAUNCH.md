# Bug Fix: Home Screen Launch After Cancelled Intervention

**Date:** January 5, 2026  
**Status:** ✅ FIXED  
**Severity:** CRITICAL - App immediately exits when opened

---

## Problem Description

When opening Instagram (or any monitored app), the app immediately exits to the home screen. The user cannot use the app at all.

**What Happened:**
1. User opens Instagram
2. BreakLoop intervention starts (breathing screen)
3. BreakLoop app comes to foreground
4. JavaScript detects "user switched away from Instagram"
5. Cancels Instagram's incomplete intervention
6. State goes to `idle`
7. **BUG:** Code calls `launchHomeScreen()` immediately
8. Instagram exits to home screen

**Root Cause:**
The code couldn't distinguish between:
- **Cancelled intervention** (incomplete, user switched away) → Should NOT launch home screen
- **Completed intervention** (user finished all steps) → Should launch home screen

Both resulted in `state = 'idle'`, but the code always launched home screen when `intentionTimerSet = false`.

---

## The Solution

**Remove `wasCanceled` flag** (redundant, never used in logic)  
**Add `wasCompleted` flag** (explicitly tracks normal completion)

### New State Flags

```javascript
{
  wasCompleted: false,   // Intervention completed normally (all steps done)
  intentionTimerSet: false  // User chose to use app with intention timer
}
```

### New Logic (Simple & Clear)

```typescript
if (wasCompleted && !intentionTimerSet) {
  // Intervention completed normally → Launch home screen
  launchHomeScreen();
} else {
  // All other cases → Just finish activity
  finishInterventionActivity();
}
```

---

## Implementation Details

### File 1: `src/core/intervention/state.js`

**Removed `wasCanceled`, added `wasCompleted`:**

```javascript
export const createInitialInterventionContext = () => ({
  state: 'idle',
  targetApp: null,
  breathingCount: 3,
  selectedCauses: [],
  selectedAlternative: null,
  actionTimer: 0,
  wasCompleted: false,  // NEW: Track normal completion
  intentionTimerSet: false,
  // REMOVED: wasCanceled (redundant)
});
```

### File 2: `src/core/intervention/transitions.js`

**Updated all actions to remove `wasCanceled` and set `wasCompleted` appropriately:**

**BEGIN_INTERVENTION:**
```javascript
wasCompleted: false,  // Clear completed flag
// REMOVED: wasCanceled
```

**FINISH_REFLECTION (normal completion):**
```javascript
wasCompleted: true,  // Mark as completed
// REMOVED: wasCanceled
```

**RESET_INTERVENTION (cancelled):**
```javascript
wasCompleted: false,  // Not completed (was cancelled)
// REMOVED: wasCanceled
```

**SET_INTENTION_TIMER:**
```javascript
wasCompleted: false,  // Not completed (chose intention timer)
// REMOVED: wasCanceled
```

### File 3: `app/App.tsx`

**Replaced complex logic with simple `wasCompleted` check:**

**BEFORE (BROKEN):**
```typescript
if (intentionTimerSet && appToLaunch) {
  finishInterventionActivity();
} else {
  launchHomeScreen();  // ❌ WRONG for cancelled interventions!
}
```

**AFTER (FIXED):**
```typescript
const wasCompleted = interventionState.wasCompleted;

if (wasCompleted && !intentionTimerSet) {
  // Intervention completed normally → Launch home screen
  launchHomeScreen();
} else {
  // All other cases → Just finish activity
  finishInterventionActivity();
}
```

---

## State Transition Examples

### Example 1: Normal Completion

```
BEGIN_INTERVENTION → breathing → root-cause → alternatives → action → action_timer → reflection → FINISH_REFLECTION
Result: wasCompleted = true
Action: Launch home screen
```

### Example 2: Cancelled (User Switched Away)

```
BEGIN_INTERVENTION → breathing → root-cause → RESET_INTERVENTION (user switched away)
Result: wasCompleted = false
Action: Finish activity (don't launch home)
```

### Example 3: Intention Timer Chosen

```
BEGIN_INTERVENTION → breathing → root-cause → alternatives → PROCEED_TO_TIMER → SET_INTENTION_TIMER
Result: wasCompleted = false, intentionTimerSet = true
Action: Finish activity and launch target app
```

---

## Decision Tree

```
Intervention completes (state → idle)
  ↓
Was intervention completed normally? (wasCompleted)
  ↓
  YES → Was intention timer set? (intentionTimerSet)
    ↓
    YES → finishInterventionActivity() (launch target app)
    ↓
    NO → launchHomeScreen() (intervention done, go to home)
  ↓
  NO → finishInterventionActivity() (cancelled or other case)
```

---

## Testing Scenarios

### Test 1: Cancelled intervention (Opening Instagram)
**Before Fix:**
- Open Instagram → Breathing screen → BreakLoop comes to foreground
- Intervention cancelled → Immediately exits to home screen ❌

**After Fix:**
- Open Instagram → Breathing screen → BreakLoop comes to foreground
- Intervention cancelled → Just finishes activity, Instagram stays/reopens ✅

### Test 2: Normal completion
- Complete full intervention (breathing → causes → alternatives → action → reflection)
- wasCompleted = true
- Should: Launch home screen ✅

### Test 3: Intention timer
- Choose "I really need to use it" → Set intention timer
- wasCompleted = false, intentionTimerSet = true
- Should: Launch target app ✅

---

## Key Benefits

1. **Simpler state** - Only 2 flags instead of 3
2. **Clearer logic** - Explicit "was completed?" check
3. **No redundancy** - Removed unused `wasCanceled` flag
4. **Easier to understand** - Positive flag (`wasCompleted`) instead of negative (`wasCanceled`)

---

## Files Modified

1. **`src/core/intervention/state.js`**
   - Removed `wasCanceled` from initial state
   - Added `wasCompleted` flag

2. **`src/core/intervention/transitions.js`**
   - Removed `wasCanceled` from all actions
   - Set `wasCompleted = true` in FINISH_REFLECTION
   - Set `wasCompleted = false` in BEGIN_INTERVENTION, RESET_INTERVENTION, SET_INTENTION_TIMER

3. **`app/App.tsx`**
   - Removed `wasCanceled` references
   - Added `wasCompleted` check
   - Simplified decision logic: if completed and no intention timer → home screen, else → finish activity

---

## Related Issues

This fix is related to the launcher incomplete intervention fix:
- **Launcher fix:** Made Kotlin emit events for ALL apps (including launchers)
- **This fix:** Made JavaScript correctly handle cancelled interventions

Together, these fixes ensure:
- Incomplete interventions are cancelled when user switches away
- Cancelled interventions don't incorrectly launch home screen
- App can be opened and used normally

---

**All implementation completed successfully on January 5, 2026.**
