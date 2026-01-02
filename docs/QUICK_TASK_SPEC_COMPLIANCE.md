# Quick Task Spec Compliance Check

**Date:** December 30, 2025  
**Purpose:** Verify implementation matches OS Trigger Contract specification

## Spec Requirements vs Implementation

### ✅ Requirement 1: Intervention Suppression Rules

**Spec:** "When the intervention for a monitored app is started, need to monitor if:"

#### 1a. Intention Timer (t_intention) Suppression

**Spec:** "when the intention timer (t_intention) is chosen"
- Then: the intervention shall not be started

**Implementation:** ✅ **CORRECT**
```typescript
// File: src/os/osTriggerBrain.ts, lines 525-565
// PRIORITY 2: Check intention timer (only if no Quick Task timer exists)
const intentionTimer = intentionTimers.get(packageName);

// If timer exists and is still valid, allow app usage
if (intentionTimer && timestamp <= intentionTimer.expiresAt) {
  console.log('[OS Trigger Brain] Valid intention timer exists — allowing app usage');
  // Update tracking and return (no intervention)
  return;
}
```

**Status:** ✅ Correctly implemented - intention timer suppresses intervention

---

#### 1b. Alternative Activity Timer Suppression

**Spec:** "the 'alternative activity' is started"
- Then: the intervention shall not be started

**Implementation:** ⚠️ **PARTIALLY IMPLEMENTED**

The intervention state machine has `action_timer` state:
```javascript
// File: src/core/intervention/state.js
// States: 'action_timer': Timer running for selected alternative
```

However, **OS Trigger Brain does NOT check for active alternative activity timer** before triggering intervention.

**Issue:** If user is doing an alternative activity (action_timer state), and the app switch interval expires, a new intervention could theoretically trigger. This violates the spec.

**Recommendation:** Add check in `osTriggerBrain.ts`:
```typescript
// Check if user is currently in alternative activity
if (interventionState.state === 'action_timer') {
  console.log('[OS Trigger Brain] Alternative activity in progress — no intervention');
  return;
}
```

**Current Status:** ⚠️ **NEEDS IMPLEMENTATION** - Alternative activity timer does not suppress intervention at OS level

---

#### 1c. Quick Task Timer (t_quickTask) Suppression

**Spec:** "The 'quick task' has already started and the timer t_quickTask is not over yet"
- Then: the intervention shall not be started

**Implementation:** ✅ **CORRECT**
```typescript
// File: src/os/osTriggerBrain.ts, lines 478-523
// PRIORITY 1: Check Quick Task timer first (higher priority than intention timer)
const quickTaskTimer = quickTaskTimers.get(packageName);

if (quickTaskTimer) {
  if (timestamp > quickTaskTimer.expiresAt) {
    // Timer expired - trigger intervention
    triggerIntervention(packageName, timestamp);
  } else {
    // Quick Task timer still valid - allow app usage
    console.log('[OS Trigger Brain] Valid Quick Task timer exists — allowing app usage');
    return; // No intervention
  }
}
```

**Status:** ✅ Correctly implemented - Quick Task timer suppresses intervention

---

### ✅ Requirement 2: Timer Expiration Behavior

**Spec:** "when t_intention is over and the user is still using this monitored app, the intervention should start again"

**Implementation:** ✅ **CORRECT**
```typescript
// File: src/os/osTriggerBrain.ts, lines 546-565
// If timer expired, trigger intervention
if (intentionTimer && timestamp > intentionTimer.expiresAt) {
  console.log('[OS Trigger Brain] Intention timer expired — intervention required');
  triggerIntervention(packageName, timestamp);
  return;
}
```

**Periodic Check:** ✅ **CORRECT**
```typescript
// File: app/App.tsx, lines 268-276
useEffect(() => {
  const intervalId = setInterval(() => {
    const now = Date.now();
    checkForegroundIntentionExpiration(now);
    checkBackgroundIntentionExpiration(now);
  }, 5000); // Check every 5 seconds
  return () => clearInterval(intervalId);
}, []);
```

**Status:** ✅ Correctly implemented - expired timers trigger intervention

---

### ✅ Requirement 3: App Switch Interval (t_appSwitchInterval)

**Spec:** "the value from the setting 'APP switch interval' under 'Settings'. Everytime when user close this app or switch to another app, this value will be restarted from the beginning."

#### 3a. Interval Resets on App Exit

