# Wake Suppression Fix - Summary

## Problem

After user set intention timer and returned to monitored app:
1. Native detected foreground app again
2. Native launched SystemSurfaceActivity
3. OS Trigger Brain saw valid timer → Suppressed intervention
4. SystemSurface stayed alive but rendered nothing
5. App appeared hung - user couldn't use Instagram

## Root Cause

Native lacked mechanism to suppress SystemSurface launch when JavaScript had granted app usage via intention timer.

## Solution: Wake Suppression Flag

Implemented a **mechanical suppression flag** that JavaScript sets and native reads.

### Key Principle

**Native has ZERO semantic knowledge** - it doesn't know about intention timers, it only knows: "Don't launch SystemSurface before this timestamp"

## Implementation

### JavaScript (Semantic Authority)

**File**: `app/screens/conscious_process/IntentionTimerScreen.tsx`

When user sets intention timer:
```typescript
// Set wake suppression flag (mechanical instruction)
AppMonitorModule.setSuppressSystemSurfaceUntil(
  interventionState.targetApp,
  expiresAt  // Timestamp: don't wake before this time
);
```

JavaScript makes semantic decision ("user wants 1-min timer"), then sets mechanical flag ("don't wake before X").

### Native (Mechanical Service)

**File**: `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`

Added suppression flag storage:
```kotlin
// Maps packageName -> suppressUntil timestamp
private val suppressWakeUntil = mutableMapOf<String, Long>()

fun isWakeSuppressed(packageName: String): Boolean {
    val suppressUntil = suppressWakeUntil[packageName] ?: return false
    val now = System.currentTimeMillis()
    
    if (now < suppressUntil) {
        return true  // Suppressed
    } else {
        suppressWakeUntil.remove(packageName)  // Auto-cleanup
        return false  // Expired
    }
}
```

Before launching SystemSurface:
```kotlin
private fun launchInterventionActivity(triggeringApp: String) {
    // Check wake suppression flag FIRST
    if (isWakeSuppressed(triggeringApp)) {
        Log.i(TAG, "⏭️ Skipping - wake suppressed by JavaScript")
        return
    }
    
    // ... rest of launch logic
}
```

### Bridge Method

**File**: `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`

```kotlin
@ReactMethod
fun setSuppressSystemSurfaceUntil(packageName: String, suppressUntil: Double) {
    val suppressUntilLong = suppressUntil.toLong()
    ForegroundDetectionService.setSuppressWakeUntil(packageName, suppressUntilLong)
}
```

## Semantic Ownership Preserved

### JavaScript
- ✅ Makes semantic decision ("user wants 1-min intention timer")
- ✅ Sets mechanical flag ("don't wake before timestamp X")
- ✅ Owns all intention timer logic

### Native
- ✅ Reads mechanical flag (timestamp)
- ✅ Suppresses wake if `now < suppressUntil`
- ❌ Does NOT know about intention timers
- ❌ Does NOT know WHY suppression exists
- ✅ Only knows: "Don't wake before this timestamp"

## Key Features

### App-Specific

Each app has independent suppression:
```kotlin
suppressWakeUntil["com.instagram.android"] = timestamp1
suppressWakeUntil["com.twitter.android"] = timestamp2
```

Instagram suppressed ≠ Twitter suppressed

### Automatic Expiration

When suppression expires:
- Native's `isWakeSuppressed()` returns `false`
- Automatically cleans up expired entry
- Next foreground event triggers normal flow
- No polling needed

### Clean Separation

- JavaScript: Semantic decisions
- Native: Mechanical actions
- No semantic knowledge in native layer
- No logic duplication

## Expected Behavior

1. User sets 1-min intention timer
2. JavaScript sets: `suppressUntil = now + 60s`
3. User returns to Instagram
4. Native detects Instagram foreground
5. Native checks: `now < suppressUntil`? **YES**
6. Native does NOT launch SystemSurface
7. User uses Instagram freely ✅
8. After 1 minute:
   - Suppression expires
   - Next foreground event (or heartbeat)
   - Native checks: `now < suppressUntil`? **NO**
   - Native launches SystemSurface
   - Intervention starts

## Files Modified

1. `app/screens/conscious_process/IntentionTimerScreen.tsx` - Set suppression flag
2. `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt` - Add bridge method
3. `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt` - Check suppression flag
4. `src/native-modules/AppMonitorModule.ts` - Add TypeScript interface
5. `app/App.tsx` - Removed JS periodic check (no longer needed)
6. `src/os/osTriggerBrain.ts` - Reverted wake call changes

## Success Criteria

- ✅ User can use Instagram after setting timer
- ✅ No SystemSurface hang
- ✅ No unnecessary SystemSurface launches
- ✅ Timer expires → Intervention triggers
- ✅ Native has ZERO semantic knowledge
- ✅ JavaScript retains full semantic authority
- ✅ Clean mechanical flag: "don't wake before X"
- ✅ Per-app suppression
- ✅ Automatic expiration cleanup

## Date
January 5, 2026
