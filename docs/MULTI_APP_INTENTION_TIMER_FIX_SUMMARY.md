# Multi-App Intention Timer Fix - Quick Summary

## Problem

When you had multiple apps with different intention timers:
- **Instagram**: 1-minute timer
- **X (Twitter)**: 5-minute timer

Instagram's timer would expire while you were in X, triggering an intervention for Instagram even though you were using X. This caused the wrong screens to show (emotion selection instead of breathing).

## Root Cause

The periodic timer check (`checkForegroundIntentionExpiration()`) was triggering interventions for **any** expired timer, regardless of whether that app was currently in the foreground.

## Solution

Modified the function to **only trigger intervention for the current foreground app**:

```typescript
if (currentTimestamp > timer.expiresAt) {
  const isForeground = packageName === lastMeaningfulApp;
  
  if (isForeground) {
    // Trigger intervention immediately
    triggerIntervention(packageName, currentTimestamp);
  } else {
    // Background app: leave timer expired, don't trigger
    // Will trigger when user returns to this app
  }
}
```

## How It Works Now

### Foreground App Timer Expires
- Timer expires → Intervention triggers immediately
- User sees Breathing screen → Root Cause → etc.

### Background App Timer Expires
- Timer expires → **No intervention triggered**
- Timer remains expired in memory
- When user returns to that app → Intervention triggers then

## Example Scenario

1. **t=0**: Instagram (1min timer), X (5min timer)
2. **t=1min**: Instagram timer expires while you're in X
   - **No intervention** - you continue using X normally
3. **t=2min**: You switch back to Instagram
   - **Intervention triggers immediately** - breathing screen appears
4. **t=5min**: X timer expires while you're in X
   - **Intervention triggers** - breathing screen appears

## Testing

1. Open Instagram → Set 1-minute timer
2. Switch to X → Set 5-minute timer
3. Wait 1 minute (stay in X)
4. **Expected**: No intervention, X continues normally
5. Switch to Instagram
6. **Expected**: Intervention triggers immediately (breathing screen)

## Files Modified

- `src/os/osTriggerBrain.ts` - Modified `checkForegroundIntentionExpiration()`

## Status

✅ **FIXED** - Multi-app intention timers now work correctly
✅ **No cross-app interference** - Each app's timer is independent
✅ **Correct intervention timing** - Only triggers for foreground app
