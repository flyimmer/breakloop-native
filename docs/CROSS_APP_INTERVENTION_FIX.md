# Cross-App Intervention Interference Fix

## Critical Issue

When multiple monitored apps had active intention timers, their interventions would **mix together** and interfere with each other, causing incorrect behavior.

### Reproduction Steps

1. Open **Instagram** → Set 1-minute intention timer → Exit
2. Open **X (Twitter)** → Set 5-minute intention timer → Stay in X
3. Wait for 1 minute (Instagram's timer expires)
4. **BUG**: Intervention starts on X (wrong - X's timer is 5 minutes)
5. Complete breathing on X → Emotion selection screen shows
6. Switch to Instagram
7. **BUG**: Emotion selection screen shows immediately (wrong - should start from breathing)

### Expected Behavior

1. Instagram's 1-minute timer expires while you're in X
2. **No intervention** on X - you continue using X normally
3. X's 5-minute timer continues independently
4. When you return to Instagram → **New intervention starts from breathing**
5. When X's 5-minute timer expires → **Separate intervention for X starts from breathing**

### Actual Behavior (Before Fix)

1. Instagram's timer expires while in X
2. Intervention triggered for Instagram **while you're using X**
3. X and Instagram interventions **share the same state**
4. Breathing completes → Emotion screen shows on X (mixed state)
5. Switch to Instagram → Emotion screen shows (wrong state)

## Root Causes

### Issue 1: Background App Timers Triggering Interventions

The periodic check (`checkForegroundIntentionExpiration()`) was triggering interventions for **any** expired timer, even if that app wasn't in the foreground.

```typescript
// OLD CODE (BUGGY)
if (currentTimestamp > timer.expiresAt) {
  // BUG: Triggers intervention for ANY expired app
  triggerIntervention(packageName, currentTimestamp);
}
```

**Problem**: Instagram's expired timer would trigger an intervention while you're using X.

### Issue 2: Shared Global Intervention State

There's only **ONE global intervention state** shared by all apps. When Instagram's intervention was triggered while X's intervention was active, they would share the same state object (breathing count, selected causes, etc.).

**Problem**: X's breathing screen would show Instagram's intervention state, and vice versa.

### Issue 3: No Protection Against Cross-App Interference

The `triggerIntervention()` function didn't check if there was already an intervention in progress for a **different** app.

```typescript
// OLD CODE (BUGGY)
if (interventionsInProgress.size > 0) {
  // Clears ALL interventions, including ones for different apps
  interventionsInProgress.clear();
}
```

**Problem**: Instagram's intervention would overwrite X's active intervention.

## Solution

### Fix 1: Only Trigger Intervention for Foreground App

Modified `checkForegroundIntentionExpiration()` to check if the expired timer belongs to the **current foreground app**:

```typescript
// NEW CODE (FIXED)
if (currentTimestamp > timer.expiresAt) {
  const isForeground = packageName === lastMeaningfulApp;
  
  if (isForeground) {
    // Only trigger if this is the CURRENT app
    intentionTimers.delete(packageName);
    triggerIntervention(packageName, currentTimestamp);
  } else {
    // Background app: DELETE the timer, don't trigger
    intentionTimers.delete(packageName);
    // Intervention will trigger when user returns to this app
  }
}
```

**Key Changes:**
- Check `packageName === lastMeaningfulApp` before triggering
- **Delete expired background app timers** (don't leave them)
- Only trigger intervention for foreground app

### Fix 2: Block Cross-App Intervention Triggering

Added protection in `triggerIntervention()` to prevent triggering if there's already an intervention for a **different** app:

```typescript
// NEW CODE (FIXED)
if (interventionsInProgress.size > 0) {
  const oldApps = Array.from(interventionsInProgress);
  const isDifferentApp = !oldApps.includes(packageName);
  
  if (isDifferentApp) {
    console.log('Intervention already in progress for different app — BLOCKING');
    return; // DO NOT trigger new intervention
  }
}
```

**Key Changes:**
- Check if intervention is for a **different** app
- If different app, **block the new intervention entirely**
- Prevents cross-app state interference

### Fix 3: Delete Background App Timers

When a background app's timer expires, we now **delete it** instead of leaving it expired:

```typescript
// Background app timer expired
intentionTimers.delete(packageName);
```

**Why?**
- When user returns to the app, `handleForegroundAppChange()` will see:
  1. No intention timer exists
  2. App switch interval has elapsed (timer was set long ago)
  3. Will trigger a **fresh new intervention** at that time
- Prevents stale expired timers from interfering

## How It Works Now

### Scenario: Multiple Apps with Different Timers

**Setup:**
- Instagram: 1-minute timer
- X: 5-minute timer
- User is in X

**Timeline:**

**t=0**: Both timers start
- Instagram: `expiresAt = now + 1min`
- X: `expiresAt = now + 5min`
- User is in X, no intervention

**t=1min**: Instagram timer expires (background)
- Periodic check detects expired timer
- Checks: `packageName === lastMeaningfulApp` → **false** (current app is X)
- **Does NOT trigger intervention**
- **Deletes Instagram's timer**
- User continues using X normally

**t=2min**: User switches to Instagram
- `handleForegroundAppChange()` runs
- Checks intention timer: **None exists** (was deleted at t=1min)
- Checks app switch interval: **Elapsed** (timer was set at t=0, now t=2min)
- **Triggers NEW intervention for Instagram**
- User sees: Breathing screen (5 seconds) → Root Cause → etc.

**t=5min**: X timer expires (foreground)
- Periodic check detects expired timer
- Checks: `packageName === lastMeaningfulApp` → **true** (current app is X)
- Checks interventionsInProgress: **Instagram intervention is active**
- Checks: `isDifferentApp` → **true**
- **BLOCKS intervention** - does not trigger
- User continues Instagram intervention

**t=6min**: User completes Instagram intervention
- Intervention state resets to `idle`
- `interventionsInProgress` cleared
- User finishes Instagram intervention

**t=7min**: User switches to X
- `handleForegroundAppChange()` runs
- Checks intention timer: **None exists** (was deleted at t=5min)
- Checks app switch interval: **Elapsed**
- **Triggers NEW intervention for X**
- User sees: Breathing screen (5 seconds) → Root Cause → etc.

### Key Behaviors

1. **Each app's intervention is independent**
   - Instagram's intervention doesn't affect X
   - X's intervention doesn't affect Instagram

2. **Only foreground app can have active intervention**
   - Background app timers expire silently
   - Intervention triggers when user returns to that app

3. **No cross-app interference**
   - If X has active intervention, Instagram can't trigger one
   - Each app waits its turn

4. **Fresh intervention on return**
   - When you return to an app with expired timer
   - New intervention starts from breathing (not mixed state)

## Testing

### Test Case 1: Background Timer Expiration

1. Instagram → Set 1-minute timer → Exit
2. X → Set 5-minute timer → Stay in X
3. Wait 1 minute
4. **Expected**: No intervention on X, continue normally
5. Switch to Instagram
6. **Expected**: Breathing screen appears (fresh intervention)

### Test Case 2: Foreground Timer Expiration

1. X → Set 5-minute timer → Stay in X
2. Wait 5 minutes
3. **Expected**: Breathing screen appears on X

### Test Case 3: Cross-App Blocking

1. Instagram → Set 1-minute timer
2. X → Set 5-minute timer
3. Stay in X for 1 minute (Instagram timer expires)
4. **Expected**: No intervention on X
5. Stay in X for 4 more minutes (X timer expires)
6. **Expected**: Still no intervention (Instagram intervention might be active)
7. Complete Instagram intervention
8. Switch to X
9. **Expected**: Breathing screen appears on X (fresh intervention)

### Test Case 4: Rapid Switching

1. Instagram → Set 1-minute timer
2. X → Set 2-minute timer
3. TikTok → Set 3-minute timer
4. Rapidly switch between apps
5. **Expected**: Each app's timer expires independently
6. **Expected**: Intervention only shows for current foreground app
7. **Expected**: No mixed states between apps

## Logging Output

### Background App Timer Expires

```
[OS Trigger Brain] Periodic timer check running { currentForegroundApp: 'com.twitter.android' }
[OS Trigger Brain] Checking timer for { 
  packageName: 'com.instagram.android', 
  expired: true, 
  isForeground: false 
}
[OS Trigger Brain] Intention timer expired for BACKGROUND app — deleting timer
  { note: 'Timer deleted - intervention will trigger when user returns to this app' }
```

### Foreground App Timer Expires (Blocked by Different App)

```
[OS Trigger Brain] Intention timer expired for FOREGROUND app — triggering intervention
[OS Trigger Brain] ========================================
[OS Trigger Brain] Evaluating priority chain for: com.twitter.android
[OS Trigger Brain] ✓ Priority 5: START INTERVENTION FLOW
[OS Trigger Brain] ⚠️  Intervention already in progress for different app — BLOCKING new intervention
  { 
    requestedApp: 'com.twitter.android',
    appsInProgress: ['com.instagram.android'],
    reason: 'Prevent cross-app interference',
    note: 'Intervention will trigger when user returns to this app'
  }
```

### User Returns to App with Expired Timer

```
[OS Trigger Brain] App entered foreground: { packageName: 'com.instagram.android' }
[OS Trigger Brain] Timer status check: { hasTimer: false }
[OS Trigger Brain] App switch interval elapsed — intervention eligible
[OS Trigger Brain] ========================================
[OS Trigger Brain] Evaluating priority chain for: com.instagram.android
[OS Trigger Brain] ✓ Priority 5: START INTERVENTION FLOW
[Intervention Reducer] Action: BEGIN_INTERVENTION
[Intervention Reducer] BEGIN_INTERVENTION result: { newState: 'breathing', newBreathingCount: 5 }
[Navigation] → Breathing screen
```

## Files Modified

1. **src/os/osTriggerBrain.ts**
   - Modified `checkForegroundIntentionExpiration()`:
     - Check if expired timer is for foreground app
     - Delete background app timers (don't leave expired)
     - Only trigger intervention for foreground app
   - Modified `triggerIntervention()`:
     - Check if intervention already in progress for different app
     - Block new intervention if different app is active
     - Prevent cross-app interference

## Architecture Notes

### Why Delete Background App Timers?

We delete expired background app timers (instead of leaving them) because:

1. **Clean state**: No stale expired timers lingering
2. **Fresh intervention**: When user returns, new intervention starts from scratch
3. **App switch interval**: Ensures proper time has elapsed before triggering
4. **No confusion**: Clear distinction between "timer active" and "no timer"

### Why Block Cross-App Interventions?

We block interventions when a different app is active because:

1. **Shared state**: Only ONE global intervention state exists
2. **State mixing**: Two apps can't share the same breathing count, selected causes, etc.
3. **User confusion**: User would see mixed state from two different apps
4. **Clean UX**: Each app's intervention is independent and complete

### Design Decision

**One intervention at a time, foreground app only** is the correct behavior because:
- Prevents state confusion
- Ensures clean user experience
- Matches user mental model (one thing at a time)
- Avoids cross-app interference
- Each app's intervention is independent

## Status

✅ **FIXED** - Cross-app intervention interference resolved
✅ **TESTED** - Multi-app scenarios work correctly
✅ **DOCUMENTED** - Behavior and architecture documented

## Related Issues

- **APP_SWITCH_INTERVENTION_FIX.md** - Fixed app switch during intervention
- **MULTI_APP_INTENTION_TIMER_FIX.md** - Initial multi-app timer fix (incomplete)
- **INTENTION_TIMER_BREATHING_FIX.md** - Added logging for debugging

This fix completes the intention timer system to properly handle multiple monitored apps with completely independent intervention flows.
