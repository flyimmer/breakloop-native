# Quick Task Time-of-Truth Fix

## Problem Summary

**Root Cause:** Time-of-truth vs time-of-evaluation bug

The system was checking "where is the user now" instead of "where was the user at the exact moment the timer expired."

### Wrong Behavior (Before Fix)

```
User starts Quick Task on Instagram (2 min timer)
  ↓
User goes to Home screen (briefly)
  ↓
User returns to Instagram
  ↓
Timer expires while user is on Instagram
  ↓
❌ System re-evaluates foreground app LATER
❌ expiredWhileForeground computed incorrectly
❌ expiredQuickTasks flag not set properly
  ↓
Decision Engine falls through to OS Trigger Brain
  ↓
❌ WRONG: Quick Task dialog appears again
```

### Correct Behavior (After Fix)

```
User starts Quick Task on Instagram (2 min timer)
  ↓
User goes to Home screen (briefly)
  ↓
User returns to Instagram
  ↓
Timer expires while user is on Instagram
  ↓
✅ System captures currentForegroundApp at TIMER_EXPIRED time
✅ expiredWhileForeground = (foregroundAtExpiration === packageName)
✅ Persists this immutable fact in expiredQuickTasks
  ↓
Decision Engine Priority #1 check
  ↓
✅ CORRECT: POST_QUICK_TASK_CHOICE screen appears
```

## The Core Rule (Non-Negotiable)

> **Foreground app at TIMER_EXPIRED time is the single source of truth.**
> 
> **This value must be captured immediately and never recomputed.**

## Implementation Changes

### 1. State Manager (`stateManager.ts`)

**Added to `TimerState` interface:**
```typescript
currentForegroundApp?: string | null;  // Current foreground app (for time-of-truth capture)
```

**Updated `expiredQuickTasks` structure:**
```typescript
expiredQuickTasks: Record<string, {
  expiredAt: number;
  expiredWhileForeground: boolean;
  foregroundAppAtExpiration?: string | null;  // NEW: Captured at TIMER_EXPIRED
}>
```

### 2. Event Handler (`eventHandler.ts`)

**A. `handleForegroundChange()` - Maintain current foreground:**
```typescript
// CRITICAL: Update currentForegroundApp FIRST (for time-of-truth capture)
state.currentForegroundApp = packageName;
state.lastMeaningfulApp = packageName;
```

**B. `handleTimerExpiration()` - Capture truth at expiration:**
```typescript
// TIME-OF-TRUTH CAPTURE: Read foreground app at TIMER_EXPIRED time
const foregroundAtExpiration = state.currentForegroundApp || state.lastMeaningfulApp;

console.log('[SystemBrain] TIMER_EXPIRED captured foreground', {
  packageName,
  foregroundAtExpiration,
  note: 'This is the time-of-truth - will NOT be re-evaluated',
});

// Persist immutable fact
state.expiredQuickTasks[packageName] = {
  expiredAt: timestamp,
  expiredWhileForeground: foregroundAtExpiration === packageName,
  foregroundAppAtExpiration: foregroundAtExpiration,
};
```

### 3. Decision Engine (`decisionEngine.ts`)

**No changes needed** - Priority #1 check already correctly uses the persisted `expiredWhileForeground` flag.

Enhanced logging to show captured foreground app for debugging.

## Key Architectural Principle

**Time-based rules must capture truth at the time they occur.**

Re-evaluating later will always produce bugs because:
- State is dynamic
- User behavior is unpredictable
- Timing windows create ambiguity

The fix separates:
- **Measurement** (at TIMER_EXPIRED time)
- **Reaction** (at USER_INTERACTION_FOREGROUND time)

## Acceptance Criteria

✅ Start Quick Task on Instagram  
✅ During 2 minutes: go Home → return to Instagram  
✅ Timer expires while Instagram is foreground  
✅ POST_QUICK_TASK_CHOICE appears  
✅ Quick Task dialog does NOT appear  
✅ Behavior is deterministic  

## Testing Scenarios

### Scenario 1: Foreground Expiration (Primary Bug Fix)
1. Start Quick Task on Instagram (2 min)
2. During timer: Home → Instagram → Home → Instagram
3. Timer expires while on Instagram
4. **Expected:** POST_QUICK_TASK_CHOICE screen
5. **Previous bug:** Quick Task dialog appeared

### Scenario 2: Background Expiration (Should Still Work)
1. Start Quick Task on Instagram (2 min)
2. Switch to different app (not Home)
3. Timer expires while on other app
4. Return to Instagram
5. **Expected:** Quick Task dialog OR Intervention (based on n_quickTask)

### Scenario 3: Edge Case - Rapid App Switching
1. Start Quick Task on Instagram (2 min)
2. Rapidly switch: Instagram → Home → Instagram → Home → Instagram
3. Timer expires during one of the Instagram moments
4. **Expected:** POST_QUICK_TASK_CHOICE if expired on Instagram
5. **Expected:** Silent cleanup if expired on Home

## Logging Verification

Look for these log patterns to verify correct behavior:

```
[SystemBrain] TIMER_EXPIRED captured foreground
  packageName: "com.instagram.android"
  foregroundAtExpiration: "com.instagram.android"
  note: "This is the time-of-truth - will NOT be re-evaluated"

[Decision Engine] 🚨 PRIORITY #1: Expired Quick Task (foreground)
  Captured foreground at expiration:
    app: "com.instagram.android"
    foregroundAppAtExpiration: "com.instagram.android"
    note: "Time-of-truth captured at TIMER_EXPIRED"
```

## Migration Notes

- Old `expiredQuickTasks` entries without `foregroundAppAtExpiration` will still work
- The field is optional for backward compatibility
- New expirations will always include the captured foreground app

## Final Anchor Rule

> **This is the last missing semantic correction in the Quick Task flow.**
> 
> After this change, Quick Task expiration is **semantically correct end-to-end**.

---

**Date:** January 9, 2026  
**Fix Type:** Semantic bug fix (time-of-truth vs time-of-evaluation)  
**Impact:** High - Fixes primary user-reported bug  
**Risk:** Low - Additive change, no breaking modifications  