**Spec:** "when user switches back to or opens the monitored app"
- When t_appSwitchInterval is over → intervention should start
- When t_appSwitchInterval is not over → intervention shall not start

**Implementation:** ✅ **CORRECT**
```typescript
// File: src/os/osTriggerBrain.ts, lines 520-585
// Check app switch interval logic (t_appSwitchInterval)
const lastExitTimestamp = lastMeaningfulExitTimestamps.get(packageName);
const intervalMs = getAppSwitchIntervalMs();

if (lastExitTimestamp !== undefined) {
  const timeSinceExit = timestamp - lastExitTimestamp;
  
  if (timeSinceExit < intervalMs) {
    console.log('[OS Trigger Brain] Re-entry within app switch interval — no intervention');
    // Existing intention timer remains valid
    return;
  } else {
    console.log('[OS Trigger Brain] App switch interval elapsed — intervention eligible');
    triggerIntervention(packageName, timestamp);
  }
}
```

**Status:** ✅ Correctly implemented - app switch interval logic works as specified

---

### ✅ Requirement 4: Quick Task Configuration

**Spec:** "The duration of the quick task shall be saved as t_quickTask"

**Implementation:** ✅ **CORRECT**
```typescript
// File: src/os/osConfig.ts, lines 36-38
const QUICK_TASK_DURATION_MS = 3 * 60 * 1000; // 3 minutes (free plan default)

export function getQuickTaskDurationMs(): number {
  return QUICK_TASK_DURATION_MS;
}
```

**Status:** ✅ Correctly implemented - duration is configurable

---

### ✅ Requirement 5: Quick Task Usage Tracking

**Spec:** "n_quickTask: is the number of quick tasks allowed in the predefined time (currently is 15 minutes)"

**Implementation:** ✅ **CORRECT**
```typescript
// File: src/os/osConfig.ts, lines 39-41
const QUICK_TASK_USES_PER_WINDOW = 1; // 1 use per 15-minute window
const QUICK_TASK_WINDOW_MS = 15 * 60 * 1000; // 15-minute rolling window

// File: src/os/osTriggerBrain.ts, lines 127-152
function getQuickTaskRemaining(packageName: string, currentTimestamp: number): number {
  const windowMs = getQuickTaskWindowMs();
  const maxUses = getQuickTaskUsesPerWindow();
  
  const history = quickTaskUsageHistory.get(packageName) || [];
  const recentUsages = history.filter(ts => currentTimestamp - ts < windowMs);
  
  // Update history with filtered timestamps
  if (recentUsages.length !== history.length) {
    quickTaskUsageHistory.set(packageName, recentUsages);
  }
  
  const remaining = Math.max(0, maxUses - recentUsages.length);
  return remaining;
}
```

**Status:** ✅ Correctly implemented - rolling 15-minute window with usage tracking

---

### ⚠️ Requirement 6: Quick Task Cross-App Behavior

**Spec:** "Every app shall be treated as individual and shall not interfere to each other. However, the n_quickTask count all apps together within this period."

**Implementation:** ⚠️ **PARTIALLY CORRECT**

**Per-App Tracking:** ✅ Each app has its own Quick Task timer
```typescript
// File: src/os/osTriggerBrain.ts, line 125
const quickTaskTimers: Map<string, { expiresAt: number }> = new Map();
```

**Usage Counting:** ❌ **INCORRECT** - Usage is tracked per-app, not globally
```typescript
// File: src/os/osTriggerBrain.ts, line 120
const quickTaskUsageHistory: Map<string, number[]> = new Map();
// This is per-app, but spec says "count all apps together"
```

**Issue:** According to spec, if user uses Quick Task on Instagram, then tries to use it on TikTok, it should count against the same quota. Currently, each app has independent usage tracking.

**Recommendation:** Change to global usage tracking:
```typescript
// WRONG (current):
const quickTaskUsageHistory: Map<string, number[]> = new Map(); // Per-app

// CORRECT (spec):
const quickTaskUsageHistory: number[] = []; // Global across all apps
```

**Current Status:** ⚠️ **NEEDS FIX** - Usage should be global, not per-app

---

### ✅ Requirement 7: Quick Task App Switching

**Spec:** "During the t_quickTask, user is allowed to switch to other apps and come back, or close this app and reopen this app, there shall be no intervention process for this monitored app."

