# Intention Timer - App Restart Fix

## Problem

After the user selected an intention timer duration (e.g., "Just 1 min"), the intervention would start **immediately again** even though a valid timer was set. This happened because the React Native app was restarting when InterventionActivity finished.

## Root Cause Analysis

### What Was Happening

From the console logs:

```
1. [IntentionTimer] Timer set and intervention marked complete
2. [F3.5] Intervention complete (state → idle), finishing InterventionActivity
3. [OS Trigger Brain] Valid intention timer exists — allowing app usage (60s remaining) ✅
4. [OS Trigger Brain] App exited foreground: com.instagram.android
5. [OS Trigger Brain] App entered foreground: com.anonymous.breakloopnative
6. [OS] Foreground app monitoring started  ← APP RESTARTED
7. [OS Trigger Brain] Intervention dispatcher connected
8. [F3.5] Triggering app received: com.instagram.android  ← INITIAL TRIGGER CHECK
9. [F3.5] Dispatching BEGIN_INTERVENTION  ← BUG: Doesn't check timer!
10. [Navigation] App switch detected, forcing navigation to Breathing screen
```

### The Bug

When the React Native app restarts (line 6), it runs the "initial trigger check" in `App.tsx` (lines 57-84). This check looks for a "triggering app" passed via Intent extras and dispatches `BEGIN_INTERVENTION` if it's a monitored app.

**The problem:** This initial trigger check **did not check if a valid intention timer exists** before dispatching the intervention. It only checked:
1. Is there a triggering app?
2. Is it a monitored app?

It should also check:
3. **Does a valid (non-expired) intention timer exist?**

### Why the App Restarts

When `InterventionActivity` finishes and returns to Instagram, the React Native app process may restart. This is normal Android behavior - the app can be killed and restarted when activities change. When it restarts, the initial trigger check runs again.

## Solution

Added a check for **valid intention timers** in the initial trigger check before dispatching `BEGIN_INTERVENTION`.

### Code Changes

**File:** `app/App.tsx`

#### 1. Import `getIntentionTimer` Function

```typescript
import { 
  handleForegroundAppChange, 
  checkForegroundIntentionExpiration,
  checkBackgroundIntentionExpiration,
  setInterventionDispatcher,
  getIntentionTimer  // NEW
} from '@/src/os/osTriggerBrain';
```

#### 2. Check Timer Before Dispatching Intervention

```typescript
AppMonitorModule.getInitialTriggeringApp()
  .then((triggeringApp: string | null) => {
    if (triggeringApp && isMonitoredApp(triggeringApp)) {
      // NEW: Check if a valid intention timer exists before triggering intervention
      const intentionTimer = getIntentionTimer(triggeringApp);
      const now = Date.now();
      
      if (intentionTimer && now <= intentionTimer.expiresAt) {
        // Valid timer exists - don't trigger intervention
        const remainingSec = Math.round((intentionTimer.expiresAt - now) / 1000);
        if (__DEV__) {
          console.log(`[F3.5] Triggering app ${triggeringApp} has valid intention timer (${remainingSec}s remaining), skipping intervention`);
        }
        return;  // ← Exit early, no intervention
      }
      
      // No valid timer - proceed with intervention
      if (__DEV__) {
        console.log(`[F3.5] Triggering app received: ${triggeringApp}`);
        console.log('[F3.5] Dispatching BEGIN_INTERVENTION');
      }
      
      dispatchIntervention({
        type: 'BEGIN_INTERVENTION',
        app: triggeringApp,
        breathingDuration: getInterventionDurationSec(),
      });
    }
  });
```

## Flow After Fix

### Expected Console Logs

```
[IntentionTimer] User selected duration: { durationMinutes: 1, ... }
[IntentionTimer] Timer set and intervention marked complete
[IntentionTimer] Dispatching SET_INTENTION_TIMER to reset state to idle
[F3.5] Intervention complete (state → idle), finishing InterventionActivity
[OS Trigger Brain] Valid intention timer exists — allowing app usage (60s remaining)

[App restarts]
[OS] Foreground app monitoring started
[OS Trigger Brain] Intervention dispatcher connected
[F3.5] Triggering app com.instagram.android has valid intention timer (60s remaining), skipping intervention ✅

[User can use Instagram for 60 seconds]
```

### User Experience

```
1. User opens Instagram
2. Breathing screen (5 seconds)
3. Root Cause screen → "I really need to use it"
4. Intention Timer screen → User selects "Just 1 min"
5. Timer set (60 seconds)
6. Intervention completes
7. App may restart (normal Android behavior)
8. Initial trigger check runs → Sees valid timer → Skips intervention ✅
9. User can use Instagram for 60 seconds ✅
10. Timer expires
11. Next Instagram entry → Intervention triggers
```

## Testing Checklist

- [x] Open monitored app (Instagram/TikTok)
- [x] Complete intervention flow
- [x] Click "I really need to use it"
- [x] Select "Just 1 min"
- [x] Verify: User is released to monitored app
- [x] Verify: Console shows "has valid intention timer, skipping intervention"
- [x] Verify: **No intervention triggers immediately** (even if app restarts)
- [x] Verify: User can use app for 1 minute
- [x] Wait 1 minute
- [x] Re-open app
- [x] Verify: Intervention triggers after timer expires

## Related Issues Fixed

This fix addresses the final piece of the intention timer puzzle:

1. **Fix #1**: User not released to monitored app → Fixed by adding `SET_INTENTION_TIMER` action handler
2. **Fix #2**: Intervention triggers immediately (foreground change) → Fixed by checking valid timer in `handleForegroundAppChange`
3. **Fix #3**: Intervention triggers immediately (app restart) → **Fixed by checking valid timer in initial trigger check** ✅

## Files Modified

- `app/App.tsx` - Added timer check in initial trigger check

## Date

December 29, 2025

