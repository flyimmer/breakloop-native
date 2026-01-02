# Multi-App Intention Timer Fix

## Issue Description

**Problem:** When multiple monitored apps have different intention timers running, the periodic expiration check was triggering interventions for background apps, causing the wrong intervention to show.

### Reproduction Steps

1. Open **Instagram** → Set 1-minute intention timer
2. Switch to **X (Twitter)** → Set 5-minute intention timer
3. Stay in X for more than 1 minute
4. **Bug**: Instagram's timer expires while you're in X, triggering an intervention
5. **Result**: Wrong intervention state shows (emotion selection screen instead of breathing)

### Expected Behavior

1. Instagram's 1-minute timer expires while you're in X
2. Timer remains expired but **does NOT trigger intervention**
3. When you return to Instagram later → Intervention triggers then
4. X's 5-minute timer continues independently

### Actual Behavior (Before Fix)

1. Instagram's 1-minute timer expires while you're in X
2. Intervention is triggered for Instagram **even though you're in X**
3. Intervention state gets confused (shows emotion screen in X)
4. When you switch to Instagram, it shows the wrong screen

## Root Cause

The `checkForegroundIntentionExpiration()` function was checking **ALL** intention timers every 5 seconds and calling `triggerIntervention()` for **any** expired timer, regardless of whether that app was currently in the foreground.

```typescript
// OLD CODE (BUGGY)
for (const [packageName, timer] of intentionTimers.entries()) {
  if (currentTimestamp > timer.expiresAt) {
    // BUG: Triggers intervention for ANY expired app, even if in background
    triggerIntervention(packageName, currentTimestamp);
  }
}
```

This caused:
1. **Cross-app interference**: Instagram's expired timer triggered while in X
2. **State confusion**: Intervention state mixed between apps
3. **Wrong screens**: User saw emotion selection instead of breathing

## Solution

Modified `checkForegroundIntentionExpiration()` to **only trigger intervention for the current foreground app**:

```typescript
// NEW CODE (FIXED)
for (const [packageName, timer] of intentionTimers.entries()) {
  if (currentTimestamp > timer.expiresAt) {
    const isForeground = packageName === lastMeaningfulApp;
    
    if (isForeground) {
      // Only trigger if this is the CURRENT app
      intentionTimers.delete(packageName);
      triggerIntervention(packageName, currentTimestamp);
    } else {
      // For background apps: leave timer expired, don't trigger
      // Intervention will trigger when user returns to this app
      console.log('Timer expired for background app - will trigger on next entry');
    }
  }
}
```

### Key Changes

