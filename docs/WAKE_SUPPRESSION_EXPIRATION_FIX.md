# Wake Suppression Expiration Detection - Summary

## Problem

After wake suppression flag was set:
1. User could use Instagram freely (no hang) ✅
2. After 1 minute, suppression expired
3. But NO intervention triggered ❌
4. User stayed in Instagram, no foreground event occurred
5. Native never detected expiration

## Root Cause

Native only checked suppression flag when foreground events occurred. If user stayed in same app continuously:
- Suppression expired
- No foreground event
- No check performed
- No intervention triggered

## Solution: Periodic Expiration Check

Added native periodic check (every 1 second) that:
1. Checks all suppression flags for expiration
2. Detects when suppression expires for FOREGROUND app
3. Launches SystemSurface automatically
4. JavaScript then decides what to show

## Implementation

### Added Expiration Check Function

**File**: `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`

```kotlin
private fun checkWakeSuppressionExpirations() {
    val now = System.currentTimeMillis()
    val currentForegroundApp = lastPackageName
    val expiredApps = mutableListOf<String>()
    
    // Find all expired suppressions
    for ((packageName, suppressUntil) in suppressWakeUntil) {
        if (now >= suppressUntil) {
            expiredApps.add(packageName)
        }
    }
    
    // Process expired suppressions
    for (packageName in expiredApps) {
        suppressWakeUntil.remove(packageName)
        
        // CRITICAL: Only launch if this is CURRENT foreground app
        val isForeground = packageName == currentForegroundApp
        
        if (isForeground) {
            Log.i(TAG, "🚨 Launching SystemSurface for expired suppression")
            launchInterventionActivity(packageName)
        }
    }
}
```

### Added to Periodic Timer

```kotlin
private val timerCheckRunnable = object : Runnable {
    override fun run() {
        checkWakeSuppressionExpirations()  // ✅ Added
        checkQuickTaskTimerExpirations()
        handler.postDelayed(this, 1000)
    }
}
```

## How It Works

### Case 1: User Switches Apps During Suppression

```
Instagram foreground (suppression active)
    ↓
User switches to Twitter
    ↓
Native detects Twitter foreground event
    ↓
Native checks suppression for Twitter
    ↓
No suppression → Normal intervention flow
```

### Case 2: User Stays in Same App (Suppression Expires)

```
Instagram foreground (suppression active)
    ↓
User continues using Instagram
    ↓
After 1 minute: Suppression expires
    ↓
Periodic check detects: now >= suppressUntil
    ↓
Checks: Instagram == foreground? YES
    ↓
Launches SystemSurface ✅
    ↓
JavaScript decides what to show
```

### Case 3: Suppression Expires While App in Background

```
Instagram had suppression (user switched away)
    ↓
Instagram now in background
    ↓
Suppression expires
    ↓
Periodic check detects expiration
    ↓
Checks: Instagram == foreground? NO
    ↓
Just cleans up, no launch
    ↓
Next time user opens Instagram → Normal flow
```

## Semantic Ownership Preserved

### Native (Mechanical)
- ✅ Checks suppression flags every 1 second
- ✅ Detects when `now >= suppressUntil`
- ✅ Launches SystemSurface for foreground app
- ❌ Does NOT know about intention timers
- ❌ Does NOT know WHY suppression existed

### JavaScript (Semantic)
- ✅ Sets suppression flag (semantic decision)
- ✅ Runs OS Trigger Brain in SystemSurface
- ✅ Decides what to show (intervention, quick task, etc.)
- ✅ Owns all semantic logic

## Complete Flow

1. **User completes intervention, sets 1-min intention timer**
   - JavaScript sets: `suppressUntil = now + 60s`

2. **User returns to Instagram**
   - Native detects foreground
   - Checks: `now < suppressUntil`? YES
   - Skips launch ✅

3. **User uses Instagram for 1 minute**
   - No foreground events (same app)
   - Periodic check runs every 1 second

4. **After 1 minute**
   - Periodic check detects: `now >= suppressUntil`
   - Checks: `Instagram == foreground`? YES
   - Launches SystemSurface ✅

5. **JavaScript runs in SystemSurface**
   - OS Trigger Brain evaluates
   - Decides to show intervention
   - User sees breathing screen ✅

## Files Modified

1. `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt` - Added expiration check

## Success Criteria

- ✅ User can use Instagram after setting timer (no hang)
- ✅ After 1 minute, intervention triggers automatically
- ✅ Works even if user stays in same app (no foreground events)
- ✅ Only triggers if app is foreground (not background)
- ✅ Native provides mechanical detection only
- ✅ JavaScript retains semantic authority
- ✅ Clean separation maintained

## Date
January 5, 2026
