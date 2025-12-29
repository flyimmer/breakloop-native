# Intention Timer Immediate Re-trigger Fix

## Problem

After fixing the initial intention timer issue, a new problem emerged: When the user selected a duration (e.g., "1 min" or "5 min") and returned to the monitored app, the intervention would trigger **immediately again** instead of waiting for the timer to expire.

**Expected Behavior:**
1. User completes intervention and sets 1-minute timer
2. User is released to Instagram
3. User can use Instagram for 1 minute
4. After 1 minute, intervention triggers again

**Actual Behavior:**
1. User completes intervention and sets 1-minute timer
2. User is released to Instagram
3. **Intervention triggers immediately** (timer is ignored)

## Root Cause

The OS Trigger Brain was not checking for **valid (non-expired) intention timers** before running the app switch interval logic. Here's what was happening:

### Flow Analysis

1. **User completes intervention**: Sets 1-minute timer via `setIntentionTimer()`
2. **Intervention completes**: `onInterventionCompleted()` removes app from `interventionsInProgress`
3. **User returns to Instagram**: InterventionActivity finishes, Instagram comes to foreground
4. **OS detects foreground change**: `handleForegroundAppChange()` is called
5. **Timer expiration check**: Timer has NOT expired (just set 1 minute ago)
6. **Heartbeat check**: `lastMeaningfulApp !== packageName` (because last app was BreakLoop/InterventionActivity)
7. **App switch interval logic runs**: No previous exit timestamp, so intervention triggers again!

### The Core Issue

The OS Trigger Brain had logic to check if a timer **expired**, but no logic to check if a timer **exists and is still valid**. When the user returned to the monitored app after setting a timer, the app switch interval logic would run and trigger a new intervention, completely ignoring the valid timer.

### Why This Happened

When InterventionActivity finishes and returns to Instagram, the OS sees this as:
```
BreakLoop (InterventionActivity) → Instagram
```

So `lastMeaningfulApp` is BreakLoop, not Instagram. This makes the OS think this is a **new entry** to Instagram, not a re-entry within the timer window.

## Solution

Added a check for **valid (non-expired) intention timers** BEFORE running the app switch interval logic.

### Code Changes

**File:** `src/os/osTriggerBrain.ts`

#### 1. Added Valid Timer Check (Lines ~350-365)

```typescript
// If timer exists and is still valid, allow app usage without intervention
if (intentionTimer && timestamp <= intentionTimer.expiresAt) {
  const remainingSec = Math.round((intentionTimer.expiresAt - timestamp) / 1000);
  console.log('[OS Trigger Brain] Valid intention timer exists — allowing app usage', {
    packageName,
    expiresAt: intentionTimer.expiresAt,
    expiresAtTime: new Date(intentionTimer.expiresAt).toISOString(),
    currentTimestamp: timestamp,
    currentTime: new Date(timestamp).toISOString(),
    remainingMs: intentionTimer.expiresAt - timestamp,
    remainingSec: `${remainingSec}s remaining`,
  });
  
  // Update tracking and return (no intervention)
  lastForegroundApp = packageName;
  lastMeaningfulApp = packageName;
  return;
}
```

This check happens **after** the expired timer check but **before** the app switch interval logic. If a valid timer exists, the function returns early without triggering an intervention.

#### 2. Removed DEBUG Testing Block (Lines ~325-331)

Removed the auto-set 2-minute timer that was interfering with user-selected timers:

```typescript
// REMOVED:
// FOR TESTING: Auto-set a 2-minute intention timer on first entry if none exists
// TODO: Remove this when real intervention flow is wired
if (!intentionTimers.has(packageName)) {
  const testDuration = 2 * 60 * 1000; // 2 minutes
  setIntentionTimer(packageName, testDuration, timestamp);
  console.log('[OS Trigger Brain] DEBUG: Auto-set test intention timer (2 min)');
}
```

## Flow After Fix

### Monitored App Entry Logic (Updated)

