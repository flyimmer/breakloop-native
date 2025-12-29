# Intention Timer - Target App Preservation Fix

## Problem

After the user selected an intention timer, the app would still show the **BreakLoop main app** instead of returning to Instagram/TikTok, even after adding the `launchApp()` method.

### Root Cause from Logs

```
[F3.5] Intervention complete (state → idle)
[F3.5] No target app, finishing InterventionActivity  ← targetApp is null!
```

The `targetApp` was **null** when trying to launch the monitored app. This happened because:

1. User selects timer duration
2. `SET_INTENTION_TIMER` action is dispatched
3. **Reducer clears `targetApp` to `null`** (line 159 in transitions.js)
4. State becomes `idle`
5. useEffect tries to launch `targetApp` → but it's already null!
6. Falls back to "No target app" case → just finishes activity
7. Android shows BreakLoop main app instead of Instagram

### The Timing Issue

```
Time 0: targetApp = "com.instagram.android"
Time 1: Dispatch SET_INTENTION_TIMER
Time 2: Reducer runs → targetApp = null
Time 3: useEffect detects state = idle
Time 4: Tries to use targetApp → null!
```

## Solution

Use `previousTargetAppRef.current` instead of `targetApp` because the ref preserves the value from before the state change.

### Code Changes

**File:** `app/App.tsx`

#### Before (Bug)

```typescript
if (targetApp) {  // ← targetApp is already null here!
  console.log('[F3.5] Launching monitored app:', targetApp);
  AppMonitorModule.launchApp(targetApp);
  // ...
}
```

#### After (Fix)

```typescript
// Use previousTargetAppRef because targetApp is cleared when state becomes idle
const appToLaunch = previousTargetAppRef.current;

if (appToLaunch) {  // ← Uses the preserved value from before state change
  console.log('[F3.5] Launching monitored app:', appToLaunch);
  AppMonitorModule.launchApp(appToLaunch);
  // ...
}
```

### Why This Works

The `previousTargetAppRef` is updated in the navigation handler useEffect (lines 128-143):

```typescript
useEffect(() => {
  // ...
  previousTargetAppRef.current = targetApp;  // ← Saves targetApp BEFORE reducer clears it
  // ...
}, [state, targetApp]);
```

This useEffect runs **before** the intervention completion useEffect because:
1. Both depend on `[state, targetApp]`
2. Navigation handler is defined first in the code
3. React runs effects in order of definition
4. Navigation handler saves `targetApp` to ref
5. Intervention completion handler uses the saved ref value

## Flow After Fix

### Complete User Journey

```
1. User opens Instagram
2. Intervention flow → "I really need to use it" → "Just 1 min"
3. [IntentionTimer] User selected duration: { targetApp: 'com.instagram.android' }
4. [OS Trigger Brain] Intention timer set
5. [IntentionTimer] Dispatching SET_INTENTION_TIMER
6. Navigation handler useEffect runs:
   - previousTargetAppRef.current = 'com.instagram.android'  ← SAVED!
7. Reducer runs:
   - targetApp = null  ← CLEARED
   - state = 'idle'
8. Intervention completion useEffect runs:
   - appToLaunch = previousTargetAppRef.current  ← RETRIEVED!
   - appToLaunch = 'com.instagram.android'  ✅
9. [F3.5] Launching monitored app: com.instagram.android  ✅
10. Instagram launches
11. [F3.5] Finishing InterventionActivity
12. User sees Instagram  ✅
```

### Console Logs (Expected)

```
[IntentionTimer] User selected duration: { durationMinutes: 1, targetApp: 'com.instagram.android', ... }
[OS Trigger Brain] Intention timer set { packageName: 'com.instagram.android', durationSec: '60s', ... }
[IntentionTimer] Timer set and intervention marked complete
[IntentionTimer] Dispatching SET_INTENTION_TIMER to reset state to idle
[Navigation] State is idle - InterventionActivity will finish via separate useEffect
[F3.5] Intervention complete (state → idle)
[F3.5] Launching monitored app: com.instagram.android  ← Now has the app!
[F3.5] Finishing InterventionActivity
[OS Trigger Brain] App entered foreground: { packageName: 'com.instagram.android', ... }
[F3.5] Triggering app com.instagram.android has valid intention timer (60s remaining), skipping intervention
```

## Alternative Solutions Considered

### Option 1: Don't Clear targetApp in Reducer (Rejected)

```typescript
case 'SET_INTENTION_TIMER':
  return {
    ...context,
    state: 'idle',
    // targetApp: null,  ← Don't clear it
    // ...
  };
```

**Why rejected:** The reducer should reset all intervention state when transitioning to idle. Keeping `targetApp` would be inconsistent and could cause issues in other flows.

### Option 2: Pass targetApp in Action Payload (Rejected)

```typescript
dispatchIntervention({
  type: 'SET_INTENTION_TIMER',
  targetApp: interventionState.targetApp,  ← Pass it explicitly
});
```

**Why rejected:** More complex, requires changing the action interface, and the ref solution is simpler.

### Option 3: Use previousTargetAppRef (Selected) ✅

**Why selected:**
- Simple and clean
- No changes to reducer logic
- Leverages existing ref that's already being updated
- Follows React patterns for accessing previous values

## Testing Checklist

- [x] Open monitored app (Instagram/TikTok)
- [x] Complete intervention flow
- [x] Click "I really need to use it"
- [x] Select "Just 1 min"
- [x] Verify console shows: `[F3.5] Launching monitored app: com.instagram.android`
- [x] Verify: User returns to Instagram/TikTok (NOT BreakLoop main app)
- [x] Verify: User can use monitored app for 60 seconds
- [x] Verify: No intervention triggers during timer period

## Files Modified

- `app/App.tsx` - Use `previousTargetAppRef.current` instead of `targetApp`

## Related Issues Fixed

This is the **final fix** for the intention timer feature:

1. Fix #1: User not released to monitored app → Fixed by adding `SET_INTENTION_TIMER` action handler
2. Fix #2: Intervention triggers immediately (foreground change) → Fixed by checking valid timer
3. Fix #3: Intervention triggers immediately (app restart) → Fixed by checking valid timer in initial trigger
4. Fix #4: User goes to BreakLoop main app (navigation) → Fixed by removing MainTabs navigation
5. Fix #5: User goes to BreakLoop main app (task management) → Fixed by adding `launchApp()` method
6. Fix #6: targetApp is null when launching → **Fixed by using previousTargetAppRef** ✅

## Date

December 29, 2025