1. **Check if app is foreground**: `packageName === lastMeaningfulApp`
2. **Foreground app**: Delete timer and trigger intervention immediately
3. **Background app**: Leave timer expired (don't delete), don't trigger intervention
4. **On app return**: `handleForegroundAppChange()` will detect expired timer and trigger then

## How It Works Now

### Scenario 1: Timer Expires for Foreground App

1. User is in **Instagram** with 1-minute timer
2. Timer expires while still in Instagram
3. `checkForegroundIntentionExpiration()` detects expiration
4. Checks: `packageName === lastMeaningfulApp` → **true**
5. Triggers intervention for Instagram immediately
6. User sees Breathing screen → Root Cause → etc.

### Scenario 2: Timer Expires for Background App

1. User is in **X** with 5-minute timer
2. User also has **Instagram** with 1-minute timer (set earlier)
3. Instagram's timer expires while user is still in X
4. `checkForegroundIntentionExpiration()` detects Instagram timer expired
5. Checks: `packageName === lastMeaningfulApp` → **false** (current app is X)
6. **Does NOT trigger intervention** - just logs it
7. Timer remains expired in memory
8. When user returns to Instagram later:
   - `handleForegroundAppChange()` runs (Step 4B, line 604-662)
   - Detects expired timer: `timestamp > intentionTimer.expiresAt`
   - Triggers intervention for Instagram at that time

### Scenario 3: Multiple Apps with Different Timers

1. **Instagram**: 1-minute timer
2. **X**: 5-minute timer
3. **TikTok**: 3-minute timer

Timeline:
- **t=0**: All timers start
- **t=1min**: Instagram timer expires (background) → No intervention, timer stays expired
- **t=3min**: TikTok timer expires (background) → No intervention, timer stays expired
- **t=5min**: X timer expires (foreground) → Intervention triggers for X
- **Later**: User switches to Instagram → Intervention triggers immediately (expired timer detected)

## Testing

### Test Case 1: Background App Timer Expiration

1. Open Instagram → Set 1-minute timer → Exit to home
2. Open X → Set 5-minute timer → Stay in X
3. Wait for 1 minute (Instagram timer expires in background)
4. **Expected**: No intervention appears, X continues normally
5. Switch back to Instagram
6. **Expected**: Intervention triggers immediately (breathing screen)

### Test Case 2: Foreground App Timer Expiration

1. Open Instagram → Set 1-minute timer
2. Stay in Instagram for 1 minute
3. **Expected**: Intervention triggers at 1 minute (breathing screen)
4. Complete or dismiss intervention
5. **Expected**: No interference from other apps

### Test Case 3: Multiple Apps, Multiple Timers

1. Open Instagram → Set 1-minute timer
2. Switch to X → Set 5-minute timer
3. Switch to TikTok → Set 3-minute timer
4. Stay in TikTok for 3 minutes
5. **Expected**: TikTok intervention triggers at 3 minutes
6. Switch to Instagram
7. **Expected**: Instagram intervention triggers immediately (1-min timer already expired)
8. Switch to X
9. **Expected**: No intervention yet (5-min timer still valid)

### Test Case 4: Rapid App Switching

1. Open Instagram → Set 1-minute timer
2. Quickly switch between Instagram, X, TikTok
3. Wait for Instagram timer to expire while in different app
4. **Expected**: No intervention while in other apps
5. Return to Instagram
6. **Expected**: Intervention triggers immediately

## Logging Output

### Foreground App Timer Expires

```
[OS Trigger Brain] Periodic timer check running { currentForegroundApp: 'com.instagram.android' }
[OS Trigger Brain] Checking timer for { packageName: 'com.instagram.android', expired: true, isForeground: true }
[OS Trigger Brain] Intention timer expired for FOREGROUND app — triggering intervention
[Intervention Reducer] Action: BEGIN_INTERVENTION
[Navigation] → Breathing screen
```

### Background App Timer Expires

```
[OS Trigger Brain] Periodic timer check running { currentForegroundApp: 'com.twitter.android' }
[OS Trigger Brain] Checking timer for { packageName: 'com.instagram.android', expired: true, isForeground: false }
[OS Trigger Brain] Intention timer expired for BACKGROUND app — will trigger on next entry
  { note: 'Timer NOT deleted - will be detected when user returns to this app' }
```

### User Returns to App with Expired Timer

```
[OS Trigger Brain] App entered foreground: { packageName: 'com.instagram.android' }
[OS Trigger Brain] Timer status check: { hasTimer: true, expired: true }
[OS Trigger Brain] Intention timer expired — intervention required
[OS Trigger Brain] ========================================
[OS Trigger Brain] Evaluating priority chain for: com.instagram.android
[Intervention Reducer] Action: BEGIN_INTERVENTION
[Navigation] → Breathing screen
```

## Files Modified

1. **src/os/osTriggerBrain.ts**
   - Modified `checkForegroundIntentionExpiration()` function
   - Added foreground check: `packageName === lastMeaningfulApp`
   - Only trigger intervention for foreground app
   - Leave background app timers expired (don't delete)

## Related Code

- **handleForegroundAppChange()** (line 460-761) - Detects expired timers on app entry
- **triggerIntervention()** (line 245-342) - Triggers intervention with priority chain
- **setIntentionTimer()** (line 791-803) - Sets intention timer for an app
- **hasValidIntentionTimer()** (line 820-826) - Checks if timer is valid (not expired)

## Architecture Notes

### Why Not Delete Background App Timers?

We **intentionally leave expired timers in memory** for background apps because:

1. **User needs to know**: When they return to the app, they should be reminded
2. **Consistent behavior**: Timer expiration should trigger intervention, just delayed
3. **No silent bypass**: User can't avoid intervention by switching apps

### Why Not Trigger Immediately?

We **don't trigger intervention for background apps** because:

1. **User context**: User is focused on a different app
2. **State confusion**: Intervention state would mix between apps
3. **UX disruption**: Interrupting the current app would be jarring
4. **Android limitations**: Can't reliably show intervention for non-foreground app

### Design Decision

**Trigger intervention when user returns to the app** is the correct behavior because:
- User is now in the correct app context
- Intervention state is clean (no mixing)
- User experience is smooth (no cross-app interference)
- Matches user mental model (timer expired, now I need to deal with it)

## Status

✅ **FIXED** - Intention timers now only trigger intervention for foreground app
✅ **TESTED** - Multi-app scenario works correctly
✅ **DOCUMENTED** - Behavior and architecture documented

## Related Issues

- **APP_SWITCH_INTERVENTION_FIX.md** - Fixed app switch during intervention
- **INTENTION_TIMER_BREATHING_FIX.md** - Added logging for debugging

This fix completes the intention timer system to properly handle multiple monitored apps with independent timers.
