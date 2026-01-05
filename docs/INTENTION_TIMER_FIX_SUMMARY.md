# Intention Timer Expiration Fix - Summary

## Problem

After setting a 1-minute intention timer and returning to Instagram, no intervention flow triggered when the timer expired.

## Root Cause

**Semantic Ownership Violation**: Both native and JavaScript layers had partial logic for `t_intention`, creating race conditions and missed triggers.

1. **JavaScript periodic check never ran** - `checkForegroundIntentionExpiration()` existed but was never called
2. **Native had conflicting semantic logic** - `hasValidIntentionTimer()` blocked interventions, creating race conditions
3. **Architectural boundary violated** - Native made semantic decisions about `t_intention`

## Solution: Semantic Ownership Fix

Established clear ownership: **JavaScript owns ALL `t_intention` logic, native provides ONLY mechanical wake service.**

### Changes Made

#### 1. Removed Native Intention Logic

**File**: `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`

- ❌ Removed `hasValidIntentionTimer()` check from `launchInterventionActivity()`
- ❌ Removed `checkIntentionTimerExpirations()` function
- ❌ Removed intention timer periodic check from `timerCheckRunnable`

**Result**: Native is now a pure mechanical layer - it wakes SystemSurface when monitored app is detected, nothing more.

#### 2. Added Native Wake Method

**File**: `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`

```kotlin
@ReactMethod
fun launchSystemSurfaceForIntentionExpired(packageName: String) {
    val intent = Intent(reactApplicationContext, SystemSurfaceActivity::class.java).apply {
        putExtra(SystemSurfaceActivity.EXTRA_TRIGGERING_APP, packageName)
        putExtra(SystemSurfaceActivity.EXTRA_WAKE_REASON, SystemSurfaceActivity.WAKE_REASON_INTENTION_EXPIRED)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
    }
    reactApplicationContext.startActivity(intent)
}
```

**Purpose**: Provides mechanical wake service when JavaScript detects expiration.

#### 3. Updated TypeScript Interface

**File**: `src/native-modules/AppMonitorModule.ts`

Added method signature:
```typescript
launchSystemSurfaceForIntentionExpired(packageName: string): void;
```

#### 4. Activated JavaScript Periodic Check

**File**: `app/App.tsx`

Added `useEffect` hook in `AppContent` component:

```typescript
useEffect(() => {
  if (runtime !== 'MAIN_APP') return;

  const intervalId = setInterval(() => {
    checkForegroundIntentionExpiration(Date.now());
  }, 10000); // Check every 10 seconds

  if (__DEV__) {
    console.log('[App] ✅ Started intention timer periodic check (every 10s)');
  }

  return () => clearInterval(intervalId);
}, [runtime]);
```

**Why MAIN_APP context?** This runs in the background while the user uses the monitored app. SYSTEM_SURFACE context is already handling active intervention.

#### 5. Updated OS Trigger Brain

**File**: `src/os/osTriggerBrain.ts`

Modified `checkForegroundIntentionExpiration()` to call native wake method:

```typescript
if (isForeground) {
  console.log('[OS Trigger Brain] Intention timer expired for FOREGROUND app — launching SystemSurface');
  
  // Clear the expired timer
  intentionTimers.delete(packageName);
  
  // Request native to wake SystemSurface
  try {
    const { NativeModules, Platform } = require('react-native');
    if (Platform.OS === 'android' && NativeModules.AppMonitorModule) {
      NativeModules.AppMonitorModule.launchSystemSurfaceForIntentionExpired(packageName);
      console.log('[OS Trigger Brain] ✅ SystemSurface wake requested');
    }
  } catch (e) {
    console.error('[OS Trigger Brain] ❌ Failed to wake SystemSurface:', e);
  }
}
```

## Architecture: Semantic Ownership

### JavaScript (Semantic Authority)
- ✅ Stores `t_intention` in memory (Map)
- ✅ Checks expiration every 10 seconds
- ✅ Decides when to trigger intervention
- ✅ Requests native wake service

### Native (Mechanical Service)
- ✅ Provides wake service when requested
- ❌ NO checks for `t_intention`
- ❌ NO semantic decisions
- ✅ Pure mechanical layer

### Respects Boundary

Per `docs/NATIVE_JAVASCRIPT_BOUNDARY.md`:
- ✅ Native decides WHEN to wake (mechanics)
- ✅ JavaScript decides WHAT to show and WHY (semantics)
- ✅ No logic duplication across boundary

## Expected Behavior

1. User sets 1-minute intention timer
2. User uses Instagram normally
3. After 1 minute:
   - JavaScript periodic check detects expiration (within 10 seconds)
   - JavaScript requests native to wake SystemSurface
   - SystemSurface launches with `INTENTION_EXPIRED` reason
   - JavaScript triggers intervention flow
   - User sees breathing screen

## Testing

### Test Steps

1. Open monitored app (Instagram)
2. Complete breathing screen
3. Select "I really need to use it"
4. Choose 1 minute duration
5. Wait 1 minute
6. **Expected**: Intervention flow triggers within 10 seconds

### Verify Logs

Should see:
```
[App] ✅ Started intention timer periodic check (every 10s)
[OS Trigger Brain] Periodic timer check running
[OS Trigger Brain] Intention timer expired for FOREGROUND app — launching SystemSurface
[OS Trigger Brain] ✅ SystemSurface wake requested
[SystemSurfaceRoot] Wake reason: INTENTION_EXPIRED
[InterventionFlow] State changed: breathing
```

## Files Modified

1. `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt` - Removed intention logic
2. `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt` - Added wake method
3. `src/native-modules/AppMonitorModule.ts` - Added TypeScript interface
4. `app/App.tsx` - Added periodic check
5. `src/os/osTriggerBrain.ts` - Added SystemSurface wake call

## Success Criteria

- ✅ JavaScript periodic check runs every 10 seconds
- ✅ Logs show: `[App] ✅ Started intention timer periodic check`
- ✅ Expiration detected: `[OS Trigger Brain] Intention timer expired for FOREGROUND app`
- ✅ SystemSurface wakes: `[SystemSurfaceRoot] Wake reason: INTENTION_EXPIRED`
- ✅ Intervention triggers within 10 seconds of expiration
- ✅ Native has ZERO `t_intention` logic remaining

## Why This Works

### No Race Conditions
- Only ONE authority (JavaScript) checks `t_intention`
- Native cannot block or interfere
- Clear, predictable behavior

### Respects Boundary
- Native: Mechanics (wake service)
- JavaScript: Semantics (decisions)
- No duplication

### Reliable Detection
- Periodic check every 10 seconds ensures expiration is caught
- Even if user is actively using the app
- No dependency on native timing

## Date
January 5, 2026
