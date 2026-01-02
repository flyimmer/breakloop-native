# Cross-App Intervention Fix - Quick Summary

## Problem

When multiple apps had active intention timers, their interventions would **mix together**:

**Scenario:**
1. Instagram: 1-minute timer
2. X: 5-minute timer (you're using X)
3. After 1 minute: Intervention started on X (wrong - should be 5 minutes)
4. Breathing completes → Emotion screen shows on X
5. Switch to Instagram → Emotion screen shows (wrong - should start from breathing)

**Root Cause:** 
- Background app timers were triggering interventions
- All apps shared ONE global intervention state
- No protection against cross-app interference

## Solution

### Fix 1: Only Trigger for Foreground App

```typescript
if (currentTimestamp > timer.expiresAt) {
  const isForeground = packageName === lastMeaningfulApp;
  
  if (isForeground) {
    // Trigger intervention for current app
    triggerIntervention(packageName, currentTimestamp);
  } else {
    // Background app: delete timer, don't trigger
    intentionTimers.delete(packageName);
  }
}
```

### Fix 2: Block Cross-App Interventions

```typescript
if (interventionsInProgress.size > 0) {
  const isDifferentApp = !oldApps.includes(packageName);
  
  if (isDifferentApp) {
    // BLOCK: Don't trigger if different app is active
    return;
  }
}
```

### Fix 3: Delete Background Timers

When background app timer expires:
- **Delete the timer** (don't leave it expired)
- When user returns → Trigger **fresh new intervention**
- Prevents stale expired timers from interfering

## How It Works Now

**Timeline:**
- **t=0**: Instagram (1min), X (5min) - User in X
- **t=1min**: Instagram timer expires (background)
  - Timer deleted, no intervention
  - User continues using X normally
- **t=2min**: User switches to Instagram
  - No timer exists → Triggers **fresh intervention**
  - Breathing screen (5s) → Root Cause → etc.
- **t=5min**: X timer expires (foreground)
  - But Instagram intervention is active
  - **BLOCKED** - does not trigger
- **t=6min**: Instagram intervention completes
- **t=7min**: User switches to X
  - No timer exists → Triggers **fresh intervention**
  - Breathing screen (5s) → Root Cause → etc.

## Key Behaviors

1. ✅ **Each app's intervention is independent**
2. ✅ **Only foreground app can have active intervention**
3. ✅ **No cross-app interference**
4. ✅ **Fresh intervention on return** (starts from breathing)

## Testing

1. Instagram → 1-minute timer → Exit
2. X → 5-minute timer → Stay in X
3. Wait 1 minute
4. **Expected**: No intervention on X
5. Switch to Instagram
6. **Expected**: Breathing screen appears (fresh intervention)

## Files Modified

- `src/os/osTriggerBrain.ts`:
  - `checkForegroundIntentionExpiration()` - Only trigger for foreground app
  - `triggerIntervention()` - Block if different app is active

## Status

✅ **FIXED** - Cross-app interference resolved
✅ Each app's intervention is completely independent
✅ No more mixed states between apps
