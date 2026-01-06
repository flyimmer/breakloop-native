# evaluateTriggerLogic Export Fix

**Date:** January 6, 2026  
**Issue:** TypeError when System Brain tries to call evaluateTriggerLogic  
**Root Cause:** Function was not exported from osTriggerBrain.ts

## Problem

After adding FOREGROUND_CHANGED event emission, System Brain received the events but crashed with:

```
ERROR [System Brain] ❌ Error processing event: [TypeError: 0, _osOsTriggerBrain.evaluateTriggerLogic is not a function (it is undefined)]
```

## Root Cause

In `src/systemBrain/eventHandler.ts`, we import and call:

```typescript
import { evaluateTriggerLogic } from '../os/osTriggerBrain';

// In handleForegroundChange:
evaluateTriggerLogic(packageName, timestamp);
```

But in `src/os/osTriggerBrain.ts`, the function was defined WITHOUT the `export` keyword:

```typescript
// Line 367 - BEFORE (BROKEN)
function evaluateTriggerLogic(packageName: string, timestamp: number): void {
  // ...
}
```

This meant the function was private to the module and couldn't be imported by System Brain.

## Solution

Added `export` keyword to the function definition:

```typescript
// Line 367 - AFTER (FIXED)
export function evaluateTriggerLogic(packageName: string, timestamp: number): void {
  // ...
}
```

## Why This Happened

The function was originally designed to be called internally within osTriggerBrain.ts. When we moved to the three-runtime architecture:

1. System Brain JS (Headless) receives FOREGROUND_CHANGED events
2. System Brain needs to evaluate OS Trigger Brain logic
3. evaluateTriggerLogic needs to be exported for System Brain to call it

But we forgot to add the `export` keyword when refactoring.

## Files Modified

- `src/os/osTriggerBrain.ts` - Added `export` to evaluateTriggerLogic function

## Expected Behavior After Fix

### FOREGROUND_CHANGED Event Flow

```
1. User opens Instagram
   ↓
   ForegroundDetectionService emits FOREGROUND_CHANGED
   ↓
   System Brain receives event
   ↓
   handleForegroundChange() called
   ↓
   Updates lastMeaningfulApp = "com.instagram.android"
   ↓
   Calls evaluateTriggerLogic() ✅ (now works!)
   ↓
   OS Trigger Brain evaluates priority chain
   ↓
   Decides to launch SystemSurface
```

### Expected Logs

```
[System Brain] Event type: FOREGROUND_CHANGED
[System Brain] Foreground changed to: com.instagram.android
[System Brain] Foreground app updated: {"current": "com.instagram.android"}
[OS Trigger Brain] ======================================
[OS Trigger Brain] Evaluating nested trigger logic for: com.instagram.android
[OS Trigger Brain] Priority Chain evaluation...
```

No more TypeError!

## Testing

The Metro bundler should automatically pick up this change since it's a TypeScript file. Just reload the app and test:

1. Open Instagram
2. Should see FOREGROUND_CHANGED event logs
3. Should see OS Trigger Brain evaluation logs
4. No TypeError errors

## Related Fixes

This completes the FOREGROUND_CHANGED event delivery chain:

1. ✅ ForegroundDetectionService emits event (PREVIOUS FIX)
2. ✅ System Brain receives event (ALREADY WORKING)
3. ✅ System Brain updates lastMeaningfulApp (ALREADY WORKING)
4. ✅ System Brain calls evaluateTriggerLogic (THIS FIX)
5. ✅ OS Trigger Brain evaluates and launches SystemSurface (ALREADY WORKING)

All pieces now connected!