```
Monitored app enters foreground
    ↓
Check if intention timer exists
    ↓
    ├─ Timer expired? → Trigger intervention
    │
    ├─ Timer valid (not expired)? → Allow app usage, return early ✅
    │
    └─ No timer? → Check app switch interval logic
                    ↓
                    ├─ Within interval? → Allow app usage
                    └─ Interval elapsed? → Trigger intervention
```

### User Journey After Fix

```
User opens Instagram
    ↓
Breathing screen (5 seconds)
    ↓
Root Cause screen → "I really need to use it"
    ↓
Intention Timer screen → User selects "1 min"
    ↓
Timer set in OS Trigger Brain (1 minute)
    ↓
Intervention state → idle
    ↓
InterventionActivity finishes
    ↓
User released back to Instagram
    ↓
OS detects Instagram foreground change
    ↓
Check intention timer → Valid, 60 seconds remaining ✅
    ↓
Allow app usage, no intervention triggered ✅
    ↓
User uses Instagram for 1 minute
    ↓
Timer expires
    ↓
Next Instagram entry → Intervention triggers
```

## Testing Checklist

- [x] Open monitored app (Instagram/TikTok)
- [x] Complete intervention flow to Intention Timer screen
- [x] Select "Just 1 min"
- [x] Verify: User is released to monitored app
- [x] Verify: Console shows "Valid intention timer exists — allowing app usage"
- [x] Verify: Console shows "60s remaining" (or similar)
- [x] Verify: **No intervention triggers immediately**
- [x] Wait 1 minute (or advance time)
- [x] Re-open monitored app
- [x] Verify: Intervention triggers after timer expires

## Console Log Examples

### Before Fix (Immediate Re-trigger)
```
[OS Trigger Brain] Intention timer set { packageName: 'com.instagram.android', durationSec: '60s', ... }
[OS Trigger Brain] Intervention completed, cleared in-progress flag
[OS Trigger Brain] Monitored app entered foreground: { packageName: 'com.instagram.android', ... }
[OS Trigger Brain] App switch interval elapsed — intervention eligible
[OS Trigger Brain] BEGIN_INTERVENTION dispatched  ❌ (WRONG!)
```

### After Fix (Timer Respected)
```
[OS Trigger Brain] Intention timer set { packageName: 'com.instagram.android', durationSec: '60s', ... }
[OS Trigger Brain] Intervention completed, cleared in-progress flag
[OS Trigger Brain] Monitored app entered foreground: { packageName: 'com.instagram.android', ... }
[OS Trigger Brain] Valid intention timer exists — allowing app usage { remainingSec: '60s remaining' }  ✅
```

## Related Files

### Modified Files
- `src/os/osTriggerBrain.ts` - Added valid timer check, removed DEBUG block

### Related Documentation
- `docs/INTENTION_TIMER_FIX.md` - Initial intention timer fix
- `docs/INTENTION_TIMER_FIX_SUMMARY.md` - Quick reference
- `spec/Intervention_OS_Contract.docx` - OS Trigger Contract specification

## Technical Notes

### Timer Priority Order

The OS Trigger Brain now checks timers in this priority order:

1. **Expired timer?** → Trigger intervention (highest priority)
2. **Valid timer?** → Allow app usage, skip intervention (medium priority)
3. **No timer?** → Run app switch interval logic (lowest priority)

This ensures that:
- Expired timers always trigger interventions
- Valid timers always prevent interventions
- New entries (no timer) follow normal app switch interval rules

### Why Update `lastMeaningfulApp`?

When a valid timer exists and we allow app usage, we update `lastMeaningfulApp = packageName`. This is important because:

1. Future heartbeat events will be recognized as same-app events
2. Exit timestamps will be recorded correctly when user leaves the app
3. App switch interval calculations will work correctly for next entry

Without this update, every foreground event would be treated as a new entry, causing repeated timer checks and log spam.

## Date

December 29, 2025

