# MainActivity Launch Order Bug - Fix Summary

## Problem

When a monitored app (e.g., xhs) was detected:
1. Native layer emitted `onForegroundAppChanged` event
2. **MainActivity's React context received and processed the event**
3. MainActivity rendered Main App UI (visible for 3-8 seconds)
4. Then SystemSurfaceActivity launched
5. Intervention flow finally started

**Root cause:** Both MainActivity AND SystemSurfaceActivity subscribed to `onForegroundAppChanged` events. When native emitted an event, it woke MainActivity's React context, causing it to render before SystemSurfaceActivity launched.

## Solution

**Conditionally subscribe to events based on RuntimeContext.**

Only `SYSTEM_SURFACE` context subscribes to foreground change events.
`MAIN_APP` context (MainActivity) never subscribes.

## Implementation

### Changed File: `app/App.tsx`

**Key Changes:**

1. **Moved event subscription from `App` component to `AppContent` component**
   - `AppContent` has access to `runtime` context via `useRuntimeContext()`
   - This allows conditional subscription based on context

2. **Added RuntimeContext check before subscribing**
   - `if (runtime === 'SYSTEM_SURFACE')` → Subscribe ✅
   - `else` (MAIN_APP context) → Don't subscribe ❌

3. **Removed event subscription from `App` component's monitoring useEffect**
   - `App` component only starts the monitoring service
   - Event subscription is now handled separately in `AppContent`

### Code Changes

**Before:**
```typescript
// In App component (line 214-225)
// Listen for foreground app changes
const emitter = new NativeEventEmitter(AppMonitorModule);
const subscription = emitter.addListener(
  'onForegroundAppChanged',  // ⚠️ BOTH contexts subscribe!
  (event: { packageName: string; timestamp: number }) => {
    handleForegroundAppChange({
      packageName: event.packageName,
      timestamp: event.timestamp,
    });
  }
);
```

**After:**
```typescript
// In AppContent component (new useEffect)
useEffect(() => {
  if (Platform.OS !== 'android' || !AppMonitorModule) {
    return;
  }

  // Only subscribe if we're in SYSTEM_SURFACE context
  if (runtime === 'SYSTEM_SURFACE') {
    const emitter = new NativeEventEmitter(AppMonitorModule);
    const subscription = emitter.addListener(
      'onForegroundAppChanged',
      (event: { packageName: string; timestamp: number }) => {
        handleForegroundAppChange({
          packageName: event.packageName,
          timestamp: event.timestamp,
        });
      }
    );

    if (__DEV__) {
      console.log('[OS] ✅ Subscribed to foreground app changes (SYSTEM_SURFACE context)');
    }

    return () => {
      subscription.remove();
    };
  } else {
    if (__DEV__) {
      console.log('[OS] ⏭️ Skipping foreground app change subscription (MAIN_APP context)');
    }
  }
}, [runtime]);
```

## Expected Behavior After Fix

### Opening xhs (monitored app):
- ✅ SystemSurfaceActivity launches **immediately** (no delay)
- ✅ MainActivity NEVER renders or processes events
- ✅ No "No dispatcher set" warnings
- ✅ No 3-8 second delay
- ✅ Intervention flow starts instantly

### Opening non-monitored app:
- ✅ No SystemSurfaceActivity launch
- ✅ MainActivity does NOT process event (not subscribed)
- ✅ No intervention

### User explicitly opens BreakLoop:
- ✅ MainActivity launches normally
- ✅ Main App UI appears as expected
- ✅ MainActivity does NOT subscribe to system events

## Verification in Logs

**MainActivity (MAIN_APP context):**
```
LOG [App] Rendering for runtime context: MAIN_APP
LOG [App] ⏭️ Skipping OS Trigger Brain connection (MAIN_APP context)
LOG [OS] ⏭️ Skipping foreground app change subscription (MAIN_APP context)
```

**SystemSurfaceActivity (SYSTEM_SURFACE context):**
```
LOG [RuntimeContext] Detected context: SYSTEM_SURFACE
LOG [App] Rendering for runtime context: SYSTEM_SURFACE
LOG [App] ✅ Connected OS Trigger Brain to SystemSession dispatcher (SYSTEM_SURFACE context)
LOG [OS] ✅ Subscribed to foreground app changes (SYSTEM_SURFACE context)
```

## Architecture Compliance

This fix ensures:
- ✅ Native detects foreground changes (mechanics preserved)
- ✅ Native emits events for ALL apps (detection preserved)
- ✅ Only SYSTEM_SURFACE context subscribes (isolation achieved)
- ✅ MainActivity NEVER processes system-level signals
- ✅ JavaScript decides WHAT to show and WHY (semantics)
- ✅ MainActivity only appears when user explicitly opens BreakLoop
- ✅ SystemSurfaceActivity is the ONLY consumer of foreground events
- ✅ No context leakage between MainActivity and SystemSurfaceActivity

## Testing

To verify the fix works:

1. Build and run:
   ```bash
   npx expo run:android
   ```

2. Open a monitored app (e.g., xhs)

3. Check logs:
   - Should see SystemSurfaceActivity launch immediately
   - Should NOT see MainActivity rendering
   - Should NOT see "No dispatcher set" warning
   - Intervention flow should start without delay

4. Explicitly open BreakLoop from launcher
   - MainActivity should work normally
   - Should see "Skipping foreground app change subscription (MAIN_APP context)"

## Files Modified

- `app/App.tsx` - Event subscription moved to AppContent with RuntimeContext check

## Files NOT Modified

- Native code (ForegroundDetectionService.kt) - Already correct, no changes needed
- All other files remain unchanged

## Date

January 5, 2026
