# Intention Timer - Navigation Fix (Return to Monitored App)

## Problem

After the user selected an intention timer duration, the app would navigate to the **BreakLoop main app** (MainTabs) instead of returning to the **monitored app** (Instagram/TikTok).

### User-Reported Issues

1. **After selecting timer**: User switches to BreakLoop main app instead of Instagram/TikTok
2. **Clicking monitored app again**: Goes directly to BreakLoop main app even when `t_intention` timer is still valid

### Expected Behavior

```
User selects "Just 1 min"
    ↓
Timer set (60 seconds)
    ↓
Intervention completes (state → idle)
    ↓
InterventionActivity finishes
    ↓
User returns to Instagram/TikTok ✅ (NOT BreakLoop main app)
    ↓
User can use Instagram/TikTok for 60 seconds
```

### Actual Behavior

```
User selects "Just 1 min"
    ↓
Timer set (60 seconds)
    ↓
Intervention completes (state → idle)
    ↓
Navigation handler resets to MainTabs ❌
    ↓
User sees BreakLoop main app ❌ (WRONG!)
```

## Root Cause

The navigation handler in `App.tsx` was navigating to `MainTabs` when the intervention state became `idle`:

```typescript
} else if (state === 'idle') {
  navigationRef.current.reset({
    index: 0,
    routes: [{ name: 'MainTabs' }],  // ← BUG: Navigates to BreakLoop main app
  });
}
```

This navigation was **conflicting** with the InterventionActivity lifecycle:

1. User selects timer duration
2. Intervention state → `idle`
3. **Navigation handler** tries to navigate to MainTabs
4. **Activity finish handler** tries to finish InterventionActivity
5. **Race condition**: Navigation wins, shows MainTabs before activity finishes
6. User sees BreakLoop main app instead of monitored app

## Solution

**Remove the navigation to MainTabs** when state becomes `idle`. Let the InterventionActivity finish naturally and return to the monitored app.

### Code Changes

**File:** `app/App.tsx` (Lines 172-177)

#### Before (Bug)

```typescript
} else if (state === 'idle') {
  navigationRef.current.reset({
    index: 0,
    routes: [{ name: 'MainTabs' }],  // ← Navigates to BreakLoop main app
  });
}
```

#### After (Fix)

```typescript
} else if (state === 'idle') {
  // Don't navigate to MainTabs - just let InterventionActivity finish
  // The finishInterventionActivity() call in the other useEffect will handle closing
  // If we're in MainActivity (not InterventionActivity), this will do nothing
  if (__DEV__) {
    console.log('[Navigation] State is idle - InterventionActivity will finish via separate useEffect');
  }
}
```

### Why This Works

The InterventionActivity finish logic is handled by a **separate useEffect** (lines 93-105):

```typescript
useEffect(() => {
  if (Platform.OS !== 'android' || !AppMonitorModule) {
    return;
  }

  if (state === 'idle' && previousStateRef.current !== 'idle' && previousStateRef.current !== state) {
    if (__DEV__) {
      console.log('[F3.5] Intervention complete (state → idle), finishing InterventionActivity');
    }
    
    AppMonitorModule.finishInterventionActivity();  // ← Finishes activity, returns to monitored app
  }
}, [state]);
```

When `state` becomes `idle`:
1. **Activity finish handler** calls `finishInterventionActivity()`
2. InterventionActivity closes
3. Android returns to the previously opened app (Instagram/TikTok)
4. **No navigation** to MainTabs occurs

## Flow After Fix

### Complete User Journey

```
1. User opens Instagram
2. Breathing screen (5 seconds)
3. Root Cause screen → "I really need to use it"
4. Intention Timer screen → User selects "Just 1 min"
5. Timer set (60 seconds)
6. Intervention state → idle
7. [Navigation] State is idle - InterventionActivity will finish
8. [F3.5] Intervention complete, finishing InterventionActivity
9. InterventionActivity finishes
10. User returns to Instagram ✅
11. User can use Instagram for 60 seconds
12. Timer expires
13. Next Instagram entry → Intervention triggers
```

### Console Logs (Expected)

```
[IntentionTimer] User selected duration: { durationMinutes: 1, ... }
[OS Trigger Brain] Intention timer set { durationSec: '60s', ... }
[OS Trigger Brain] Intervention completed
[IntentionTimer] Dispatching SET_INTENTION_TIMER to reset state to idle
[Navigation] State is idle - InterventionActivity will finish via separate useEffect
[F3.5] Intervention complete (state → idle), finishing InterventionActivity
[AppMonitorModule] Finishing InterventionActivity
[OS Trigger Brain] App entered foreground: { packageName: 'com.instagram.android', ... }
[F3.5] Triggering app com.instagram.android has valid intention timer (60s remaining), skipping intervention
```

## Related Issues Fixed

This fix completes the intention timer implementation:

1. **Fix #1**: User not released to monitored app → Fixed by adding `SET_INTENTION_TIMER` action handler
2. **Fix #2**: Intervention triggers immediately (foreground change) → Fixed by checking valid timer in `handleForegroundAppChange`
3. **Fix #3**: Intervention triggers immediately (app restart) → Fixed by checking valid timer in initial trigger check
4. **Fix #4**: User goes to BreakLoop main app instead of monitored app → **Fixed by removing MainTabs navigation** ✅

## Architecture Notes

### Two Activity Contexts

The app has two activity contexts:

1. **MainActivity**: Main app UI (tabs, settings, community, etc.)
   - Launched when user opens BreakLoop from launcher
   - Shows MainTabs navigation

2. **InterventionActivity**: Intervention UI only (breathing, root cause, alternatives, etc.)
   - Launched when user opens monitored app (Instagram/TikTok)
   - Shows intervention flow
   - **Finishes and returns to monitored app** when complete

### Navigation Logic

- **During intervention** (state ≠ idle): Navigate between intervention screens
- **After intervention** (state = idle):
  - **In InterventionActivity**: Finish activity, return to monitored app
  - **In MainActivity**: Stay in MainActivity (no navigation needed)

The navigation handler should **not** try to navigate to MainTabs when in InterventionActivity. The activity finish handler takes care of closing the activity and returning to the monitored app.

## Testing Checklist

- [x] Open monitored app (Instagram/TikTok)
- [x] Complete intervention flow
- [x] Click "I really need to use it"
- [x] Select "Just 1 min"
- [x] Verify: User returns to **Instagram/TikTok** (NOT BreakLoop main app) ✅
- [x] Verify: User can use monitored app for 60 seconds
- [x] Verify: No intervention triggers during timer period
- [x] Wait 60 seconds
- [x] Re-open monitored app
- [x] Verify: Intervention triggers after timer expires

## Files Modified

- `app/App.tsx` - Removed MainTabs navigation when state becomes idle

## Date

December 29, 2025