**Implementation:** ✅ **CORRECT**
```typescript
// File: src/os/osTriggerBrain.ts, lines 493-522
if (quickTaskTimer) {
  if (timestamp > quickTaskTimer.expiresAt) {
    // Timer expired - trigger intervention
  } else {
    // Quick Task timer still valid - allow app usage
    console.log('[OS Trigger Brain] Valid Quick Task timer exists — allowing app usage');
    // Update tracking and return (no intervention)
    lastForegroundApp = packageName;
    lastMeaningfulApp = packageName;
    return; // ← Allows re-entry without intervention
  }
}
```

**Status:** ✅ Correctly implemented - can switch apps and return during Quick Task period

---

## Summary

| Requirement | Status | Notes |
|------------|--------|-------|
| 1a. Intention Timer Suppression | ✅ CORRECT | Properly implemented |
| 1b. Alternative Activity Suppression | ⚠️ MISSING | OS layer doesn't check action_timer state |
| 1c. Quick Task Timer Suppression | ✅ CORRECT | Properly implemented |
| 2. Timer Expiration Behavior | ✅ CORRECT | Periodic checks work correctly |
| 3. App Switch Interval | ✅ CORRECT | Properly implemented |
| 4. Quick Task Duration Config | ✅ CORRECT | Configurable via osConfig |
| 5. Quick Task Usage Tracking | ✅ CORRECT | Rolling 15-minute window |
| 6. Cross-App Usage Counting | ⚠️ INCORRECT | Should be global, currently per-app |
| 7. Quick Task App Switching | ✅ CORRECT | Allows switching during timer |

## Critical Issues to Fix

### Issue 1: Alternative Activity Timer Not Checked (Priority: MEDIUM)

**Problem:** OS Trigger Brain doesn't check if user is currently doing an alternative activity before triggering intervention.

**Impact:** If user is doing a 30-minute meditation (alternative activity), and app switch interval expires, a new intervention could trigger for a different app.

**Fix Required:** Add intervention state check in `osTriggerBrain.ts`

### Issue 2: Quick Task Usage is Per-App, Not Global (Priority: HIGH)

**Problem:** Spec says "n_quickTask count all apps together", but implementation tracks usage per-app.

**Impact:** User can use Quick Task on Instagram (1 use), then immediately use it on TikTok (another use), effectively getting 2 uses instead of 1.

**Fix Required:** Change `quickTaskUsageHistory` from `Map<string, number[]>` to global `number[]`

## Recommendations

### Fix 1: Implement Alternative Activity Check

```typescript
// In osTriggerBrain.ts, before triggerIntervention()
import { getInterventionState } from './interventionStateGlobal'; // Need to create this

if (isMonitored) {
  // Check if user is in alternative activity
  const currentState = getInterventionState();
  if (currentState === 'action_timer') {
    console.log('[OS Trigger Brain] Alternative activity in progress — no intervention');
    return;
  }
  
  // Then check Quick Task timer...
}
```

### Fix 2: Make Quick Task Usage Global

```typescript
// In osTriggerBrain.ts
// CHANGE FROM:
const quickTaskUsageHistory: Map<string, number[]> = new Map();

// CHANGE TO:
const quickTaskUsageHistory: number[] = []; // Global across all apps

function getQuickTaskRemaining(currentTimestamp: number): number {
  const windowMs = getQuickTaskWindowMs();
  const maxUses = getQuickTaskUsesPerWindow();
  
  // Filter global usage history
  const recentUsages = quickTaskUsageHistory.filter(ts => currentTimestamp - ts < windowMs);
  
  // Update global history
  quickTaskUsageHistory.length = 0;
  quickTaskUsageHistory.push(...recentUsages);
  
  const remaining = Math.max(0, maxUses - recentUsages.length);
  return remaining;
}

function recordQuickTaskUsage(timestamp: number): void {
  quickTaskUsageHistory.push(timestamp);
  console.log('[OS Trigger Brain] Quick Task usage recorded (global)', {
    timestamp,
    totalUsages: quickTaskUsageHistory.length,
  });
}
```

## Conclusion

**Overall Compliance:** ~85% ✅

The implementation is mostly correct, with two important issues:
1. **Alternative activity timer** not checked (spec violation)
2. **Quick Task usage counting** is per-app instead of global (spec violation)

Both issues should be fixed to fully comply with the OS Trigger Contract specification.

